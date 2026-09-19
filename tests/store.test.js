// Unit tests for store.js
const assert = require('assert');
const store = require('../src/store');

function runStoreTests() {
  console.log('Testing store registration & CRUD...');
  const newService = store.register({
    name: 'Test Payment Service',
    url: 'https://example.com/health',
    intervalMs: 5000,
    timeoutMs: 2000
  });

  assert.ok(newService.id, 'Service should have generated ID');
  assert.strictEqual(newService.name, 'Test Payment Service');
  assert.strictEqual(newService.status, 'PENDING');

  const retrieved = store.get(newService.id);
  assert.strictEqual(retrieved.id, newService.id);

  console.log('Testing probe recording & history ring buffer...');
  store.recordProbe(newService.id, {
    status: 'HEALTHY',
    statusCode: 200,
    latencyMs: 42
  });

  const updated = store.get(newService.id);
  assert.strictEqual(updated.status, 'HEALTHY');
  assert.strictEqual(updated.lastLatencyMs, 42);
  assert.strictEqual(updated.history.length, 1);
  assert.strictEqual(updated.uptimePercent, 100);

  // Clean up
  store.delete(newService.id);
  assert.strictEqual(store.get(newService.id), undefined);

  console.log('✅ store.test.js PASSED');
}

module.exports = runStoreTests;
