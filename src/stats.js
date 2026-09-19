// Statistical calculations for microservice latency and uptime percentiles

function calculatePercentile(samples, percentile) {
  if (!samples || samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function calculateStats(history) {
  if (!history || history.length === 0) {
    return {
      p50: 0,
      p95: 0,
      p99: 0,
      avg: 0,
      min: 0,
      max: 0,
      sampleCount: 0,
      uptimePercent: 100
    };
  }

  const latencies = history
    .filter(h => h.latencyMs !== null && h.latencyMs !== undefined && h.status !== 'DOWN')
    .map(h => h.latencyMs);

  const totalProbes = history.length;
  const successfulProbes = history.filter(h => h.status === 'HEALTHY' || h.status === 'DEGRADED').length;
  const uptimePercent = totalProbes > 0 ? parseFloat(((successfulProbes / totalProbes) * 100).toFixed(2)) : 100;

  if (latencies.length === 0) {
    return {
      p50: 0,
      p95: 0,
      p99: 0,
      avg: 0,
      min: 0,
      max: 0,
      sampleCount: 0,
      uptimePercent
    };
  }

  const sum = latencies.reduce((acc, val) => acc + val, 0);
  const avg = parseFloat((sum / latencies.length).toFixed(1));
  const min = Math.min(...latencies);
  const max = Math.max(...latencies);

  return {
    p50: calculatePercentile(latencies, 50),
    p95: calculatePercentile(latencies, 95),
    p99: calculatePercentile(latencies, 99),
    avg,
    min,
    max,
    sampleCount: latencies.length,
    uptimePercent
  };
}

module.exports = {
  calculatePercentile,
  calculateStats
};
