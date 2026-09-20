// CloudPulse-API v2.0.0 - Latency Analyzer Engine
const { calculatePercentile, calculateStats } = require('./stats');

class LatencyAnalyzer {
  constructor(maxSamples = 5000) {
    this.maxSamples = maxSamples;
    this.latencies = [];
  }

  record(latencyMs) {
    this.latencies.push(Number(latencyMs));
    if (this.latencies.length > this.maxSamples) {
      this.latencies.shift();
    }
  }

  percentile(p) {
    return calculatePercentile(this.latencies, p);
  }

  summary() {
    const fakeHistory = this.latencies.map(l => ({ status: 'HEALTHY', latencyMs: l }));
    return {
      count: this.latencies.length,
      ...calculateStats(fakeHistory)
    };
  }
}

module.exports = LatencyAnalyzer;