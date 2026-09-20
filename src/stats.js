// CloudPulse-API v2.0.0 - Statistical Latency & SLA Percentile Engine

/**
 * Calculates exact Nearest-Rank percentile over sample array
 */
function calculatePercentile(samples, percentile) {
  if (!samples || samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(rank, sorted.length - 1))];
}

/**
 * Computes comprehensive statistical distribution metrics over probe history
 */
function calculateStats(history) {
  if (!history || history.length === 0) {
    return {
      p50: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      avg: 0,
      min: 0,
      max: 0,
      stdDev: 0,
      sampleCount: 0,
      uptimePercent: 100.0
    };
  }

  const latencies = history
    .filter(h => h.latencyMs !== null && h.latencyMs !== undefined && h.status !== 'DOWN')
    .map(h => Number(h.latencyMs));

  const totalProbes = history.length;
  const successfulProbes = history.filter(h => h.status === 'HEALTHY' || h.status === 'DEGRADED').length;
  const uptimePercent = totalProbes > 0 ? parseFloat(((successfulProbes / totalProbes) * 100).toFixed(2)) : 100.0;

  if (latencies.length === 0) {
    return {
      p50: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      avg: 0,
      min: 0,
      max: 0,
      stdDev: 0,
      sampleCount: 0,
      uptimePercent
    };
  }

  const sum = latencies.reduce((acc, val) => acc + val, 0);
  const avg = parseFloat((sum / latencies.length).toFixed(2));
  const min = Math.min(...latencies);
  const max = Math.max(...latencies);

  // Variance & Standard Deviation
  const variance = latencies.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / latencies.length;
  const stdDev = parseFloat(Math.sqrt(variance).toFixed(2));

  return {
    p50: calculatePercentile(latencies, 50),
    p90: calculatePercentile(latencies, 90),
    p95: calculatePercentile(latencies, 95),
    p99: calculatePercentile(latencies, 99),
    avg,
    min,
    max,
    stdDev,
    sampleCount: latencies.length,
    uptimePercent
  };
}

module.exports = {
  calculatePercentile,
  calculateStats
};
