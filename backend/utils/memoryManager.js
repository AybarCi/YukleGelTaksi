/**
 * Memory Management Utility
 * Socket bağlantıları ve room'lar için memory leak koruması sağlar
 */

class MemoryManager {
  constructor() {
    this.cleanupIntervals = new Map();
    this.memoryThresholds = {
      maxConnectedDrivers: 1000,
      maxConnectedCustomers: 5000,
      maxRoomsPerCustomer: 10,
      maxInspectingOrders: 100
    };
    
    // Memory monitoring
    this.memoryStats = {
      lastCleanup: Date.now(),
      cleanupCount: 0,
      leaksDetected: 0
    };
  }

  /**
   * Socket server için memory cleanup başlatır
   */
  startMemoryCleanup(socketServer, intervalMs = 300000) { // 5 dakika
    if (this.cleanupIntervals.has('main')) {
      clearInterval(this.cleanupIntervals.get('main'));
    }

    const cleanupInterval = setInterval(() => {
      this.performMemoryCleanup(socketServer);
    }, intervalMs);

    this.cleanupIntervals.set('main', cleanupInterval);
    console.log(`🧹 Memory cleanup started with ${intervalMs}ms interval`);
  }

  /**
   * Memory cleanup işlemini gerçekleştirir
   */
  performMemoryCleanup(socketServer) {
    console.log('🧹 Starting memory cleanup...');
    const startTime = Date.now();
    let cleanedItems = 0;

    try {
      // 1. Disconnected socket'leri temizle
      cleanedItems += this.cleanupDisconnectedSockets(socketServer);

      // 2. Orphaned room'ları temizle
      cleanedItems += this.cleanupOrphanedRooms(socketServer);

      // 3. Expired inspecting orders'ı temizle
      cleanedItems += this.cleanupExpiredInspections(socketServer);

      // 4. Memory threshold kontrolü
      this.checkMemoryThresholds(socketServer);

      // 5. İstatistikleri güncelle
      this.memoryStats.lastCleanup = Date.now();
      this.memoryStats.cleanupCount++;

      const duration = Date.now() - startTime;
      console.log(`✅ Memory cleanup completed in ${duration}ms, cleaned ${cleanedItems} items`);

    } catch (error) {
      console.error('❌ Memory cleanup error:', error);
    }
  }

  /**
   * Bağlantısı kesilmiş socket'leri temizler
   */
  cleanupDisconnectedSockets(socketServer) {
    let cleaned = 0;

    // Disconnected drivers
    for (const [driverId, driverData] of socketServer.connectedDrivers) {
      const socket = socketServer.io.sockets.sockets.get(driverData.socketId);
      if (!socket || !socket.connected) {
        socketServer.connectedDrivers.delete(driverId);
        cleaned++;
        console.log(`🧹 Cleaned disconnected driver: ${driverId}`);
      }
    }

    // Disconnected customers
    for (const [customerId, customerData] of socketServer.connectedCustomers) {
      const socket = socketServer.io.sockets.sockets.get(customerData.socketId);
      if (!socket || !socket.connected) {
        socketServer.connectedCustomers.delete(customerId);
        cleaned++;
        console.log(`🧹 Cleaned disconnected customer: ${customerId}`);
      }
    }

    return cleaned;
  }

  /**
   * Orphaned room'ları temizler
   */
  cleanupOrphanedRooms(socketServer) {
    let cleaned = 0;

    try {
      const allRooms = socketServer.io.sockets.adapter.rooms;
      
      for (const [roomName, roomData] of allRooms) {
        // Socket.IO'nun kendi room'larını atla
        if (roomName.length === 20) continue; // Socket ID room'ları

        // Customer room kontrolü
        if (roomName.startsWith('customer_')) {
          const customerId = roomName.replace('customer_', '');
          if (!socketServer.connectedCustomers.has(customerId)) {
            // Room'daki tüm socket'leri çıkar
            for (const socketId of roomData) {
              const socket = socketServer.io.sockets.sockets.get(socketId);
              if (socket) {
                socket.leave(roomName);
              }
            }
            cleaned++;
            console.log(`🧹 Cleaned orphaned room: ${roomName}`);
          }
        }

        // Driver room kontrolü
        if (roomName.startsWith('driver_')) {
          const driverId = roomName.replace('driver_', '');
          if (!socketServer.connectedDrivers.has(driverId)) {
            for (const socketId of roomData) {
              const socket = socketServer.io.sockets.sockets.get(socketId);
              if (socket) {
                socket.leave(roomName);
              }
            }
            cleaned++;
            console.log(`🧹 Cleaned orphaned driver room: ${roomName}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error cleaning orphaned rooms:', error);
    }

    return cleaned;
  }

  /**
   * Süresi dolmuş inspection'ları temizler
   */
  cleanupExpiredInspections(socketServer) {
    let cleaned = 0;
    const now = Date.now();
    const maxInspectionTime = 5 * 60 * 1000; // 5 dakika

    if (socketServer.inspectingOrders) {
      for (const [orderId, inspectionData] of socketServer.inspectingOrders) {
        let shouldClean = false;

        if (typeof inspectionData === 'string') {
          // Eski format: sadece driverId
          shouldClean = true;
        } else if (inspectionData.startTime) {
          // Yeni format: timestamp ile
          shouldClean = (now - inspectionData.startTime) > maxInspectionTime;
        }

        if (shouldClean) {
          socketServer.inspectingOrders.delete(orderId);
          cleaned++;
          console.log(`🧹 Cleaned expired inspection for order: ${orderId}`);
        }
      }
    }

    return cleaned;
  }

  /**
   * Memory threshold'larını kontrol eder
   */
  checkMemoryThresholds(socketServer) {
    const stats = {
      connectedDrivers: socketServer.connectedDrivers.size,
      connectedCustomers: socketServer.connectedCustomers.size,
      inspectingOrders: socketServer.inspectingOrders?.size || 0
    };

    // Threshold kontrolü
    if (stats.connectedDrivers > this.memoryThresholds.maxConnectedDrivers) {
      console.warn(`⚠️ Driver count exceeds threshold: ${stats.connectedDrivers}/${this.memoryThresholds.maxConnectedDrivers}`);
      this.memoryStats.leaksDetected++;
    }

    if (stats.connectedCustomers > this.memoryThresholds.maxConnectedCustomers) {
      console.warn(`⚠️ Customer count exceeds threshold: ${stats.connectedCustomers}/${this.memoryThresholds.maxConnectedCustomers}`);
      this.memoryStats.leaksDetected++;
    }

    if (stats.inspectingOrders > this.memoryThresholds.maxInspectingOrders) {
      console.warn(`⚠️ Inspecting orders exceed threshold: ${stats.inspectingOrders}/${this.memoryThresholds.maxInspectingOrders}`);
      this.memoryStats.leaksDetected++;
    }

    // Memory usage log
    console.log(`📊 Memory stats - Drivers: ${stats.connectedDrivers}, Customers: ${stats.connectedCustomers}, Inspections: ${stats.inspectingOrders}`);
  }

  /**
   * Memory cleanup'ı durdurur
   */
  stopMemoryCleanup() {
    for (const [key, interval] of this.cleanupIntervals) {
      clearInterval(interval);
      console.log(`🛑 Stopped memory cleanup: ${key}`);
    }
    this.cleanupIntervals.clear();
  }

  /**
   * Memory istatistiklerini döndürür
   */
  getMemoryStats() {
    return {
      ...this.memoryStats,
      uptime: Date.now() - (this.memoryStats.lastCleanup - 300000), // Approximate uptime
      thresholds: this.memoryThresholds
    };
  }

  /**
   * Threshold değerlerini günceller
   */
  updateThresholds(newThresholds) {
    this.memoryThresholds = { ...this.memoryThresholds, ...newThresholds };
    console.log('📊 Memory thresholds updated:', this.memoryThresholds);
  }

  /**
   * Acil durum memory cleanup
   */
  emergencyCleanup(socketServer) {
    console.log('🚨 Emergency memory cleanup initiated');
    
    // Tüm inspection'ları temizle
    if (socketServer.inspectingOrders) {
      socketServer.inspectingOrders.clear();
    }

    // Disconnected socket'leri agresif temizle
    this.cleanupDisconnectedSockets(socketServer);
    this.cleanupOrphanedRooms(socketServer);

    console.log('🚨 Emergency cleanup completed');
  }
}

module.exports = MemoryManager;