// Prometheus Text Metrics Exporter

function formatPrometheusMetrics(services) {
  let lines = [
    '# HELP cloudpulse_service_up Microservice health status (1 = UP/HEALTHY, 0 = DOWN)',
    '# TYPE cloudpulse_service_up gauge',
    '# HELP cloudpulse_latency_seconds Microservice round-trip probe latency in seconds',
    '# TYPE cloudpulse_latency_seconds gauge',
    '# HELP cloudpulse_uptime_percent Computed uptime percentage',
    '# TYPE cloudpulse_uptime_percent gauge',
    '# HELP cloudpulse_latency_p95_seconds 95th percentile latency in seconds',
    '# TYPE cloudpulse_latency_p95_seconds gauge'
  ];

  services.forEach((s) => {
    const isUp = s.status === 'HEALTHY' || s.status === 'DEGRADED' ? 1 : 0;
    const latencySec = (s.lastLatencyMs || 0) / 1000;
    const p95Sec = (s.stats.p95 || 0) / 1000;
    const labels = `id="${s.id}",name="${s.name.replace(/"/g, '\\"')}",url="${s.url}"`;

    lines.push(`cloudpulse_service_up{${labels}} ${isUp}`);
    lines.push(`cloudpulse_latency_seconds{${labels}} ${latencySec.toFixed(4)}`);
    lines.push(`cloudpulse_uptime_percent{${labels}} ${(s.uptimePercent || 0).toFixed(2)}`);
    lines.push(`cloudpulse_latency_p95_seconds{${labels}} ${p95Sec.toFixed(4)}`);
  });

  return lines.join('\n') + '\n';
}

module.exports = {
  formatPrometheusMetrics
};
