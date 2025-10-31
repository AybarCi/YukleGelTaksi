const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const SocketServer = require('./socket/socketServer.js');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

// Next.js app'i hazırla
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Health check endpoint
const healthCheck = (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  };
  
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(health));
};

app.prepare().then(() => {
  // HTTP server oluştur
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || '', true);
      
      // Health check endpoint
      if (parsedUrl.pathname === '/api/health') {
        return healthCheck(req, res);
      }
      
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Socket.IO server'ı başlat
  const socketServer = new SocketServer(server);
  
  // Global olarak erişilebilir yap
  global.socketServer = socketServer;
  
  console.log('Socket.IO server initialized');
  console.log(`Connected drivers: ${socketServer.getConnectedDriversCount()}`);
  console.log(`Connected customers: ${socketServer.getConnectedCustomersCount()}`);

  server
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.IO server running on the same port`);
    });
});