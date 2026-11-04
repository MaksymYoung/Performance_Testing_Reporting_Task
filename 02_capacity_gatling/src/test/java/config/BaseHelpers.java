package config;

import io.gatling.javaapi.http.HttpProtocolBuilder;

import static io.gatling.javaapi.http.HttpDsl.http;

public class BaseHelpers {

    private BaseHelpers() {
    }

    public static final String BASE_URL = System.getProperty("BASE_URL", "http://localhost");

    /** Simulation name used as the prefix of Graphite metrics. */
    public static final String SIMULATION_NAME = "PerfTestSimulation";

    /**
     * HTTP protocol configuration with realistic headers:
     * - Accept, Accept-Encoding, Accept-Language
     * - Upgrade-Insecure-Requests
     * - User-Agent
     */
    public static final HttpProtocolBuilder HTTP_PROTOCOL = http
            .baseUrl(BASE_URL)
            .acceptHeader("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
            .acceptEncodingHeader("gzip, deflate")
            .acceptLanguageHeader("en-US,en;q=0.5")
            .upgradeInsecureRequestsHeader("1")
            .userAgentHeader(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            );

    /**
     * Admin AJAX endpoint (e.g., "/wp-admin/admin-ajax.php").
     */
    public static final String ADMIN_AJAX = "/wp-admin/admin-ajax.php";
    public static final String CART_WIDGET_DISABLED = "0";
    public static final String CART_CONTAINER_DISABLED = "0";

    /**
     * Percentage of users adding chairs (default: 50).
     */
    public static final double CHAIRS_PERCENTAGE = Double.parseDouble(
            System.getProperty("CHAIRS_PERCENTAGE", "50"));

    /**
     * Percentage of users proceeding to cart (default: 30).
     */
    public static final double CART_PERCENTAGE = Double.parseDouble(
            System.getProperty("CART_PERCENTAGE", "30"));

    /** Think time center in milliseconds (default: 3500). */
    public static final int THINK_TIME_CENTER = Integer.parseInt(
            System.getProperty("think_time_center", "3500"));

    /** Think time deviation in milliseconds (default: 1500). */
    public static final int THINK_TIME_DEVIATION = Integer.parseInt(
            System.getProperty("think_time_deviation", "1500"));

    /**
     * Standard deviation for Gaussian think-time pauses as a percentage of THINK_TIME (default: 20).
     */
    public static final double THINK_TIME_STD_DEV_PERCENT = Double.parseDouble(
            System.getProperty("THINK_TIME_STD_DEV_PERCENT", "20"));

    /**
     * Number of virtual users (Open model) - reads from -Dramp_threads or -DOPEN_USERS.
     */
    public static final int OPEN_USERS = Integer.parseInt(
            System.getProperty("OPEN_USERS", System.getProperty("ramp_threads", "200")));

    /**
     * Number of concurrent users (Closed model).
     */
    public static final int CONCURRENT_USERS =
            Integer.parseInt(System.getProperty("CONCURRENT_USERS", System.getProperty("ramp_threads", "200")));

    /**
     * Ramp-up period in seconds - reads from -Dramp_sec (default: 2100 / 35 minutes).
     */
    public static final int RAMP_UP_PERIOD = Integer.parseInt(
            System.getProperty("RAMP_UP_PERIOD", System.getProperty("ramp_sec", "2100")));

    /**
     * Test hold period in seconds after ramp-up (default: 3600 / 1 hour).
     */
    public static final int TEST_HOLD_SEC = Integer.parseInt(
            System.getProperty("TEST_HOLD_SEC", System.getProperty("test_hold_sec", "3600")));

    // ---- Capacity test (closed model, PerfTestSimulation) ----

    /** Initial number of concurrent users of stage 1 (default: 1). */
    public static final int CLOSED_START_USERS = Integer.parseInt(
            System.getProperty("CLOSED_START_USERS", "1"));

    /** Number of concurrent users at the end of stage 1 (default: 200). */
    public static final int CLOSED_USERS = Integer.parseInt(
            System.getProperty("CLOSED_USERS", "200"));

    /**
     * Stage 2 (optional): target number of concurrent users of the slow ramp-up from CLOSED_USERS
     * (default: 0 = disabled).
     */
    public static final int RAMP2_USERS = Integer.parseInt(
            System.getProperty("RAMP2_USERS", "0"));

    /** Stage 2 (optional): ramp-up duration in seconds (default: 0 = disabled). */
    public static final int RAMP2_SEC = Integer.parseInt(
            System.getProperty("RAMP2_PERIOD", "0"));

    /** True when both RAMP2_USERS and RAMP2_SEC are set, i.e. stage 2 is enabled. */
    public static final boolean HAS_STAGE2 = RAMP2_USERS > 0 && RAMP2_SEC > 0;

    /**
     * Peak hold of the capacity test in seconds after the last ramp-up stage
     * (default: 0 = ramp-up only). Separate from TEST_HOLD_SEC, whose default is 3600.
     */
    public static final int CAPACITY_HOLD_SEC = Integer.parseInt(
            System.getProperty("TEST_HOLD_SEC", System.getProperty("test_hold_sec", "0")));

    /** Total duration of the capacity load profile in seconds (all stages + hold). */
    public static final long TEST_DURATION_SEC =
            (long) RAMP_UP_PERIOD + (HAS_STAGE2 ? RAMP2_SEC : 0) + CAPACITY_HOLD_SEC;

    /** Number of concurrent users at the peak (end of the last stage). */
    public static final int PEAK_USERS = HAS_STAGE2 ? RAMP2_USERS : CLOSED_USERS;

    /**
     * Pause in ms after a FAILED iteration only (default: 3500; 0 = disabled). Successful iterations
     * get no extra pause.
     */
    public static final int FAILED_ITERATION_PAUSE_MS = Integer.parseInt(
            System.getProperty("FAILED_ITERATION_PAUSE_MS", "3500"));

    /**
     * Programmatic step timeout in ms (default: 10000; 0 = disabled). A step slower than this is
     * counted as an error even if Gatling did not abort the request.
     */
    public static final long STEP_TIMEOUT_MS = Long.getLong("STEP_TIMEOUT_MS", 10_000L);

    /**
     * Load model: open or closed (default: open).
     */
    public static final String LOAD_MODEL = System.getProperty("LOAD_MODEL", "open");

    /**
     * Tables quantity in units (default: 1).
     */
    public static final int TABLES_QUANTITY = Integer.parseInt(
            System.getProperty("TABLES_QUANTITY", "1"));

    /**
     * Chairs quantity in units (default: 1).
     */
    public static final int CHAIRS_QUANTITY = Integer.parseInt(
            System.getProperty("CHAIRS_QUANTITY", "1"));

    /**
     * Minimum percentage of successful requests (default: 99.0).
     */
    public static final double SUCCESSFUL_REQUESTS_PERCENT = Double.parseDouble(
            System.getProperty("SUCCESSFUL_REQUESTS_PERCENT", "90.0"));

    /** Home page 95th percentile response time threshold in milliseconds (default: 3000). */
    public static final int HOME_PAGE_P95_RESPONSE_TIME_MS = Integer.parseInt(
            System.getProperty("HOME_PAGE_P95_RESPONSE_TIME_MS", "3000"));

    /** Category page 95th percentile response time threshold in milliseconds (default: 2500). */
    public static final int CATEGORY_P95_RESPONSE_TIME_MS = Integer.parseInt(
            System.getProperty("CATEGORY_P95_RESPONSE_TIME_MS", "2500"));

    /** Tables page 95th percentile response time threshold in milliseconds (default: 3000). */
    public static final int TABLES_P95_RESPONSE_TIME_MS = Integer.parseInt(
            System.getProperty("TABLES_P95_RESPONSE_TIME_MS", "3000"));

    /** Tables add-to-cart 95th percentile response time threshold in milliseconds (default: 4000). */
    public static final int TABLES_ADD_TO_CART_P95_RESPONSE_TIME_MS = Integer.parseInt(
            System.getProperty("TABLES_ADD_TO_CART_P95_RESPONSE_TIME_MS", "4000"));

    /** Chairs page 95th percentile response time threshold in milliseconds (default: 3000). */
    public static final int CHAIRS_P95_RESPONSE_TIME_MS = Integer.parseInt(
            System.getProperty("CHAIRS_P95_RESPONSE_TIME_MS", "3000"));

    /** Chairs add-to-cart 95th percentile response time threshold in milliseconds (default: 4000). */
    public static final int CHAIRS_ADD_TO_CART_P95_RESPONSE_TIME_MS = Integer.parseInt(
            System.getProperty("CHAIRS_ADD_TO_CART_P95_RESPONSE_TIME_MS", "4000"));

    /** Cart page 95th percentile response time threshold in milliseconds (default: 3000). */
    public static final int CART_P95_RESPONSE_TIME_MS = Integer.parseInt(
            System.getProperty("CART_P95_RESPONSE_TIME_MS", "3000"));

    /** Checkout page 95th percentile response time threshold in milliseconds (default: 4000). */
    public static final int CHECKOUT_P95_RESPONSE_TIME_MS = Integer.parseInt(
            System.getProperty("CHECKOUT_P95_RESPONSE_TIME_MS", "4000"));

    /** Choosing country 95th percentile response time threshold in milliseconds (default: 2000). */
    public static final int CHOOSING_COUNTRY_P95_RESPONSE_TIME_MS = Integer.parseInt(
            System.getProperty("CHOOSING_COUNTRY_P95_RESPONSE_TIME_MS", "2000"));

    /** Place order 95th percentile response time threshold in milliseconds (default: 4000). */
    public static final int PLACE_ORDER_P95_RESPONSE_TIME_MS = Integer.parseInt(
            System.getProperty("PLACE_ORDER_P95_RESPONSE_TIME_MS", "4000"));

    /** Assertion set name; also reads -Dassertion_type (default: smokeTest). */
    public static final String ASSERTION_TYPE = System.getProperty(
            "ASSERTION_TYPE", System.getProperty("assertion_type", "smokeTest")
    );
}
