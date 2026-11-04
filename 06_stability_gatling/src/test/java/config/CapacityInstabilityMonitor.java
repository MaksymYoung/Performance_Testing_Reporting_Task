package config;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.logging.Logger;

/**
 * Monitor for sustained instability during a capacity test.
 *
 * Calculates the proportion of failed requests within a sliding window of ERROR_WINDOW_SEC. If this proportion is >= ERROR_THRESHOLD_PCT,
 * the onset of instability is recorded. If the instability persists for INSTABILITY_HOLD_SEC without
 * recovery, shouldStopLoadGenerator() returns true.
 */
public final class CapacityInstabilityMonitor {
    private static final Logger LOGGER = Logger.getLogger(CapacityInstabilityMonitor.class.getName());

    private static final int ERROR_WINDOW_SEC = intProperty("ERROR_WINDOW_SEC", 60);
    private static final double ERROR_THRESHOLD_PCT = intProperty("ERROR_THRESHOLD_PCT", 10);
    private static final int INSTABILITY_HOLD_SEC = intProperty("INSTABILITY_HOLD_SEC", 180);
    private static final int MIN_SAMPLES = intProperty("ERROR_MIN_SAMPLES", 50);

    private static final Deque<Event> WINDOW = new ArrayDeque<>();
    private static int errorsInWindow = 0;
    private static long monitoringSince = 0;
    private static Long instabilityAt = null;
    private static boolean stopTriggered = false;
    private static volatile boolean enabled =
            Boolean.parseBoolean(System.getProperty("CAPACITY_MONITOR_ENABLED", "true"));

    private CapacityInstabilityMonitor() {
    }

    public static synchronized void record(boolean isSuccessful) {
        long now = System.currentTimeMillis();
        if (monitoringSince == 0) {
            monitoringSince = now;
        }
        WINDOW.addLast(new Event(now, !isSuccessful));
        if (!isSuccessful) {
            errorsInWindow++;
        }
        evaluate(now);
    }

    public static synchronized boolean shouldStopLoadGenerator() {
        if (stopTriggered) {
            return true;
        }
        long now = System.currentTimeMillis();
        evaluate(now);

        if (instabilityAt != null && now - instabilityAt >= INSTABILITY_HOLD_SEC * 1000L) {
            stopTriggered = true;
            LOGGER.warning(String.format(
                    "Instability persisted for %ds observation period. Stopping load generator.",
                    INSTABILITY_HOLD_SEC));
            return true;
        }
        return false;
    }

    public static boolean isEnabled() {
        return enabled;
    }

    public static void setEnabled(boolean value) {
        enabled = value;
    }

    public static synchronized void reset() {
        WINDOW.clear();
        errorsInWindow = 0;
        monitoringSince = 0;
        instabilityAt = null;
        stopTriggered = false;
    }

    private static void evaluate(long now) {
        long cutoff = now - ERROR_WINDOW_SEC * 1000L;
        while (!WINDOW.isEmpty() && WINDOW.peekFirst().timestamp < cutoff) {
            if (WINDOW.removeFirst().error) {
                errorsInWindow--;
            }
        }

        if (monitoringSince == 0
                || now - monitoringSince < ERROR_WINDOW_SEC * 1000L
                || WINDOW.size() < MIN_SAMPLES) {
            return;
        }

        double errorPct = errorsInWindow * 100.0 / WINDOW.size();
        if (errorPct >= ERROR_THRESHOLD_PCT) {
            if (instabilityAt == null) {
                instabilityAt = now;
                LOGGER.warning(String.format(
                        "Capacity instability detected: %.2f%% errors in the rolling %ds window; threshold is %.0f%%",
                        errorPct, ERROR_WINDOW_SEC, ERROR_THRESHOLD_PCT));
            }
        } else if (instabilityAt != null) {
            instabilityAt = null;
            LOGGER.info(String.format("Error rate recovered to %.2f%%; instability timer reset", errorPct));
        }
    }

    private static int intProperty(String name, int defaultValue) {
        String value = System.getProperty(name, System.getProperty(name.toLowerCase(), String.valueOf(defaultValue)));
        return Integer.parseInt(value.trim());
    }

    private static final class Event {
        final long timestamp;
        final boolean error;

        Event(long timestamp, boolean error) {
            this.timestamp = timestamp;
            this.error = error;
        }
    }
}
