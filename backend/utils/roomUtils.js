const crypto = require('crypto');

/**
 * Room güvenliği için UUID tabanlı room isimlendirme utility'si
 */
class RoomUtils {
  constructor() {
    // Room mapping cache - memory'de tutulacak
    this.customerRoomMap = new Map(); // userId -> roomId
    this.driverRoomMap = new Map(); // driverId -> roomId
    this.roomUserMap = new Map(); // roomId -> {type, userId}
  }

  /**
   * Müşteri için güvenli room ID oluştur
   * @param {string|number} customerId - Müşteri ID'si
   * @returns {string} Güvenli room ID
   */
  getCustomerRoomId(customerId) {
    const key = `customer_${customerId}`;
    
    if (this.customerRoomMap.has(key)) {
      return this.customerRoomMap.get(key);
    }

    // UUID tabanlı güvenli room ID oluştur
    const roomId = `cr_${crypto.randomUUID().replace(/-/g, '')}`;
    
    this.customerRoomMap.set(key, roomId);
    this.roomUserMap.set(roomId, { type: 'customer', userId: customerId });
    
    console.log(`🔐 Created secure customer room: ${customerId} -> ${roomId}`);
    return roomId;
  }

  /**
   * Sürücü için güvenli room ID oluştur
   * @param {string|number} driverId - Sürücü ID'si
   * @returns {string} Güvenli room ID
   */
  getDriverRoomId(driverId) {
    const key = `driver_${driverId}`;
    
    if (this.driverRoomMap.has(key)) {
      return this.driverRoomMap.get(key);
    }

    // UUID tabanlı güvenli room ID oluştur
    const roomId = `dr_${crypto.randomUUID().replace(/-/g, '')}`;
    
    this.driverRoomMap.set(key, roomId);
    this.roomUserMap.set(roomId, { type: 'driver', userId: driverId });
    
    console.log(`🔐 Created secure driver room: ${driverId} -> ${roomId}`);
    return roomId;
  }

  /**
   * Room ID'den kullanıcı bilgisini al
   * @param {string} roomId - Room ID
   * @returns {object|null} {type, userId} veya null
   */
  getRoomUser(roomId) {
    return this.roomUserMap.get(roomId) || null;
  }

  /**
   * Kullanıcının room ID'sini al
   * @param {string} type - 'customer' veya 'driver'
   * @param {string|number} userId - Kullanıcı ID'si
   * @returns {string|null} Room ID veya null
   */
  getUserRoomId(type, userId) {
    const key = `${type}_${userId}`;
    
    if (type === 'customer') {
      return this.customerRoomMap.get(key) || null;
    } else if (type === 'driver') {
      return this.driverRoomMap.get(key) || null;
    }
    
    return null;
  }

  /**
   * Kullanıcının room'unu temizle
   * @param {string} type - 'customer' veya 'driver'
   * @param {string|number} userId - Kullanıcı ID'si
   */
  clearUserRoom(type, userId) {
    const key = `${type}_${userId}`;
    let roomId = null;
    
    if (type === 'customer') {
      roomId = this.customerRoomMap.get(key);
      this.customerRoomMap.delete(key);
    } else if (type === 'driver') {
      roomId = this.driverRoomMap.get(key);
      this.driverRoomMap.delete(key);
    }
    
    if (roomId) {
      this.roomUserMap.delete(roomId);
      console.log(`🧹 Cleared room mapping: ${key} -> ${roomId}`);
    }
  }

  /**
   * Tüm room mapping'leri temizle
   */
  clearAllRooms() {
    this.customerRoomMap.clear();
    this.driverRoomMap.clear();
    this.roomUserMap.clear();
    console.log('🧹 All room mappings cleared');
  }

  /**
   * Room istatistiklerini al
   * @returns {object} Room istatistikleri
   */
  getRoomStats() {
    return {
      customerRooms: this.customerRoomMap.size,
      driverRooms: this.driverRoomMap.size,
      totalRooms: this.roomUserMap.size
    };
  }

  /**
   * Room ID'nin geçerli olup olmadığını kontrol et
   * @param {string} roomId - Kontrol edilecek room ID
   * @returns {boolean} Geçerli ise true
   */
  isValidRoomId(roomId) {
    return this.roomUserMap.has(roomId);
  }
}

// Singleton instance
const roomUtils = new RoomUtils();

module.exports = roomUtils;