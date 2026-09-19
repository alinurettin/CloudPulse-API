// CloudPulse-API Main Entrypoint
const Server = require('./server');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const server = new Server(PORT);

server.start();

process.on('SIGINT', () => {
  console.log('\nShutting down CloudPulse-API engine gracefully...');
  server.stop();
  process.exit(0);
});
