import java.util.ArrayDeque
import org.apache.jmeter.threads.JMeterContextService

int intProp(String name, int defaultValue) {
    String value = props.getProperty(name)
    return (value == null || value.trim().isEmpty()) ? defaultValue : (value.trim() as int)
}

void say(String message) {
    log.warn(message)
    OUT.println(new Date().format('HH:mm:ss') + ' ' + message)
}

Map loadState() {
    long runStart
    try {
        runStart = JMeterContextService.getTestStartTime()
    } catch (Throwable ignored) {
        runStart = 0L
    }
    Map st = (Map) props.get('capacityMonitorState')
    if (st == null || st.runStart != runStart) {
        synchronized (props) {
            st = (Map) props.get('capacityMonitorState')
            if (st == null || st.runStart != runStart) {
                st = [
                        runStart     : runStart,
                        windowSec    : intProp('error_window_sec', 60),
                        thresholdPct : intProp('error_threshold_pct', 10),
                        holdSec      : intProp('instability_hold_sec', 180),
                        minSamples   : intProp('error_min_samples', 50),
                        window       : new ArrayDeque(),
                        errors       : 0,
                        since        : 0L,
                        instabilityAt: null,
                        stopIssued   : false
                ]
                props.put('capacityMonitorState', st)
            }
        }
    }
    return st
}

void evaluateWindow(Map st, long now) {
    ArrayDeque window = (ArrayDeque) st.window
    long cutoff = now - st.windowSec * 1000L

    while (!window.isEmpty() && ((long[]) window.peekFirst())[0] < cutoff) {
        if (((long[]) window.removeFirst())[1] == 1L) {
            st.errors = st.errors - 1
        }
    }

    if (st.since == 0L || now - st.since < st.windowSec * 1000L || window.size() < st.minSamples) {
        return
    }

    double errorPct = st.errors * 100.0d / window.size()
    if (errorPct >= st.thresholdPct) {
        if (st.instabilityAt == null) {
            st.instabilityAt = now
            say(String.format('Capacity instability detected: %.2f%% errors in the rolling %ds window; threshold is %d%%',
                    errorPct, st.windowSec, st.thresholdPct))
        }
    } else if (st.instabilityAt != null) {
        st.instabilityAt = null
        say(String.format('Error rate recovered to %.2f%%; instability timer reset', errorPct))
    }
}

void checkStop(Map st, long now) {
    boolean stop = false
    synchronized (st) {
        Long at = (Long) st.instabilityAt
        if (!st.stopIssued && at != null && now - at >= st.holdSec * 1000L) {
            st.stopIssued = true
            stop = true
        }
    }
    if (stop) {
        say("Instability persisted for ${st.holdSec}s observation period. Stopping load generator.")
        ctx.getEngine().stopTest(false)
    }
}

final String mode = (Parameters ?: '').trim()

if (mode == 'pause') {
    if (vars.get('iterationFailed') == 'true') {
        vars.remove('iterationFailed')
        return intProp('failed_iteration_pause_ms', 3500)
    }
    return 0
}

if (!Boolean.parseBoolean(props.getProperty('capacity_monitor_enabled') ?: 'true')) {
    return mode == 'poll' ? 1000L : 0
}

final long now = System.currentTimeMillis()
final Map st = loadState()

if (mode == 'record') {
    boolean failed = !sampleResult.isSuccessful()
    synchronized (st) {
        if (st.since == 0L) {
            st.since = now
        }
        ((ArrayDeque) st.window).addLast([now, failed ? 1L : 0L] as long[])
        if (failed) {
            st.errors = st.errors + 1
        }
        evaluateWindow(st, now)
    }
    if (failed) {
        // решта ітерації скасовується (Start Next Thread Loop), пауза виконається перед наступною
        vars.put('iterationFailed', 'true')
    }
    checkStop(st, now)
    return 0
}

if (mode == 'poll') {
    synchronized (st) {
        evaluateWindow(st, now)
    }
    checkStop(st, now)
    return 1000L
}

log.warn('capacity_instability_guard.groovy: unknown mode "{}"', mode)
return 0
