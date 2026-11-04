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
                        stopEnabled  : Boolean.parseBoolean(props.getProperty('capacity_stop_enabled') ?: 'false'),
                        window       : new ArrayDeque(),
                        errors       : 0,
                        since        : 0L,
                        instabilityAt: null,
                        stopIssued   : false,
                        heartbeatSec : intProp('heartbeat_sec', 900),
                        lastBeat     : 0L,
                        episodes     : 0,
                        unstableMs   : 0L,
                        maxEpisodeMs : 0L
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
            st.episodes = st.episodes + 1
            say(String.format('Capacity instability detected: %.2f%% errors in the rolling %ds window; threshold is %d%%',
                    errorPct, st.windowSec, st.thresholdPct))
        }
    } else if (st.instabilityAt != null) {
        long episodeMs = now - ((Long) st.instabilityAt).longValue()
        st.unstableMs = st.unstableMs + episodeMs
        st.maxEpisodeMs = Math.max((long) st.maxEpisodeMs, episodeMs)
        st.instabilityAt = null
        if (!st.stopEnabled) {
            st.stopIssued = false
        }
        say(String.format('Error rate recovered to %.2f%% after %d s of instability (episode #%d); instability timer reset',
                errorPct, (long) (episodeMs / 1000L), st.episodes))
    }
}

String heartbeatLine(Map st, long now) {
    if (st.heartbeatSec <= 0) {
        return null
    }
    if (st.lastBeat == 0L) {
        st.lastBeat = now
        return null
    }
    if (now - st.lastBeat < st.heartbeatSec * 1000L) {
        return null
    }
    st.lastBeat = now
    ArrayDeque window = (ArrayDeque) st.window
    int n = window.size()
    double errorPct = n > 0 ? st.errors * 100.0d / n : 0.0d
    long unstable = st.unstableMs
    if (st.instabilityAt != null) {
        unstable += now - ((Long) st.instabilityAt).longValue()
    }
    return String.format('Soak heartbeat: rolling %ds window = %d steps, %.2f%% errors; instability episodes: %d, ' +
            'total unstable time: %d s, longest finished episode: %d s%s',
            st.windowSec, n, errorPct, st.episodes, (long) (unstable / 1000L), (long) (st.maxEpisodeMs / 1000L),
            st.instabilityAt != null ? ' [UNSTABLE NOW]' : '')
}

void checkStop(Map st, long now) {
    boolean stop = false
    boolean observeOnly = false
    synchronized (st) {
        Long at = (Long) st.instabilityAt
        if (!st.stopIssued && at != null && now - at >= st.holdSec * 1000L) {
            st.stopIssued = true
            stop = st.stopEnabled
            observeOnly = !st.stopEnabled
        }
    }
    if (observeOnly) {
        say("Instability persisted for ${st.holdSec}s, but capacity_stop_enabled=false: test continues (observe-only mode). " +
                "This run is NOT valid for steady-state analysis; check the instability episodes and the trend report.")
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
        vars.put('iterationFailed', 'true')
    }
    checkStop(st, now)
    return 0
}

if (mode == 'poll') {
    String beat = null
    synchronized (st) {
        evaluateWindow(st, now)
        beat = heartbeatLine(st, now)
    }
    if (beat != null) {
        say(beat)
    }
    checkStop(st, now)
    return 1000L
}

log.warn('capacity_instability_guard.groovy: unknown mode "{}"', mode)
return 0
