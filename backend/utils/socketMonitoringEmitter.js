class SocketMonitoringEmitter {
  constructor(socketServer) {
    this.socketServer = socketServer;
    this.lastEmitTime = 0;
    this.emitInterval = 5000; // 5 saniye
  }

  // Real-time monitoring verilerini emit et
  emitMonitoringUpdate(data) {
    if (!this.socketServer || !this.socketServer.io) return;

    const now = Date.now();
    if (now - this.lastEmitTime < this.emitInterval) return;

    this.lastEmitTime = now;

    // Sadece supervisor kullanıcılarına gönder
    this.socketServer.io.to('supervisor_monitoring').emit('monitoring_update', {
      timestamp: new Date().toISOString(),
      ...data
    });

    console.log('📊 Monitoring update emitted to supervisor_monitoring room:', Object.keys(data));
  }

  // Error alert emit et
  emitErrorAlert(error, context = {}) {
    if (!this.socketServer || !this.socketServer.io) return;

    this.socketServer.io.to('supervisor_monitoring').emit('error_alert', {
      timestamp: new Date().toISOString(),
      message: error.message || error,
      type: 'error',
      context,
      severity: 'high'
    });

    console.log('🚨 Error alert emitted to supervisor_monitoring room:', error.message || error);
  }

  // Performance alert emit et
  emitPerformanceAlert(metric, value, threshold, context = {}) {
    if (!this.socketServer || !this.socketServer.io) return;

    this.socketServer.io.emit('performance_alert', {
      timestamp: new Date().toISOString(),
      message: `${metric} threshold exceeded: ${value} > ${threshold}`,
      type: 'performance',
      metric,
      value,
      threshold,
      context,
      severity: 'medium'
    });

    console.log('⚡ Performance alert emitted:', metric, value, threshold);
  }

  // Connection status update emit et
  emitConnectionUpdate(type, count, change = 0) {
    if (!this.socketServer || !this.socketServer.io) return;

    this.socketServer.io.to('supervisor_monitoring').emit('connection_update', {
      timestamp: new Date().toISOString(),
      type, // 'drivers' or 'customers'
      count,
      change, // +1, -1, etc.
      message: `${type} connection count: ${count} (${change >= 0 ? '+' : ''}${change})`
    });

    console.log('🔗 Connection update emitted to supervisor_monitoring room:', type, count, change);
  }

  // Event frequency alert emit et
  emitEventFrequencyAlert(eventType, frequency, threshold) {
    if (!this.socketServer || !this.socketServer.io) return;

    this.socketServer.io.emit('event_frequency_alert', {
      timestamp: new Date().toISOString(),
      message: `High event frequency detected: ${eventType} (${frequency}/min > ${threshold}/min)`,
      type: 'frequency',
      eventType,
      frequency,
      threshold,
      severity: 'medium'
    });

    console.log('📈 Event frequency alert emitted:', eventType, frequency, threshold);
  }

  // Memory usage alert emit et
  emitMemoryAlert(usage, threshold) {
    if (!this.socketServer || !this.socketServer.io) return;

    this.socketServer.io.emit('memory_alert', {
      timestamp: new Date().toISOString(),
      message: `High memory usage detected: ${usage}% > ${threshold}%`,
      type: 'memory',
      usage,
      threshold,
      severity: 'high'
    });

    console.log('💾 Memory alert emitted:', usage, threshold);
  }

  // System health update emit et
  emitSystemHealthUpdate(health) {
    if (!this.socketServer || !this.socketServer.io) return;

    this.socketServer.io.emit('system_health_update', {
      timestamp: new Date().toISOString(),
      ...health
    });

    console.log('❤️ System health update emitted');
  }
}

module.exports = SocketMonitoringEmitter;