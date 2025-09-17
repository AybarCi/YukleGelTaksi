const rateLimit = require('express-rate-limit');

/**
 * Socket event'leri için rate limiting ve spam koruması
 */
class SocketRateLimiter {
  constructor() {
    // Kullanıcı başına event sayacı - memory'de tutulacak
    this.userEventCounts = new Map(); // userId -> { eventType -> { count, lastReset } }
    this.ipEventCounts = new Map(); // ip -> { eventType -> { count, lastReset } }
    
    // Rate limit ayarları
    this.limits = {
      // Genel event limitleri (dakika başına)
      'location_update': { max: 60, window: 60000 }, // 60 saniyede 60 konum güncellemesi
      'order_create': { max: 5, window: 60000 }, // 60 saniyede 5 sipariş oluşturma
      'order_cancel': { max: 10, window: 60000 }, // 60 saniyede 10 sipariş iptal
      'order_accept': { max: 20, window: 60000 }, // 60 saniyede 20 sipariş kabul
      'order_inspection': { max: 30, window: 60000 }, // 60 saniyede 30 inceleme
      'driver_availability': { max: 30, window: 60000 }, // 60 saniyede 30 müsaitlik değişimi
      
      // Genel event limiti (tüm event'ler için)
      'global': { max: 200, window: 60000 }, // 60 saniyede toplam 200 event
      
      // IP bazlı limitler (daha sıkı)
      'ip_global': { max: 500, window: 60000 } // IP başına 60 saniyede 500 event
    };
    
    // Temizlik interval'ı - her 5 dakikada bir eski kayıtları temizle
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
    
    console.log('🛡️ Socket Rate Limiter initialized');
  }

  /**
   * Event rate limit kontrolü
   * @param {string} userId - Kullanıcı ID'si
   * @param {string} ip - IP adresi
   * @param {string} eventType - Event tipi
   * @returns {object} { allowed: boolean, remaining: number, resetTime: number }
   */
  checkRateLimit(userId, ip, eventType) {
    const now = Date.now();
    
    // Kullanıcı bazlı kontrol
    const userResult = this.checkUserLimit(userId, eventType, now);
    if (!userResult.allowed) {
      console.log(`🚫 Rate limit exceeded for user ${userId}, event: ${eventType}`);
      return userResult;
    }
    
    // IP bazlı kontrol
    const ipResult = this.checkIpLimit(ip, eventType, now);
    if (!ipResult.allowed) {
      console.log(`🚫 Rate limit exceeded for IP ${ip}, event: ${eventType}`);
      return ipResult;
    }
    
    // Global kontrol (kullanıcı bazlı)
    const globalResult = this.checkUserLimit(userId, 'global', now);
    if (!globalResult.allowed) {
      console.log(`🚫 Global rate limit exceeded for user ${userId}`);
      return globalResult;
    }
    
    // IP global kontrol
    const ipGlobalResult = this.checkIpLimit(ip, 'ip_global', now);
    if (!ipGlobalResult.allowed) {
      console.log(`🚫 IP global rate limit exceeded for IP ${ip}`);
      return ipGlobalResult;
    }
    
    // Tüm kontroller geçti, sayaçları artır
    this.incrementCounter(userId, eventType, now, 'user');
    this.incrementCounter(userId, 'global', now, 'user');
    this.incrementCounter(ip, eventType, now, 'ip');
    this.incrementCounter(ip, 'ip_global', now, 'ip');
    
    return {
      allowed: true,
      remaining: Math.min(userResult.remaining - 1, ipResult.remaining - 1),
      resetTime: Math.max(userResult.resetTime, ipResult.resetTime)
    };
  }

  /**
   * Kullanıcı bazlı limit kontrolü
   */
  checkUserLimit(userId, eventType, now) {
    return this.checkLimit(userId, eventType, now, 'user');
  }

  /**
   * IP bazlı limit kontrolü
   */
  checkIpLimit(ip, eventType, now) {
    const limitKey = eventType === 'ip_global' ? 'ip_global' : eventType;
    return this.checkLimit(ip, limitKey, now, 'ip');
  }

  /**
   * Genel limit kontrolü
   */
  checkLimit(identifier, eventType, now, type) {
    const storage = type === 'user' ? this.userEventCounts : this.ipEventCounts;
    const limit = this.limits[eventType];
    
    if (!limit) {
      // Tanımlanmamış event tipi için varsayılan limit
      return { allowed: true, remaining: 100, resetTime: now + 60000 };
    }
    
    if (!storage.has(identifier)) {
      storage.set(identifier, {});
    }
    
    const userEvents = storage.get(identifier);
    
    if (!userEvents[eventType]) {
      userEvents[eventType] = { count: 0, lastReset: now };
    }
    
    const eventData = userEvents[eventType];
    
    // Window süresi geçmişse sayacı sıfırla
    if (now - eventData.lastReset >= limit.window) {
      eventData.count = 0;
      eventData.lastReset = now;
    }
    
    const remaining = Math.max(0, limit.max - eventData.count);
    const resetTime = eventData.lastReset + limit.window;
    
    return {
      allowed: eventData.count < limit.max,
      remaining: remaining,
      resetTime: resetTime
    };
  }

  /**
   * Sayacı artır
   */
  incrementCounter(identifier, eventType, now, type) {
    const storage = type === 'user' ? this.userEventCounts : this.ipEventCounts;
    
    if (!storage.has(identifier)) {
      storage.set(identifier, {});
    }
    
    const events = storage.get(identifier);
    
    if (!events[eventType]) {
      events[eventType] = { count: 0, lastReset: now };
    }
    
    events[eventType].count++;
  }

  /**
   * Eski kayıtları temizle
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 dakika
    
    // Kullanıcı kayıtlarını temizle
    for (const [userId, events] of this.userEventCounts.entries()) {
      let hasActiveEvents = false;
      
      for (const [eventType, data] of Object.entries(events)) {
        if (now - data.lastReset < maxAge) {
          hasActiveEvents = true;
        } else {
          delete events[eventType];
        }
      }
      
      if (!hasActiveEvents || Object.keys(events).length === 0) {
        this.userEventCounts.delete(userId);
      }
    }
    
    // IP kayıtlarını temizle
    for (const [ip, events] of this.ipEventCounts.entries()) {
      let hasActiveEvents = false;
      
      for (const [eventType, data] of Object.entries(events)) {
        if (now - data.lastReset < maxAge) {
          hasActiveEvents = true;
        } else {
          delete events[eventType];
        }
      }
      
      if (!hasActiveEvents || Object.keys(events).length === 0) {
        this.ipEventCounts.delete(ip);
      }
    }
    
    console.log(`🧹 Rate limiter cleanup completed. Users: ${this.userEventCounts.size}, IPs: ${this.ipEventCounts.size}`);
  }

  /**
   * Kullanıcının tüm rate limit verilerini temizle
   */
  clearUserLimits(userId) {
    this.userEventCounts.delete(userId);
    console.log(`🧹 Cleared rate limits for user: ${userId}`);
  }

  /**
   * IP'nin tüm rate limit verilerini temizle
   */
  clearIpLimits(ip) {
    this.ipEventCounts.delete(ip);
    console.log(`🧹 Cleared rate limits for IP: ${ip}`);
  }

  /**
   * Rate limiter istatistiklerini al
   */
  getStats() {
    return {
      activeUsers: this.userEventCounts.size,
      activeIPs: this.ipEventCounts.size,
      limits: this.limits
    };
  }

  /**
   * Temizlik interval'ını durdur
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.userEventCounts.clear();
    this.ipEventCounts.clear();
    
    console.log('🛡️ Socket Rate Limiter destroyed');
  }
}

// Singleton instance
const socketRateLimiter = new SocketRateLimiter();

module.exports = socketRateLimiter;