const { Server: SocketIOServer } = require('socket.io');
const { Server: HTTPServer } = require('http');
const { EventEmitter } = require('events');
const jwt = require('jsonwebtoken');
const sql = require('mssql');
const DatabaseConnection = require('../config/database.js');
const roomUtils = require('../utils/roomUtils.js');
const socketRateLimiter = require('../middleware/rateLimiter.js');
const SocketEventWrapper = require('../utils/socketEventWrapper.js');
const MemoryManager = require('../utils/memoryManager.js');
const EventMonitor = require('../utils/eventMonitor.js');
const SocketMonitoringEmitter = require('../utils/socketMonitoringEmitter.js');

class SocketServer extends EventEmitter {
  constructor(server) {
    super(); // EventEmitter constructor'ını çağır
    
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
    this.inspectingOrders = new Map(); // orderId -> { driverId, startTime }

    // Memory management
    this.memoryManager = new MemoryManager();
    
    // Event monitoring
    this.eventMonitor = new EventMonitor();
    
    // Monitoring emitter
    this.monitoringEmitter = new SocketMonitoringEmitter(this);

    this.setupSocketHandlers();
    
    // Memory cleanup başlat
    this.memoryManager.startMemoryCleanup(this, 300000); // 5 dakika
    
    // Event monitoring başlat
    this.eventMonitor.startMonitoring();
    
    // Real-time monitoring data emission başlat
    this.startMonitoringEmission();
    
    // 🚀 OPTIMIZASYON: Periyodik oda temizliği başlat (her 5 dakikada bir)
    this.startPeriodicRoomValidation();
    
    console.log('🚀 Socket.IO server initialized with memory management and event monitoring');
  }

  async addDriverToCustomerRooms(driverSocket) {
    try {
      // Sürücünün konumu yoksa room'lara ekleme
      const driverData = this.connectedDrivers.get(driverSocket.driverId);
      if (!driverData || !driverData.location) {
        console.log(`⚠️ Driver ${driverSocket.driverId} has no location, skipping room assignments`);
        return;
      }

      const driverLocation = driverData.location;
      console.log(`📍 Driver ${driverSocket.driverId} location:`, driverLocation);

      // Sistem ayarlarından arama yarıçapını al
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();
      
      const settingsResult = await pool.request()
        .query(`SELECT setting_value FROM system_settings WHERE setting_key = 'driver_search_radius_km' AND is_active = 'true'`);
      
      const searchRadiusKm = settingsResult.recordset.length > 0 
        ? parseFloat(settingsResult.recordset[0].setting_value) 
        : 5; // varsayılan 5km
      
      console.log(`🎯 Search radius for driver room assignment: ${searchRadiusKm} km`);

      // Tüm bağlı müşterileri al ve yarıçap kontrolü yap
      const connectedCustomerIds = Array.from(this.connectedCustomers.keys());
      console.log(`🚗 Checking driver ${driverSocket.driverId} against ${connectedCustomerIds.length} customers`);
      
      let joinedRooms = 0;
      
      for (const customerId of connectedCustomerIds) {
        const customerData = this.connectedCustomers.get(customerId);
        
        // Müşterinin konumu varsa mesafe kontrolü yap
        if (customerData && customerData.location) {
          const distance = this.calculateDistance(
            driverLocation.latitude,
            driverLocation.longitude,
            customerData.location.latitude,
            customerData.location.longitude
          );
          
          console.log(`📏 Distance to customer ${customerId}: ${distance.toFixed(2)} km`);
          
          // Yarıçap içindeyse room'a ekle
          if (distance <= searchRadiusKm) {
            const customerRoom = roomUtils.getCustomerRoomId(customerId);
            driverSocket.join(customerRoom);
            joinedRooms++;
            console.log(`✅ Driver ${driverSocket.driverId} joined customer room: ${customerRoom} (${distance.toFixed(2)}km)`);
            
            // Bu müşteriye güncellenmiş sürücü listesini gönder
            const customerSocket = this.io.sockets.sockets.get(customerData.socketId);
            if (customerSocket) {
              this.sendNearbyDriversToCustomer(customerSocket);
            }
          } else {
            console.log(`❌ Customer ${customerId} too far (${distance.toFixed(2)}km > ${searchRadiusKm}km)`);
          }
        } else {
          console.log(`⚠️ Customer ${customerId} has no location, skipping`);
        }
      }
      
      console.log(`🏠 Driver ${driverSocket.driverId} joined ${joinedRooms} customer rooms out of ${connectedCustomerIds.length} customers`);
      
    } catch (error) {
      console.error(`❌ Error adding driver ${driverSocket.driverId} to customer rooms:`, error);
      
      // 🚀 OPTIMIZASYON: Güvenlik açığını kapatmak için fallback mekanizmasını kaldır
      // Hata durumunda sürücüyü hiçbir odaya ekleme, sadece hata logla
      console.log(`🔒 Security: Driver ${driverSocket.driverId} not added to any rooms due to error (preventing security vulnerability)`);
      
      // Event monitoring için hata kaydet
      if (this.eventMonitor) {
        this.eventMonitor.recordError('addDriverToCustomerRooms', error.message);
      }
      
      // Hata durumunda periyodik validasyon mekanizması devreye girecek
      console.log(`⏰ Periodic room validation will handle this driver in the next cycle`);
    }
  }

  async addAllDriversToCustomerRoom(customerId) {
    try {
      const customerRoom = roomUtils.getCustomerRoomId(customerId);
      const connectedDriverIds = Array.from(this.connectedDrivers.keys());
      console.log(`👥 Checking ${connectedDriverIds.length} drivers for customer ${customerId} room with radius control`);
      
      // Müşterinin konum bilgisini al
      const customerData = this.connectedCustomers.get(customerId);
      if (!customerData || !customerData.location) {
        console.log(`⚠️ Customer ${customerId} has no location, cannot add drivers to room`);
        return;
      }

      // Sistem ayarlarından arama yarıçapını ve konum güncellik süresini al
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();
      
      const settingsResult = await pool.request()
        .query(`SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('driver_search_radius_km', 'driver_location_update_interval_minutes') AND is_active = 'true'`);
      
      const settings = {};
      settingsResult.recordset.forEach(row => {
        settings[row.setting_key] = parseFloat(row.setting_value);
      });
      
      const searchRadiusKm = settings['driver_search_radius_km'] || 5; // varsayılan 5km
      const locationUpdateIntervalMinutes = settings['driver_location_update_interval_minutes'] || 10; // varsayılan 10 dakika
      
      console.log(`🎯 Search radius for customer room assignment: ${searchRadiusKm} km`);
      console.log(`⏰ Location update interval: ${locationUpdateIntervalMinutes} minutes`);

      // Bağlı sürücülerin veritabanı durumlarını kontrol et
      if (connectedDriverIds.length === 0) {
        console.log(`⚠️ No connected drivers to check for customer ${customerId}`);
        return;
      }

      const driverIds = connectedDriverIds.map(id => parseInt(id)).filter(id => !isNaN(id));
      if (driverIds.length === 0) {
        console.log(`⚠️ No valid driver IDs found for customer ${customerId}`);
        return;
      }

      // Veritabanından sürücü durumlarını kontrol et (is_approved, is_active, is_available ve konum güncellik)
      const driverValidationResult = await pool.request()
        .query(`
          SELECT 
            d.id,
            d.is_approved,
            d.is_active,
            d.is_available,
            u.current_latitude,
            u.current_longitude,
            u.last_location_update,
            ABS(DATEDIFF(minute, u.last_location_update, DATEADD(hour, 3, GETDATE()))) as minutes_since_update
          FROM drivers d
          INNER JOIN users u ON d.user_id = u.id
          WHERE d.id IN (${driverIds.join(',')})
            AND d.is_approved = 1
            AND d.is_active = 1
            AND d.is_available = 1
            AND u.current_latitude IS NOT NULL 
            AND u.current_longitude IS NOT NULL
            AND ABS(DATEDIFF(minute, u.last_location_update, DATEADD(hour, 3, GETDATE()))) <= ${locationUpdateIntervalMinutes}
        `);

      const validDriversFromDB = new Set();
      const driverLocationsFromDB = new Map();
      
      driverValidationResult.recordset.forEach(driver => {
        validDriversFromDB.add(driver.id.toString());
        driverLocationsFromDB.set(driver.id.toString(), {
          latitude: driver.current_latitude,
          longitude: driver.current_longitude,
          lastUpdate: driver.last_location_update,
          minutesSinceUpdate: driver.minutes_since_update
        });
      });

      console.log(`🔍 Database validation: ${driverValidationResult.recordset.length} out of ${connectedDriverIds.length} drivers passed all criteria (approved, active, available, recent location)`);

      let joinedDrivers = 0;
      
      connectedDriverIds.forEach(driverId => {
        const driverData = this.connectedDrivers.get(driverId);
        
        // Önce veritabanı validasyonunu kontrol et
        if (!validDriversFromDB.has(driverId)) {
          console.log(`❌ Driver ${driverId} skipped - failed database validation (not approved/active/available or stale location)`);
          return;
        }
        
        if (driverData && driverData.location && driverData.isAvailable) {
          const driverSocket = this.io.sockets.sockets.get(driverData.socketId);
          if (driverSocket) {
            // Mesafe kontrolü yap (memory'deki konum ile)
            const distance = this.calculateDistance(
              customerData.location.latitude,
              customerData.location.longitude,
              driverData.location.latitude,
              driverData.location.longitude
            );
            
            // Yarıçap içindeyse room'a ekle
            if (distance <= searchRadiusKm) {
              driverSocket.join(customerRoom);
              joinedDrivers++;
              const dbLocation = driverLocationsFromDB.get(driverId);
              console.log(`✅ Driver ${driverId} joined customer room: ${customerRoom} (${distance.toFixed(2)}km) - DB location updated ${dbLocation?.minutesSinceUpdate || 'N/A'} minutes ago`);
            } else {
              console.log(`❌ Driver ${driverId} too far for customer ${customerId} (${distance.toFixed(2)}km > ${searchRadiusKm}km)`);
            }
          }
        } else {
          console.log(`⚠️ Driver ${driverId} skipped - no location in memory or not available in memory`);
        }
      });
      
      console.log(`🏠 Added ${joinedDrivers} drivers to customer ${customerId} room out of ${connectedDriverIds.length} total drivers`);
      
    } catch (error) {
      console.error(`❌ Error adding drivers to customer ${customerId} room:`, error);
    }
  }

  setupSocketHandlers() {
    this.io.use(this.authenticateSocket.bind(this));

    this.io.on('connection', async (socket) => {
      const startTime = Date.now();
      
      console.log(`Socket connected: ${socket.id}`);
      console.log(`User type: ${socket.userType}, User ID: ${socket.userId}`);
      
      // Connection event tracking
      this.eventMonitor.trackEvent('socket_connection', {
        socketId: socket.id,
        userType: socket.userType,
        userId: socket.userId
      });

      try {
        if (socket.userType === 'driver') {
          await this.handleDriverConnection(socket);
        } else if (socket.userType === 'customer') {
          this.handleCustomerConnection(socket);
        } else if (socket.userType === 'supervisor') {
          // Supervisor bağlantısı için özel handling - sadece monitoring için
          console.log(`👨‍💼 Supervisor ${socket.userId} connected for monitoring`);
        }
        
        // Connection performance tracking
        this.eventMonitor.trackPerformance('socket_connection_setup', startTime);
      } catch (error) {
        this.eventMonitor.trackError('socket_connection_setup', error, {
          socketId: socket.id,
          userType: socket.userType,
          userId: socket.userId
        });
      }

      socket.on('disconnect', () => {
        this.eventMonitor.trackEvent('socket_disconnect', {
          socketId: socket.id,
          userType: socket.userType,
          userId: socket.userId
        });
        this.handleDisconnection(socket);
      });

      // Ping-pong for connection health
      socket.on('ping', () => {
        this.eventMonitor.trackEvent('socket_ping', { socketId: socket.id });
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
        
        // Supervisor token için özel handling
        if (decoded.supervisorId) {
          socket.userId = decoded.supervisorId;
          socket.userType = 'supervisor';
        } else {
          socket.userId = decoded.userId;
          socket.userType = decoded.userType || 'customer';
        }

        // Eğer sürücü ise, driver ID'sini al
        if (socket.userType === 'driver') {
          const db = DatabaseConnection.getInstance();
          const pool = await db.connect();
          const driverResult = await pool.request()
            .input('userId', socket.userId)
            .query('SELECT id FROM drivers WHERE user_id = @userId AND is_active = \'true\'');
          
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
              
              // Supervisor token için özel handling
              if (decoded.supervisorId) {
                socket.userId = decoded.supervisorId;
                socket.userType = 'supervisor';
              } else {
                socket.userId = decoded.userId;
                socket.userType = decoded.userType || 'customer';
              }

              // Eğer sürücü ise, driver ID'sini al
              if (socket.userType === 'driver') {
                const db = DatabaseConnection.getInstance();
                const pool = await db.connect();
                const driverResult = await pool.request()
                  .input('userId', socket.userId)
                  .query('SELECT id FROM drivers WHERE user_id = @userId AND is_active = \'true\'');
                
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
    
    console.log(`🚗 Driver ${driverId} attempting to connect...`);
    
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
      console.log(`🚗 Total connected drivers: ${this.connectedDrivers.size}`);
      
      // Sürücü event listener'larını rate limiting ile ekle
      const driverEvents = {
        'location_update': (socket, locationData) => {
          console.log(`📍 Received location update from driver ${driverId}:`, locationData);
          
          // Spam detection
          if (SocketEventWrapper.detectSpam(driverId, 'location_update', locationData)) {
            socket.emit('spam_warning', { 
              message: 'Çok hızlı konum güncellemesi gönderiyorsunuz.' 
            });
            return;
          }
          
          // Data validation
          const validation = SocketEventWrapper.validateEventData('location_update', locationData);
          if (!validation.valid) {
            socket.emit('validation_error', { 
              eventType: 'location_update',
              message: validation.error 
            });
            return;
          }
          
          this.updateDriverLocation(driverId, locationData);
        },
        
        'availability_update': (socket, availabilityData) => {
          console.log(`🔄 Received availability update from driver ${driverId}:`, availabilityData);
          
          // Data validation
          if (!availabilityData || typeof availabilityData.isAvailable !== 'boolean') {
            socket.emit('validation_error', { 
              eventType: 'availability_update',
              message: 'Valid availability status is required' 
            });
            return;
          }
          
          this.updateDriverAvailability(driverId, availabilityData.isAvailable);
        }
      };
      
      SocketEventWrapper.addRateLimitedListeners(socket, driverEvents, this);
      
      // Sürücüyü tüm müşteri room'larına ekle (yarıçap bazlı)
      await this.addDriverToCustomerRooms(socket);
      
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
      
      // 🚀 OPTIMIZASYON: Güvenlik açığını kapatmak için fallback mekanizmasını iyileştir
      // Varsayılan olarak false kullan ve sürücüyü odalara ekleme
      this.connectedDrivers.set(driverId, {
        socketId: socket.id,
        location: null,
        isAvailable: false, // Güvenlik için false
        userType: 'driver',
        userId: driverId
      });
      console.log(`🚗 Driver ${driverId} connected (Socket: ${socket.id}) - Available: false (secure fallback)`);
      
      // Event monitoring için hata kaydet
      if (this.eventMonitor) {
        this.eventMonitor.recordError('handleDriverConnection', error.message);
      }
      
      // Event listener'ları ekle ama odalara ekleme
      socket.on('location_update', (locationData) => {
        console.log(`📍 Received location update from driver ${driverId}:`, locationData);
        this.updateDriverLocation(driverId, locationData);
      });
      
      socket.on('availability_update', (availabilityData) => {
        console.log(`🔄 Received availability update from driver ${driverId}:`, availabilityData);
        this.updateDriverAvailability(driverId, availabilityData.isAvailable);
      });
      
      // Hata durumunda odalara ekleme - periyodik validasyon devreye girecek
      console.log(`🔒 Security: Driver ${driverId} not added to rooms due to connection error`);
      
      // Sürücüden konum güncellemesi iste
      socket.emit('request_location_update');
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
      
      // Sadece ilgili müşterilere sürücünün offline olduğunu bildir
      this.broadcastDriverStatusToRelevantCustomers(driverId, 'driver_went_offline', {
        driverId: driverId.toString()
      });
      
      // Tüm müşterilere güncellenmiş sürücü listesini gönder
      this.broadcastNearbyDriversToAllCustomers();
      
      console.log(`📡 Driver ${driverId} offline event broadcasted to all customers`);
      
      // Socket bağlantısını kapat
      socket.disconnect(true);
    });
  }

  async handleCustomerConnection(socket) {
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
    const customerRoom = roomUtils.getCustomerRoomId(customerId);
    socket.join(customerRoom);
    console.log(`🏠 Customer ${customerId} joined private room: ${customerRoom} (Socket: ${socket.id})`);
    
    // Tüm bağlı sürücüleri bu müşterinin odasına ekle (yarıçap kontrolü ile)
    await this.addAllDriversToCustomerRoom(customerId);
    
    console.log(`👤 Customer ${customerId} connected`);

    // Send nearby drivers to the newly connected customer (sadece bir kez)
    setTimeout(() => {
      this.sendNearbyDriversToCustomer(socket);
    }, 1000);

    // Customer-specific event handlers with rate limiting
    const customerEvents = {
      'create_order': (socket, orderData) => {
        // Data validation
        const validation = SocketEventWrapper.validateEventData('order_create', orderData);
        if (!validation.valid) {
          socket.emit('validation_error', { 
            eventType: 'create_order',
            message: validation.error 
          });
          return;
        }
        
        this.createOrder(customerId, orderData);
      },
      
      'cancel_order': (socket, orderId) => {
        // Data validation
        if (!orderId) {
          socket.emit('validation_error', { 
            eventType: 'cancel_order',
            message: 'Order ID is required' 
          });
          return;
        }
        
        this.cancelOrder(orderId, customerId);
      },
      
      'cancel_order_with_code': (socket, data) => {
        // Data validation
        if (!data || !data.orderId || !data.confirmCode) {
          socket.emit('validation_error', { 
            eventType: 'cancel_order_with_code',
            message: 'Order ID and confirmation code are required' 
          });
          return;
        }
        
        this.cancelOrderWithCode(data.orderId, data.confirmCode, customerId);
      },
      
      'customer_location_update': (socket, location) => {
        console.log(`📍 Customer ${customerId} location update received:`, location);
        
        // Spam detection
        if (SocketEventWrapper.detectSpam(customerId, 'customer_location_update', location)) {
          socket.emit('spam_warning', { 
            message: 'Çok hızlı konum güncellemesi gönderiyorsunuz.' 
          });
          return;
        }
        
        // Data validation
        const validation = SocketEventWrapper.validateEventData('location_update', location);
        if (!validation.valid) {
          socket.emit('validation_error', { 
            eventType: 'customer_location_update',
            message: validation.error 
          });
          return;
        }
        
        // Müşteri konumunu güncelle
        const customerInfo = this.connectedCustomers.get(customerId);
        const previousLocation = customerInfo ? customerInfo.location : null;
        
        console.log(`📍 Previous customer location:`, previousLocation);
        console.log(`📍 New customer location:`, location);
        
        if (customerInfo) {
          customerInfo.location = location;
          console.log(`📍 Customer ${customerId} location updated in memory:`, location);
        } else {
          console.log(`❌ Customer ${customerId} not found in connectedCustomers`);
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
          console.log(`📏 Distance from previous location: ${distance.toFixed(3)}km, shouldUpdate: ${shouldUpdateDrivers}`);
        }
        
        if (shouldUpdateDrivers) {
          console.log(`🔄 Significant location change detected, updating nearby drivers for customer ${customerId}`);
          this.sendNearbyDriversToCustomer(socket);
        } else {
          console.log(`📍 Minor location change, skipping driver list update for customer ${customerId}`);
        }
      }
    };
    
    SocketEventWrapper.addRateLimitedListeners(socket, customerEvents, this);
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
        
        // Sadece ilgili müşterilere sürücünün disconnect olduğunu bildir
        this.broadcastDriverStatusToRelevantCustomers(driverId, 'driver_disconnected', {
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
        const customerRoom = roomUtils.getUserRoomId('customer', customerId);
        if (customerRoom) {
          socket.leave(customerRoom);
          roomUtils.clearUserRoom('customer', customerId);
        }
        
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
      console.log(`🔍 DEBUG: updateDriverLocation called for driver ${driverId} with location:`, location);
      
      // Önce memory'deki bilgiyi güncelle (anlık takip için)
      const driverInfo = this.connectedDrivers.get(driverId);
      if (driverInfo) {
        driverInfo.location = location;
        console.log(`📍 Driver ${driverId} location updated in memory:`, location);
      } else {
        console.log(`⚠️ WARNING: Driver ${driverId} not found in connectedDrivers map`);
      }

      // Sonra veritabanını güncelle (persistence için)
      console.log(`💾 DEBUG: Attempting to update database for driver ${driverId}`);
      const db = DatabaseConnection.getInstance();
      
      // Users tablosunu güncelle
      console.log(`📝 DEBUG: Updating users table for driver ${driverId}`);
      try {
        const usersResult = await db.query(
          'UPDATE users SET current_latitude = @latitude, current_longitude = @longitude, last_location_update = DATEADD(hour, 3, GETDATE()) WHERE id = (SELECT user_id FROM drivers WHERE id = @driverId)',
          { latitude: location.latitude, longitude: location.longitude, driverId: driverId }
        );
        console.log(`✅ DEBUG: Users table update result:`, usersResult);
        // UPDATE sorguları için rowsAffected bilgisini kontrol et
        if (usersResult && usersResult.rowsAffected !== undefined) {
          console.log(`📊 DEBUG: Users table rows affected:`, usersResult.rowsAffected);
        } else {
          console.log(`⚠️ DEBUG: Users table - rowsAffected bilgisi alınamadı:`, usersResult);
        }
      } catch (usersError) {
        console.error(`❌ DEBUG: Users table update error:`, usersError.message);
        console.error(`🔍 DEBUG: Users table error stack:`, usersError.stack);
      }
      
      // Drivers tablosunu güncelle
      console.log(`📝 DEBUG: Updating drivers table for driver ${driverId}`);
      try {
        const driversResult = await db.query(
          'UPDATE drivers SET current_latitude = @latitude, current_longitude = @longitude, last_location_update = DATEADD(hour, 3, GETDATE()) WHERE id = @driverId',
          { latitude: location.latitude, longitude: location.longitude, driverId: driverId }
        );
        console.log(`✅ DEBUG: Drivers table update result:`, driversResult);
        // UPDATE sorguları için rowsAffected bilgisini kontrol et
        if (driversResult && driversResult.rowsAffected !== undefined) {
          console.log(`📊 DEBUG: Drivers table rows affected:`, driversResult.rowsAffected);
        } else {
          console.log(`⚠️ DEBUG: Drivers table - rowsAffected bilgisi alınamadı:`, driversResult);
        }
      } catch (driversError) {
        console.error(`❌ DEBUG: Drivers table update error:`, driversError.message);
        console.error(`🔍 DEBUG: Drivers table error stack:`, driversError.stack);
      }

      // 🚀 OPTIMIZASYON: Konum güncellemesi sonrası oda üyeliklerini yeniden düzenle
      const driverSocket = this.getDriverSocket(driverId);
      if (driverSocket && driverInfo && driverInfo.isAvailable) {
        console.log(`🔄 Re-arranging room memberships for driver ${driverId} after location update`);
        
        // Önce tüm müşteri odalarından çıkar
        this.removeDriverFromAllCustomerRooms(driverId);
        
        // Sonra yeni konuma göre uygun odalara ekle
        await this.addDriverToCustomerRooms(driverSocket);
      }

      // Broadcast location to all customers
      this.broadcastDriverLocationToCustomers(driverId, location);
      
      // Tüm müşterilere güncellenmiş sürücü listesini gönder
      this.broadcastNearbyDriversToAllCustomers();
      
      console.log(`✅ Driver ${driverId} location updated in both memory and database`);
    } catch (error) {
      console.error('❌ Error updating driver location:', error);
      console.error('❌ Error stack:', error.stack);
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
      
      // 🚀 OPTIMIZASYON: Availability değişikliğinde oda kontrolü
      const driverSocket = this.getDriverSocket(driverId);
      if (driverSocket && driverInfo && driverInfo.location) {
        if (isAvailable) {
          // Çevrimiçi olduğunda yarıçap kontrolü ile odalara ekle
          console.log(`🔄 Driver ${driverId} going online - adding to appropriate customer rooms`);
          await this.addDriverToCustomerRooms(driverSocket);
        } else {
          // Çevrimdışı olduğunda tüm odalardan çıkar
          console.log(`🔄 Driver ${driverId} going offline - removing from all customer rooms`);
          this.removeDriverFromAllCustomerRooms(driverId);
        }
      }
      
      // Tüm müşterilere güncellenmiş sürücü listesini gönder
      this.broadcastNearbyDriversToAllCustomers();
      console.log(`📡 Broadcasted nearby drivers update after availability change for driver ${driverId}`);
    } catch (error) {
      console.error('❌ Error updating driver availability:', error);
    }
  }

  // 🚨 DEPRECATED: Bu fonksiyon güvenlik riski taşır - tüm sürücülere broadcast yapar
  // Bunun yerine broadcastToOrderRelatedDrivers() veya broadcastToCustomerRoomDrivers() kullanın
  broadcastToAllDrivers(event, data) {
    console.warn(`⚠️ SECURITY WARNING: broadcastToAllDrivers is deprecated and unsafe. Use targeted broadcast instead.`);
    console.log(`📡 Broadcasting ${event} to all ${this.connectedDrivers.size} connected drivers:`, data);
    this.connectedDrivers.forEach((driverData, driverId) => {
      if (driverData && driverData.socketId) {
        this.io.to(driverData.socketId).emit(event, data);
        console.log(`✅ Event ${event} sent to driver ${driverId} (socket: ${driverData.socketId})`);
      } else {
        console.warn(`⚠️ Invalid driver data for driver ${driverId}:`, driverData);
      }
    });
  }

  // 🔒 Güvenli broadcast: Sadece müşteri odasındaki sürücülere gönder
  broadcastToCustomerRoomDrivers(customerId, event, data) {
    const customerRoom = roomUtils.getCustomerRoomId(customerId);
    this.io.to(customerRoom).emit(event, data);
    console.log(`🎯 Broadcast to customer ${customerId} room (${customerRoom}): ${event}`);
  }

  // 🔒 Güvenli broadcast: Sipariş ile ilgili sürücülere gönder (yakındaki + müşteri odası)
  async broadcastToOrderRelatedDrivers(orderId, event, data) {
    try {
      // Siparişin müşteri ID'sini al
      const orderDetails = await this.getOrderDetails(orderId);
      if (!orderDetails) {
        console.error(`❌ Order ${orderId} not found for broadcast`);
        return;
      }

      const customerId = orderDetails.user_id;
      const customerRoom = roomUtils.getCustomerRoomId(customerId);
      
      // Müşteri odasındaki sürücülere gönder
      this.io.to(customerRoom).emit(event, data);
      console.log(`🎯 Broadcast to order ${orderId} related drivers in room ${customerRoom}: ${event}`);
      
    } catch (error) {
      console.error(`❌ Error broadcasting to order related drivers:`, error);
      
      // 🚀 OPTIMIZASYON: Güvenlik açığını kapatmak için fallback mekanizmasını iyileştir
      // Tüm sürücülere göndermek yerine sadece hata logla ve işlemi atla
      console.log(`🔒 Security: Broadcast to order ${orderId} failed, skipping to prevent unnecessary data exposure`);
      
      // Event monitoring için hata kaydet
      if (this.eventMonitor) {
        this.eventMonitor.recordError('broadcastToOrderRelatedDrivers', error.message);
      }
    }
  }

  // 🔒 Güvenli broadcast: Sadece belirli müşterinin yakındaki sürücülere gönder
  broadcastToNearbyDriversOfCustomer(customerId, event, data) {
    const customerRoom = roomUtils.getCustomerRoomId(customerId);
    this.io.to(customerRoom).emit(event, data);
    console.log(`🎯 Broadcast to nearby drivers of customer ${customerId} in room ${customerRoom}: ${event}`);
  }

  // 🔒 Güvenli broadcast: Sürücü durumu değişikliklerini sadece ilgili müşteri odalarına gönder
  broadcastDriverStatusToRelevantCustomers(driverId, event, data) {
    // Sürücünün hangi müşteri odalarında olduğunu bul
    const driverData = this.connectedDrivers.get(driverId);
    if (!driverData) {
      console.warn(`⚠️ Driver ${driverId} not found for status broadcast`);
      return;
    }

    // Sürücünün bulunduğu tüm müşteri odalarına gönder
    this.connectedCustomers.forEach((customerData, customerId) => {
      if (customerData && customerData.location) {
        // Mesafe kontrolü yap
        const distance = this.calculateDistance(
          driverData.location?.latitude || 0,
          driverData.location?.longitude || 0,
          customerData.location.latitude,
          customerData.location.longitude
        );
        
        // 10km yarıçap içindeki müşterilere gönder
        if (distance <= 10) {
          const customerRoom = roomUtils.getCustomerRoomId(customerId);
          this.io.to(customerRoom).emit(event, data);
        }
      }
    });
    
    console.log(`🎯 Driver ${driverId} status broadcasted to relevant customer rooms: ${event}`);
  }

  // 🚨 DEPRECATED: Bu fonksiyon güvenlik riski taşır - tüm müşterilere broadcast yapar
  // Bunun yerine oda bazlı broadcast fonksiyonları kullanın
  broadcastToAllCustomers(event, data) {
    console.warn(`⚠️ SECURITY WARNING: broadcastToAllCustomers is deprecated and unsafe. Use room-based broadcast instead.`);
    console.log(`📡 Broadcasting ${event} to all ${this.connectedCustomers.size} connected customers:`, data);
    this.connectedCustomers.forEach((customerData, customerId) => {
      if (customerData && customerData.socketId) {
        this.io.to(customerData.socketId).emit(event, data);
        console.log(`✅ Event ${event} sent to customer ${customerId} (socket: ${customerData.socketId})`);
      } else {
        console.warn(`⚠️ Invalid customer data for customer ${customerId}:`, customerData);
      }
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

  // 🚀 OPTIMIZASYON: Sürücü socket'ini bul
  getDriverSocket(driverId) {
    const driverData = this.connectedDrivers.get(driverId);
    if (driverData && driverData.socketId) {
      return this.io.sockets.sockets.get(driverData.socketId);
    }
    return null;
  }

  getConnectedCustomersCount() {
    // Sadece gerçek müşterileri say, supervisor'ları hariç tut
    let customerCount = 0;
    this.connectedCustomers.forEach((customerData, customerId) => {
      if (customerData.userType === 'customer') {
        customerCount++;
      }
    });
    return customerCount;
  }

  getConnectionDetails() {
    const details = {
      customers: [],
      drivers: [],
      supervisors: []
    };

    // Müşteri detayları
    this.connectedCustomers.forEach((customerData, customerId) => {
      details.customers.push({
        id: customerId,
        userType: customerData.userType,
        socketId: customerData.socketId,
        hasLocation: !!customerData.location,
        connectedAt: customerData.connectedAt || new Date().toISOString()
      });
    });

    // Sürücü detayları
    this.connectedDrivers.forEach((driverData, driverId) => {
      details.drivers.push({
        id: driverId,
        userType: 'driver',
        socketId: driverData.socketId,
        hasLocation: !!driverData.location,
        isAvailable: driverData.isAvailable,
        connectedAt: driverData.connectedAt || new Date().toISOString()
      });
    });

    // Supervisor'ları bul (io.sockets üzerinden)
    if (this.io && this.io.sockets) {
      this.io.sockets.sockets.forEach((socket) => {
        if (socket.userType === 'supervisor') {
          details.supervisors.push({
            id: socket.userId,
            userType: 'supervisor',
            socketId: socket.id,
            connectedAt: new Date().toISOString()
          });
        }
      });
    }

    return details;
  }

  // Placeholder methods - implement as needed
  async createOrder(userId, orderData) {
    const startTime = Date.now();
    console.log('Creating order for user:', userId, 'with data:', orderData);
    
    try {
      this.eventMonitor.trackEvent('order_create', {
        userId,
        orderId: orderData.orderId || orderData.id
      });
      
      // Sipariş oluşturulduktan sonra yakındaki uygun sürücülere bildirim gönder
      await this.broadcastOrderToNearbyDrivers(orderData.orderId || orderData.id, {
        orderId: orderData.orderId || orderData.id,
        customerId: userId,
        pickupLatitude: orderData.pickupLatitude,
        pickupLongitude: orderData.pickupLongitude,
        vehicle_type_id: orderData.vehicle_type_id || orderData.vehicleTypeId, // Her iki format da desteklenir
        ...orderData
      });
      
      this.eventMonitor.trackPerformance('order_create', startTime);
      console.log(`Order created and broadcasted to drivers for user ${userId}`);
    } catch (error) {
      this.eventMonitor.trackError('order_create', error, { userId, orderData });
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
          WHERE order_status = @orderStatus AND is_active = 'true'
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
              updated_at = DATEADD(hour, 3, GETDATE())
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
              updated_at = DATEADD(hour, 3, GETDATE())
          WHERE id = @orderId
        `);

      console.log('✅ Order cancelled successfully in database for Order', orderId);

      // Eğer sipariş inspecting durumundaysa, inspectingOrders Map'inden kaldır
      if (order.order_status === 'inspecting') {
        this.inspectingOrders.delete(orderId);
        console.log('🔍 Removed order from inspecting list:', orderId);
      }

      // Müşteriye başarılı iptal mesajı gönder - KALDIRILDI
      // Artık müşteri kendi iptal işlemini socket'ten dinlemeyecek
      // Sadece HTTP response ile bilgilendirilecek
      console.log('✅ Order cancelled successfully - customer will be notified via HTTP response');

      // Eğer sürücü atanmışsa, sürücüye bildir
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

      // Müşteri odasındaki sürücülere sipariş iptal edildi bilgisi gönder (oda mantığı kullanarak)
      this.broadcastToCustomerRoomDrivers(userId, 'order_cancelled_by_customer', { orderId, message: 'Müşteri siparişi iptal etti.' });
      
      // Sipariş ile ilgili sürücülere iptal bilgisi gönder (güvenli broadcast)
      await this.broadcastToOrderRelatedDrivers(orderId, 'order_cancelled_by_customer', { orderId, reason: 'cancelled_by_customer', message: 'Müşteri siparişi iptal etti.' });

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
        'UPDATE users SET current_latitude = @latitude, current_longitude = @longitude, last_location_update = DATEADD(hour, 3, GETDATE()), updated_at = DATEADD(hour, 3, GETDATE()) WHERE id = @userId',
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

    // Sadece ilgili müşterilere sürücü konum güncellemesi gönder
    this.broadcastDriverStatusToRelevantCustomers(driverId, 'driver_location_update', {
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
      const customerRoom = roomUtils.getCustomerRoomId(customerId);
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
      console.log(`🔍 Total connected customers: ${this.connectedCustomers.size}`);
      console.log(`🔍 Total connected drivers: ${this.connectedDrivers.size}`);
      
      // Müşterinin konumunu al
      const customerData = this.connectedCustomers.get(socket.userId);
      if (!customerData || !customerData.location) {
        console.log(`❌ Customer ${socket.userId} location not available`);
        console.log(`❌ Customer data:`, customerData);
        socket.emit('nearbyDriversUpdate', { drivers: [] });
        return;
      }

      const customerLocation = customerData.location;
      console.log(`📍 Customer location:`, customerLocation);

      // Sistem ayarlarından arama yarıçapını ve konum güncellik süresini al
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();
      
      const settingsResult = await pool.request()
        .query(`SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('driver_search_radius_km', 'driver_location_update_interval_minutes') AND is_active = 1`);
      
      const settings = {};
      settingsResult.recordset.forEach(row => {
        settings[row.setting_key] = parseFloat(row.setting_value);
      });
      
      const searchRadiusKm = settings['driver_search_radius_km'] || 5; // varsayılan 5km
      const locationUpdateIntervalMinutes = settings['driver_location_update_interval_minutes'] || 10; // varsayılan 10 dakika
      
      console.log(`🎯 Search radius: ${searchRadiusKm} km`);
      console.log(`⏰ Location update interval: ${locationUpdateIntervalMinutes} minutes`);
      
      // Önce mesafe kontrolü yap ve yakın sürücüleri belirle
      const nearbyDriversWithDistance = [];
      
      for (const [driverId, driverData] of this.connectedDrivers) {
        console.log(`🔍 Checking driver ${driverId}:`, {
          hasLocation: !!driverData.location,
          isAvailable: driverData.isAvailable,
          location: driverData.location
        });
        
        // Konum ve müsaitlik kontrolü (memory'de)
        if (driverData.location && (driverData.isAvailable !== false)) {
          // Mesafe hesapla
          const distance = this.calculateDistance(
            customerLocation.latitude,
            customerLocation.longitude,
            driverData.location.latitude,
            driverData.location.longitude
          );
          
          console.log(`📏 Driver ${driverId} distance: ${distance.toFixed(2)} km`);
          
          // Yarıçap kontrolü
          if (distance <= searchRadiusKm) {
            nearbyDriversWithDistance.push({
              driverId: driverId,
              driverData: driverData,
              distance: distance
            });
          } else {
            console.log(`❌ Driver ${driverId} skipped - outside radius (${distance.toFixed(2)}km > ${searchRadiusKm}km)`);
          }
        } else {
          console.log(`❌ Driver ${driverId} skipped - no location or not available in memory`);
        }
      }

      // Eğer yakın sürücü yoksa boş liste döndür
      if (nearbyDriversWithDistance.length === 0) {
        console.log(`📍 No nearby drivers found within ${searchRadiusKm}km radius`);
        socket.emit('nearbyDriversUpdate', { drivers: [] });
        return;
      }

      // Batch query ile tüm yakın sürücülerin bilgilerini tek seferde al ve veritabanı validasyonu yap
      const driverIds = nearbyDriversWithDistance.map(item => item.driverId);
      
      // Debug: Driver ID'lerini ve tiplerini logla
      console.log(`🔍 Debug - Driver IDs to query:`, driverIds.map(id => ({
        value: id,
        type: typeof id,
        isString: typeof id === 'string',
        length: id ? id.toString().length : 0,
        isEmpty: !id || id.toString().trim() === ''
      })));
      
      // Geçersiz driver ID'leri filtrele ve string'e çevir
      const validDriverIds = driverIds.filter(id => {
        // Null, undefined, empty string kontrolü
        if (!id) {
          console.log(`❌ Invalid driver ID filtered out (null/undefined):`, { value: id, type: typeof id });
          return false;
        }
        
        // String'e çevir ve trim yap
        const stringId = String(id).trim();
        
        // Boş string kontrolü
        if (stringId === '' || stringId === 'null' || stringId === 'undefined') {
          console.log(`❌ Invalid driver ID filtered out (empty/null string):`, { value: id, stringValue: stringId, type: typeof id });
          return false;
        }
        
        // Numeric string kontrolü (driver ID'ler genellikle numeric olmalı)
        if (!/^\d+$/.test(stringId)) {
          console.log(`❌ Invalid driver ID filtered out (non-numeric):`, { value: id, stringValue: stringId, type: typeof id });
          return false;
        }
        
        return true;
      }).map(id => String(id).trim()); // Tüm geçerli ID'leri string'e çevir
      
      if (validDriverIds.length === 0) {
        console.log(`❌ No valid driver IDs found after filtering`);
        socket.emit('nearbyDriversUpdate', { drivers: [] });
        return;
      }
      
      // SQL Injection güvenlik açığını kapatmak için parameterized query kullan
      const driverIdsParams = validDriverIds.map((_, index) => `@driverId${index}`).join(',');
      const request = pool.request();
      
      // Her driver ID'yi ayrı parametre olarak ekle
      validDriverIds.forEach((driverId, index) => {
        // Driver ID zaten string olarak filtrelenmiş ve validate edilmiş
        console.log(`🔍 Adding parameter driverId${index}:`, { 
          value: driverId, 
          length: driverId.length,
          type: typeof driverId,
          isNumeric: /^\d+$/.test(driverId)
        });
        request.input(`driverId${index}`, sql.VarChar, driverId);
      });
      
      // Veritabanı validasyonu: is_approved, is_active, is_available ve konum güncellik kontrolü
      const driversResult = await request
        .query(`
          SELECT 
            d.id,
            d.first_name,
            d.last_name,
            d.vehicle_plate,
            d.vehicle_model,
            d.vehicle_color,
            d.is_active,
            d.is_available,
            d.is_approved,
            u.current_latitude,
            u.current_longitude,
            u.last_location_update,
            ABS(DATEDIFF(minute, u.last_location_update, DATEADD(hour, 3, GETDATE()))) as minutes_since_update
          FROM drivers d
          INNER JOIN users u ON d.user_id = u.id
          WHERE d.id IN (${driverIdsParams}) 
            AND d.is_active = 1
            AND d.is_available = 1
            AND d.is_approved = 1
            AND u.current_latitude IS NOT NULL 
            AND u.current_longitude IS NOT NULL
            AND ABS(DATEDIFF(minute, u.last_location_update, DATEADD(hour, 3, GETDATE()))) <= ${locationUpdateIntervalMinutes}
        `);

      console.log(`🔍 Database validation: ${driversResult.recordset.length} out of ${validDriverIds.length} drivers passed all criteria (approved, active, available, recent location)`);

      // Veritabanı sonuçlarını Map'e çevir (hızlı erişim için)
      const driversMap = new Map();
      driversResult.recordset.forEach(driver => {
        driversMap.set(driver.id.toString(), driver);
      });

      // Final liste oluştur - sadece veritabanı validasyonunu geçen sürücüler
      const connectedDriversWithLocation = [];
      
      for (const item of nearbyDriversWithDistance) {
        const driverIdString = item.driverId.toString();
        const driver = driversMap.get(driverIdString);
        
        if (driver) {
          connectedDriversWithLocation.push({
            id: driver.id.toString(),
            latitude: item.driverData.location.latitude,
            longitude: item.driverData.location.longitude,
            heading: item.driverData.location.heading || 0,
            name: driver.first_name,
            vehicle: `${driver.vehicle_color} ${driver.vehicle_model}`,
            plate: driver.vehicle_plate,
            distance: item.distance,
            dbLocationUpdateMinutes: driver.minutes_since_update
          });
          console.log(`✅ Driver ${driver.id} included - DB location updated ${driver.minutes_since_update} minutes ago`);
        } else {
          console.log(`❌ Driver ${item.driverId} excluded - failed database validation (not approved/active/available or stale location)`);
        }
      }
      
      // Mesafeye göre sırala (en yakından en uzağa)
      connectedDriversWithLocation.sort((a, b) => a.distance - b.distance);
      
      const drivers = connectedDriversWithLocation;
      
      console.log(`🚗 Available drivers within ${searchRadiusKm}km radius after all validations: ${drivers.length}`);
      if (drivers.length > 0) {
        console.log(`📍 Driver locations:`, drivers.map(d => ({ 
          id: d.id, 
          lat: d.latitude, 
          lng: d.longitude,
          heading: d.heading,
          name: d.name,
          distance: `${d.distance.toFixed(2)}km`,
          dbUpdateMinutes: d.dbLocationUpdateMinutes
        })));
      }

      // Müşterinin room'una emit et
      const customerRoom = roomUtils.getCustomerRoomId(socket.userId);
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
        .query('SELECT * FROM users WHERE id = @userId AND is_active = \'true\'');

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
        const inspectingData = this.inspectingOrders.get(actualOrderId);
        if (inspectingData.driverId !== driverId) {
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
      this.inspectingOrders.set(actualOrderId, { 
        driverId, 
        startTime: Date.now() 
      });

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
      
      // Tüm sürücülere order_status_update gönder -> GÜVENLİ: Sadece ilgili sürücülere gönder
      await this.broadcastToOrderRelatedDrivers(actualOrderId, 'order_status_update', { orderId: actualOrderId, status: 'inspecting' });

      // Müşteriye siparişin incelendiğini bildir
      const orderResult = await pool.request()
        .input('orderId', sql.Int, orderIdInt)
        .query(`SELECT user_id FROM orders WHERE id = @orderId`);
      
      if (orderResult.recordset.length > 0) {
        const customerId = orderResult.recordset[0].user_id;
        const customerRoom = roomUtils.getCustomerRoomId(customerId);
        
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
      
      // Sistem ayarlarından yarıçap değerini çek
      let searchRadiusKm = 10; // Varsayılan değer
      try {
        const settingsResult = await pool.request()
          .query('SELECT setting_value FROM system_settings WHERE setting_key = \'driver_search_radius_km\'');
        
        if (settingsResult.recordset.length > 0) {
          searchRadiusKm = parseFloat(settingsResult.recordset[0].setting_value) || 10;
        }
      } catch (settingsError) {
        console.log('⚠️ System settings not found, using default radius:', searchRadiusKm);
      }
      
      console.log(`🔍 Using search radius: ${searchRadiusKm}km for order ${orderId}`);
      
      // Önce mesafe kontrolü yap ve uygun sürücüleri belirle
      const eligibleDrivers = [];
      
      for (const [driverId, driverInfo] of this.connectedDrivers) {
        if (driverInfo.isAvailable && driverInfo.location) {
          // Mesafe hesapla
          const distance = this.calculateDistance(
            orderData.pickupLatitude,
            orderData.pickupLongitude,
            driverInfo.location.latitude,
            driverInfo.location.longitude
          );
          
          // Yarıçap içinde mi kontrol et
          if (distance <= searchRadiusKm) {
            eligibleDrivers.push({
              driverId: driverId,
              driverInfo: driverInfo,
              distance: distance
            });
          } else {
            console.log(`❌ Driver ${driverId} skipped - outside radius (distance: ${distance.toFixed(2)}km > ${searchRadiusKm}km)`);
          }
        }
      }

      // Eğer socket'e bağlı uygun sürücü yoksa işlemi sonlandır
      if (eligibleDrivers.length === 0) {
        console.log(`📍 No drivers connected to socket within ${searchRadiusKm}km radius for order ${orderId}`);
        return;
      }
      
      console.log(`🔗 Found ${eligibleDrivers.length} drivers connected to socket within radius, validating with database...`);

      // Batch query ile tüm uygun sürücülerin araç tiplerini ve durumlarını al
      const driverIds = eligibleDrivers.map(item => item.driverId);
      
      // Eğer hiç uygun sürücü yoksa SQL query'sini çalıştırmaya gerek yok
      if (driverIds.length === 0) {
        console.log(`📍 No eligible drivers found for order ${orderId} - skipping database validation`);
        return;
      }
      
      // SQL Injection güvenlik açığını kapatmak için parameterized query kullan
      const driverIdsParams = driverIds.map((_, index) => `@driverId${index}`).join(',');
      const request = pool.request();
      
      // Her driver ID'yi ayrı parametre olarak ekle
      driverIds.forEach((driverId, index) => {
        request.input(`driverId${index}`, sql.Int, parseInt(driverId));
      });
      
      // Sistem ayarlarından konum güncelleme aralığını al
      let locationUpdateInterval = 30; // Varsayılan değer (dakika)
      try {
        const locationSettingsResult = await pool.request()
          .query('SELECT setting_value FROM system_settings WHERE setting_key = \'location_update_interval_minutes\'');
        
        if (locationSettingsResult.recordset.length > 0) {
          locationUpdateInterval = parseInt(locationSettingsResult.recordset[0].setting_value) || 30;
        }
      } catch (settingsError) {
        console.log('⚠️ Location update interval setting not found, using default:', locationUpdateInterval);
      }
      
      const driversResult = await request
        .input('locationUpdateInterval', locationUpdateInterval)
        .query(`
          SELECT d.id, d.vehicle_type_id, d.is_available, d.is_active, d.is_approved,
                 u.current_latitude, u.current_longitude, u.last_location_update
          FROM drivers d
          INNER JOIN users u ON d.user_id = u.id
          WHERE d.id IN (${driverIdsParams}) 
            AND d.is_active = 1
            AND d.is_approved = 1
            AND d.is_available = 1
            AND u.current_latitude IS NOT NULL 
            AND u.current_longitude IS NOT NULL
            AND ABS(DATEDIFF(minute, u.last_location_update, DATEADD(hour, 3, GETDATE()))) <= @locationUpdateInterval
        `);

      // Veritabanı sonuçlarını Map'e çevir (hızlı erişim için) - sadece geçerli sürücüler
      const driversVehicleMap = new Map();
      const validDriversFromDB = new Set();
      
      driversResult.recordset.forEach(driver => {
        driversVehicleMap.set(driver.id.toString(), driver.vehicle_type_id);
        validDriversFromDB.add(driver.id.toString());
      });
      
      console.log(`🔍 Database validation: ${driversResult.recordset.length} out of ${driverIds.length} drivers passed all criteria (approved, active, available, recent location)`);
      
      // Geçerli olmayan sürücüleri logla
      const invalidDrivers = driverIds.filter(id => !validDriversFromDB.has(id));
      if (invalidDrivers.length > 0) {
        console.log(`❌ Invalid drivers (failed DB validation): ${invalidDrivers.join(', ')}`);
      }
      
      // Eğer veritabanı validasyonundan geçen sürücü yoksa işlemi sonlandır
      if (driversResult.recordset.length === 0) {
        console.log(`📍 No drivers passed database validation for order ${orderId} - all connected drivers are either not approved, not active, not available, or have stale location data`);
        return;
      }

      let matchingDriversCount = 0;
      let driversWithDistance = [];
      
      // Final kontrol ve sipariş gönderimi - sadece DB'den geçerli sürücülere
      for (const item of eligibleDrivers) {
        // Önce sürücünün DB validasyonunu geçip geçmediğini kontrol et
        if (!validDriversFromDB.has(item.driverId)) {
          console.log(`❌ Driver ${item.driverId} skipped - failed database validation (not approved/active/available or stale location)`);
          continue;
        }
        
        const driverVehicleTypeId = driversVehicleMap.get(item.driverId);
        
        if (driverVehicleTypeId) {
          // Araç tipi eşleşiyorsa sipariş gönder
          if (driverVehicleTypeId === orderData.vehicle_type_id) {
            const driverSocket = this.io.sockets.sockets.get(item.driverInfo.socketId);
            if (driverSocket) {
              driverSocket.emit('new_order_available', {
                orderId,
                distance: item.distance,
                ...orderData
              });
              matchingDriversCount++;
              driversWithDistance.push({ 
                driverId: item.driverId, 
                distance: item.distance, 
                vehicleType: driverVehicleTypeId 
              });
              console.log(`✅ Order ${orderId} sent to driver ${item.driverId} (vehicle_type: ${driverVehicleTypeId}, distance: ${item.distance.toFixed(2)}km)`);
            } else {
              console.log(`❌ Driver ${item.driverId} socket not found - connection may have been lost`);
            }
          } else {
            console.log(`❌ Driver ${item.driverId} skipped - vehicle type mismatch (driver: ${driverVehicleTypeId}, order: ${orderData.vehicle_type_id})`);
          }
        } else {
          console.log(`❌ Driver ${item.driverId} - unexpected error: passed DB validation but not in vehicle map`);
        }
      }
      
      // Mesafeye göre sırala ve log
      driversWithDistance.sort((a, b) => a.distance - b.distance);
      console.log(`📡 Order ${orderId} broadcasted to ${matchingDriversCount} matching drivers within ${searchRadiusKm}km radius out of ${this.connectedDrivers.size} total drivers`);
      
      if (driversWithDistance.length > 0) {
        console.log(`📍 Closest drivers:`, driversWithDistance.slice(0, 3).map(d => `Driver ${d.driverId}: ${d.distance.toFixed(2)}km`));
      }
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
          WHERE id = @orderId
        `);
      
      console.log(`Order ${actualOrderId} status updated to pending. Rows affected: ${updateResult.rowsAffected[0]}`);
      
      // Tüm sürücülere siparişin tekrar müsait olduğunu bildir -> GÜVENLİ: Sadece ilgili sürücülere gönder
      await this.broadcastToOrderRelatedDrivers(actualOrderId, 'order_available_again', { orderId: actualOrderId });
      await this.broadcastToOrderRelatedDrivers(actualOrderId, 'order_status_update', { orderId: actualOrderId, status: 'pending' });

      // 🔧 FIX: Sürücülere de inceleme bittiğini bildir
      await this.broadcastToOrderRelatedDrivers(actualOrderId, 'order_inspection_stopped', {
        orderId: actualOrderId,
        status: 'pending',
        message: 'Sipariş incelemesi tamamlandı, tekrar beklemede'
      });

      // Müşteriye incelemenin bittiğini bildir
      const orderResult = await pool.request()
        .input('orderId', sql.Int, orderIdInt)
        .query(`SELECT user_id FROM orders WHERE id = @orderId`);
      
      if (orderResult.recordset.length > 0) {
        const customerId = orderResult.recordset[0].user_id;
        const customerRoom = roomUtils.getCustomerRoomId(customerId);
        
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

  // Real-time monitoring data emission
  startMonitoringEmission() {
    // Her 5 saniyede bir monitoring verilerini emit et
    setInterval(() => {
      try {
        const monitoringData = {
          summary: {
            totalEvents: this.eventMonitor.getTotalEvents(),
            totalErrors: this.eventMonitor.getTotalErrors(),
            connectedDrivers: this.getConnectedDriversCount(),
            connectedCustomers: this.getConnectedCustomersCount(),
            uptime: Math.floor((Date.now() - this.eventMonitor.startTime) / 1000),
            errorRate: this.eventMonitor.getErrorRate(),
            avgResponseTime: this.eventMonitor.getAverageResponseTime()
          },
          recentEvents: this.eventMonitor.getRecentEvents(10),
          recentErrors: this.eventMonitor.getRecentErrors(10),
          recentPerformance: this.eventMonitor.getRecentPerformance(10)
        };

        this.monitoringEmitter.emitMonitoringUpdate(monitoringData);
      } catch (error) {
        console.error('Error emitting monitoring data:', error);
      }
    }, 5000);

    // Connection değişikliklerini izle
    this.on('driver_connected', (driverId) => {
      this.monitoringEmitter.emitConnectionUpdate('drivers', this.getConnectedDriversCount(), 1);
    });

    this.on('driver_disconnected', (driverId) => {
      this.monitoringEmitter.emitConnectionUpdate('drivers', this.getConnectedDriversCount(), -1);
    });

    this.on('customer_connected', (customerId) => {
      this.monitoringEmitter.emitConnectionUpdate('customers', this.getConnectedCustomersCount(), 1);
    });

    this.on('customer_disconnected', (customerId) => {
      this.monitoringEmitter.emitConnectionUpdate('customers', this.getConnectedCustomersCount(), -1);
    });

    console.log('📊 Real-time monitoring emission started');
  }

  // 🚀 OPTIMIZASYON: Periyodik oda üyeliklerini doğrulama
  startPeriodicRoomValidation() {
    setInterval(() => {
      this.validateRoomMemberships();
    }, 5 * 60 * 1000); // Her 5 dakikada bir
    
    console.log('🔄 Periodic room validation started (every 5 minutes)');
  }

  // 🚀 OPTIMIZASYON: Oda üyeliklerini doğrulama ve temizleme
  async validateRoomMemberships() {
    try {
      console.log('🔍 Starting room membership validation...');
      
      let validatedCount = 0;
      let removedCount = 0;
      
      // Tüm bağlı sürücüleri kontrol et
      for (const [driverId, driverData] of this.connectedDrivers) {
        const driverSocket = this.getDriverSocket(driverId);
        
        if (!driverSocket || !driverData.location || !driverData.isAvailable) {
          // Sürücü çevrimdışı veya konumu yok ise tüm odalardan çıkar
          this.removeDriverFromAllCustomerRooms(driverId);
          removedCount++;
          continue;
        }
        
        // Sürücünün mevcut oda üyeliklerini kontrol et
        const currentRooms = Array.from(driverSocket.rooms).filter(room => 
          room.startsWith('customer_') && room !== driverSocket.id
        );
        
        // Sürücünün olması gereken odaları hesapla
        const shouldBeInRooms = [];
        for (const [customerId, customerData] of this.connectedCustomers) {
          if (customerData.location) {
            const distance = this.calculateDistance(
              driverData.location.latitude,
              driverData.location.longitude,
              customerData.location.latitude,
              customerData.location.longitude
            );
            
            if (distance <= 10) { // 10 km yarıçap
              shouldBeInRooms.push(`customer_${customerId}`);
            }
          }
        }
        
        // Yanlış odalarda olan sürücüyü çıkar
        for (const room of currentRooms) {
          if (!shouldBeInRooms.includes(room)) {
            driverSocket.leave(room);
            removedCount++;
          }
        }
        
        // Eksik odalara sürücüyü ekle
        for (const room of shouldBeInRooms) {
          if (!currentRooms.includes(room)) {
            driverSocket.join(room);
          }
        }
        
        validatedCount++;
      }
      
      console.log(`✅ Room validation completed: ${validatedCount} drivers validated, ${removedCount} invalid memberships removed`);
      
    } catch (error) {
      console.error('❌ Error during room membership validation:', error);
    }
  }

  /**
   * Hybrid approach: Check driver availability from socket memory first
   * Falls back to database if socket data is insufficient
   */
  async checkDriverAvailabilityFromMemory(pickupLatitude, pickupLongitude, searchRadiusKm = 5, vehicleTypeId = null) {
    try {
      console.log(`🔍 Hybrid check: Looking for drivers near ${pickupLatitude}, ${pickupLongitude} within ${searchRadiusKm}km`);
      
      const availableDrivers = [];
      const currentTime = new Date();
      const maxLocationAge = 10 * 60 * 1000; // 10 dakika (milliseconds)
      
      // Socket memory'den kontrol et
      for (const [driverId, driverData] of this.connectedDrivers) {
        // Temel kontroller
        if (!driverData.location || 
            driverData.isAvailable === false || 
            driverData.isActive === false ||
            driverData.isApproved === false) {
          continue;
        }
        
        // Araç tipi kontrolü
        if (vehicleTypeId && driverData.vehicleTypeId !== vehicleTypeId) {
          continue;
        }
        
        // Konum güncellik kontrolü
        const locationAge = currentTime - new Date(driverData.lastLocationUpdate);
        if (locationAge > maxLocationAge) {
          console.log(`⚠️ Driver ${driverId} location too old: ${Math.round(locationAge/1000/60)} minutes`);
          continue;
        }
        
        // Mesafe kontrolü
        const distance = this.calculateDistance(
          pickupLatitude,
          pickupLongitude,
          driverData.location.latitude,
          driverData.location.longitude
        );
        
        if (distance <= searchRadiusKm) {
          availableDrivers.push({
            driverId: parseInt(driverId),
            distance: distance,
            location: driverData.location,
            vehicleTypeId: driverData.vehicleTypeId,
            lastUpdate: driverData.lastLocationUpdate
          });
        }
      }
      
      // Mesafeye göre sırala
      availableDrivers.sort((a, b) => a.distance - b.distance);
      
      console.log(`✅ Hybrid check result: ${availableDrivers.length} available drivers found in socket memory`);
      
      return {
        success: true,
        source: 'socket_memory',
        available: availableDrivers.length > 0,
        driverCount: availableDrivers.length,
        drivers: availableDrivers.slice(0, 10), // İlk 10 sürücü
        searchRadius: searchRadiusKm,
        timestamp: currentTime
      };
      
    } catch (error) {
      console.error('❌ Socket memory check failed:', error);
      
      // Fallback to database
      return await this.checkDriverAvailabilityFromDatabase(pickupLatitude, pickupLongitude, searchRadiusKm, vehicleTypeId);
    }
  }
  
  /**
   * Fallback: Database check when socket memory fails
   */
  async checkDriverAvailabilityFromDatabase(pickupLatitude, pickupLongitude, searchRadiusKm = 5, vehicleTypeId = null) {
    try {
      console.log(`🗄️ Fallback: Checking database for driver availability`);
      
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();
      
      const query = `
        SELECT COUNT(*) as driverCount
        FROM drivers d
        INNER JOIN users u ON d.user_id = u.id
        WHERE d.is_available = 1 
          AND d.is_active = 1
          AND d.is_approved = 1
          AND u.current_latitude IS NOT NULL 
          AND u.current_longitude IS NOT NULL
          AND (
            6371 * acos(
              cos(radians(@latitude)) * cos(radians(u.current_latitude)) *
              cos(radians(u.current_longitude) - radians(@longitude)) +
              sin(radians(@latitude)) * sin(radians(u.current_latitude))
            )
          ) <= @radius
          AND ABS(DATEDIFF(minute, u.last_location_update, DATEADD(hour, 3, GETDATE()))) <= 10
          ${vehicleTypeId ? 'AND d.vehicle_type_id = @vehicleTypeId' : ''}
      `;
      
      const request = pool.request()
        .input('latitude', pickupLatitude)
        .input('longitude', pickupLongitude)
        .input('radius', searchRadiusKm);
      
      if (vehicleTypeId) {
        request.input('vehicleTypeId', vehicleTypeId);
      }
      
      const result = await request.query(query);
      const driverCount = result.recordset[0]?.driverCount || 0;
      
      console.log(`✅ Database fallback result: ${driverCount} drivers found`);
      
      return {
        success: true,
        source: 'database_fallback',
        available: driverCount > 0,
        driverCount: driverCount,
        searchRadius: searchRadiusKm,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('❌ Database fallback also failed:', error);
      return {
        success: false,
        error: error.message,
        source: 'failed'
      };
    }
  }
}

module.exports = SocketServer;