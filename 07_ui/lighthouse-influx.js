// Sends Lighthouse user-flow results to InfluxDB v2 (line protocol over HTTP).
// Requires Node 18+ (built-in fetch). No extra npm packages.
//
// Env variables:
//   INFLUX_URL    default http://localhost:8086
//   INFLUX_ORG    organization name or ID
//   INFLUX_BUCKET default lighthouse (create it in InfluxDB first)
//   INFLUX_TOKEN  token with write access to the bucket (do NOT hardcode it)
//   SCENARIO      optional tag, default "order-flow"
//   RUN_INDEX     optional, loop number (1..N), written as tag "loop"

const INFLUX_URL = (process.env.INFLUX_URL || 'http://localhost:8086').replace(/\/$/, '');
const INFLUX_ORG = process.env.INFLUX_ORG || '';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'lighthouse';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || '';
const SCENARIO = process.env.SCENARIO || 'order-flow';
const RUN_INDEX = process.env.RUN_INDEX || ''; // set by run_lighthouse.ps1 (1..N)

// audit id -> InfluxDB field name (values are in ms, except cls and score)
const AUDIT_FIELDS = {
  'first-contentful-paint': 'fcp',
  'largest-contentful-paint': 'lcp',
  'speed-index': 'speed_index',
  'total-blocking-time': 'tbt',
  'cumulative-layout-shift': 'cls',
  'interactive': 'tti',
  'interaction-to-next-paint': 'inp',
};

const escapeTag = (value) => String(value).replace(/([ ,=])/g, '\\$1');

function stepToLine(step, runId, timestampNs) {
  const lhr = step.lhr;
  const fields = [];

  for (const [auditId, fieldName] of Object.entries(AUDIT_FIELDS)) {
    const value = lhr.audits?.[auditId]?.numericValue;
    if (typeof value === 'number' && Number.isFinite(value)) {
      fields.push(`${fieldName}=${value}`);
    }
  }

  const score = lhr.categories?.performance?.score;
  if (typeof score === 'number') {
    fields.push(`performance_score=${score * 100}`);
  }

  if (fields.length === 0) return null; // nothing to write for this step

  const tags = [
    `scenario=${escapeTag(SCENARIO)}`,
    `step=${escapeTag(step.name)}`,
    `mode=${escapeTag(lhr.gatherMode || 'unknown')}`,
    `run=${escapeTag(runId)}`,
  ];
  if (RUN_INDEX) tags.push(`loop=${escapeTag(RUN_INDEX)}`); // easy grouping of the N loops in Grafana

  const tagString = tags.join(',');

  return `lighthouse,${tagString} ${fields.join(',')} ${timestampNs}`;
}

async function pushToInfluxDB(flowResult) {
  if (!INFLUX_TOKEN || !INFLUX_ORG) {
    console.log('INFLUX_TOKEN / INFLUX_ORG are not set, skipping InfluxDB export');
    return;
  }

  const runId = new Date().toISOString();
  const baseNs = BigInt(Date.now()) * 1000000n;

  // +1 ms per step so points with the same tags/time never overwrite each other
  const lines = flowResult.steps
    .map((step, index) => stepToLine(step, runId, baseNs + BigInt(index) * 1000000n))
    .filter(Boolean);

  const url = `${INFLUX_URL}/api/v2/write?org=${encodeURIComponent(INFLUX_ORG)}`
    + `&bucket=${encodeURIComponent(INFLUX_BUCKET)}&precision=ns`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Token ${INFLUX_TOKEN}`,
      'Content-Type': 'text/plain; charset=utf-8',
    },
    body: lines.join('\n'),
  });

  if (!response.ok) {
    throw new Error(`InfluxDB write failed: ${response.status} ${await response.text()}`);
  }

  console.log(`Sent ${lines.length} Lighthouse steps to InfluxDB bucket "${INFLUX_BUCKET}"`);
}

module.exports = { pushToInfluxDB };
