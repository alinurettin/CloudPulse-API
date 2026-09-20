// CloudPulse-API - Server Class Compatibility Wrapper
const { startServer, store, probeEngine } = require('./index');

class Server {
  constructor(port = 3000) {
    this.port = port;
    this.httpServer = null;
    this.store = store;
    this.probeEngine = probeEngine;
  }

  start() {
    this.httpServer = startServer(this.port);
    return this.httpServer;
  }

  stop() {
    this.probeEngine.stop();
    if (this.httpServer) this.httpServer.close();
  }
}

module.exports = Server;
