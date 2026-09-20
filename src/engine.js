class LatencyAnalyzer {
  constructor() {
    this.latencies = [];
  }
  record(latencyMs) {
    this.latencies.push(latencyMs);
    if (this.latencies.length > 5000) this.latencies.shift();
  }
  percentile(p) {
    if (this.latencies.length === 0) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
  summary() {
    return {
      count: this.latencies.length,
      p50: this.percentile(50),
      p95: this.percentile(95),
      p99: this.percentile(99)
    };
  }
}
module.exports = LatencyAnalyzer;