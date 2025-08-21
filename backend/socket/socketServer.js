const { Server: SocketIOServer } = require('socket.io');
const { Server: HTTPServer } = require('http');
const jwt = require('jsonwebtoken');
const DatabaseConnection = require('../config/database.js');

class SocketServer {
  constructor(server) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.connectedDrivers = new Map(); // driverId -> { socketId, location, isAvailable }
    this.connectedCustomers = new Map(); // userId -> { socketId, location }
    this.activeOrders = new Map(); // orderId -> orderData

    this.setupSocketHandlers();
    console.log('Socket.IO server initialized');
  }

  addDriverToCustomerRooms(driverSocket) {
    // Tüm bağlı müşterileri al
    const connectedCustomerIds = Array.from(this.connectedCustomers.keys());
    console.log(`🚗 Adding driver ${driverSocket.driverId} to ${connectedCustomerIds.length} customer rooms`);
    
    connectedCustomerIds.forEach(customerId => {
      const customerRoom = `customer_${customerId}`;
      driverSocket.join(customerRoom);
      console.log(`✅ Driver ${driverSocket.driverId} joined customer room: ${customerRoom}`);
      
      // Bu müşteriye güncellenmiş sürücü listesini gönder
      const customerData = this.connectedCustomers.get(customerId);
      if (customerData) {
        const customerSocket = this.io.sockets.sockets.get(customerData.socketId);
        if (customerSocket) {
          this.sendNearbyDriversToCustomer(customerSocket);
        }
      }
    });
  }

  addAllDriversToCustomerRoom(customerId) {
    const customerRoom = `customer_${customerId}`;
    const connectedDriverIds = Array.from(this.connectedDrivers.keys());
    console.log(`👥 Adding ${connectedDriverIds.length} drivers to customer ${customerId} room`);
    
    connectedDriverIds.forEach(driverId => {
      const driverData = this.connectedDrivers.get(driverId);
      if (driverData) {
        const driverSocket = this.io.sockets.sockets.get(driverData.socketId);
        if (driverSocket) {
          driverSocket.join(customerRoom);
          console.log(`✅ Driver ${driverId} joined customer room: ${customerRoom}`);
        }
      }
    });
  }

  setupSocketHandlers() {
    this.io.use(this.authenticateSocket.bind(this));

    this.io.on('connection', async (socket) => {
      console.log(`Socket connected: ${socket.id}`);
      console.log(`User type: ${socket.userType}, User ID: ${socket.userId}`);

      if (socket.userType === 'driver') {
        await this.handleDriverConnection(socket);
      } else if (socket.userType === 'customer') {
        this.handleCustomerConnection(socket);
      }

      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });

      // Ping-pong for connection health
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });
  }

  async authenticateSocket(socket, next) {
    try {
      const token = socket.handshake.auth.token;
      const refreshToken = socket.handshake.auth.refreshToken;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      try {
        // İlk olarak mevcut token'ı doğrula
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        socket.userId = decoded.userId;
        socket.userType = decoded.userType || 'customer';

        // Eğer sürücü ise, driver ID'sini al
        if (socket.userType === 'driver') {
          const db = DatabaseConnection.getInstance();
          const pool = await db.connect();
          const driverResult = await pool.request()
            .input('userId', socket.userId)
            .query('SELECT id FROM drivers WHERE user_id = @userId AND is_active = 1');
          
          if (driverResult.recordset.length > 0) {
            socket.driverId = driverResult.recordset[0].id;
          }
        }

        next();
      } catch (tokenError) {
        // Token süresi dolmuşsa refresh token ile yenile
        if (tokenError.name === 'TokenExpiredError' && refreshToken) {
          console.log('Token expired, attempting refresh for socket connection');
          
          try {
            const newToken = await this.refreshSocketToken(refreshToken);
            if (newToken) {
              // Yeni token ile tekrar doğrula
              const decoded = jwt.verify(newToken, process.env.JWT_SECRET || 'your-secret-key');
              socket.userId = decoded.userId;
              socket.userType = decoded.userType || 'customer';

              // Eğer sürücü ise, driver ID'sini al
              if (socket.userType === 'driver') {
                const db = DatabaseConnection.getInstance();
                const pool = await db.connect();
                const driverResult = await pool.request()
                  .input('userId', socket.userId)
                  .query('SELECT id FROM drivers WHERE user_id = @userId AND is_active = 1');
                
                if (driverResult.recordset.length > 0) {
                  socket.driverId = driverResult.recordset[0].id;
                }
              }

              // Yeni token'ı client'a gönder
              socket.emit('token_refreshed', { token: newToken });
              console.log(`Token refreshed successfully for user ${socket.userId}`);
              next();
            } else {
              return next(new Error('Token refresh failed'));
            }
          } catch (refreshError) {
            console.error('Token refresh error:', refreshError);
            return next(new Error('Authentication error'));
          }
        } else {
          return next(new Error('Authentication error: Invalid token'));
        }
      }
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  }

  async handleDriverConnection(socket) {
    const driverId = socket.driverId;
    
    try {
      // Eğer bu sürücü zaten bağlıysa, eski bağlantıyı kapat
      const existingDriver = this.connectedDrivers.get(driverId);
      if (existingDriver && existingDriver.socketId !== socket.id) {
        const oldSocket = this.io.sockets.sockets.get(existingDriver.socketId);
        if (oldSocket) {
          console.log(`🔄 Disconnecting old socket ${existingDriver.socketId} for driver ${driverId}`);
          oldSocket.disconnect(true);
        }
      }
      
      // Veritabanından sadece sürücünün müsaitlik durumunu çek
      const db = DatabaseConnection.getInstance();
      const result = await db.query(
        'SELECT is_available FROM drivers WHERE id = @driverId',
        { driverId: driverId }
      );
      
      const isAvailable = result && result.recordset && result.recordset.length > 0 ? result.recordset[0].is_available : true;
      
      // Sürücüyü bağlı sürücüler listesine ekle (konum null olarak başlat)
      this.connectedDrivers.set(driverId, {
        socketId: socket.id,
        location: null,
        isAvailable: isAvailable,
        userType: 'driver',
        userId: driverId
      });
      console.log(`🚗 Driver ${driverId} connected (Socket: ${socket.id}) - Available: ${isAvailable}`);
      
      // Sürücüden konum güncellemesi iste
      socket.emit('request_location_update');
      console.log(`📡 Sent request_location_update to driver ${driverId}`);
    } catch (error) {
      console.error('❌ Error fetching driver availability:', error);
      // Fallback olarak true kullan
      this.connectedDrivers.set(driverId, {
        socketId: socket.id,
        location: null,
        isAvailable: true,
        userType: 'driver',
        userId: driverId
      });
      console.log(`🚗 Driver ${driverId} connected (Socket: ${socket.id}) - Available: true (fallback)`);
    }

    // Sürücüyü tüm aktif müşteri room'larına ekle
    this.addDriverToCustomerRooms(socket);

    // Driver-specific event handlers
    socket.on('location_update', (location) => {
      // Konum güncellemesini memory ve veritabanında yap
      this.updateDriverLocation(driverId, location);
    });

    socket.on('availability_update', (isAvailable) => {
      // Uygunluk durumunu memory ve veritabanında güncelle
      this.updateDriverAvailability(driverId, isAvailable);
    });

    socket.on('accept_order', (orderId) => {
      this.handleOrderAcceptance(driverId, orderId);
    });

    socket.on('update_order_status', ({ orderId, status }) => {
      this.updateOrderStatus(orderId, status, driverId);
    });
  }

  handleCustomerConnection(socket) {
    const customerId = socket.userId;
    
    // Müşteriyi bağlı müşteriler listesine ekle (detaylı bilgilerle)
    this.connectedCustomers.set(customerId, {
      socketId: socket.id,
      location: null,
      userType: 'customer',
      userId: customerId
    });
    
    // Müşteriyi kendi özel odasına ekle
    const customerRoom = `customer_${customerId}`;
    socket.join(customerRoom);
    console.log(`🏠 Customer ${customerId} joined private room: ${customerRoom} (Socket: ${socket.id})`);
    
    // Tüm bağlı sürücüleri bu müşterinin odasına ekle
    this.addAllDriversToCustomerRoom(customerId);
    
    // Odadaki mevcut üyeleri detaylı logla
    this.logRoomMembers(customerRoom);
    
    console.log(`👤 Customer ${customerId} connected`);

    // Send nearby drivers to the newly connected customer
    this.sendNearbyDriversToCustomer(socket);

    // Customer-specific event handlers
    socket.on('create_order', (orderData) => {
      this.createOrder(customerId, orderData);
    });

    socket.on('cancel_order', (orderId) => {
      this.cancelOrder(orderId, customerId);
    });

    socket.on('customer_location_update', (location) => {
      // Müşteri konumunu güncelle
      const customerInfo = this.connectedCustomers.get(customerId);
      if (customerInfo) {
        customerInfo.location = location;
        console.log(`📍 Customer ${customerId} location updated:`, location);
      }
      this.updateCustomerLocation(customerId, location);
      
      // Müşteri konumu değiştiğinde yakındaki sürücüleri yeniden hesapla ve gönder
      this.sendNearbyDriversToCustomer(socket);
    });
  }

  handleDisconnection(socket) {
    console.log(`Socket disconnected: ${socket.id}`);
    
    if (socket.userType === 'driver') {
      const driverId = socket.driverId;
      console.log(`🔍 Before disconnect - Connected drivers count: ${this.connectedDrivers.size}`);
      console.log(`🔍 Driver ${driverId} exists in map: ${this.connectedDrivers.has(driverId)}`);
      
      const driverData = this.connectedDrivers.get(driverId);
      if (driverData && driverData.socketId === socket.id) {
        console.log(`🚗 Driver ${driverId} disconnected (had location: ${driverData.location ? 'Yes' : 'No'}, was available: ${driverData.isAvailable})`);
        
        // Sürücüyü tüm müşteri room'larından çıkar
        this.removeDriverFromAllCustomerRooms(driverId);
        
        // Önce sürücüyü listeden sil
        const deleteResult = this.connectedDrivers.delete(driverId);
        console.log(`🗑️ Driver ${driverId} deleted from map: ${deleteResult}`);
        console.log(`🔍 After delete - Connected drivers count: ${this.connectedDrivers.size}`);
        
        // Müşterilere sürücünün disconnect olduğunu bildir
        this.broadcastToAllCustomers('driver_disconnected', {
          driverId: driverId.toString()
        });
        
        // Tüm müşterilere güncellenmiş sürücü listesini gönder
        this.broadcastNearbyDriversToAllCustomers();
        console.log(`🔌 Driver ${driverId} disconnect broadcasted to all customers`);
      } else if (driverData) {
        console.log(`⚠️ Driver ${driverId} socket ${socket.id} disconnected, but active socket is ${driverData.socketId}`);
      } else {
        console.log(`⚠️ Driver ${driverId} not found in connected drivers map`);
      }
    } else if (socket.userType === 'customer') {
      const customerId = socket.userId;
      const customerData = this.connectedCustomers.get(customerId);
      if (customerData) {
        console.log(`👤 Customer ${customerId} disconnected (had location: ${customerData.location ? 'Yes' : 'No'})`);
        this.connectedCustomers.delete(customerId);
        
        // Müşteri room'undan ayrıl ve room'u temizle
        const customerRoom = `customer_${customerId}`;
        socket.leave(customerRoom);
        
        // Room'daki diğer üyeleri kontrol et ve boşsa room'u temizle
        const roomSockets = this.io.sockets.adapter.rooms.get(customerRoom);
        if (!roomSockets || roomSockets.size === 0) {
          console.log(`🗑️ Customer room ${customerRoom} cleaned (empty room)`);
        } else {
          console.log(`⚠️ Customer room ${customerRoom} still has ${roomSockets.size} members`);
          this.logRoomMembers(customerRoom);
        }
      }
    }
  }

  async updateDriverLocation(driverId, location) {
    try {
      // Önce memory'deki bilgiyi güncelle (anlık takip için)
      const driverInfo = this.connectedDrivers.get(driverId);
      if (driverInfo) {
        driverInfo.location = location;
        console.log(`📍 Driver ${driverId} location updated in memory:`, location);
      }

      // Sonra veritabanını güncelle (persistence için)
      const db = DatabaseConnection.getInstance();
      await db.query(
        'UPDATE users SET current_latitude = @latitude, current_longitude = @longitude, last_location_update = GETDATE() WHERE id = (SELECT user_id FROM drivers WHERE id = @driverId)',
        { latitude: location.latitude, longitude: location.longitude, driverId: driverId }
      );
      
      await db.query(
        'UPDATE drivers SET last_location_update = GETDATE() WHERE id = @driverId',
        { driverId: driverId }
      );

      // Broadcast location to all customers
      this.broadcastDriverLocationToCustomers(driverId, location);
      
      // Tüm müşterilere güncellenmiş sürücü listesini gönder
      this.broadcastNearbyDriversToAllCustomers();
      
      console.log(`✅ Driver ${driverId} location updated in both memory and database`);
    } catch (error) {
      console.error('❌ Error updating driver location:', error);
    }
  }

  async updateDriverAvailability(driverId, isAvailable) {
    try {
      // Önce memory'deki bilgiyi güncelle (anlık takip için)
      const driverInfo = this.connectedDrivers.get(driverId);
      if (driverInfo) {
        driverInfo.isAvailable = isAvailable;
        console.log(`🟢 Driver ${driverId} availability updated in memory: ${isAvailable}`);
      }

      // Sonra veritabanını güncelle (persistence için)
      const db = DatabaseConnection.getInstance();
      await db.query(
        'UPDATE drivers SET is_available = @isAvailable WHERE id = @driverId',
        { isAvailable: isAvailable, driverId: driverId }
      );
      
      console.log(`✅ Driver ${driverId} availability updated in both memory and database: ${isAvailable}`);
    } catch (error) {
      console.error('❌ Error updating driver availability:', error);
    }
  }

  broadcastToAllDrivers(event, data) {
    this.connectedDrivers.forEach((socketId) => {
      this.io.to(socketId).emit(event, data);
    });
  }

  broadcastToAllCustomers(event, data) {
    this.connectedCustomers.forEach((socketId) => {
      this.io.to(socketId).emit(event, data);
    });
  }

  getConnectedDriversCount() {
    return this.connectedDrivers.size;
  }

  getConnectedCustomersCount() {
    return this.connectedCustomers.size;
  }

  // Placeholder methods - implement as needed
  async createOrder(userId, orderData) {
    console.log('Create order called:', userId, orderData);
  }

  async cancelOrder(orderId, userId) {
    console.log('Cancel order called:', orderId, userId);
  }

  async updateCustomerLocation(userId, location) {
    try {
      console.log('📍 Updating customer location in database:', userId, location);
      
      const db = DatabaseConnection.getInstance();
      await db.query(
        'UPDATE users SET current_latitude = @latitude, current_longitude = @longitude, last_location_update = GETDATE(), updated_at = GETDATE() WHERE id = @userId',
        { 
          latitude: location.latitude, 
          longitude: location.longitude, 
          userId: userId 
        }
      );
      
      console.log(`✅ Customer ${userId} location updated in database`);
    } catch (error) {
      console.error('❌ Error updating customer location:', error);
    }
  }

  broadcastDriverLocationToCustomers(driverId, location) {
    // Broadcast driver location update to all connected customers
    this.broadcastToAllCustomers('driver_location_update', {
      driverId: driverId.toString(),
      latitude: location.latitude,
      longitude: location.longitude,
      heading: location.heading || 0
    });
    console.log(`Driver ${driverId} location broadcasted to customers:`, location);
  }

  broadcastNearbyDriversToAllCustomers() {
    // Tüm bağlı müşterilere güncellenmiş sürücü listesini gönder
    this.connectedCustomers.forEach((customerInfo, customerId) => {
      const customerRoom = `customer_${customerId}`;
      const customerSocket = this.io.sockets.sockets.get(customerInfo.socketId);
      if (customerSocket) {
        this.sendNearbyDriversToCustomer(customerSocket);
      }
    });
    console.log(`📡 Nearby drivers list broadcasted to all ${this.connectedCustomers.size} customers`);
  }

  async handleOrderAcceptance(driverId, orderId) {
    console.log('Handle order acceptance called:', driverId, orderId);
  }

  async updateOrderStatus(orderId, status, driverId) {
    console.log('Update order status called:', orderId, status, driverId);
  }

  async sendNearbyDriversToCustomer(socket) {
    try {
      console.log(`🔍 Fetching nearby drivers for customer ${socket.userId}`);
      
      // Bağlı sürücüleri memory'den al (veritabanına gitmeden)
      const connectedDriversArray = Array.from(this.connectedDrivers.entries());
      console.log(`🌐 Connected drivers count: ${connectedDriversArray.length}`);
      
      if (connectedDriversArray.length === 0) {
        console.log(`⚠️ No connected drivers found`);
        const customerRoom = `customer_${socket.userId}`;
        this.io.to(customerRoom).emit('nearbyDriversUpdate', { drivers: [] });
        socket.emit('nearbyDriversUpdate', { drivers: [] });
        return;
      }
      
      // Memory'deki sürücü bilgilerini filtrele ve formatla
      const availableDrivers = connectedDriversArray
        .filter(([driverId, driverInfo]) => {
          // Sadece uygun olan ve konum bilgisi olan sürücüleri al
          return driverInfo.isAvailable && 
                 driverInfo.location && 
                 driverInfo.location.latitude && 
                 driverInfo.location.longitude;
        })
        .map(([driverId, driverInfo]) => ({
          id: driverId.toString(),
          driver_id: driverId.toString(),
          latitude: driverInfo.location.latitude,
          longitude: driverInfo.location.longitude,
          heading: driverInfo.location.heading || 0
        }));

      console.log(`🚗 Available drivers with location: ${availableDrivers.length}`);
      if (availableDrivers.length > 0) {
        console.log(`📍 Driver locations:`, availableDrivers.map(d => ({ 
          id: d.id, 
          lat: d.latitude, 
          lng: d.longitude,
          heading: d.heading
        })));
      }

      // Müşterinin room'una emit et
      const customerRoom = `customer_${socket.userId}`;
      this.io.to(customerRoom).emit('nearbyDriversUpdate', { drivers: availableDrivers });
      
      console.log(`✅ Sent ${availableDrivers.length} nearby drivers to customer ${socket.userId} in room ${customerRoom}`);
      
      // Ayrıca direkt socket'e de gönder (fallback)
      socket.emit('nearbyDriversUpdate', { drivers: availableDrivers });
      
    } catch (error) {
      console.error('❌ Error sending nearby drivers to customer:', error);
      socket.emit('nearbyDriversUpdate', { drivers: [] });
    }
  }

  removeDriverFromAllCustomerRooms(driverId) {
    console.log(`🗑️ Removing driver ${driverId} from all customer rooms`);
    
    // Tüm room'ları kontrol et
    const rooms = this.io.sockets.adapter.rooms;
    let removedFromRooms = [];
    
    rooms.forEach((sockets, roomName) => {
      // Sadece customer room'larını kontrol et
      if (roomName.startsWith('customer_')) {
        // Bu room'daki tüm socket'leri kontrol et
        sockets.forEach(socketId => {
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket && socket.userType === 'driver' && socket.driverId === driverId) {
            socket.leave(roomName);
            removedFromRooms.push(roomName);
            console.log(`  ✅ Driver ${driverId} removed from ${roomName}`);
          }
        });
      }
    });
    
    if (removedFromRooms.length > 0) {
      console.log(`🚗 Driver ${driverId} removed from ${removedFromRooms.length} customer rooms: ${removedFromRooms.join(', ')}`);
      
      // Müşterilere sürücünün çevrimdışı olduğunu bildir
      removedFromRooms.forEach(roomName => {
        this.io.to(roomName).emit('driver_offline', { driverId });
      });
    } else {
      console.log(`ℹ️ Driver ${driverId} was not in any customer rooms`);
    }
  }

  logRoomMembers(roomName) {
    const roomMembers = this.io.sockets.adapter.rooms.get(roomName);
    if (!roomMembers) {
      console.log(`📊 Room ${roomName} is empty`);
      return;
    }

    console.log(`📊 Room ${roomName} has ${roomMembers.size} members:`);
    roomMembers.forEach(socketId => {
      // Socket ID'den kullanıcı bilgilerini bul
      let userInfo = null;
      
      // Sürücüler arasında ara
      for (const [driverId, driverData] of this.connectedDrivers.entries()) {
        if (driverData.socketId === socketId) {
          userInfo = {
            type: 'driver',
            id: driverId,
            socketId: socketId,
            location: driverData.location,
            isAvailable: driverData.isAvailable
          };
          break;
        }
      }
      
      // Müşteriler arasında ara
      if (!userInfo) {
        for (const [customerId, customerData] of this.connectedCustomers.entries()) {
          if (customerData.socketId === socketId) {
            userInfo = {
              type: 'customer',
              id: customerId,
              socketId: socketId,
              location: customerData.location
            };
            break;
          }
        }
      }
      
      if (userInfo) {
        console.log(`  - ${userInfo.type.toUpperCase()} ${userInfo.id} (Socket: ${socketId})`, 
                   userInfo.location ? `Location: ${JSON.stringify(userInfo.location)}` : 'No location',
                   userInfo.type === 'driver' ? `Available: ${userInfo.isAvailable}` : '');
      } else {
        console.log(`  - Unknown user (Socket: ${socketId})`);
      }
    });
  }

  async refreshSocketToken(refreshToken) {
    try {
      // Refresh token'ı doğrula
      const refreshDecoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh-secret');
      
      if (refreshDecoded.type !== 'refresh') {
        console.log('Invalid refresh token type');
        return null;
      }

      // Kullanıcıyı veritabanından al
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();
      
      const userResult = await pool.request()
        .input('userId', refreshDecoded.userId)
        .query('SELECT * FROM users WHERE id = @userId AND is_active = 1');

      const user = userResult.recordset[0];
      if (!user) {
        console.log('User not found for refresh token');
        return null;
      }

      // Yeni access token oluştur
      const newTokenPayload = {
        userId: user.id,
        phone: user.phone_number,
        userType: user.user_type || 'customer'
      };
      
      const newToken = jwt.sign(
        newTokenPayload,
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1h' }
      );

      return newToken;
    } catch (error) {
      console.error('Refresh token error:', error);
      return null;
    }
  }
}

module.exports = SocketServer;