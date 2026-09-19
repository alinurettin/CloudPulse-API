// Integration tests for CloudPulse-API endpoints
const assert = require('assert');
const http = require('http');
const Server = require('../src/server');

function makeRequest(port, path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runApiTests() {
  const testPort = 3999;
  const server = new Server(testPort);
  server.start();

  // Small pause to allow socket bind
  await new Promise(r => setTimeout(r, 400));

  try {
    console.log('Testing GET /api/health...');
    const health = await makeRequest(testPort, '/api/health');
    assert.strictEqual(health.statusCode, 200);
    const healthJson = JSON.parse(health.data);
    assert.strictEqual(healthJson.status, 'UP');
    assert.strictEqual(healthJson.engine, 'CloudPulse-API');

    console.log('Testing GET /api/services...');
    const servicesRes = await makeRequest(testPort, '/api/services');
    assert.strictEqual(servicesRes.statusCode, 200);
    const servicesJson = JSON.parse(servicesRes.data);
    assert.ok(servicesJson.success);
    assert.ok(servicesJson.services.length > 0);

    console.log('Testing POST /api/services (Registering dynamic endpoint)...');
    const createRes = await makeRequest(testPort, '/api/services', 'POST', {
      name: 'Integration Test Service',
      url: 'https://httpbin.org/status/200',
      intervalMs: 5000
    });
    assert.strictEqual(createRes.statusCode, 201);
    const createdJson = JSON.parse(createRes.data);
    assert.ok(createdJson.service.id);
    const testId = createdJson.service.id;

    console.log('Testing GET /metrics (Prometheus Exporter)...');
    const metricsRes = await makeRequest(testPort, '/metrics');
    assert.strictEqual(metricsRes.statusCode, 200);
    assert.ok(metricsRes.data.includes('cloudpulse_service_up'));
    assert.ok(metricsRes.data.includes('cloudpulse_latency_seconds'));

    console.log('Testing DELETE /api/services/:id...');
    const deleteRes = await makeRequest(testPort, `/api/services/${testId}`, 'DELETE');
    assert.strictEqual(deleteRes.statusCode, 200);

    console.log('✅ api.test.js PASSED');
  } finally {
    server.stop();
  }
}

module.exports = runApiTests;
