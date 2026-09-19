// CloudPulse-API Core HTTP Server & REST Router
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const store = require('./store');
const ProbeEngine = require('./probeEngine');
const { formatPrometheusMetrics } = require('./prometheus');

class Server {
  constructor(port = 3000) {
    this.port = port;
    this.sseClients = new Set();
    this.publicDir = path.join(__dirname, '..', 'public');
    this.startTime = Date.now();

    this.probeEngine = new ProbeEngine(store, (updatedService) => {
      this.broadcastEvent('service_update', updatedService);
    });

    this.httpServer = http.createServer((req, res) => this.handleRequest(req, res));
  }

  broadcastEvent(eventType, data) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(payload);
      } catch (err) {
        this.sseClients.delete(client);
      }
    }
  }

  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.svg': 'image/svg+xml'
    };
    return map[ext] || 'text/plain; charset=utf-8';
  }

  sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(data));
  }

  async parseBody(req) {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          resolve({});
        }
      });
    });
  }

  async handleRequest(req, res) {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;
    const method = req.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      return res.end();
    }

    // --- REST API ENDPOINTS ---

    // 1. System Health
    if (pathname === '/api/health' && method === 'GET') {
      const allServices = store.getAll();
      const healthyCount = allServices.filter(s => s.status === 'HEALTHY').length;
      return this.sendJson(res, 200, {
        status: 'UP',
        engine: 'CloudPulse-API',
        version: '1.0.0',
        uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
        servicesMonitored: allServices.length,
        servicesHealthy: healthyCount
      });
    }

    // 2. Real-Time Server-Sent Events (SSE)
    if (pathname === '/api/events' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write(': connected\n\n');
      this.sseClients.add(res);

      req.on('close', () => {
        this.sseClients.delete(res);
      });
      return;
    }

    // 3. Prometheus Metrics Exporter
    if (pathname === '/metrics' && method === 'GET') {
      const metricsText = formatPrometheusMetrics(store.getAll());
      res.writeHead(200, {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8'
      });
      return res.end(metricsText);
    }

    // 4. Services List
    if (pathname === '/api/services' && method === 'GET') {
      return this.sendJson(res, 200, {
        success: true,
        count: store.getAll().length,
        services: store.getAll()
      });
    }

    // 5. Register New Service
    if (pathname === '/api/services' && method === 'POST') {
      const body = await this.parseBody(req);
      if (!body.name || !body.url) {
        return this.sendJson(res, 400, {
          success: false,
          error: 'name and url are required fields'
        });
      }

      const service = store.register(body);
      this.probeEngine.scheduleService(service);
      return this.sendJson(res, 201, {
        success: true,
        service
      });
    }

    // 6. Delete Service
    if (pathname.startsWith('/api/services/') && method === 'DELETE') {
      const id = pathname.replace('/api/services/', '');
      this.probeEngine.unscheduleService(id);
      const deleted = store.delete(id);
      return this.sendJson(res, deleted ? 200 : 404, {
        success: deleted,
        message: deleted ? 'Service removed from monitoring' : 'Service not found'
      });
    }

    // 7. Manual Ad-Hoc Ping
    if (pathname.match(/^\/api\/services\/([^/]+)\/ping$/) && method === 'POST') {
      const id = pathname.split('/')[3];
      const service = store.get(id);
      if (!service) {
        return this.sendJson(res, 404, { success: false, error: 'Service not found' });
      }

      await this.probeEngine.executeProbe(id);
      return this.sendJson(res, 200, {
        success: true,
        service: store.get(id)
      });
    }

    // --- STATIC ASSET SERVING ---
    let filePath = path.join(this.publicDir, pathname === '/' ? 'index.html' : pathname);
    fs.stat(filePath, (err, stats) => {
      if (!err && stats.isFile()) {
        const mime = this.getMimeType(filePath);
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      }
    });
  }

  start() {
    this.httpServer.listen(this.port, () => {
      console.log(`====================================================`);
      console.log(`  CloudPulse-API Monitoring Engine running`);
      console.log(`  Local URL    : http://localhost:${this.port}`);
      console.log(`  Prometheus   : http://localhost:${this.port}/metrics`);
      console.log(`  Live Events  : http://localhost:${this.port}/api/events`);
      console.log(`====================================================`);
      this.probeEngine.start();
    });
  }

  stop() {
    this.probeEngine.stop();
    this.httpServer.close();
  }
}

module.exports = Server;
