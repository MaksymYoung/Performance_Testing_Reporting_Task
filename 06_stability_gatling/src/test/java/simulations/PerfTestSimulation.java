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
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Backend response time test under STEADY load, CLOSED model.
 *
 * Profile: ramp-up from CLOSED_START_USERS to CLOSED_USERS over RAMP_UP_PERIOD seconds, then hold
 * exactly CLOSED_USERS concurrent users for TEST_HOLD_SEC seconds.
 * Typical response time test: saturation point 160 VU, target load 80% = 128 VU, hold 30 min (1800 s).
 * Stability test (run_gatling_stability.ps1): the same load, but a 4-hour hold (14400 s);
 * a "STABILITY CHECKPOINT" line is printed to the console every hour.
 * As soon as a user finishes the scenario, Gatling starts a new one, so the system always has
 * exactly N users.
 *
 * The measured window (steady state) is the TEST_HOLD_SEC after the ramp-up ends. The start and end
 * of the window are printed to the console ("STEADY STATE" lines); use them to select the range in Grafana.
 *
 * The instability monitor is DISABLED in run_gatling_response_time.ps1 (-DCAPACITY_MONITOR_ENABLED=false):
 * an early stop would break the measured window (30 minutes or 4 hours). In the code itself it is
 * enabled by default (as a safeguard).
 *
 * Parameters: -DCLOSED_USERS, -DCLOSED_START_USERS, -DRAMP_UP_PERIOD, -DTEST_HOLD_SEC,
 * -DASSERTION_TYPE (default responseTime), -DCAPACITY_MONITOR_ENABLED,
 * -DERROR_THRESHOLD_PCT, -DERROR_WINDOW_SEC, -DINSTABILITY_HOLD_SEC.
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
                .maxDuration(Duration.ofSeconds(TEST_DURATION_SEC + SHUTDOWN_GRACE_SEC))
                .assertions(assertions());
    }

    @Override
    public void before() {
        CapacityInstabilityMonitor.reset();
        startMillis = System.currentTimeMillis();
        long steadyFrom = startMillis + STEADY_RAMP_SEC * 1000L;
        long steadyTo = steadyFrom + STEADY_HOLD_SEC * 1000L;
        System.out.printf("STEADY STATE plan: ramp %d -> %d users in %d s, then hold %d users for %d s%n",
                CLOSED_START_USERS, CLOSED_USERS, STEADY_RAMP_SEC, CLOSED_USERS, STEADY_HOLD_SEC);
        System.out.printf("STEADY STATE window: %s - %s (local time)%n", clock(steadyFrom), clock(steadyTo));
    }

    private static String clock(long millis) {
        return DateTimeFormatter.ofPattern("HH:mm:ss")
                .withZone(ZoneId.systemDefault())
                .format(Instant.ofEpochMilli(millis));
    }

    @Override
    public void after() {
        metricsScheduler.shutdownNow();
        GraphiteMetricsExporter.recordActiveUsers(SIMULATION_NAME, 0);
        GraphiteMetricsExporter.close();
    }

    private void startActiveUsersReporter() {
        final AtomicBoolean steadyLogged = new AtomicBoolean();
        final AtomicLong tick = new AtomicLong();
        final AtomicLong lastHourLogged = new AtomicLong(0);
        metricsScheduler.scheduleAtFixedRate(() -> {
            try {
                int active = activeUsers();
                GraphiteMetricsExporter.recordActiveUsers(SIMULATION_NAME, active);

                if (startMillis == 0) {
                    return;
                }
                long elapsedMs = System.currentTimeMillis() - startMillis;
                if (elapsedMs >= STEADY_RAMP_SEC * 1000L && steadyLogged.compareAndSet(false, true)) {
                    System.out.printf("STEADY STATE started at %s, active users: %d (target %d)%n",
                            clock(System.currentTimeMillis()), active, CLOSED_USERS);
                }

                if (tick.incrementAndGet() % PROGRESS_LOG_INTERVAL_SEC == 0) {
                    System.out.printf("[%s] elapsed %d s, active users: %d (target %d)%n",
                            clock(System.currentTimeMillis()), elapsedMs / 1000, active, CLOSED_USERS);
                }

                long steadyElapsedMs = elapsedMs - STEADY_RAMP_SEC * 1000L;
                if (steadyElapsedMs >= 0) {
                    long hour = steadyElapsedMs / (STABILITY_CHECKPOINT_SEC * 1000L);
                    long prev = lastHourLogged.get();
                    if (hour > prev && lastHourLogged.compareAndSet(prev, hour)) {
                        System.out.printf("STABILITY CHECKPOINT: hour %d of %.1f at %s, active users: %d (target %d)%n",
                                hour, STEADY_HOLD_SEC / (double) STABILITY_CHECKPOINT_SEC,
                                clock(System.currentTimeMillis()), active, CLOSED_USERS);
                    }
                }
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
     * In the closed model Gatling immediately replaces a finished user with a new one, so without
     * a pause a user that hit an error (exitBlockOnFail) would exit instantly and be replaced by a new
     * one that hammers the server again with no think time. Failed sessions are marked by
     * UserFlow.page() (key ITERATION_FAILED, whose failure status is reset there), so the pause and
     * the counter decrement run for them as well.
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
        if (CLOSED_USERS <= 0 || STEADY_HOLD_SEC <= 0 || STEADY_RAMP_SEC <= 0) {
            throw new IllegalArgumentException("CLOSED_USERS, RAMP_UP_PERIOD and TEST_HOLD_SEC must be > 0");
        }
        if (CLOSED_START_USERS > CLOSED_USERS) {
            throw new IllegalArgumentException("CLOSED_START_USERS (" + CLOSED_START_USERS
                    + ") must not exceed CLOSED_USERS (" + CLOSED_USERS + ")");
        }

        List<ClosedInjectionStep> steps = new ArrayList<>();

        steps.add(rampConcurrentUsers(CLOSED_START_USERS).to(CLOSED_USERS).during(Duration.ofSeconds(STEADY_RAMP_SEC)));

        steps.add(constantConcurrentUsers(CLOSED_USERS).during(Duration.ofSeconds(STEADY_HOLD_SEC)));
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
        List<Assertion> selectedAssertions = ASSERT_MAPPING.get(STEADY_ASSERTION_TYPE);
        if (selectedAssertions == null) {
            throw new IllegalArgumentException(
                    "Unsupported ASSERTION_TYPE '" + STEADY_ASSERTION_TYPE + "'. Supported values: " + ASSERT_MAPPING.keySet()
            );
        }
        return selectedAssertions.toArray(new Assertion[0]);
    }
}
