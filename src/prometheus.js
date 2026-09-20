// CloudPulse-API v2.0.0 - Prometheus / OpenMetrics Text Exporter

function formatPrometheusMetrics(services) {
  let lines = [
    '# HELP cloudpulse_service_up Microservice health status (1 = UP/HEALTHY, 0 = DOWN)',
    '# TYPE cloudpulse_service_up gauge',
    '# HELP cloudpulse_latency_seconds Microservice round-trip probe latency in seconds',
    '# TYPE cloudpulse_latency_seconds gauge',
    '# HELP cloudpulse_uptime_percent Computed uptime percentage',
    '# TYPE cloudpulse_uptime_percent gauge',
    '# HELP cloudpulse_latency_p50_seconds 50th percentile median latency in seconds',
    '# TYPE cloudpulse_latency_p50_seconds gauge',
    '# HELP cloudpulse_latency_p95_seconds 95th percentile SLA latency in seconds',
    '# TYPE cloudpulse_latency_p95_seconds gauge',
    '# HELP cloudpulse_latency_p99_seconds 99th percentile tail latency in seconds',
    '# TYPE cloudpulse_latency_p99_seconds gauge',
    '# HELP cloudpulse_latency_stddev_seconds Standard deviation of probe latency',
    '# TYPE cloudpulse_latency_stddev_seconds gauge'
  ];

  services.forEach((s) => {
    const isUp = s.status === 'HEALTHY' || s.status === 'DEGRADED' ? 1 : 0;
    const latencySec = (s.lastLatencyMs || 0) / 1000;
    const p50Sec = ((s.stats && s.stats.p50) || 0) / 1000;
    const p95Sec = ((s.stats && s.stats.p95) || 0) / 1000;
    const p99Sec = ((s.stats && s.stats.p99) || 0) / 1000;
    const stdDevSec = ((s.stats && s.stats.stdDev) || 0) / 1000;
    const safeName = (s.name || s.id).replace(/"/g, '\\"');
    const labels = `id="${s.id}",name="${safeName}",url="${s.url}"`;

    lines.push(`cloudpulse_service_up{${labels}} ${isUp}`);
    lines.push(`cloudpulse_latency_seconds{${labels}} ${latencySec.toFixed(4)}`);
    lines.push(`cloudpulse_uptime_percent{${labels}} ${(s.uptimePercent || 0).toFixed(2)}`);
    lines.push(`cloudpulse_latency_p50_seconds{${labels}} ${p50Sec.toFixed(4)}`);
    lines.push(`cloudpulse_latency_p95_seconds{${labels}} ${p95Sec.toFixed(4)}`);
    lines.push(`cloudpulse_latency_p99_seconds{${labels}} ${p99Sec.toFixed(4)}`);
    lines.push(`cloudpulse_latency_stddev_seconds{${labels}} ${stdDevSec.toFixed(4)}`);
  });

  return lines.join('\n') + '\n';
}

module.exports = {
  formatPrometheusMetrics
};
