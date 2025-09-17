const socketRateLimiter = require('../middleware/rateLimiter.js');

/**
 * Socket event'lerini rate limiting ile wrap eden utility
 */
class SocketEventWrapper {
  /**
   * Event handler'ı rate limiting ile wrap et
   * @param {string} eventType - Event tipi (location_update, order_create, vb.)
   * @param {function} handler - Orijinal event handler fonksiyonu
   * @param {object} options - Ek seçenekler
   * @returns {function} Wrap edilmiş handler fonksiyonu
   */
  static wrapWithRateLimit(eventType, handler, options = {}) {
    return async function(socket, ...args) {
      try {
        // Socket'ten kullanıcı bilgilerini al
        const userId = socket.userId || socket.id;
        const ip = socket.handshake.address || socket.conn.remoteAddress || 'unknown';
        
        // Rate limit kontrolü
        const rateLimitResult = socketRateLimiter.checkRateLimit(userId, ip, eventType);
        
        if (!rateLimitResult.allowed) {
          // Rate limit aşıldı
          console.log(`🚫 Rate limit exceeded for user ${userId}, event: ${eventType}`);
          
          // Kullanıcıya rate limit hatası gönder
          socket.emit('rate_limit_exceeded', {
            eventType: eventType,
            message: 'Çok fazla istek gönderiyorsunuz. Lütfen bekleyin.',
            remaining: rateLimitResult.remaining,
            resetTime: rateLimitResult.resetTime,
            retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
          });
          
          return;
        }
        
        // Rate limit geçti, orijinal handler'ı çalıştır
        await handler.call(this, socket, ...args);
        
      } catch (error) {
        console.error(`❌ Error in wrapped event handler for ${eventType}:`, error);
        
        // Hata durumunda kullanıcıya bilgi ver
        socket.emit('event_error', {
          eventType: eventType,
          message: 'İşlem sırasında bir hata oluştu.',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
      }
    };
  }

  /**
   * Birden fazla event'i aynı anda wrap et
   * @param {object} events - { eventType: handler } şeklinde event map'i
   * @param {object} options - Ek seçenekler
   * @returns {object} Wrap edilmiş event map'i
   */
  static wrapMultipleEvents(events, options = {}) {
    const wrappedEvents = {};
    
    for (const [eventType, handler] of Object.entries(events)) {
      wrappedEvents[eventType] = this.wrapWithRateLimit(eventType, handler, options);
    }
    
    return wrappedEvents;
  }

  /**
   * Socket'e event listener'ları rate limiting ile ekle
   * @param {object} socket - Socket instance
   * @param {object} events - { eventType: handler } şeklinde event map'i
   * @param {object} context - Handler'ların çalışacağı context (this)
   * @param {object} options - Ek seçenekler
   */
  static addRateLimitedListeners(socket, events, context, options = {}) {
    for (const [eventType, handler] of Object.entries(events)) {
      const wrappedHandler = this.wrapWithRateLimit(eventType, handler, options);
      socket.on(eventType, (...args) => wrappedHandler.call(context, socket, ...args));
    }
  }

  /**
   * Spam detection - aynı event'in çok kısa sürede tekrarlanması
   * @param {string} userId - Kullanıcı ID'si
   * @param {string} eventType - Event tipi
   * @param {any} eventData - Event verisi
   * @returns {boolean} Spam ise true
   */
  static detectSpam(userId, eventType, eventData) {
    const key = `${userId}_${eventType}`;
    const now = Date.now();
    
    if (!this.lastEvents) {
      this.lastEvents = new Map();
    }
    
    const lastEvent = this.lastEvents.get(key);
    
    if (lastEvent) {
      const timeDiff = now - lastEvent.timestamp;
      
      // Aynı event 100ms içinde tekrarlanıyorsa spam olarak değerlendir
      if (timeDiff < 100) {
        console.log(`🚨 Spam detected for user ${userId}, event: ${eventType}`);
        return true;
      }
      
      // Aynı veri ile event 1 saniye içinde tekrarlanıyorsa spam
      if (timeDiff < 1000 && JSON.stringify(eventData) === JSON.stringify(lastEvent.data)) {
        console.log(`🚨 Duplicate event spam detected for user ${userId}, event: ${eventType}`);
        return true;
      }
    }
    
    // Son event'i kaydet
    this.lastEvents.set(key, {
      timestamp: now,
      data: eventData
    });
    
    // Eski kayıtları temizle (5 dakikadan eski)
    if (now % 1000 === 0) { // Her 1000. çağrıda temizlik yap
      for (const [eventKey, eventInfo] of this.lastEvents.entries()) {
        if (now - eventInfo.timestamp > 5 * 60 * 1000) {
          this.lastEvents.delete(eventKey);
        }
      }
    }
    
    return false;
  }

  /**
   * Event validation - event verilerinin geçerliliğini kontrol et
   * @param {string} eventType - Event tipi
   * @param {any} eventData - Event verisi
   * @returns {object} { valid: boolean, error?: string }
   */
  static validateEventData(eventType, eventData) {
    const validators = {
      'location_update': (data) => {
        if (!data || typeof data !== 'object') {
          return { valid: false, error: 'Location data is required' };
        }
        
        if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
          return { valid: false, error: 'Valid latitude and longitude are required' };
        }
        
        if (data.latitude < -90 || data.latitude > 90) {
          return { valid: false, error: 'Latitude must be between -90 and 90' };
        }
        
        if (data.longitude < -180 || data.longitude > 180) {
          return { valid: false, error: 'Longitude must be between -180 and 180' };
        }
        
        return { valid: true };
      },
      
      'order_create': (data) => {
        if (!data || typeof data !== 'object') {
          return { valid: false, error: 'Order data is required' };
        }
        
        if (!data.pickup_location || !data.destination_location) {
          return { valid: false, error: 'Pickup and destination locations are required' };
        }
        
        return { valid: true };
      },
      
      'order_accept': (data) => {
        if (!data || !data.orderId) {
          return { valid: false, error: 'Order ID is required' };
        }
        
        return { valid: true };
      }
    };
    
    const validator = validators[eventType];
    if (validator) {
      return validator(eventData);
    }
    
    // Varsayılan validation - boş değil
    if (eventData === null || eventData === undefined) {
      return { valid: false, error: 'Event data cannot be null or undefined' };
    }
    
    return { valid: true };
  }
}

module.exports = SocketEventWrapper;