// Asynchronous Network Prober & Metric Polling Scheduler
const http = require('http');
const https = require('https');
const url = require('url');

class ProbeEngine {
  constructor(store, onProbeComplete = null) {
    this.store = store;
    this.onProbeComplete = onProbeComplete;
    this.timers = new Map();
    this.isRunning = false;
  }

  async probeSingle(service) {
    const startTime = Date.now();
    return new Promise((resolve) => {
      try {
        const parsed = new URL(service.url);
        const protocol = parsed.protocol === 'https:' ? https : http;

        const reqOptions = {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: 'GET',
          timeout: service.timeoutMs,
          headers: {
            'User-Agent': 'CloudPulse-Probe/1.0'
          }
        };

        const req = protocol.request(reqOptions, (res) => {
          const latencyMs = Date.now() - startTime;
          let status = 'HEALTHY';

          if (res.statusCode >= 500) {
            status = 'DOWN';
          } else if (res.statusCode >= 400 || latencyMs > 800) {
            status = 'DEGRADED';
          }

          res.resume(); // Consume stream to free socket
          resolve({
            status,
            statusCode: res.statusCode,
            latencyMs
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            status: 'DOWN',
            statusCode: 504,
            latencyMs: Date.now() - startTime,
            error: 'Request Timeout'
          });
        });

        req.on('error', (err) => {
          resolve({
            status: 'DOWN',
            statusCode: 500,
            latencyMs: Date.now() - startTime,
            error: err.message
          });
        });

        req.end();
      } catch (err) {
        resolve({
          status: 'DOWN',
          statusCode: 500,
          latencyMs: Date.now() - startTime,
          error: err.message
        });
      }
    });
  }

  async executeProbe(id) {
    const service = this.store.get(id);
    if (!service) return;

    const result = await this.probeSingle(service);
    const updated = this.store.recordProbe(id, result);

    if (this.onProbeComplete && updated) {
      this.onProbeComplete(updated);
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Trigger initial probe for all services immediately
    this.store.getAll().forEach((service) => {
      this.executeProbe(service.id);
      const timer = setInterval(() => {
        this.executeProbe(service.id);
      }, service.intervalMs);
      this.timers.set(service.id, timer);
    });
  }

  stop() {
    this.isRunning = false;
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers.clear();
  }

  scheduleService(service) {
    if (this.timers.has(service.id)) {
      clearInterval(this.timers.get(service.id));
    }
    this.executeProbe(service.id);
    const timer = setInterval(() => {
      this.executeProbe(service.id);
    }, service.intervalMs);
    this.timers.set(service.id, timer);
  }

  unscheduleService(id) {
    if (this.timers.has(id)) {
      clearInterval(this.timers.get(id));
      this.timers.delete(id);
    }
  }
}

module.exports = ProbeEngine;
