package simulations;

import static assertions.AssertionsMap.ASSERT_MAPPING;
import static config.BaseHelpers.*;
import static io.gatling.javaapi.core.CoreDsl.*;

import config.CapacityInstabilityMonitor;
import config.GraphiteMetricsExporter;
import io.gatling.javaapi.core.Assertion;
import io.gatling.javaapi.core.ClosedInjectionStep;
import io.gatling.javaapi.core.PopulationBuilder;
import io.gatling.javaapi.core.ScenarioBuilder;
import io.gatling.javaapi.core.Simulation;
import scenarios.UserFlow;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Capacity test, CLOSED model.
 *
 * The number of concurrent users grows linearly from CLOSED_START_USERS to CLOSED_USERS
 * over RAMP_UP_PERIOD seconds (stage 1: a fast ramp-up to find the knee). Then, if
 * RAMP2_USERS > CLOSED_USERS and RAMP2_PERIOD > 0, stage 2 follows: a slow ramp-up from
 * CLOSED_USERS to RAMP2_USERS over RAMP2_PERIOD seconds (a fine step in N for pinpointing
 * the instability point). As soon as a user finishes the scenario, Gatling starts a new one,
 * so the system always has exactly N users. If TEST_HOLD_SEC > 0, the final peak N is held for
 * another TEST_HOLD_SEC seconds; the default is 0 (ramp-up only).
 */
public class PerfTestSimulation extends Simulation {

    /** Number of users currently running the scenario (a sanity check: should match the profile). */
    private static final AtomicInteger ACTIVE_USERS = new AtomicInteger();

    /** Test start time (ms), set in before(). */
    private static volatile long startMillis = 0;

    private static final ScheduledExecutorService metricsScheduler =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "gatling-metrics-reporter");
                t.setDaemon(true);
                return t;
            });

    {
        startActiveUsersReporter();

        setUp(populations())
                .protocols(HTTP_PROTOCOL)
                .maxDuration(Duration.ofSeconds(TEST_DURATION_SEC + 300))
                .assertions(assertions());
    }

    @Override
    public void before() {
        CapacityInstabilityMonitor.reset();
        startMillis = System.currentTimeMillis();
    }

    @Override
    public void after() {
        metricsScheduler.shutdownNow();
        GraphiteMetricsExporter.recordActiveUsers(SIMULATION_NAME, 0);
        GraphiteMetricsExporter.close();
    }

    private void startActiveUsersReporter() {
        metricsScheduler.scheduleAtFixedRate(() -> {
            try {
                GraphiteMetricsExporter.recordActiveUsers(SIMULATION_NAME, activeUsers());
            } catch (Exception ignored) {
            }
        }, 0, 1, TimeUnit.SECONDS);
    }

    /**
     * Actual number of active users for Graphite (a counter of sessions in progress).
     * Returns 0 after the monitor stops the test or the profile ends.
     */
    private static int activeUsers() {
        if (startMillis == 0) {
            return 0;
        }
        if (CapacityInstabilityMonitor.isEnabled() && CapacityInstabilityMonitor.shouldStopLoadGenerator()) {
            return 0;
        }
        return Math.max(0, ACTIVE_USERS.get());
    }

    /**
     * User scenario + a pause after each iteration (including a failed one).
     */
    private static ScenarioBuilder journey() {
        return scenario("E-commerce End-to-End Journey")
                .exec(session -> {
                    ACTIVE_USERS.incrementAndGet();
                    return session;
                })
                .exec(UserFlow.userJourney(CHAIRS_PERCENTAGE, CART_PERCENTAGE))
                .doIf(session -> session.contains(UserFlow.ITERATION_FAILED) && FAILED_ITERATION_PAUSE_MS > 0)
                        .then(pause(Duration.ofMillis(FAILED_ITERATION_PAUSE_MS)))
                .exec(session -> {
                    ACTIVE_USERS.decrementAndGet();
                    return session;
                });
    }

    private PopulationBuilder injection() {
        if (HAS_STAGE2 && RAMP2_USERS <= CLOSED_USERS) {
            throw new IllegalArgumentException("RAMP2_USERS (" + RAMP2_USERS
                    + ") must be greater than CLOSED_USERS (" + CLOSED_USERS + ")");
        }

        List<ClosedInjectionStep> steps = new ArrayList<>();
        steps.add(rampConcurrentUsers(CLOSED_START_USERS).to(CLOSED_USERS).during(Duration.ofSeconds(RAMP_UP_PERIOD)));
        if (HAS_STAGE2) {
            steps.add(rampConcurrentUsers(CLOSED_USERS).to(RAMP2_USERS).during(Duration.ofSeconds(RAMP2_SEC)));
        }
        if (CAPACITY_HOLD_SEC > 0) {
            steps.add(constantConcurrentUsers(PEAK_USERS).during(Duration.ofSeconds(CAPACITY_HOLD_SEC)));
        }
        return journey().injectClosed(steps);
    }

    private PopulationBuilder[] populations() {
        if (!CapacityInstabilityMonitor.isEnabled()) {
            return new PopulationBuilder[]{injection()};
        }

        PopulationBuilder monitor = scenario("Capacity Instability Monitor")
                .during(Duration.ofSeconds(TEST_DURATION_SEC)).on(
                        pause(Duration.ofSeconds(1)),
                        exec(stopLoadGeneratorIf(
                                "Capacity instability confirmed by CapacityInstabilityMonitor",
                                session -> CapacityInstabilityMonitor.shouldStopLoadGenerator()
                        ))
                )
                .injectOpen(atOnceUsers(1));

        return new PopulationBuilder[]{injection(), monitor};
    }

    private Assertion[] assertions() {
        List<Assertion> selectedAssertions = ASSERT_MAPPING.get(ASSERTION_TYPE);
        if (selectedAssertions == null) {
            throw new IllegalArgumentException(
                    "Unsupported ASSERTION_TYPE '" + ASSERTION_TYPE + "'. Supported values: " + ASSERT_MAPPING.keySet()
            );
        }
        return selectedAssertions.toArray(new Assertion[0]);
    }
}
