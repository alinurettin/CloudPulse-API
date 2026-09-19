// In-Memory Service & Metric History Store with Ring Buffer
const crypto = require('crypto');
const { calculateStats } = require('./stats');

class Store {
  constructor(maxHistory = 100) {
    this.maxHistory = maxHistory;
    this.services = new Map();
    this.initDefaultServices();
  }

  initDefaultServices() {
    this.register({
      name: 'Auth Gateway',
      url: 'https://httpbin.org/status/200',
      intervalMs: 15000,
      timeoutMs: 5000
    });
    this.register({
      name: 'Payments API',
      url: 'https://httpbin.org/delay/0',
      intervalMs: 20000,
      timeoutMs: 5000
    });
    this.register({
      name: 'Search Cluster',
      url: 'https://httpbin.org/status/200',
      intervalMs: 12000,
      timeoutMs: 4000
    });
  }

  register(data) {
    const id = data.id || `srv-${crypto.randomBytes(4).toString('hex')}`;
    const service = {
      id,
      name: data.name || 'Unnamed Service',
      url: data.url,
      intervalMs: parseInt(data.intervalMs, 10) || 15000,
      timeoutMs: parseInt(data.timeoutMs, 10) || 5000,
      status: 'PENDING',
      lastCheckedAt: null,
      lastLatencyMs: 0,
      uptimePercent: 100,
      stats: {
        p50: 0,
        p95: 0,
        p99: 0,
        avg: 0,
        min: 0,
        max: 0,
        sampleCount: 0,
        uptimePercent: 100
      },
      history: []
    };
    this.services.set(id, service);
    return service;
  }

  getAll() {
    return Array.from(this.services.values());
  }

  get(id) {
    return this.services.get(id);
  }

  delete(id) {
    return this.services.delete(id);
  }

  recordProbe(id, probeResult) {
    const service = this.services.get(id);
    if (!service) return null;

    const entry = {
      timestamp: new Date().toISOString(),
      status: probeResult.status,
      statusCode: probeResult.statusCode,
      latencyMs: probeResult.latencyMs,
      error: probeResult.error || null
    };

    service.status = probeResult.status;
    service.lastCheckedAt = entry.timestamp;
    service.lastLatencyMs = probeResult.latencyMs || 0;

    service.history.push(entry);
    if (service.history.length > this.maxHistory) {
      service.history.shift();
    }

    service.stats = calculateStats(service.history);
    service.uptimePercent = service.stats.uptimePercent;

    return service;
  }
}

module.exports = new Store();
