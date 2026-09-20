// CloudPulse-API v2.0.0 - Production HTTP Server & Telemetry Gateway
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const store = require('./store');
const ProbeEngine = require('./probeEngine');
const { formatPrometheusMetrics } = require('./prometheus');
const LatencyAnalyzer = require('./engine');

const PORT = parseInt(process.env.PORT, 10) || 6001;
const publicDir = path.join(__dirname, '..', 'public');
const startTime = Date.now();
const sseClients = new Set();

const probeEngine = new ProbeEngine(store, (updatedService) => {
  broadcastEvent('service_update', updatedService);
});

function broadcastEvent(eventType, data) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

function requestHandler(req, res) {
  const reqUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = reqUrl.pathname;
  const method = req.method;

  // CORS Headers
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
    });
    return res.end();
  }

  // 1. Prometheus Metrics Exporter: /metrics
  if (method === 'GET' && pathname === '/metrics') {
    res.writeHead(200, {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(formatPrometheusMetrics(store.getAll()));
  }

  // 2. Real-Time Server-Sent Events (SSE): /api/events or /api/events/stream
  if (method === 'GET' && (pathname === '/api/events' || pathname === '/api/events/stream')) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('retry: 3000\n: connected\n\n');
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    const jsonRes = (statusCode, data) => {
      res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(data));
    };

    let parsedBody = {};
    if (body) {
      try { parsedBody = JSON.parse(body); } catch (e) { /* fallback empty */ }
    }

    // 3. Health Endpoint
    if (pathname === '/api/health' && method === 'GET') {
      const allServices = store.getAll();
      const healthyCount = allServices.filter(s => s.status === 'HEALTHY').length;
      return jsonRes(200, {
        status: 'UP',
        service: 'CloudPulse-API',
        version: '2.0.0',
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        servicesMonitored: allServices.length,
        servicesHealthy: healthyCount,
        timestamp: new Date().toISOString()
      });
    }

    // 4. Stats & Telemetry API
    if (pathname === '/api/stats' && method === 'GET') {
      const allServices = store.getAll();
      const healthyCount = allServices.filter(s => s.status === 'HEALTHY').length;
      const degradedCount = allServices.filter(s => s.status === 'DEGRADED').length;
      const downCount = allServices.filter(s => s.status === 'DOWN').length;

      return jsonRes(200, {
        success: true,
        service: 'CloudPulse-API',
        version: '2.0.0',
        totalServices: allServices.length,
        healthy: healthyCount,
        degraded: degradedCount,
        down: downCount,
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000)
      });
    }

    // 5. Services List
    if (pathname === '/api/services' && method === 'GET') {
      return jsonRes(200, {
        success: true,
        count: store.getAll().length,
        services: store.getAll()
      });
    }

    // 6. Register New Service
    if (pathname === '/api/services' && method === 'POST') {
      if (!parsedBody.name || !parsedBody.url) {
        return jsonRes(400, { success: false, error: 'name and url are required fields' });
      }

      const service = store.register(parsedBody);
      probeEngine.scheduleService(service);
      broadcastEvent('service_added', service);
      return jsonRes(201, { success: true, service });
    }

    // 7. Delete Service
    if (pathname.startsWith('/api/services/') && method === 'DELETE') {
      const id = pathname.replace('/api/services/', '');
      probeEngine.unscheduleService(id);
      const deleted = store.delete(id);
      if (deleted) broadcastEvent('service_deleted', { id });
      return jsonRes(deleted ? 200 : 404, {
        success: deleted,
        message: deleted ? 'Service removed from monitoring' : 'Service not found'
      });
    }

    // 8. Manual Ad-Hoc Ping
    if (pathname.match(/^\/api\/services\/([^/]+)\/ping$/) && method === 'POST') {
      const id = pathname.split('/')[3];
      const service = store.get(id);
      if (!service) {
        return jsonRes(404, { success: false, error: 'Service not found' });
      }

      await probeEngine.executeProbe(id);
      return jsonRes(200, {
        success: true,
        service: store.get(id)
      });
    }

    // 9. Static Assets
    let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8'
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      return fs.createReadStream(filePath).pipe(res);
    }

    jsonRes(404, { error: 'Endpoint Not Found', path: pathname });
  });
}

function startServer(port = PORT, callback) {
  const server = http.createServer(requestHandler);
  server.listen(port, () => {
    if (callback) callback(server);
    probeEngine.start();
  });
  return server;
}

if (require.main === module) {
  startServer(PORT, () => {
    console.log(`⚡ CloudPulse-API v2.0.0 running on http://localhost:${PORT}`);
    console.log(`📊 Prometheus scrape endpoint at http://localhost:${PORT}/metrics`);
  });
}

module.exports = { startServer, requestHandler, store, probeEngine };
