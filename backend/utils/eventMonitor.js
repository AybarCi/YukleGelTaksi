const EventEmitter = require('events');
const SocketMonitoringEmitter = require('./socketMonitoringEmitter.js');

class EventMonitor extends EventEmitter {
  constructor() {
    super();
    this.eventStats = new Map();
    this.errorStats = new Map();
    this.performanceMetrics = new Map();
    this.isMonitoring = false;
    this.startTime = Date.now(); // Başlangıç zamanını ekle
    
    // Event thresholds
    this.thresholds = {
      errorRate: 0.1, // 10% error rate
      responseTime: 5000, // 5 seconds
      eventFrequency: 100 // events per minute
    };
  }

  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('🔍 Event monitoring started');
    
    // Periyodik raporlama
    this.reportInterval = setInterval(() => {
      this.generateReport();
    }, 60000); // Her dakika
    
    // Metrics temizleme
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 300000); // 5 dakikada bir
  }

  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    console.log('🔍 Event monitoring stopped');
  }

  trackEvent(eventName, data = {}) {
    if (!this.isMonitoring) return;
    
    const timestamp = Date.now();
    const eventKey = `${eventName}_${Math.floor(timestamp / 60000)}`; // Per minute
    
    if (!this.eventStats.has(eventKey)) {
      this.eventStats.set(eventKey, {
        eventName,
        count: 0,
        timestamp: Math.floor(timestamp / 60000) * 60000,
        data: []
      });
    }
    
    const stats = this.eventStats.get(eventKey);
    stats.count++;
    stats.data.push({ timestamp, ...data });
    
    // Threshold kontrolü
    this.checkEventThreshold(eventName, stats.count);
  }

  trackError(eventName, error, context = {}) {
    if (!this.isMonitoring) return;
    
    const timestamp = Date.now();
    const errorKey = `${eventName}_error_${Math.floor(timestamp / 60000)}`;
    
    if (!this.errorStats.has(errorKey)) {
      this.errorStats.set(errorKey, {
        eventName,
        errorCount: 0,
        timestamp: Math.floor(timestamp / 60000) * 60000,
        errors: []
      });
    }
    
    const errorStats = this.errorStats.get(errorKey);
    errorStats.errorCount++;
    errorStats.errors.push({
      timestamp,
      error: error.message || error,
      stack: error.stack,
      context
    });
    
    // Error rate kontrolü
    this.checkErrorRate(eventName);
    
    console.error(`❌ Event error tracked: ${eventName}`, error);
  }

  trackPerformance(eventName, startTime, endTime = Date.now()) {
    if (!this.isMonitoring) return;
    
    const duration = endTime - startTime;
    const timestamp = Date.now();
    const perfKey = `${eventName}_perf_${Math.floor(timestamp / 60000)}`;
    
    if (!this.performanceMetrics.has(perfKey)) {
      this.performanceMetrics.set(perfKey, {
        eventName,
        measurements: [],
        timestamp: Math.floor(timestamp / 60000) * 60000
      });
    }
    
    const perfStats = this.performanceMetrics.get(perfKey);
    perfStats.measurements.push({ timestamp, duration });
    
    // Performance threshold kontrolü
    if (duration > this.thresholds.responseTime) {
      console.warn(`⚠️ Slow event detected: ${eventName} took ${duration}ms`);
      this.emit('slowEvent', { eventName, duration, timestamp });
    }
  }

  checkEventThreshold(eventName, count) {
    if (count > this.thresholds.eventFrequency) {
      console.warn(`⚠️ High event frequency: ${eventName} - ${count} events/minute`);
      this.emit('highFrequency', { eventName, count });
    }
  }

  checkErrorRate(eventName) {
    const currentMinute = Math.floor(Date.now() / 60000);
    const eventKey = `${eventName}_${currentMinute}`;
    const errorKey = `${eventName}_error_${currentMinute}`;
    
    const eventStats = this.eventStats.get(eventKey);
    const errorStats = this.errorStats.get(errorKey);
    
    if (eventStats && errorStats) {
      const errorRate = errorStats.errorCount / eventStats.count;
      
      if (errorRate > this.thresholds.errorRate) {
        console.warn(`⚠️ High error rate: ${eventName} - ${(errorRate * 100).toFixed(2)}%`);
        this.emit('highErrorRate', { eventName, errorRate, errorCount: errorStats.errorCount, totalCount: eventStats.count });
      }
    }
  }

  generateReport() {
    const currentMinute = Math.floor(Date.now() / 60000);
    const report = {
      timestamp: new Date().toISOString(),
      events: {},
      errors: {},
      performance: {}
    };
    
    // Event stats
    for (const [key, stats] of this.eventStats.entries()) {
      if (stats.timestamp === (currentMinute - 1) * 60000) { // Önceki dakika
        report.events[stats.eventName] = {
          count: stats.count,
          timestamp: new Date(stats.timestamp).toISOString()
        };
      }
    }
    
    // Error stats
    for (const [key, stats] of this.errorStats.entries()) {
      if (stats.timestamp === (currentMinute - 1) * 60000) {
        report.errors[stats.eventName] = {
          errorCount: stats.errorCount,
          timestamp: new Date(stats.timestamp).toISOString()
        };
      }
    }
    
    // Performance stats
    for (const [key, stats] of this.performanceMetrics.entries()) {
      if (stats.timestamp === (currentMinute - 1) * 60000) {
        const durations = stats.measurements.map(m => m.duration);
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const maxDuration = Math.max(...durations);
        
        report.performance[stats.eventName] = {
          avgDuration: Math.round(avgDuration),
          maxDuration,
          measurementCount: durations.length,
          timestamp: new Date(stats.timestamp).toISOString()
        };
      }
    }
    
    // Sadece veri varsa rapor et
    if (Object.keys(report.events).length > 0 || 
        Object.keys(report.errors).length > 0 || 
        Object.keys(report.performance).length > 0) {
      console.log('📊 Event Monitor Report:', JSON.stringify(report, null, 2));
      this.emit('report', report);
    }
  }

  cleanupOldMetrics() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 saat önce
    
    // Eski event stats'ları temizle
    for (const [key, stats] of this.eventStats.entries()) {
      if (stats.timestamp < cutoffTime) {
        this.eventStats.delete(key);
      }
    }
    
    // Eski error stats'ları temizle
    for (const [key, stats] of this.errorStats.entries()) {
      if (stats.timestamp < cutoffTime) {
        this.errorStats.delete(key);
      }
    }
    
    // Eski performance metrics'leri temizle
    for (const [key, stats] of this.performanceMetrics.entries()) {
      if (stats.timestamp < cutoffTime) {
        this.performanceMetrics.delete(key);
      }
    }
    
    console.log('🧹 Old metrics cleaned up');
  }

  getEventStats(eventName, minutes = 60) {
    const stats = [];
    const currentMinute = Math.floor(Date.now() / 60000);
    
    for (let i = 0; i < minutes; i++) {
      const minute = currentMinute - i;
      const key = `${eventName}_${minute}`;
      const eventStat = this.eventStats.get(key);
      
      stats.unshift({
        timestamp: minute * 60000,
        count: eventStat ? eventStat.count : 0
      });
    }
    
    return stats;
  }

  getErrorStats(eventName, minutes = 60) {
    const stats = [];
    const currentMinute = Math.floor(Date.now() / 60000);
    
    for (let i = 0; i < minutes; i++) {
      const minute = currentMinute - i;
      const key = `${eventName}_error_${minute}`;
      const errorStat = this.errorStats.get(key);
      
      stats.unshift({
        timestamp: minute * 60000,
        errorCount: errorStat ? errorStat.errorCount : 0
      });
    }
    
    return stats;
  }

  setThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('🎯 Event monitor thresholds updated:', this.thresholds);
  }

  getAllEventNames() {
    const eventNames = new Set();
    for (const [key, stats] of this.eventStats.entries()) {
      eventNames.add(stats.eventName);
    }
    return Array.from(eventNames);
  }

  getAllErrorStats(minutes = 60) {
    const errorStats = {};
    const currentMinute = Math.floor(Date.now() / 60000);
    
    for (let i = 0; i < minutes; i++) {
      const minute = currentMinute - i;
      
      for (const [key, stats] of this.errorStats.entries()) {
        if (stats.timestamp === minute * 60000) {
          if (!errorStats[stats.eventName]) {
            errorStats[stats.eventName] = [];
          }
          errorStats[stats.eventName].push({
            timestamp: stats.timestamp,
            errorCount: stats.errorCount,
            errors: stats.errors
          });
        }
      }
    }
    
    return errorStats;
  }

  getPerformanceStats(minutes = 60) {
    const performanceStats = {};
    const currentMinute = Math.floor(Date.now() / 60000);
    
    for (let i = 0; i < minutes; i++) {
      const minute = currentMinute - i;
      
      for (const [key, stats] of this.performanceMetrics.entries()) {
        if (stats.timestamp === minute * 60000) {
          if (!performanceStats[stats.eventName]) {
            performanceStats[stats.eventName] = [];
          }
          
          const durations = stats.measurements.map(m => m.duration);
          const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
          const maxDuration = Math.max(...durations);
          const minDuration = Math.min(...durations);
          
          performanceStats[stats.eventName].push({
            timestamp: stats.timestamp,
            avgDuration: Math.round(avgDuration),
            maxDuration,
            minDuration,
            measurementCount: durations.length
          });
        }
      }
    }
    
    return performanceStats;
  }

  getSummary(minutes = 60) {
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    
    let totalEvents = 0;
    let totalErrors = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;
    
    // Event stats
    for (const [key, stats] of this.eventStats) {
      if (stats.timestamp >= cutoffTime) {
        totalEvents += stats.count;
      }
    }
    
    // Error stats
    for (const [key, stats] of this.errorStats) {
      if (stats.timestamp >= cutoffTime) {
        totalErrors += stats.errorCount;
      }
    }
    
    // Performance stats
    for (const [key, stats] of this.performanceMetrics) {
      if (stats.timestamp >= cutoffTime) {
        const durations = stats.measurements.map(m => m.duration);
        const totalTime = durations.reduce((a, b) => a + b, 0);
        totalResponseTime += totalTime;
        responseTimeCount += durations.length;
      }
    }
    
    const errorRate = totalEvents > 0 ? (totalErrors / totalEvents) : 0;
    const avgResponseTime = responseTimeCount > 0 ? (totalResponseTime / responseTimeCount) : 0;
    
    return {
      totalEvents,
      totalErrors,
      errorRate: Math.round(errorRate * 10000) / 100, // Percentage with 2 decimals
      avgResponseTime: Math.round(avgResponseTime),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      period: `${minutes} minutes`
    };
  }

  // Yeni metodlar ekliyoruz
  getTotalEvents() {
    let total = 0;
    for (const [key, stats] of this.eventStats) {
      total += stats.count;
    }
    return total;
  }

  getTotalErrors() {
    let total = 0;
    for (const [key, stats] of this.errorStats) {
      total += stats.errorCount;
    }
    return total;
  }

  getErrorRate() {
    const totalEvents = this.getTotalEvents();
    const totalErrors = this.getTotalErrors();
    return totalEvents > 0 ? Math.round((totalErrors / totalEvents) * 10000) / 100 : 0;
  }

  getAverageResponseTime() {
    let totalTime = 0;
    let count = 0;
    
    for (const [key, stats] of this.performanceMetrics) {
      const durations = stats.measurements.map(m => m.duration);
      totalTime += durations.reduce((a, b) => a + b, 0);
      count += durations.length;
    }
    
    return count > 0 ? Math.round(totalTime / count) : 0;
  }

  getRecentEvents(minutes = 5) {
    const recentEvents = [];
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    
    for (const [key, stats] of this.eventStats.entries()) {
      if (stats.timestamp >= cutoffTime) {
        recentEvents.push({
          eventName: stats.eventName,
          count: stats.count,
          timestamp: stats.timestamp,
          data: stats.data.slice(-5) // Son 5 event
        });
      }
    }
    
    return recentEvents.sort((a, b) => b.timestamp - a.timestamp);
  }

  getRecentErrors(minutes = 5) {
    const recentErrors = [];
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    
    for (const [key, stats] of this.errorStats.entries()) {
      if (stats.timestamp >= cutoffTime) {
        recentErrors.push({
          eventName: stats.eventName,
          errorCount: stats.errorCount,
          timestamp: stats.timestamp,
          errors: stats.errors.slice(-3) // Son 3 error
        });
      }
    }
    
    return recentErrors.sort((a, b) => b.timestamp - a.timestamp);
  }

  getRecentPerformance(minutes = 5) {
    const recentPerformance = [];
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    
    for (const [key, stats] of this.performanceMetrics.entries()) {
      if (stats.timestamp >= cutoffTime) {
        const durations = stats.measurements.map(m => m.duration);
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        
        recentPerformance.push({
          eventName: stats.eventName,
          avgDuration: Math.round(avgDuration),
          maxDuration: Math.max(...durations),
          measurementCount: durations.length,
          timestamp: stats.timestamp
        });
      }
    }
    
    return recentPerformance.sort((a, b) => b.timestamp - a.timestamp);
  }
}

module.exports = EventMonitor;