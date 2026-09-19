// Unit tests for stats.js
const assert = require('assert');
const { calculatePercentile, calculateStats } = require('../src/stats');

function runStatsTests() {
  console.log('Testing calculatePercentile...');
  const samples = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  assert.strictEqual(calculatePercentile(samples, 50), 50, 'p50 should be 50');
  assert.strictEqual(calculatePercentile(samples, 90), 90, 'p90 should be 90');
  assert.strictEqual(calculatePercentile(samples, 99), 100, 'p99 should be 100');
  assert.strictEqual(calculatePercentile([], 50), 0, 'Empty samples should return 0');

  console.log('Testing calculateStats with mixed history...');
  const history = [
    { status: 'HEALTHY', latencyMs: 50 },
    { status: 'HEALTHY', latencyMs: 60 },
    { status: 'DEGRADED', latencyMs: 150 },
    { status: 'DOWN', latencyMs: 0 }
  ];

  const stats = calculateStats(history);
  assert.strictEqual(stats.uptimePercent, 75, 'Uptime should be 75%');
  assert.strictEqual(stats.sampleCount, 3, 'Sample count should exclude DOWN latency');
  assert.ok(stats.p95 >= 60, 'p95 should be at least 60');
  assert.strictEqual(stats.min, 50, 'Min should be 50');
  assert.strictEqual(stats.max, 150, 'Max should be 150');

  console.log('✅ stats.test.js PASSED');
}

module.exports = runStatsTests;
