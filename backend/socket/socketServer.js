const { Server: SocketIOServer } = require('socket.io');
const { Server: HTTPServer } = require('http');
const jwt = require('jsonwebtoken');
const sql = require('mssql');
const DatabaseConnection = require('../config/database.js');

class SocketServer {
  constructor(server) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      pingTimeout: 60000, // 60 saniye
      pingInterval: 25000, // 25 saniye
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      connectTimeout: 45000 // 45 saniye
    });
    
    this.connectedDrivers = new Map(); // driverId -> { socketId, location, isAvailable }
    this.connectedCustomers = new Map(); // userId -> { socketId, location }
    this.activeOrders = new Map(); // orderId -> orderData
    this.inspectingOrders = new Map(); // orderId -> driverId (inceleme kilidi)

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
      
      // Sürücü event listener'larını ekle
      socket.on('location_update', (locationData) => {
        console.log(`📍 Received location update from driver ${driverId}:`, locationData);
        this.updateDriverLocation(driverId, locationData);
      });
      
      socket.on('availability_update', (availabilityData) => {
        console.log(`🔄 Received availability update from driver ${driverId}:`, availabilityData);
        this.updateDriverAvailability(driverId, availabilityData.isAvailable);
      });
      
      // Sürücüyü tüm müşteri room'larına ekle
      this.addDriverToCustomerRooms(socket);
      
      // Sürücüden konum güncellemesi iste
      socket.emit('request_location_update');
      console.log(`📡 Sent request_location_update to driver ${driverId}`);
      
      // Konum alındıktan sonra müşterilere gönder - 2 saniye bekle
      setTimeout(() => {
        console.log(`⏰ Broadcasting nearby drivers after driver ${driverId} connection`);
        this.broadcastNearbyDriversToAllCustomers();
      }, 2000);
      
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
      
      // Event listener'ları fallback durumunda da ekle
      socket.on('location_update', (locationData) => {
        console.log(`📍 Received location update from driver ${driverId}:`, locationData);
        this.updateDriverLocation(driverId, locationData);
      });
      
      socket.on('availability_update', (availabilityData) => {
        console.log(`🔄 Received availability update from driver ${driverId}:`, availabilityData);
        this.updateDriverAvailability(driverId, availabilityData.isAvailable);
      });
      
      this.addDriverToCustomerRooms(socket);
      
      // Sürücüden konum güncellemesi iste
      socket.emit('request_location_update');
      
      // Konum alındıktan sonra müşterilere gönder - 2 saniye bekle
      setTimeout(() => {
        console.log(`⏰ Broadcasting nearby drivers after driver ${driverId} connection (fallback)`);
        this.broadcastNearbyDriversToAllCustomers();
      }, 2000);
    }

    // Driver-specific event handlers are already added above

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

    socket.on('inspect_order', async (data) => {
      console.log('🔍 SOCKET: inspect_order event received:', data);
      const { orderId } = data;
      const driverId = socket.driverId;
      
      console.log(`🔍 SOCKET: Driver ${driverId} wants to inspect order ${orderId}`);
      console.log(`🔍 DEBUG: socket.driverId değeri:`, socket.driverId);
      console.log(`🔍 DEBUG: data içeriği:`, JSON.stringify(data));
      console.log(`🔍 DEBUG: orderId değeri:`, orderId);
      
      if (!driverId) {
        console.error('❌ ERROR: driverId bulunamadı!');
        socket.emit('error', { message: 'Driver ID bulunamadı' });
        return;
      }
      
      if (!orderId) {
        console.error('❌ ERROR: orderId bulunamadı!');
        socket.emit('error', { message: 'Order ID bulunamadı' });
        return;
      }
      
      console.log(`🔍 SOCKET: handleOrderInspection çağrılıyor...`);
      const result = await this.handleOrderInspection(driverId, orderId);
      console.log('🔍 DEBUG: handleOrderInspection sonucu:', result);
    });

    socket.on('stop_inspecting_order', (orderId) => {
      this.handleStopInspection(driverId, orderId);
    });

    // Driver offline event handler
    socket.on('driver_going_offline', async () => {
      console.log(`🔴 Driver ${driverId} is going offline voluntarily`);
      
      // Veritabanında sürücünün durumunu offline yap
      await this.updateDriverAvailability(driverId, false);
      
      // Sürücüyü tüm müşteri room'larından çıkar
      this.removeDriverFromAllCustomerRooms(driverId);
      
      // Sürücüyü bağlı sürücüler listesinden sil
      this.connectedDrivers.delete(driverId);
      
      // Müşterilere sürücünün offline olduğunu bildir
      this.broadcastToAllCustomers('driver_went_offline', {
        driverId: driverId.toString()
      });
      
      // Tüm müşterilere güncellenmiş sürücü listesini gönder
      this.broadcastNearbyDriversToAllCustomers();
      
      console.log(`📡 Driver ${driverId} offline event broadcasted to all customers`);
      
      // Socket bağlantısını kapat
      socket.disconnect(true);
    });
  }

  handleCustomerConnection(socket) {
    const customerId = socket.userId;
    
    // Eğer bu müşteri zaten bağlıysa, eski bağlantıyı temizle
    const existingCustomer = this.connectedCustomers.get(customerId);
    if (existingCustomer && existingCustomer.socketId !== socket.id) {
      console.log(`🔄 Customer ${customerId} reconnecting, cleaning old connection`);
      const oldSocket = this.io.sockets.sockets.get(existingCustomer.socketId);
      if (oldSocket) {
        oldSocket.disconnect(true);
      }
    }
    
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
    
    console.log(`👤 Customer ${customerId} connected`);

    // Send nearby drivers to the newly connected customer (sadece bir kez)
    setTimeout(() => {
      this.sendNearbyDriversToCustomer(socket);
    }, 1000);

    // Customer-specific event handlers
    socket.on('create_order', (orderData) => {
      this.createOrder(customerId, orderData);
    });

    socket.on('cancel_order', (orderId) => {
      this.cancelOrder(orderId, customerId);
    });

    socket.on('cancel_order_with_code', (data) => {
      this.cancelOrderWithCode(data.orderId, data.confirmCode, customerId);
    });

    socket.on('customer_location_update', (location) => {
      // Müşteri konumunu güncelle
      const customerInfo = this.connectedCustomers.get(customerId);
      const previousLocation = customerInfo ? customerInfo.location : null;
      
      if (customerInfo) {
        customerInfo.location = location;
        console.log(`📍 Customer ${customerId} location updated:`, location);
      }
      this.updateCustomerLocation(customerId, location);
      
      // Sadece önemli konum değişikliklerinde sürücü listesini yeniden gönder
      // Eğer önceki konum yoksa veya 100 metreden fazla değişiklik varsa güncelle
      let shouldUpdateDrivers = !previousLocation;
      
      if (previousLocation && !shouldUpdateDrivers) {
        const distance = this.calculateDistance(
          previousLocation.latitude, previousLocation.longitude,
          location.latitude, location.longitude
        );
        // 100 metreden fazla değişiklik varsa güncelle
        shouldUpdateDrivers = distance > 0.1; // 0.1 km = 100 metre
      }
      
      if (shouldUpdateDrivers) {
        console.log(`🔄 Significant location change detected, updating nearby drivers for customer ${customerId}`);
        this.sendNearbyDriversToCustomer(socket);
      } else {
        console.log(`📍 Minor location change, skipping driver list update for customer ${customerId}`);
      }
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
      
      // Tüm müşterilere güncellenmiş sürücü listesini gönder
      this.broadcastNearbyDriversToAllCustomers();
      console.log(`📡 Broadcasted nearby drivers update after availability change for driver ${driverId}`);
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

  // Send message to specific customer
  sendToCustomer(customerId, event, data) {
    const customerData = this.connectedCustomers.get(customerId);
    if (customerData && customerData.socketId) {
      this.io.to(customerData.socketId).emit(event, data);
      console.log(`Message sent to customer ${customerId}: ${event}`);
    } else {
      console.log(`Customer ${customerId} not connected`);
    }
  }

  // İki koordinat arasındaki mesafeyi hesapla (km cinsinden)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Dünya'nın yarıçapı (km)
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // km cinsinden mesafe
  }

  // Derece'yi radyan'a çevir
  toRadians(degrees) {
    return degrees * (Math.PI/180);
  }

  getConnectedDriversCount() {
    return this.connectedDrivers.size;
  }

  getConnectedCustomersCount() {
    return this.connectedCustomers.size;
  }

  // Placeholder methods - implement as needed
  async createOrder(userId, orderData) {
    console.log('Creating order for user:', userId, 'with data:', orderData);
    
    try {
      // Sipariş oluşturulduktan sonra sürücülere bildirim gönder
      this.broadcastToAllDrivers('order_created', {
        orderId: orderData.orderId || orderData.id,
        customerId: userId,
        ...orderData
      });
      
      console.log(`Order created and broadcasted to drivers for user ${userId}`);
    } catch (error) {
      console.error('Error in createOrder:', error);
    }
  }

  async cancelOrder(orderId, userId) {
    console.log('🔴 cancelOrder method called with orderId:', orderId, 'userId:', userId);
    try {
      const DatabaseConnection = require('../config/database');
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Sipariş bilgilerini al
      const orderResult = await pool.request()
        .input('orderId', orderId)
        .input('userId', userId)
        .query(`
          SELECT id, order_status, total_price, created_at, driver_id
          FROM orders 
          WHERE id = @orderId AND user_id = @userId AND order_status IN ('pending', 'accepted', 'started', 'inspecting')
        `);

      if (orderResult.recordset.length === 0) {
        console.log('🔴 Order not found or cannot be cancelled. orderId:', orderId, 'userId:', userId);
        const customerData = this.connectedCustomers.get(userId);
        if (customerData && customerData.socketId) {
          this.io.to(customerData.socketId).emit('cancel_order_error', { 
            message: 'Sipariş bulunamadı veya iptal edilemez durumda.' 
          });
        }
        return;
      }

      const order = orderResult.recordset[0];
      let cancellationFee = 0;

      // Cezai tutar hesaplama - backoffice'ten tanımlanan yüzdeleri kullan
      const feeResult = await pool.request()
        .input('orderStatus', order.order_status)
        .query(`
          SELECT fee_percentage 
          FROM cancellation_fees 
          WHERE order_status = @orderStatus AND is_active = 1
        `);

      if (feeResult.recordset.length > 0) {
        const feePercentage = feeResult.recordset[0].fee_percentage;
        cancellationFee = Math.round(order.total_price * (feePercentage / 100));
      } else {
        // Fallback: Eski sistem
        if (order.order_status === 'pending' || order.order_status === 'driver_accepted_awaiting_customer') {
          cancellationFee = 0;
        } else {
          cancellationFee = Math.round(order.total_price * 0.25); // Default %25
        }
      }

      // 4 haneli onay kodu oluştur
      const confirmCode = Math.floor(1000 + Math.random() * 9000).toString();
      console.log('🔑 CONFIRM CODE GENERATED for Order', orderId + ':', confirmCode);
      console.log('💰 Cancellation Fee:', cancellationFee, 'TL');
      console.log('📝 Saving confirm code to database...');

      // Onay kodunu veritabanına kaydet (sipariş durumunu henüz değiştirme)
      await pool.request()
        .input('orderId', orderId)
        .input('confirmCode', confirmCode)
        .input('cancellationFee', cancellationFee)
        .query(`
          UPDATE orders 
          SET cancellation_confirm_code = @confirmCode,
              cancellation_fee = @cancellationFee,
              updated_at = GETDATE()
          WHERE id = @orderId
        `);
      
      console.log('✅ Confirm code saved to database successfully for Order', orderId);

      // Müşteriye iptal onay modalı gönder
      const customerData = this.connectedCustomers.get(userId);
      console.log('🔴 Sending cancel_order_confirmation_required to customer', userId, 'customerData:', customerData);
      if (customerData && customerData.socketId) {
        this.io.to(customerData.socketId).emit('cancel_order_confirmation_required', {
          orderId,
          confirmCode,
          cancellationFee,
          orderStatus: order.order_status,
          message: cancellationFee > 0 
            ? `Sipariş iptal edilecek. Cezai tutar: ${cancellationFee} TL. Onaylamak için kodu girin: ${confirmCode}`
            : `Sipariş ücretsiz iptal edilecek. Onaylamak için kodu girin: ${confirmCode}`
        });
        console.log('🔴 cancel_order_confirmation_required event sent successfully to socket:', customerData.socketId);
      } else {
        console.log('🔴 Customer socket not found for userId:', userId);
      }

    } catch (error) {
      console.error('Error cancelling order:', error);
      const customerData = this.connectedCustomers.get(userId);
      if (customerData && customerData.socketId) {
        this.io.to(customerData.socketId).emit('cancel_order_error', { 
          message: 'Sipariş iptal edilirken bir hata oluştu.' 
        });
      }
    }
  }

  async cancelOrderWithCode(orderId, confirmCode, userId) {
    console.log('🔴 cancelOrderWithCode method called with orderId:', orderId, 'confirmCode:', confirmCode, 'userId:', userId);
    try {
      const DatabaseConnection = require('../config/database');
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Sipariş bilgilerini ve confirm code'u kontrol et
      const orderResult = await pool.request()
        .input('orderId', orderId)
        .input('userId', userId)
        .input('confirmCode', confirmCode)
        .query(`
          SELECT id, order_status, total_price, cancellation_confirm_code, cancellation_fee, driver_id
          FROM orders 
          WHERE id = @orderId AND user_id = @userId AND cancellation_confirm_code = @confirmCode
        `);

      if (orderResult.recordset.length === 0) {
        console.log('🔴 Order not found or confirm code mismatch. orderId:', orderId, 'userId:', userId);
        const customerSocketId = this.connectedCustomers.get(userId);
        if (customerSocketId) {
          this.io.to(customerSocketId).emit('cancel_order_error', { 
            message: 'Sipariş bulunamadı veya doğrulama kodu yanlış.' 
          });
        }
        return;
      }

      const order = orderResult.recordset[0];
      console.log('✅ Confirm code verified, proceeding with cancellation for Order', orderId);

      // Siparişi gerçekten iptal et
      await pool.request()
        .input('orderId', orderId)
        .query(`
          UPDATE orders 
          SET order_status = 'cancelled',
              updated_at = GETDATE()
          WHERE id = @orderId
        `);

      console.log('✅ Order cancelled successfully in database for Order', orderId);

      // Eğer sipariş inspecting durumundaysa, inspectingOrders Map'inden kaldır
      if (order.order_status === 'inspecting') {
        this.inspectingOrders.delete(orderId);
        console.log('🔍 Removed order from inspecting list:', orderId);
      }

      // Müşteriye başarılı iptal mesajı gönder
      const customerSocketId = this.connectedCustomers.get(userId);
      if (customerSocketId) {
        this.io.to(customerSocketId).emit('order_cancelled_successfully', {
          orderId,
          message: 'Sipariş başarıyla iptal edildi.',
          cancellationFee: order.cancellation_fee
        });
        console.log('✅ order_cancelled_successfully event sent to customer', userId);
      }

      // Eğer sürücü atanmışsa, sürücüye de bildir
      if (order.driver_id) {
        const driverData = this.connectedDrivers.get(order.driver_id);
        if (driverData) {
          const driverSocketId = driverData.socketId;
          this.io.to(driverSocketId).emit('order_cancelled_by_customer', {
            orderId,
            message: 'Müşteri siparişi iptal etti.'
          });
          console.log('✅ order_cancelled_by_customer event sent to driver', order.driver_id);
        }
      }

      // Tüm sürücülere sipariş iptal edildi bilgisi gönder
      this.broadcastToAllDrivers('order_cancelled', {
        orderId,
        message: 'Sipariş müşteri tarafından iptal edildi.'
      });

    } catch (error) {
      console.error('Error in cancelOrderWithCode:', error);
      const customerSocketId = this.connectedCustomers.get(userId);
      if (customerSocketId) {
        this.io.to(customerSocketId).emit('cancel_order_error', { 
          message: 'Sipariş iptal edilirken bir hata oluştu.' 
        });
      }
    }
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
    // Validate inputs
    if (!driverId || !location) {
      console.error('❌ Invalid parameters for broadcastDriverLocationToCustomers:', { driverId, location });
      return;
    }

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
      
      // Sadece gerçekten bağlı olan sürücüleri göster (bellekten)
      const connectedDriversWithLocation = [];
      
      for (const [driverId, driverData] of this.connectedDrivers) {
        console.log(`🔍 Checking driver ${driverId}:`, {
          hasLocation: !!driverData.location,
          isAvailable: driverData.isAvailable,
          location: driverData.location
        });
        
        // Konum ve müsaitlik kontrolü - daha esnek hale getirdik
        if (driverData.location && (driverData.isAvailable !== false)) {
          // Veritabanından sürücü detaylarını getir
          const db = DatabaseConnection.getInstance();
          const pool = await db.connect();
          
          const result = await pool.request()
            .input('driverId', driverId)
            .query(`
              SELECT 
                d.id,
                d.first_name,
                d.last_name,
                d.vehicle_plate,
                d.vehicle_model,
                d.vehicle_color,
                d.is_active,
                d.is_available
              FROM drivers d
              WHERE d.id = @driverId AND d.is_active = 1
            `);
          
          if (result.recordset && result.recordset.length > 0) {
            const driver = result.recordset[0];
            console.log(`✅ Adding driver ${driverId} to nearby list:`, {
              name: driver.first_name,
              isActive: driver.is_active,
              isAvailable: driver.is_available,
              location: driverData.location
            });
            
            connectedDriversWithLocation.push({
              id: driver.id.toString(),
              latitude: driverData.location.latitude,
              longitude: driverData.location.longitude,
              heading: driverData.location.heading || 0,
              name: driver.first_name,
              vehicle: `${driver.vehicle_color} ${driver.vehicle_model}`,
              plate: driver.vehicle_plate
            });
          } else {
            console.log(`❌ Driver ${driverId} not found in database or not active`);
          }
        } else {
          console.log(`❌ Driver ${driverId} skipped - no location or not available`);
        }
      }
      
      const drivers = connectedDriversWithLocation;
      
      console.log(`🚗 Available drivers with location: ${drivers.length}`);
      if (drivers.length > 0) {
        console.log(`📍 Driver locations:`, drivers.map(d => ({ 
          id: d.id, 
          lat: d.latitude, 
          lng: d.longitude,
          heading: d.heading,
          name: d.name
        })));
      }

      // Müşterinin room'una emit et
      const customerRoom = `customer_${socket.userId}`;
      this.io.to(customerRoom).emit('nearbyDriversUpdate', { drivers });
      
      console.log(`✅ Sent ${drivers.length} nearby drivers to customer ${socket.userId} in room ${customerRoom}`);
      
      // Ayrıca direkt socket'e de gönder (fallback)
      socket.emit('nearbyDriversUpdate', { drivers });
      
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

  async handleOrderInspection(driverId, orderId) {
    try {
      // orderId'yi düzelt - eğer object ise id property'sini al
      let actualOrderId = orderId;
      if (typeof orderId === 'object' && orderId !== null) {
        actualOrderId = orderId.id || orderId.orderId;
      }
      
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // orderId'yi integer'a çevir
      const orderIdInt = parseInt(actualOrderId);

      // Siparişin durumunu kontrol et
      const orderCheck = await pool.request()
        .input('orderId', sql.Int, orderIdInt)
        .query(`SELECT order_status, driver_id FROM orders WHERE id = @orderId`);
      
      if (orderCheck.recordset.length === 0 || orderCheck.recordset[0].order_status !== 'pending') {
        const driverData = this.connectedDrivers.get(driverId);
        if (driverData) {
          this.io.to(driverData.socketId).emit('order_no_longer_available', { orderId });
        }
        return;
      }

      // Başka bir sürücü inceliyor mu kontrol et
      if (this.inspectingOrders.has(actualOrderId)) {
        const inspectingDriverId = this.inspectingOrders.get(actualOrderId);
        if (inspectingDriverId !== driverId) {
          const driverData = this.connectedDrivers.get(driverId);
          if (driverData) {
            this.io.to(driverData.socketId).emit('order_being_inspected', { 
              orderId, 
              message: 'Bu sipariş başka bir sürücü tarafından inceleniyor' 
            });
          }
          return;
        }
      }

      // Siparişi inceleme listesine ekle
      this.inspectingOrders.set(actualOrderId, driverId);

      // Siparişi "inspecting" durumuna getir (driver_id set etme)
      await pool.request()
        .input('orderId', sql.Int, orderIdInt)
        .query(`
          UPDATE orders 
          SET order_status = 'inspecting'
          WHERE id = @orderId AND order_status = 'pending'
        `);

      // Diğer sürücülere bu siparişin incelendiğini bildir
      this.connectedDrivers.forEach((driverData, otherDriverId) => {
        if (otherDriverId !== driverId) {
          this.io.to(driverData.socketId).emit('order_locked_for_inspection', { orderId: actualOrderId });
        }
      });
      
      // Tüm sürücülere order_status_update gönder
      this.broadcastToAllDrivers('order_status_update', { orderId: actualOrderId, status: 'inspecting' });

      // Müşteriye siparişin incelendiğini bildir
      const orderResult = await pool.request()
        .input('orderId', sql.Int, orderIdInt)
        .query(`SELECT user_id FROM orders WHERE id = @orderId`);
      
      if (orderResult.recordset.length > 0) {
        const customerId = orderResult.recordset[0].user_id;
        const customerRoom = `customer_${customerId}`;
        
        // Customer room'una sipariş inceleme durumu gönder
        this.io.to(customerRoom).emit('order_inspection_started', {
          orderId: actualOrderId,
          status: 'inspecting',
          message: 'Siparişiniz bir sürücü tarafından inceleniyor'
        });
        
        // Müşteriye order_status_update da gönder
        this.io.to(customerRoom).emit('order_status_update', {
          orderId: actualOrderId,
          status: 'inspecting',
          message: 'Siparişiniz inceleniyor'
        });
      }

      // İnceleyen sürücüye sipariş detaylarını gönder
      const driverData = this.connectedDrivers.get(driverId);
      if (driverData) {
        const orderDetails = await this.getOrderDetails(actualOrderId);
        this.io.to(driverData.socketId).emit('order_inspection_started', {
          orderId: actualOrderId,
          orderDetails
        });
      }

      console.log(`Order ${actualOrderId} is being inspected by driver ${driverId}`);
    } catch (error) {
      console.error('Error handling order inspection:', error);
    }
  }

  async broadcastOrderToNearbyDrivers(orderId, orderData) {
    try {
      console.log(`📡 Broadcasting order ${orderId} to nearby drivers with vehicle_type_id: ${orderData.vehicle_type_id}`);
      
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();
      
      let matchingDriversCount = 0;
      
      // Tüm bağlı ve müsait sürücülere sipariş bilgisini gönder (araç tipi kontrolü ile)
      for (const [driverId, driverInfo] of this.connectedDrivers) {
        if (driverInfo.isAvailable && driverInfo.location) {
          try {
            // Sürücünün araç tipini kontrol et
            const driverResult = await pool.request()
              .input('driverId', driverId)
              .query(`
                SELECT vehicle_type_id 
                FROM drivers 
                WHERE id = @driverId AND is_active = 1
              `);
            
            if (driverResult.recordset.length > 0) {
              const driverVehicleTypeId = driverResult.recordset[0].vehicle_type_id;
              
              // Araç tipi eşleşiyorsa siparişi gönder
              if (driverVehicleTypeId === orderData.vehicle_type_id) {
                const driverSocket = this.io.sockets.sockets.get(driverInfo.socketId);
                if (driverSocket) {
                  driverSocket.emit('new_order_available', {
                    orderId,
                    ...orderData
                  });
                  matchingDriversCount++;
                  console.log(`✅ Order ${orderId} sent to driver ${driverId} (vehicle_type_id: ${driverVehicleTypeId})`);
                }
              } else {
                console.log(`❌ Driver ${driverId} skipped - vehicle type mismatch (driver: ${driverVehicleTypeId}, order: ${orderData.vehicle_type_id})`);
              }
            } else {
              console.log(`❌ Driver ${driverId} not found or inactive`);
            }
          } catch (driverError) {
            console.error(`❌ Error checking driver ${driverId} vehicle type:`, driverError);
          }
        }
      }
      
      console.log(`📡 Order ${orderId} broadcasted to ${matchingDriversCount} matching drivers out of ${this.connectedDrivers.size} total drivers`);
    } catch (error) {
      console.error('❌ Error broadcasting order to drivers:', error);
      throw error;
    }
  }

  async handleStopInspection(driverId, orderId) {
    try {
      // orderId'yi düzelt - eğer object ise id property'sini al
      let actualOrderId = orderId;
      if (typeof orderId === 'object' && orderId !== null) {
        actualOrderId = orderId.id || orderId.orderId;
      }
      
      // İnceleme kilidini kaldır
      this.inspectingOrders.delete(actualOrderId);

      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // orderId'yi integer'a çevir
      const orderIdInt = parseInt(actualOrderId);

      // Siparişi tekrar pending durumuna getir
      const updateResult = await pool.request()
        .input('orderId', sql.Int, orderIdInt)
        .query(`
          UPDATE orders 
          SET order_status = 'pending', driver_id = NULL
          WHERE id = @orderId AND order_status = 'inspecting'
        `);
      
      // Tüm sürücülere siparişin tekrar müsait olduğunu bildir
      this.broadcastToAllDrivers('order_available_again', { orderId: actualOrderId });
      this.broadcastToAllDrivers('order_status_update', { orderId: actualOrderId, status: 'pending' });

      // Müşteriye incelemenin bittiğini bildir
      const orderResult = await pool.request()
        .input('orderId', sql.Int, orderIdInt)
        .query(`SELECT user_id FROM orders WHERE id = @orderId`);
      
      if (orderResult.recordset.length > 0) {
        const customerId = orderResult.recordset[0].user_id;
        const customerRoom = `customer_${customerId}`;
        
        this.io.to(customerRoom).emit('order_inspection_stopped', {
          orderId: actualOrderId,
          status: 'pending',
          message: 'Sipariş incelemesi tamamlandı, tekrar beklemede'
        });
        
        this.io.to(customerRoom).emit('order_status_update', {
          orderId: actualOrderId,
          status: 'pending',
          message: 'Siparişiniz tekrar beklemede'
        });
      }

      console.log(`Driver ${driverId} stopped inspecting order ${actualOrderId}`);
    } catch (error) {
      console.error('Error stopping order inspection:', error);
    }
  }

  async getOrderDetails(orderId) {
    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();
      
      const result = await pool.request()
        .input('orderId', orderId)
        .query(`
          SELECT o.*, u.first_name, u.last_name, u.phone_number
          FROM orders o
          LEFT JOIN users u ON o.user_id = u.id
          WHERE o.id = @orderId
        `);
      
      return result.recordset[0] || null;
    } catch (error) {
      console.error('Error getting order details:', error);
      return null;
    }
  }
}

module.exports = SocketServer;