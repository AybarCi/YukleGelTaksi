const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const SocketServer = require('./socket/socketServer.js');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

// Container ortamı için process optimizasyonları
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Memory optimizasyonu
if (process.env.NODE_ENV === 'production') {
  // Garbage collection'ı manuel tetikleme için izin ver
  if (global.gc) {
    setInterval(() => {
      global.gc();
      console.log('Manual garbage collection triggered');
    }, 300000); // 5 dakikada bir
  }
}

// Next.js app'i hazırla
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Health check endpoint - container için optimize edilmiş
const healthCheck = (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB'
      },
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      socket: {
        drivers: global.socketServer ? global.socketServer.getConnectedDriversCount() : 0,
        customers: global.socketServer ? global.socketServer.getConnectedCustomersCount() : 0
      }
    };
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.end(JSON.stringify(health));
  } catch (error) {
    console.error('Health check error:', error);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'unhealthy', error: error.message }));
  }
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

  // Socket.IO server'ı başlat - container için optimize edilmiş
  const socketServer = new SocketServer(server);
  
  // Global olarak erişilebilir yap
  global.socketServer = socketServer;
  
  console.log('🚀 Socket.IO server initialized');
  console.log(`📊 Connected drivers: ${socketServer.getConnectedDriversCount()}`);
  console.log(`📊 Connected customers: ${socketServer.getConnectedCustomersCount()}`);
  
  // Graceful shutdown handling
  const gracefulShutdown = (signal) => {
    console.log(`\n📴 Received ${signal}. Starting graceful shutdown...`);
    
    // Socket.IO bağlantılarını kapat
    if (socketServer && socketServer.io) {
      socketServer.io.close(() => {
        console.log('🔌 Socket.IO connections closed');
      });
    }
    
    // HTTP server'ı kapat
    server.close(() => {
      console.log('🛑 HTTP server closed');
      process.exit(0);
    });
    
    // Zorla kapatma için timeout
    setTimeout(() => {
      console.error('❌ Forced shutdown after timeout');
      process.exit(1);
    }, 30000); // 30 saniye
  };
  
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  server
    .once('error', (err) => {
      console.error('❌ Server error:', err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`🌐 Ready on http://${hostname}:${port}`);
      console.log(`⚡ Socket.IO server running on the same port`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
});