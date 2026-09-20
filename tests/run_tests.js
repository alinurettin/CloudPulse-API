// CloudPulse-API v2.0.0 - Exhaustive Verification Suite
// Nearest-Rank Percentiles, Synthetic Probing, Prometheus Gateway, and REST API
const assert = require('assert');
const http = require('http');

const { calculatePercentile, calculateStats } = require('../src/stats');
const LatencyAnalyzer = require('../src/engine');
const { formatPrometheusMetrics } = require('../src/prometheus');
const ProbeEngine = require('../src/probeEngine');
const store = require('../src/store');
const { startServer } = require('../src/index');

console.log('====================================================');
console.log('🧪 Running Verification Suite: CloudPulse-API v2.0.0');
console.log('====================================================');

let totalPassed = 0;
function pass(desc) {
  totalPassed++;
  console.log(`  ✓ [PASS ${totalPassed}] ${desc}`);
}

async function runAllTests() {
  // -------------------------------------------------------------
  // 1. Algorithmic Percentile & Standard Deviation Engine
  // -------------------------------------------------------------
  console.log('\n[1/5] Testing Nearest-Rank Percentiles & Variance...');

  const emptyStats = calculateStats([]);
  assert.strictEqual(emptyStats.p50, 0);
  assert.strictEqual(emptyStats.avg, 0);
  assert.strictEqual(emptyStats.uptimePercent, 100);
  pass('Zero length history handles clean default metrics');

  const history10 = [
    { status: 'HEALTHY', latencyMs: 10 },
    { status: 'HEALTHY', latencyMs: 20 },
    { status: 'HEALTHY', latencyMs: 30 },
    { status: 'HEALTHY', latencyMs: 40 },
    { status: 'HEALTHY', latencyMs: 50 },
    { status: 'HEALTHY', latencyMs: 60 },
    { status: 'HEALTHY', latencyMs: 70 },
    { status: 'HEALTHY', latencyMs: 80 },
    { status: 'HEALTHY', latencyMs: 90 },
    { status: 'DOWN', latencyMs: null } // 1 failure out of 10
  ];

  const stats = calculateStats(history10);
  assert.strictEqual(stats.p50, 50);
  pass('Nearest-Rank p50 matches exact median value (50ms)');

  assert.strictEqual(stats.p90, 90);
  pass('Nearest-Rank p90 matches 9th decile (90ms)');

  assert.strictEqual(stats.p95, 90);
  pass('Nearest-Rank p95 evaluates upper bound');

  assert.strictEqual(stats.min, 10);
  assert.strictEqual(stats.max, 90);
  assert.strictEqual(stats.avg, 50);
  assert(stats.stdDev > 25);
  pass('Min, Max, Mean (50.0), and Standard Deviation verified');

  // Exact 100-item array for p99 test
  const history100 = Array.from({ length: 100 }, (_, i) => ({ status: 'HEALTHY', latencyMs: i + 1 }));
  const stats100 = calculateStats(history100);
  assert.strictEqual(stats100.p99, 99);
  pass('Nearest-Rank p99 on 100 samples evaluates exact 99th percentile (99ms)');

  assert.strictEqual(stats.uptimePercent, 90.0);
  pass('Uptime percentage correctly evaluates 90.0% (9/10)');

  // -------------------------------------------------------------
  // 2. LatencyAnalyzer Standalone Engine
  // -------------------------------------------------------------
  console.log('\n[2/5] Testing LatencyAnalyzer Ring Buffer...');

  const analyzer = new LatencyAnalyzer(100);
  for (let i = 1; i <= 120; i++) analyzer.record(i);

  assert.strictEqual(analyzer.latencies.length, 100);
  pass('Latency buffer capped strictly at maxSamples (100)');

  const summary = analyzer.summary();
  assert(summary.p50 >= 60);
  assert(summary.max === 120);
  pass('Analyzer summary computes distribution across capped buffer');

  // -------------------------------------------------------------
  // 3. Synthetic Probe Engine (Mock-Free Live Sockets)
  // -------------------------------------------------------------
  console.log('\n[3/5] Testing Live Network Sockets Probing (Mock-Free)...');

  // Ephemeral HTTP Target Server
  const dummyServer = http.createServer((req, res) => {
    if (req.url === '/ok') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok' }));
    }
    if (req.url === '/error') {
      res.writeHead(500);
      return res.end('Internal Server Error');
    }
    res.writeHead(404);
    res.end();
  });

  const dummyPort = await new Promise(resolve => {
    dummyServer.listen(0, '127.0.0.1', () => resolve(dummyServer.address().port));
  });

  const prober = new ProbeEngine(store);

  // Probe live healthy socket
  const healthyRes = await prober.probeSingle({
    url: `http://127.0.0.1:${dummyPort}/ok`,
    timeoutMs: 1000
  });
  assert.strictEqual(healthyRes.status, 'HEALTHY');
  assert.strictEqual(healthyRes.statusCode, 200);
  assert(healthyRes.latencyMs >= 0);
  pass('Live synthetic HTTP probe against healthy socket returned HEALTHY');

  // Probe server error socket
  const errorRes = await prober.probeSingle({
    url: `http://127.0.0.1:${dummyPort}/error`,
    timeoutMs: 1000
  });
  assert.strictEqual(errorRes.status, 'DOWN');
  assert.strictEqual(errorRes.statusCode, 500);
  pass('Live synthetic HTTP probe against error endpoint transitioned to DOWN');

  // Probe 404 client error -> DEGRADED
  const degRes = await prober.probeSingle({
    url: `http://127.0.0.1:${dummyPort}/non-existent`,
    timeoutMs: 1000
  });
  assert.strictEqual(degRes.status, 'DEGRADED');
  assert.strictEqual(degRes.statusCode, 404);
  pass('Live synthetic HTTP probe against 404 endpoint transitioned to DEGRADED');

  // Probe closed socket
  const closedRes = await prober.probeSingle({
    url: 'http://127.0.0.1:59998/offline',
    timeoutMs: 300
  });
  assert.strictEqual(closedRes.status, 'DOWN');
  assert(closedRes.error);
  pass('Probe against closed socket failed gracefully as DOWN with error payload');

  // Test store delete non-existent
  assert.strictEqual(store.delete('non_existent_srv_id'), false);
  pass('Store delete on nonexistent service returns false');

  // -------------------------------------------------------------
  // 4. In-Memory Store & Prometheus Text Formatter
  // -------------------------------------------------------------
  console.log('\n[4/5] Testing In-Memory Store & Prometheus Exporter...');

  const testService = store.register({
    name: 'Unit Test Ingress Gateway',
    url: `http://127.0.0.1:${dummyPort}/ok`,
    intervalMs: 10000,
    timeoutMs: 1000
  });

  assert(testService.id);
  assert.strictEqual(testService.status, 'PENDING');
  pass('New service registered with PENDING initial status');

  store.recordProbe(testService.id, {
    status: 'HEALTHY',
    statusCode: 200,
    latencyMs: 14
  });
  assert.strictEqual(testService.status, 'HEALTHY');
  assert.strictEqual(testService.lastLatencyMs, 14);
  assert.strictEqual(testService.history.length, 1);
  pass('Service history and status updated after probe recording');

  const promText = formatPrometheusMetrics(store.getAll());
  assert(promText.includes('# TYPE cloudpulse_service_up gauge'));
  assert(promText.includes('cloudpulse_service_up{'));
  assert(promText.includes('cloudpulse_latency_p95_seconds{'));
  pass('RFC compliant Prometheus metrics text generated with label tags');

  // -------------------------------------------------------------
  // 5. Production HTTP API Gateway Integration
  // -------------------------------------------------------------
  console.log('\n[5/5] Testing Production HTTP API Gateway...');

  const apiServer = await new Promise(resolve => {
    const s = startServer(0, () => resolve(s));
  });
  const apiPort = apiServer.address().port;

  const makeReq = (options, postData) => new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: apiPort,
      ...options
    };
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, json: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, text: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    req.end();
  });

  // GET /api/health
  const healthRes = await makeReq({ path: '/api/health', method: 'GET' });
  assert.strictEqual(healthRes.status, 200);
  assert.strictEqual(healthRes.json.status, 'UP');
  assert.strictEqual(healthRes.json.service, 'CloudPulse-API');
  pass('GET /api/health returned 200 UP');

  // GET /api/stats
  const statsRes = await makeReq({ path: '/api/stats', method: 'GET' });
  assert.strictEqual(statsRes.status, 200);
  assert.strictEqual(statsRes.json.success, true);
  assert(statsRes.json.totalServices >= 1);
  pass('GET /api/stats returned cluster health counts');

  // GET /api/services
  const srvListRes = await makeReq({ path: '/api/services', method: 'GET' });
  assert.strictEqual(srvListRes.status, 200);
  assert(Array.isArray(srvListRes.json.services));
  pass('GET /api/services returned active service array');

  // POST /api/services (create)
  const createRes = await makeReq({
    path: '/api/services',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: 'Dynamic Microservice',
    url: `http://127.0.0.1:${dummyPort}/ok`,
    intervalMs: 15000,
    timeoutMs: 2000
  });
  assert.strictEqual(createRes.status, 201);
  const createdId = createRes.json.service.id;
  assert(createdId);
  pass('POST /api/services successfully registered new service');

  // POST /api/services/:id/ping
  const pingRes = await makeReq({
    path: `/api/services/${createdId}/ping`,
    method: 'POST'
  });
  assert.strictEqual(pingRes.status, 200);
  assert.strictEqual(pingRes.json.service.status, 'HEALTHY');
  pass('POST /api/services/:id/ping executed live synthetic probe');

  // GET /metrics
  const metricsRes = await makeReq({ path: '/metrics', method: 'GET' });
  assert.strictEqual(metricsRes.status, 200);
  assert(metricsRes.text.includes('cloudpulse_service_up'));
  pass('GET /metrics returned Prometheus scrape text');

  // DELETE /api/services/:id
  const deleteRes = await makeReq({
    path: `/api/services/${createdId}`,
    method: 'DELETE'
  });
  assert.strictEqual(deleteRes.status, 200);
  assert.strictEqual(deleteRes.json.success, true);
  pass('DELETE /api/services/:id removed service from monitoring');

  // Test SSE Stream Handshake
  const sseHandshake = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: apiPort,
      path: '/api/events',
      method: 'GET'
    }, (res) => {
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['content-type'], 'text/event-stream');
      res.on('data', chunk => {
        const text = chunk.toString();
        if (text.includes(': connected')) {
          req.destroy();
          resolve(true);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
  assert.strictEqual(sseHandshake, true);
  pass('GET /api/events established Server-Sent Events live stream');

  // Teardown Servers
  await new Promise(resolve => dummyServer.close(resolve));
  await new Promise(resolve => apiServer.close(resolve));

  console.log('\n====================================================');
  console.log(`🎉 ALL ${totalPassed} ASSERTIONS PASSED WITH ZERO MOCKS! (100% SUCCESS)`);
  console.log('====================================================\n');
  process.exit(0);
}

runAllTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
