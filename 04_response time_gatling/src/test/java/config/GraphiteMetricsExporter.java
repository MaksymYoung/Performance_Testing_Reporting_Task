package config;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.logging.Level;
import java.util.logging.Logger;

public final class GraphiteMetricsExporter {
    private static final Logger LOGGER = Logger.getLogger(GraphiteMetricsExporter.class.getName());
    private static final int QUEUE_CAPACITY = 100_000;
    private static final String HOST = System.getProperty("GRAPHITE_HOST", "127.0.0.1");
    private static final int PORT = Integer.getInteger("GRAPHITE_PORT", 2003);
    private static final long WINDOW_MS = Long.getLong("GRAPHITE_WINDOW_MS", 1000L);
    private static final BlockingQueue<Sample> QUEUE = new ArrayBlockingQueue<>(QUEUE_CAPACITY);
    private static final BlockingQueue<UserSample> USER_QUEUE = new ArrayBlockingQueue<>(QUEUE_CAPACITY);
    private static final AtomicBoolean CLOSED = new AtomicBoolean();
    private static final AtomicLong DROPPED_SAMPLES = new AtomicLong();
    private static final int ROLLING_SAMPLES = Integer.getInteger("GRAPHITE_ROLLING_SAMPLES", 100);
    private static final long ROLLING_WINDOW_MS = Long.getLong("GRAPHITE_ROLLING_WINDOW_MS", 0L);
    private static final String ROLLING_SUFFIX = "_rolling";
    private static final String ROLLING_ALL = "ALL";
    private static final long STEP_WEIGHT_WINDOW_MS = Long.getLong("GRAPHITE_STEP_WEIGHT_WINDOW_MS", 60_000L);
    private static final Map<RollingKey, java.util.ArrayDeque<long[]>> ROLLING = new HashMap<>();
    private static final Thread WORKER = startWorker();

    private GraphiteMetricsExporter() {
    }

    public static void record(String simulation, String request, int statusCode, boolean successful, long responseTimeMs) {
        if (CLOSED.get()) {
            LOGGER.severe("Cannot publish Gatling metrics after the Graphite exporter has closed");
            return;
        }

        Sample sample = new Sample(
                sanitize(simulation),
                sanitize(request),
                String.valueOf(statusCode), 
                Math.max(0, responseTimeMs)
        );

        if (!QUEUE.offer(sample)) {
            long dropped = DROPPED_SAMPLES.incrementAndGet();
            if (dropped == 1 || dropped % 1000 == 0) {
                LOGGER.severe("Graphite metrics queue is full; dropped samples: " + dropped);
            }
        }
    }

    public static void recordActiveUsers(String simulation, int activeUsers) {
        if (CLOSED.get()) {
            return;
        }
        UserSample userSample = new UserSample(sanitize(simulation), activeUsers);
        USER_QUEUE.offer(userSample);
    }

    public static void close() {
        if (!CLOSED.compareAndSet(false, true)) {
            return;
        }

        try {
            WORKER.join(TimeUnit.SECONDS.toMillis(10));
            if (WORKER.isAlive()) {
                LOGGER.severe("Graphite exporter did not flush its queue before shutdown");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOGGER.log(Level.SEVERE, "Interrupted while flushing Gatling metrics to Graphite", e);
        }
    }

    private static Thread startWorker() {
        Thread thread = new Thread(GraphiteMetricsExporter::run, "gatling-graphite-exporter");
        thread.setDaemon(true);
        thread.start();
        return thread;
    }

    private static void run() {
        while (!CLOSED.get() || !QUEUE.isEmpty() || !USER_QUEUE.isEmpty()) {
            List<Sample> batch = new ArrayList<>();
            List<UserSample> userBatch = new ArrayList<>();
            try {
                Sample first = QUEUE.poll(1, TimeUnit.SECONDS);
                if (first != null) {
                    batch.add(first);
                    long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(WINDOW_MS);
                    while (true) {
                        long remaining = deadline - System.nanoTime();
                        if (remaining <= 0) {
                            break;
                        }
                        Sample sample = QUEUE.poll(remaining, TimeUnit.NANOSECONDS);
                        if (sample == null) {
                            break;
                        }
                        batch.add(sample);
                    }
                    QUEUE.drainTo(batch);
                }

                USER_QUEUE.drainTo(userBatch);

                if (!batch.isEmpty() || !userBatch.isEmpty()) {
                    send(batch, userBatch);
                }
            } catch (InterruptedException e) {
                if (!CLOSED.get()) {
                    LOGGER.log(Level.SEVERE, "Graphite exporter worker was interrupted", e);
                }
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    private static void send(List<Sample> batch, List<UserSample> userBatch) {
        Map<Series, List<Long>> timesBySeries = new HashMap<>();
        for (Sample sample : batch) {
            Series series = new Series(sample.simulation, sample.request, sample.status);
            timesBySeries.computeIfAbsent(series, ignored -> new ArrayList<>()).add(sample.responseTimeMs);
        }

        Map<String, Integer> latestUsers = new HashMap<>();
        for (UserSample us : userBatch) {
            latestUsers.put(us.simulation, us.activeUsers);
        }

        long nowMs = System.currentTimeMillis();
        long timestamp = nowMs / 1000;

        for (Sample sample : batch) {
            long[] item = {nowMs, sample.responseTimeMs};
            ROLLING.computeIfAbsent(new RollingKey(sample.simulation, sample.request),
                    ignored -> new java.util.ArrayDeque<>()).addLast(item);
            ROLLING.computeIfAbsent(new RollingKey(sample.simulation, ROLLING_ALL),
                    ignored -> new java.util.ArrayDeque<>()).addLast(item);
        }
        Map<RollingKey, List<Long>> rollingTimes = new HashMap<>();
        Map<RollingKey, Long> stepWeights = new HashMap<>();
        for (Map.Entry<RollingKey, java.util.ArrayDeque<long[]>> entry : ROLLING.entrySet()) {
            java.util.ArrayDeque<long[]> window = entry.getValue();
            while (window.size() > ROLLING_SAMPLES) {
                window.removeFirst();
            }
            while (ROLLING_WINDOW_MS > 0 && !window.isEmpty() && window.peekFirst()[0] < nowMs - ROLLING_WINDOW_MS) {
                window.removeFirst();
            }
            if (!window.isEmpty()) {
                List<Long> times = new ArrayList<>(window.size());
                for (long[] item : window) {
                    times.add(item[1]);
                }
                Collections.sort(times);
                rollingTimes.put(entry.getKey(), times);
                long weight = 0;
                for (long[] item : window) {
                    if (item[0] >= nowMs - STEP_WEIGHT_WINDOW_MS) {
                        weight++;
                    }
                }
                stepWeights.put(entry.getKey(), weight);
            }
        }

        Map<String, double[]> stepAverages = new HashMap<>();
        Map<String, Long> stepWeightSums = new HashMap<>();
        for (Map.Entry<RollingKey, List<Long>> entry : rollingTimes.entrySet()) {
            RollingKey key = entry.getKey();
            if (ROLLING_ALL.equals(key.request())) {
                continue;
            }
            long weight = stepWeights.getOrDefault(key, 0L);
            if (weight == 0) {
                continue;
            }
            double[] acc = stepAverages.computeIfAbsent(key.simulation(), ignored -> new double[2]);
            acc[0] += weight * percentile(entry.getValue(), 90);
            acc[1] += weight * percentile(entry.getValue(), 95);
            stepWeightSums.merge(key.simulation(), weight, Long::sum);
        }
        for (Map.Entry<String, double[]> entry : stepAverages.entrySet()) {
            long weightSum = stepWeightSums.get(entry.getKey());
            entry.getValue()[0] /= weightSum;
            entry.getValue()[1] /= weightSum;
        }

        for (int attempt = 1; attempt <= 3; attempt++) {
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(HOST, PORT), 1000);
                socket.setTcpNoDelay(true);
                try (BufferedWriter writer = new BufferedWriter(
                        new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8))) {

                    for (Map.Entry<Series, List<Long>> entry : timesBySeries.entrySet()) {
                        Series series = entry.getKey();
                        List<Long> times = entry.getValue();
                        Collections.sort(times);

                        long count = times.size();
                        long sum = 0;
                        for (long t : times) {
                            sum += t;
                        }
                        String prefix = "gatling." + series.simulation + "." + series.request + "." + series.status + ".";

                        line(writer, prefix + "count", count, timestamp);
                        line(writer, prefix + "response_time.mean", sum / count, timestamp);
                        line(writer, prefix + "response_time.min", times.get(0), timestamp);
                        line(writer, prefix + "response_time.max", times.get(times.size() - 1), timestamp);
                        line(writer, prefix + "response_time.p50", percentile(times, 50), timestamp);
                        line(writer, prefix + "response_time.p90", percentile(times, 90), timestamp);
                        line(writer, prefix + "response_time.p95", percentile(times, 95), timestamp);
                        line(writer, prefix + "response_time.p99", percentile(times, 99), timestamp);
                    }

                    // Ковзні серії: gatling.<sim>_rolling.<request|ALL>.all.response_time.<metric>
                    for (Map.Entry<RollingKey, List<Long>> entry : rollingTimes.entrySet()) {
                        List<Long> times = entry.getValue();
                        long sum = 0;
                        for (long t : times) {
                            sum += t;
                        }
                        RollingKey key = entry.getKey();
                        String prefix = "gatling." + key.simulation() + ROLLING_SUFFIX + "." + key.request() + ".all.";
                        line(writer, prefix + "response_time_mean", sum / times.size(), timestamp);
                        line(writer, prefix + "response_time_p50", percentile(times, 50), timestamp);
                        line(writer, prefix + "response_time_p90", percentile(times, 90), timestamp);
                        line(writer, prefix + "response_time_p95", percentile(times, 95), timestamp);
                        line(writer, prefix + "response_time_p99", percentile(times, 99), timestamp);
                        if (ROLLING_ALL.equals(key.request())) {
                            double[] avg = stepAverages.get(key.simulation());
                            if (avg != null) {
                                line(writer, prefix + "response_time_step_p90_avg", Math.round(avg[0]), timestamp);
                                line(writer, prefix + "response_time_step_p95_avg", Math.round(avg[1]), timestamp);
                            }
                        }
                    }

                    for (Map.Entry<String, Integer> entry : latestUsers.entrySet()) {
                        line(writer, "gatling." + entry.getKey() + ".users.active", entry.getValue(), timestamp);
                    }
                }
                return;
            } catch (IOException e) {
                if (attempt == 3) {
                    LOGGER.log(Level.SEVERE, "Unable to send Gatling metrics to " + HOST + ":" + PORT, e);
                } else {
                    try {
                        Thread.sleep(200L * attempt);
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        LOGGER.log(Level.SEVERE, "Interrupted while retrying Graphite metrics", interrupted);
                        return;
                    }
                }
            }
        }
    }

    private static void line(BufferedWriter writer, String path, long value, long timestamp) throws IOException {
        writer.write(path + " " + value + " " + timestamp);
        writer.newLine();
    }

    private static long percentile(List<Long> sorted, int p) {
        int index = (int) Math.ceil(p / 100.0 * sorted.size()) - 1;
        return sorted.get(Math.max(0, Math.min(index, sorted.size() - 1)));
    }

    private static String sanitize(String value) {
        String sanitized = value.replaceAll("[^A-Za-z0-9_-]", "_");
        if (sanitized.isEmpty()) {
            throw new IllegalArgumentException("Graphite metric path components must not be empty");
        }
        return sanitized;
    }

    private record Sample(String simulation, String request, String status, long responseTimeMs) {
    }

    private record UserSample(String simulation, int activeUsers) {
    }

    private record Series(String simulation, String request, String status) {
    }

    private record RollingKey(String simulation, String request) {
    }
}
