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
    this.orderCountdownTimers = new Map(); // orderId -> timeout timer
    this.orderCountdownIntervals = new Map(); // orderId -> countdown interval

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

  // Ortak sürücü validasyon fonksiyonu
  async validateDriversWithDatabase(driverIds, locationUpdateIntervalMinutes = null) {
    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();
      
      // Eğer interval belirtilmediyse sistem ayarlarından al
      if (!locationUpdateIntervalMinutes) {
        try {
          const settingsResult = await pool.request()
            .query('SELECT setting_value FROM system_settings WHERE setting_key = \'driver_location_update_interval_minutes\'');
          
          if (settingsResult.recordset.length > 0) {
            locationUpdateIntervalMinutes = parseInt(settingsResult.recordset[0].setting_value) || 10;
          } else {
            locationUpdateIntervalMinutes = 10; // Default
          }
        } catch (settingsError) {
          locationUpdateIntervalMinutes = 10; // Default
          console.log('⚠️ Location update interval setting not found, using default:', locationUpdateIntervalMinutes);
        }
      }

      // Veritabanından sürücü durumlarını kontrol et - SADECE users tablosu yeterli
      const driverValidationResult = await pool.request()
        .query(`
          SELECT 
            d.id,
            d.is_approved,
            d.is_active,
            d.is_available,
            d.vehicle_type_id,
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
      const driverDataFromDB = new Map();
      
      // Artık sadece users tablosuna bakıyoruz - çok daha basit
      driverValidationResult.recordset.forEach(driver => {
        validDriversFromDB.add(driver.id.toString());
        driverDataFromDB.set(driver.id.toString(), {
          vehicleTypeId: driver.vehicle_type_id,
          latitude: driver.current_latitude,
          longitude: driver.current_longitude,
          lastUpdate: driver.last_location_update,
          minutesSinceUpdate: driver.minutes_since_update
        });
        console.log(`Sürücü ${driver.id} validasyon başarılı - konum: ${driver.current_latitude}, ${driver.current_longitude} (${driver.minutes_since_update}dk önce)`);
      });

      console.log(`🔍 Database validation: ${driverValidationResult.recordset.length} out of ${driverIds.length} drivers passed all criteria (approved, active, available, recent location)`);
      
      // Artık sadece users tablosuna bakıyoruz - loglar da sadeleşti
      console.log(`🔍 Database validation: ${driverValidationResult.recordset.length} out of ${driverIds.length} drivers passed all criteria`);

      return {
        validDrivers: validDriversFromDB,
        driverData: driverDataFromDB,
        locationUpdateIntervalMinutes
      };
      
    } catch (error) {
      console.error('❌ Error validating drivers with database:', error);
      return {
        validDrivers: new Set(),
        driverData: new Map(),
        locationUpdateIntervalMinutes: locationUpdateIntervalMinutes || 10
      };
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

      // Sistem ayarlarından arama yarıçapını al
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();
      
      const settingsResult = await pool.request()
        .query(`SELECT setting_value FROM system_settings WHERE setting_key = 'driver_search_radius_km' AND is_active = 'true'`);
      
      const searchRadiusKm = settingsResult.recordset.length > 0 ? parseFloat(settingsResult.recordset[0].setting_value) : 5; // varsayılan 5km
      
      console.log(`🎯 Search radius for customer room assignment: ${searchRadiusKm} km`);

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

      // Ortak validasyon fonksiyonunu kullan
      const validationResult = await this.validateDriversWithDatabase(driverIds);
      const validDriversFromDB = validationResult.validDrivers;
      const driverDataFromDB = validationResult.driverData;

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
              const dbLocation = driverDataFromDB.get(driverId);
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
      
      // Sürücü bağlandığında otomatik olarak available yap
      const db = DatabaseConnection.getInstance();
      
      // Önce is_available'ı true yap
      await db.query(
        'UPDATE drivers SET is_available = 1 WHERE id = @driverId',
        { driverId: driverId }
      );
      
      console.log(`✅ Driver ${driverId} is_available set to true on connection`);
      
      const isAvailable = true; // Artık her zaman true olacak
      
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

    socket.on('accept_order_with_labor', ({ orderId, laborCount }) => {
      console.log(`🚛 SOCKET: accept_order_with_labor received - Driver ${driverId}, Order ${orderId}, Labor: ${laborCount}`);
      console.log(`📍 Socket ID: ${socket.id}`);
      console.log(`📍 Socket rooms:`, Array.from(socket.rooms));
      console.log(`📍 Driver authenticated:`, !!socket.driverId);
      this.handleOrderAcceptanceWithLabor(driverId, orderId, laborCount);
    });

    socket.on('confirm_price_with_customer', async ({ orderId, finalPrice, laborCost }) => {
      await this.handlePriceConfirmation(driverId, orderId, finalPrice, laborCost);
    });

    socket.on('driver_started_navigation', async ({ orderId }) => {
      await this.handleDriverStartedNavigation(driverId, orderId);
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
    
    console.log(`👤 Customer ${customerId} connection started - Socket: ${socket.id}`);
    
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
    const db = require('../config/database');
    const rows = await db.query('SELECT current_latitude, current_longitude FROM users WHERE id = ?', [customerId]);
    const loc = (rows && rows[0] && rows[0].current_latitude != null) ? {
      latitude:  rows[0].current_latitude,
      longitude: rows[0].current_longitude
    } : null;
    this.connectedCustomers.set(customerId, {
      socketId: socket.id,
      location: loc,
      userType: 'customer',
      userId: customerId
    });
    
    console.log(`📊 Customer connection stats: Total customers: ${this.connectedCustomers.size}`);
    
    // Müşteriyi kendi özel odasına ekle
    const customerRoom = roomUtils.getCustomerRoomId(customerId);
    console.log(`🏠 Customer ${customerId} getting room ID: ${customerRoom}`);
    socket.join(customerRoom);
    console.log(`🏠 Customer ${customerId} joined private room: ${customerRoom} (Socket: ${socket.id})`);
    console.log(`🏠 Customer ${customerId} socket rooms after join:`, Array.from(socket.rooms));
    
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
      },
      
      'price_confirmation_response': (socket, payload) => {
        // Defensive parsing for different client payload shapes/types
        const rawOrderId = payload?.orderId;
        let rawAccepted = payload?.isAccepted;

        // Coerce orderId to number where possible
        const normalizedOrderId = rawOrderId != null ? Number(rawOrderId) : null;

        // Coerce accepted to boolean from string/number
        if (typeof rawAccepted !== 'boolean') {
          if (typeof rawAccepted === 'string') {
            const lc = rawAccepted.trim().toLowerCase();
            if (lc === 'true' || lc === '1') rawAccepted = true;
            else if (lc === 'false' || lc === '0') rawAccepted = false;
          } else if (typeof rawAccepted === 'number') {
            rawAccepted = rawAccepted === 1;
          }
        }

        // Data validation
        if (!normalizedOrderId || typeof rawAccepted !== 'boolean') {
          socket.emit('validation_error', {
            eventType: 'price_confirmation_response',
            message: 'Order ID (number) and acceptance status (boolean) are required'
          });
          console.log('⚠️ Validation failed for price_confirmation_response:', payload);
          return;
        }

        console.log(`🔧 DEBUG: price_confirmation_response received from customer ${customerId} for order ${normalizedOrderId}, accepted: ${rawAccepted}`);
        this.handleCustomerPriceResponse(customerId, normalizedOrderId, rawAccepted);
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

      // Sadece users tablosunu güncelle - drivers tablosu gereksiz
      console.log(`💾 DEBUG: Updating users table for driver ${driverId}`);
      const db = DatabaseConnection.getInstance();
      
      try {
        const result = await db.query(
          'UPDATE users SET current_latitude = @latitude, current_longitude = @longitude, last_location_update = DATEADD(hour, 3, GETDATE()) WHERE id = (SELECT user_id FROM drivers WHERE id = @driverId)',
          { latitude: location.latitude, longitude: location.longitude, driverId: driverId }
        );
        console.log(`✅ DEBUG: Users table updated successfully for driver ${driverId}`);
        
        if (result && result.rowsAffected !== undefined) {
          console.log(`📊 DEBUG: Rows affected:`, result.rowsAffected);
        }
      } catch (error) {
        console.error(`❌ DEBUG: Users table update error:`, error.message);
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
      
      // 🔒 DELIVERED ve PAYMENT_COMPLETED statülerinde iptal engelleme (ilk kontrol)
      if (order.order_status === 'delivered' || order.order_status === 'payment_completed') {
        console.log('🚫 Order cancellation blocked for delivered/payment_completed status. Order:', orderId, 'Status:', order.order_status);
        const customerData = this.connectedCustomers.get(userId);
        if (customerData && customerData.socketId) {
          this.io.to(customerData.socketId).emit('cancel_order_error', { 
            message: 'Teslim edilmiş veya ödemesi tamamlanmış siparişler iptal edilemez.' 
          });
        }
        return;
      }
      
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
      
      // 🔒 DELIVERED ve PAYMENT_COMPLETED statülerinde iptal engelleme
      if (order.order_status === 'delivered' || order.order_status === 'payment_completed') {
        console.log('🚫 Order cancellation blocked for delivered/payment_completed status. Order:', orderId, 'Status:', order.order_status);
        const customerSocketId = this.connectedCustomers.get(userId);
        if (customerSocketId) {
          this.io.to(customerSocketId).emit('cancel_order_error', { 
            message: 'Teslim edilmiş veya ödemesi tamamlanmış siparişler iptal edilemez.' 
          });
        }
        return;
      }
      
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

  async handleOrderAcceptanceWithLabor(driverId, orderId, laborCount) {
    console.log(`🚛 Handle order acceptance with labor called: Driver ${driverId}, Order ${orderId}, Labor: ${laborCount}`);
    
    // Debug: Tüm bağlı müşterileri göster
    console.log(`📊 Connected customers:`, Array.from(this.connectedCustomers.keys()));
    
    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();
      
      // Siparişi ve sürücüyü kontrol et
      const orderResult = await pool.request()
        .input('orderId', sql.Int, orderId)
        .query('SELECT * FROM orders WHERE id = @orderId');
        
      if (orderResult.recordset.length === 0) {
        console.error(`❌ Order ${orderId} not found`);
        return;
      }
      
      const order = orderResult.recordset[0];
      console.log(`📋 Order ${orderId} status: ${order.status}`);
      
      // Sipariş durumu kontrolü - zaten kabul edilmişse engelle
      if (order.status === 'driver_accepted_awaiting_customer') {
        console.log(`⚠️ Order ${orderId} already waiting for customer approval, rejecting duplicate acceptance`);
        
        // Sürücüyü bilgilendir
        const driverData = this.connectedDrivers.get(driverId);
        if (driverData) {
          const driverSocket = this.io.sockets.sockets.get(driverData.socketId);
          if (driverSocket) {
            driverSocket.emit('order_accept_error', {
              message: 'Bu sipariş zaten kabul edilmiş ve müşteri onayı bekleniyor'
            });
          }
        }
        return;
      }
      
      // Sürücüyü kontrol et
      const driverResult = await pool.request()
        .input('driverId', sql.Int, driverId)
        .query('SELECT * FROM drivers WHERE id = @driverId AND is_active = 1 AND is_available = 1');
        
      if (driverResult.recordset.length === 0) {
        console.error(`❌ Driver ${driverId} not found or not available`);
        return;
      }
      
      // Sadece işçi sayısını geçici olarak kaydet, driver_id ve durum güncellemesi yapma
      // Bu bilgiyi memory'de saklayacağız ve müşteri onayı geldikten sonra kullanacağız
      const tempOrderData = {
        driverId: driverId,
        laborCount: laborCount,
        estimatedPrice: order.estimated_price || 0,
        timestamp: new Date()
      };
      
      // Memory'de geçici sipariş verisini sakla
      if (!this.pendingOrderApprovals) {
        this.pendingOrderApprovals = new Map();
      }
      // Normalize map keys to avoid string/number mismatches
      const orderKeyNum = Number(orderId);
      const orderKeyStr = String(orderId);
      this.pendingOrderApprovals.set(orderKeyNum, tempOrderData);
      this.pendingOrderApprovals.set(orderKeyStr, tempOrderData);
      
      console.log(`✅ Order ${orderId} temporary data stored - awaiting customer approval for driver ${driverId} with ${laborCount} labor workers`);
      
      // Müşteriye siparişin kabul edildiğini ve fiyat onayı gerektiğini bildir
      // FIX: order.customer_id yerine order.user_id kullanılmalı ve mevcut oda ID'si tercih edilmeli
      const customerId = order.user_id;
      console.log(`🔍 DEBUG: Getting customer room for customer ID: ${customerId}`);
      const existingRoomId = roomUtils.getUserRoomId('customer', customerId);
      if (!existingRoomId) {
        console.log(`🧩 No existing room mapping for customer ${customerId}; a new room ID may be generated if needed`);
      }
      const customerRoom = existingRoomId || roomUtils.getCustomerRoomId(customerId);

      // Oda ve müşteri üyeliği diagnostikleri
      const isCustomerConnected = this.connectedCustomers.has(customerId) || this.connectedCustomers.has(String(customerId));
      const room = this.io.sockets.adapter.rooms.get(customerRoom);
      let isCustomerInRoom = false;
      if (room) {
        room.forEach(socketId => {
          const s = this.io.sockets.sockets.get(socketId);
          if (s && s.userType === 'customer' && s.userId === customerId) {
            isCustomerInRoom = true;
          }
        });
      }
      console.log(`🧭 Room diagnostics: room=${customerRoom}, hasRoom=${!!room}, customerConnected=${isCustomerConnected}, customerInRoom=${isCustomerInRoom}`);
      console.log(`🔍 DEBUG: Customer room ID: ${customerRoom}`);
      
      // Debug: Müşterinin bağlı olup olmadığını kontrol et
      const customerData = this.connectedCustomers.get(customerId) || this.connectedCustomers.get(String(customerId));
      console.log(`🔍 DEBUG: Customer ${customerId} connection status:`, customerData ? 'Connected' : 'Not connected');
      
      if (customerData) {
        console.log(`🔍 DEBUG: Customer socket ID: ${customerData.socketId}`);
        console.log(`🔍 DEBUG: Customer room: ${customerRoom}`);
        
        // Socket'in odaya katılıp katılmadığını kontrol et
        const customerSocket = this.io.sockets.sockets.get(customerData.socketId);
        if (customerSocket) {
          const rooms = Array.from(customerSocket.rooms);
          console.log(`🔍 DEBUG: Customer rooms:`, rooms);
          console.log(`🔍 DEBUG: Is customer in target room? ${rooms.includes(customerRoom)}`);
        } else {
          console.log(`🔍 DEBUG: Customer socket not found`);
        }
      }
      
      // Önce sipariş durumunu güncelle (driver_id henüz atanmadı, sadece orderId ile)
      console.log(`🔧 DEBUG: Updating order ${orderId} status to driver_accepted_awaiting_customer with driver ${driverId}`);
      const updateResult = await this.updateOrderStatusBeforeAssignment(orderId, 'driver_accepted_awaiting_customer', driverId);
      console.log(`🔧 DEBUG: Order status update result:`, updateResult);
      
      // Müşteriye sipariş durumu güncellemesini gönder (oda yoksa doğrudan sokete fallback)
      const orderStatusPayload = {
        orderId,
        status: 'driver_accepted_awaiting_customer',
        message: 'Sürücü siparişinizi kabul etti, onayınız bekleniyor'
      };
      if (customerData && !isCustomerInRoom) {
        this.io.to(customerData.socketId).emit('order_status_update', orderStatusPayload);
      } else {
        this.io.to(customerRoom).emit('order_status_update', orderStatusPayload);
      }
      
      // NOT: order_status_update eventi tekrar eklendi - müşteri hem sipariş durumunu hem de fiyat onay modalını görecek
      
      // Fiyat onayı için müşteriye bildirim gönder
      // Mevcut siparişin toplamını baz al ve araç tipine göre yeni toplamı hesapla
      let newTotalPrice = order.total_price || 0;
      let priceDifference = 0;

      try {
        // Araç tipi bazlı pricing ayarlarını al
        const pricingSettingsResult = await pool.request()
          .input('vehicle_type_id', sql.Int, order.vehicle_type_id)
          .query(`
            SELECT base_price, price_per_km, labor_price
            FROM vehicle_type_pricing
            WHERE vehicle_type_id = @vehicle_type_id AND is_active = 1
          `);

        if (pricingSettingsResult.recordset.length > 0) {
          const ps = pricingSettingsResult.recordset[0];
          const basePrice = parseFloat(ps.base_price);
          const pricePerKm = parseFloat(ps.price_per_km);
          const laborPricePerPerson = parseFloat(ps.labor_price);

          // Yeni toplamı hesapla (mesafe + yeni hammaliye)
          const distancePrice = (order.distance_km || 0) * pricePerKm;
          const laborPriceForNewCount = (laborCount || 0) * laborPricePerPerson;
          const calculated = distancePrice + laborPriceForNewCount;

          if (calculated < basePrice) {
            newTotalPrice = basePrice;
          } else {
            newTotalPrice = calculated;
          }

          // Fark: yeni toplam - mevcut toplam
          priceDifference = (newTotalPrice - (order.total_price || 0));
        } else {
          console.warn(`⚠️ Pricing settings not found for vehicle_type_id=${order.vehicle_type_id}. Using current total_price.`);
        }
      } catch (pricingError) {
        console.error('❌ Pricing calculation error in socket flow:', pricingError);
        // Hata halinde mevcut toplamı koru ve farkı 0 gönder
        newTotalPrice = order.total_price || 0;
        priceDifference = 0;
      }

      // Sürücü bilgilerini al
      const driver = driverResult.recordset[0];
      
      console.log(`🔍 DEBUG: Emitting price_confirmation_requested to target: ${isCustomerInRoom ? customerRoom : (customerData ? customerData.socketId : 'unknown')}`);
      console.log(`🔍 DEBUG: Event data:`, {
        orderId: orderId,
        finalPrice: newTotalPrice,
        laborCount: laborCount,
        customerId: customerId
      });
      
      const priceConfirmationPayload = {
        orderId: orderId,
        finalPrice: newTotalPrice,
        laborCount: laborCount,
        estimatedPrice: order.total_price || 0,
        priceDifference: priceDifference,
        driverInfo: {
          id: driverId,
          name: `${driver.first_name} ${driver.last_name}`,
          vehicle: `${driver.vehicle_color} ${driver.vehicle_model}`,
          plate: driver.vehicle_plate
        },
        timeout: 60000 // 60 saniye - 1 dakika
      };

      if (customerData && !isCustomerInRoom) {
        this.io.to(customerData.socketId).emit('price_confirmation_requested', priceConfirmationPayload);
      } else {
        this.io.to(customerRoom).emit('price_confirmation_requested', priceConfirmationPayload);
      }
      
      console.log(`💰 Price confirmation requested sent to customer ${customerId} for order ${orderId}`);
      
      // Set timeout for customer response - 1 dakika
      const countdownTimer = setTimeout(async () => {
        // Check if customer already responded
        if (!this.pendingOrderApprovals || !this.pendingOrderApprovals.has(orderId)) {
          console.log(`✅ Order ${orderId} already processed, timeout cancelled`);
          return;
        }
        
        console.log(`⏰ Price confirmation timeout for order ${orderId} - marking as customer_confirmation_timeout`);
        // Check if customer already responded
        if (!this.pendingOrderApprovals || !this.pendingOrderApprovals.has(orderId)) {
          console.log(`✅ Order ${orderId} already processed, timeout cancelled`);
          return;
        }
        
        console.log(`⏰ Price confirmation timeout for order ${orderId} - returning to pending status`);
        
        try {
          // Get the pending approval data before cleaning up
          const pendingApproval = this.pendingOrderApprovals.get(orderId);
          const timeoutDriverId = pendingApproval.driverId;
          
          // Clean up pending approval
          this.pendingOrderApprovals.delete(orderId);
          
          // Return order to pending status
          console.log(`🔧 DEBUG: Timeout - Updating order ${orderId} status to customer_confirmation_timeout, previous driver was ${timeoutDriverId}`);
          await this.updateOrderStatusBeforeAssignment(orderId, 'customer_confirmation_timeout', timeoutDriverId, 'driver_accepted_awaiting_customer');
          
          // Notify customer about timeout (oda yoksa soket fallback)
          const timeoutPayload = {
            orderId: orderId,
            status: 'customer_confirmation_timeout',
            message: 'Sipariş onay süresi doldu, müşteriden yanıt alınamadı'
          };
          if (customerData && !isCustomerInRoom) {
            this.io.to(customerData.socketId).emit('order_status_update', timeoutPayload);
          } else {
            this.io.to(customerRoom).emit('order_status_update', timeoutPayload);
          }
          
          // Notify driver about timeout
          const driverSocket = this.getDriverSocket(timeoutDriverId);
          if (driverSocket) {
            driverSocket.emit('price_confirmation_timeout', {
              orderId: orderId,
              message: 'Müşteri onay süresi doldu, sipariş tekrar müsait duruma döndü'
            });
          }
          
          // Remove driver from customer room
          const timeoutCustomerRoom = roomUtils.getUserRoomId('customer', order.user_id);
          const room = this.io.sockets.adapter.rooms.get(timeoutCustomerRoom);
          if (room) {
            room.forEach(socketId => {
              const socket = this.io.sockets.sockets.get(socketId);
              if (socket && socket.userType === 'driver' && socket.userId === timeoutDriverId) {
                socket.leave(timeoutCustomerRoom);
                console.log(`🚪 Removed driver ${timeoutDriverId} from customer ${order.user_id} room due to timeout`);
              }
            });
          }
          
          // Broadcast updated driver list to all customers
          this.broadcastNearbyDriversToAllCustomers();
          
          console.log(`✅ Order ${orderId} returned to pending status due to customer timeout`);
          
        } catch (timeoutError) {
          console.error(`❌ Error handling price confirmation timeout for order ${orderId}:`, timeoutError);
        }
      }, 60000); // 60 saniye - 1 dakika
      
      // Store the timer reference so we can cancel it if customer responds
      if (!this.orderCountdownTimers) {
        this.orderCountdownTimers = new Map();
      }
      this.orderCountdownTimers.set(orderId, countdownTimer);
      
      // Store pending approval with start time for countdown tracking
      if (!this.pendingOrderApprovals) {
        this.pendingOrderApprovals = new Map();
      }
      this.pendingOrderApprovals.set(orderId, {
        driverId: driverId,
        customerId: order.customer_id,
        startTime: Date.now()
      });
      
      // Sürücüye periyodik geri sayım güncellemeleri gönder
      const countdownInterval = setInterval(() => {
        const driverData = this.connectedDrivers.get(driverId);
        if (!driverData) {
          clearInterval(countdownInterval);
          return;
        }
        
        const driverSocket = this.io.sockets.sockets.get(driverData.socketId);
        if (driverSocket && this.pendingOrderApprovals && this.pendingOrderApprovals.has(orderId)) {
          const approvalData = this.pendingOrderApprovals.get(orderId);
          const elapsed = Date.now() - (approvalData.startTime || Date.now());
          const remaining = Math.max(0, 60000 - elapsed);
          
          driverSocket.emit('price_confirmation_countdown_update', {
            orderId: orderId,
            remainingTime: remaining,
            totalTime: 60000
          });
          
          if (remaining <= 0) {
            clearInterval(countdownInterval);
          }
        } else {
          clearInterval(countdownInterval);
        }
      }, 1000); // Her saniye güncelle
      
      // Interval'ı da sakla ki iptal edebilelim
      if (!this.orderCountdownIntervals) {
        this.orderCountdownIntervals = new Map();
      }
      this.orderCountdownIntervals.set(orderId, countdownInterval);
      
      // Sürücüye başarılı kabul bildirimi ve geri sayım bilgisi gönder
      const driverSocket = this.io.sockets.sockets.get(this.connectedDrivers.get(driverId).socketId);
      if (driverSocket) {
        driverSocket.emit('order_accepted_success', {
          orderId: orderId,
          message: 'Sipariş başarıyla kabul edildi'
        });
        
        // Sürücüye fiyat onayı için geri sayım başladığını bildir
        driverSocket.emit('price_confirmation_countdown_started', {
          orderId: orderId,
          timeout: 60000, // 60 saniye
          message: 'Müşteri fiyat onayı bekleniyor (60 saniye)',
          countdownStartTime: Date.now()
        });
      }
      
      // Tüm müşterilere güncellenmiş sürücü listesini gönder
      this.broadcastNearbyDriversToAllCustomers();
      
    } catch (error) {
      console.error(`❌ Error in handleOrderAcceptanceWithLabor:`, error);
      
      // Hata durumunda sürücüyü bilgilendir
      const driverData = this.connectedDrivers.get(driverId);
      if (driverData) {
        const driverSocket = this.io.sockets.sockets.get(driverData.socketId);
        if (driverSocket) {
          driverSocket.emit('order_accept_error', {
            message: 'Sipariş kabul edilirken hata oluştu'
          });
        }
      }
    }
  }

  async updateOrderStatusBeforeAssignment(orderId, status, driverId, oldStatus = null) {
    console.log('🔧 updateOrderStatusBeforeAssignment called:', { orderId, status, driverId, oldStatus });
    
    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();
      
      // Önce orders tablosunu güncelle - driver_id kontrolü yok çünkü henüz atanmadı
      console.log(`🔧 Executing UPDATE query for order ${orderId} with status ${status}`);
      const result = await pool.request()
        .input('orderId', sql.Int, orderId)
        .input('orderStatus', sql.VarChar, status)
        .query(`
          UPDATE orders 
          SET order_status = @orderStatus,
              updated_at = DATEADD(hour, 3, GETDATE())
          WHERE id = @orderId
        `);
      
      console.log(`🔧 UPDATE result:`, { rowsAffected: result.rowsAffected[0] });
      
      if (result.rowsAffected[0] === 0) {
        console.warn(`⚠️ Order ${orderId} not found`);
        return false;
      }
      
      // Ardından order_status_history tablosuna yeni kayıt ekle
      try {
        await pool.request()
          .input('orderId', sql.Int, orderId)
          .input('oldStatus', sql.VarChar, oldStatus)
          .input('newStatus', sql.VarChar, status)
          .input('driverId', sql.Int, driverId)
          .query(`
            INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_driver_id, created_at)
            VALUES (@orderId, @oldStatus, @newStatus, @driverId, DATEADD(hour, 3, GETDATE()))
          `);
        
        console.log(`📋 Order status history recorded for order ${orderId}: ${oldStatus} -> ${status}`);
      } catch (historyError) {
        console.error(`❌ Error inserting order status history:`, historyError);
        // History kaydı eklenemese bile ana işlem devam etmeli
      }
      
      console.log(`✅ Order ${orderId} status updated to '${status}' for driver ${driverId}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Error updating order status:`, error);
      return false;
    }
  }

  async updateOrderStatus(orderId, status, driverId, oldStatus = null) {
    console.log('Update order status called:', orderId, status, driverId, oldStatus);

    // Map incoming statuses to DB-compliant statuses
    const statusMap = {
      started: 'pickup_completed',
      completed: 'delivered',
      driver_navigating: 'driver_going_to_pickup',
    };
    const finalDbStatus = statusMap[status] || status;

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Update orders table with driver assignment check
      const result = await pool.request()
        .input('orderId', sql.Int, orderId)
        .input('orderStatus', sql.VarChar, finalDbStatus)
        .input('driverId', sql.Int, driverId)
        .query(`
          UPDATE orders 
          SET order_status = @orderStatus,
              updated_at = DATEADD(hour, 3, GETDATE())
          WHERE id = @orderId AND driver_id = @driverId
        `);

      if (result.rowsAffected[0] === 0) {
        console.warn(`⚠️ Order ${orderId} not found or not assigned to driver ${driverId}`);
        return false;
      }

      // Insert into order_status_history
      try {
        await pool.request()
          .input('orderId', sql.Int, orderId)
          .input('oldStatus', sql.VarChar, oldStatus)
          .input('newStatus', sql.VarChar, finalDbStatus)
          .input('driverId', sql.Int, driverId)
          .query(`
            INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_driver_id, created_at)
            VALUES (@orderId, @oldStatus, @newStatus, @driverId, DATEADD(hour, 3, GETDATE()))
          `);
        console.log(`📋 Order status history recorded for order ${orderId}: ${oldStatus} -> ${finalDbStatus}`);
      } catch (historyError) {
        console.error(`❌ Error inserting order status history:`, historyError);
        // History kaydı eklenemese bile ana işlem devam etmeli
      }

      // Fetch customer to emit updates
      const orderDetails = await this.getOrderDetails(orderId);
      const customerId = orderDetails?.user_id;

      // Map DB statuses to driver-friendly display statuses
      const driverDisplayStatusMap = {
        driver_going_to_pickup: 'in_progress',
        pickup_completed: 'in_progress',
        in_transit: 'in_progress',
        delivered: 'completed',
        payment_completed: 'completed',
        cancelled: 'cancelled',
      };
      const driverEmitStatus = driverDisplayStatusMap[finalDbStatus] || status;

      // Determine phase for driver UI
      let phase = null;
      if (finalDbStatus === 'driver_going_to_pickup') {
        phase = 'pickup';
      } else if (finalDbStatus === 'pickup_completed' || finalDbStatus === 'in_transit') {
        phase = 'delivery';
      } else if (finalDbStatus === 'delivered' || finalDbStatus === 'payment_completed') {
        phase = null;
      }

      // Emit order status updates
      try {
        const driverRoom = roomUtils.getUserRoomId('driver', driverId);
        if (customerId) {
          const customerRoom = roomUtils.getUserRoomId('customer', customerId);
          // Send DB status to customer
          this.io.to(customerRoom).emit('order_status_update', { orderId, status: finalDbStatus });
        }
        // Send mapped status to driver for UI compatibility
        this.io.to(driverRoom).emit('order_status_update', { orderId, status: driverEmitStatus });

        // Emit phase update to driver if applicable
        if (phase !== null) {
          this.io.to(driverRoom).emit('order_phase_update', {
            orderId,
            currentPhase: phase,
            status: finalDbStatus,
          });
        }
      } catch (emitError) {
        console.error('❌ Error emitting status/phase updates:', emitError);
      }

      // Stop periodic updates when order is finalized or cancelled
      if (finalDbStatus === 'delivered' || finalDbStatus === 'payment_completed' || finalDbStatus === 'cancelled') {
        const intervalKey = `${driverId}_${orderId}`;
        if (this.driverLocationIntervals && this.driverLocationIntervals.has(intervalKey)) {
          try {
            clearInterval(this.driverLocationIntervals.get(intervalKey));
          } catch {}
          this.driverLocationIntervals.delete(intervalKey);
          console.log(`🛑 Stopped driver location updates for ${intervalKey}`);
        }
      }

      console.log(`✅ Order ${orderId} status updated to '${finalDbStatus}' for driver ${driverId}`);
      return true;

    } catch (error) {
      console.error(`❌ Error updating order status:`, error);
      return false;
    }
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
      const updateResult = await pool.request()
        .input('orderId', sql.Int, orderIdInt)
        .query(`
          UPDATE orders 
          SET order_status = 'inspecting',
              updated_at = DATEADD(hour, 3, GETDATE())
          WHERE id = @orderId AND order_status = 'pending'
        `);
      
      if (updateResult.rowsAffected[0] === 0) {
        console.warn(`⚠️ Order ${orderIdInt} could not be updated to inspecting status (may not exist or not in pending status)`);
        const driverData = this.connectedDrivers.get(driverId);
        if (driverData) {
          this.io.to(driverData.socketId).emit('order_no_longer_available', { orderId: actualOrderId });
        }
        return;
      }
      
      console.log(`✅ Order ${orderIdInt} status updated to 'inspecting'`);

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
        
        // NOT: order_status_update event'i kaldırıldı - sadece order_inspection_started yeterli
        // Bu sayede müşteri tarafında yanlış modal açılmayacak
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
      
      // Ortak validasyon fonksiyonunu kullan
      const validationResult = await this.validateDriversWithDatabase(driverIds);
      const validDriversFromDB = validationResult.validDrivers;
      const driverDataFromDB = validationResult.driverData;
      
      console.log(`🔍 Database validation: ${validDriversFromDB.size} out of ${driverIds.length} drivers passed all criteria (approved, active, available, recent location)`);
      console.log(`🔍 Valid drivers from DB:`, Array.from(validDriversFromDB));
      console.log(`🔍 Driver data keys:`, Array.from(driverDataFromDB.keys()));
      
      // Geçerli olmayan sürücüleri logla - TİP UYUMSUZLUGU YOK ET!
      const invalidDrivers = driverIds.filter(id => !validDriversFromDB.has(id.toString()));
      if (invalidDrivers.length > 0) {
        console.log(`❌ Invalid drivers (failed DB validation): ${invalidDrivers.join(', ')}`);
      }
      
      // Eğer veritabanı validasyonundan geçen sürücü yoksa işlemi sonlandır
      if (validDriversFromDB.size === 0) {
        console.log(`📍 No drivers passed database validation for order ${orderId} - all connected drivers are either not approved, not active, not available, or have stale location data`);
        return;
      }

      let matchingDriversCount = 0;
      let driversWithDistance = [];
      
      // Final kontrol ve sipariş gönderimi - sadece DB'den geçerli sürücülere
      for (const item of eligibleDrivers) {
        // Önce sürücünün DB validasyonunu geçip geçmediğini kontrol et - TİP UYUMSUZLUGU YOK ET!
        if (!validDriversFromDB.has(item.driverId.toString())) {
          console.log(`❌ Driver ${item.driverId} skipped - failed database validation (not approved/active/available or stale location)`);
          continue;
        }
        
        const driverData = driverDataFromDB.get(item.driverId.toString());
        const driverVehicleTypeId = driverData?.vehicleTypeId;
        
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
          console.log(`❌ Driver ${item.driverId} - unexpected error: passed DB validation but no vehicle type data`);
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
      
      const orderData = result.recordset[0];
      if (!orderData) return null;
      
      // Transform database field names to match frontend expectations
      // Frontend expects delivery_latitude/delivery_longitude instead of destination_latitude/destination_longitude
      return {
        ...orderData,
        delivery_latitude: orderData.destination_latitude,
        delivery_longitude: orderData.destination_longitude,
        // Keep original fields for backward compatibility
        destination_latitude: orderData.destination_latitude,
        destination_longitude: orderData.destination_longitude
      };
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

  /**
   * Handle driver price confirmation - send to customer for approval
   */
  async handlePriceConfirmation(driverId, orderId, finalPrice, laborCost) {
    try {
      console.log(`💰 Price confirmation: Driver ${driverId} for order ${orderId}, final price: ${finalPrice}, labor: ${laborCost}`);
      
      // Get order details to find customer
      const orderDetails = await this.getOrderDetails(orderId);
      if (!orderDetails) {
        console.error(`❌ Order ${orderId} not found for price confirmation`);
        return;
      }
      
      const customerId = orderDetails.user_id;
      const driverData = this.connectedDrivers.get(driverId);
      
      if (!driverData) {
        console.error(`❌ Driver ${driverId} not found in connected drivers`);
        return;
      }
      
      // Get driver info
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();
      
      const driverResult = await pool.request()
        .input('driverId', driverId)
        .query(`
          SELECT d.first_name, d.last_name, d.vehicle_plate, d.vehicle_model, d.vehicle_color
          FROM drivers d
          WHERE d.id = @driverId
        `);
      
      if (driverResult.recordset.length === 0) {
        console.error(`❌ Driver ${driverId} not found in database`);
        return;
      }
      
      const driverInfo = driverResult.recordset[0];
      
      // Send price confirmation to customer
      const customerRoom = roomUtils.getUserRoomId('customer', customerId);
      this.io.to(customerRoom).emit('order_price_confirmed', {
        orderId,
        finalPrice,
        laborCost,
        driverInfo: {
          id: driverId,
          name: `${driverInfo.first_name} ${driverInfo.last_name}`,
          vehicle: `${driverInfo.vehicle_color} ${driverInfo.vehicle_model}`,
          plate: driverInfo.vehicle_plate
        },
        timeout: 60000 // 60 seconds for customer response
      });
      
      console.log(`💰 Price confirmation sent to customer ${customerId} for order ${orderId}`);
      
      // Set timeout for customer response
      setTimeout(async () => {
        // Check if customer responded (you might want to track this in memory or database)
        console.log(`⏰ Price confirmation timeout for order ${orderId}`);
        // You can add timeout handling here if needed
      }, 60000);
      
    } catch (error) {
      console.error('❌ Error handling price confirmation:', error);
    }
  }

  /**
   * Handle customer price response - accept or reject
   */
  async handleCustomerPriceResponse(customerId, orderId, accepted) {
    try {
      console.log(`💰 Customer ${customerId} price response for order ${orderId}: ${accepted ? 'ACCEPTED' : 'REJECTED'}`);
      console.log(`🔧 DEBUG: Pending approvals keys:`, Array.from(this.pendingOrderApprovals?.keys() || []));
      
      // Önce bekleyen onay verisini kontrol et
      const pendingKeyNum = Number(orderId);
      const pendingKeyStr = String(orderId);
      let pendingApproval = null;
      if (this.pendingOrderApprovals && this.pendingOrderApprovals.has(pendingKeyNum)) {
        pendingApproval = this.pendingOrderApprovals.get(pendingKeyNum);
      } else if (this.pendingOrderApprovals && this.pendingOrderApprovals.has(pendingKeyStr)) {
        pendingApproval = this.pendingOrderApprovals.get(pendingKeyStr);
      } else {
        console.error(`❌ No pending approval found for order ${orderId} (checked keys: ${pendingKeyNum} and '${pendingKeyStr}')`);
        console.log(`🔧 DEBUG: Available pending approvals:`, Array.from(this.pendingOrderApprovals?.keys() || []));
        return;
      }
      
      console.log(`🔧 DEBUG: Found pending approval:`, pendingApproval);
      const driverId = pendingApproval.driverId;
      const laborCount = pendingApproval.laborCount;
      
      // Get order details
      const orderDetails = await this.getOrderDetails(orderId);
      if (!orderDetails) {
        console.error(`❌ Order ${orderId} not found for price response`);
        return;
      }
      
      const driverData = this.connectedDrivers.get(driverId);
      
      if (!driverData) {
        console.error(`❌ Driver ${driverId} not connected for price response`);
        return;
      }
      
      const currentOrderStatus = orderDetails.order_status; // Mevcut durumu al
      
      if (accepted) {
        // Önce siparişe driver ataması yap ve durumu güncelle
        const db = DatabaseConnection.getInstance();
        const pool = await db.connect();
        
        try {
          // Siparişe driver ataması yap ve işçi sayısını güncelle
          const updateResult = await pool.request()
            .input('orderId', sql.Int, orderId)
            .input('driverId', sql.Int, driverId)
            .input('laborCount', sql.Int, laborCount)
            .input('orderStatus', sql.VarChar, 'customer_price_approved')
            .query(`
              UPDATE orders 
              SET driver_id = @driverId, 
                  labor_count = @laborCount,
                  order_status = @orderStatus,
                  updated_at = DATEADD(hour, 3, GETDATE())
              WHERE id = @orderId
            `);
          console.log(`🔧 UPDATE rows affected: ${updateResult.rowsAffected[0]}`);
          
          // Sürücünün müsaitliğini güncelle
          await pool.request()
            .input('driverId', sql.Int, driverId)
            .input('isAvailable', sql.Bit, false)
            .query('UPDATE drivers SET is_available = @isAvailable WHERE id = @driverId');
            
          // Memory'de sürücü durumunu güncelle
          const driverData = this.connectedDrivers.get(driverId);
          if (driverData) {
            driverData.isAvailable = false;
            driverData.currentOrderId = orderId;
          }

          // History kaydı ekle (oldStatus -> customer_price_approved)
          try {
            await pool.request()
              .input('orderId', sql.Int, orderId)
              .input('oldStatus', sql.VarChar, currentOrderStatus)
              .input('newStatus', sql.VarChar, 'customer_price_approved')
              .input('driverId', sql.Int, driverId)
              .query(`
                INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_driver_id, created_at)
                VALUES (@orderId, @oldStatus, @newStatus, @driverId, DATEADD(hour, 3, GETDATE()))
              `);
            console.log(`📋 Order status history recorded for order ${orderId}: ${currentOrderStatus} -> customer_price_approved`);
          } catch (historyError) {
            console.error(`❌ Error inserting order status history for customer_price_approved:`, historyError);
          }
          
          console.log(`✅ Order ${orderId} assigned to driver ${driverId} and status updated to customer_price_approved`);
          
        } catch (dbError) {
          console.error(`❌ Database error during order assignment:`, dbError);
          console.error(`   SQL Error number: ${dbError.number}, message: ${dbError.message}`);
          return;
        }
        
        // Send acceptance to driver
        const driverSocket = this.getDriverSocket(driverId);
        if (driverSocket) {
          driverSocket.emit('price_accepted_by_customer', {
            orderId,
            message: 'Müşteri fiyatı onayladı, yola çıkabilirsiniz'
          });
          
          // Remove other drivers from customer room (only accepted driver stays)
          const customerRoom = roomUtils.getUserRoomId('customer', customerId);
          
          // Get all drivers in customer room
          const room = this.io.sockets.adapter.rooms.get(customerRoom);
          if (room) {
            room.forEach(socketId => {
              const socket = this.io.sockets.sockets.get(socketId);
              if (socket && socket.userType === 'driver' && socket.userId !== driverId) {
                socket.leave(customerRoom);
                console.log(`🚪 Removed driver ${socket.userId} from customer ${customerId} room - order accepted by different driver`);
              }
            });
          }
          
          // Notify customer that order is now confirmed
          this.io.to(customerRoom).emit('order_status_update', {
            orderId: orderId,
            status: 'customer_price_approved',
            message: 'Müşteri onayı alındı, sürücünüz yola çıkıyor'
          });
          
          // Start driver navigation
          await this.handleDriverStartedNavigation(driverId, orderId);
          
          console.log(`✅ Price accepted by customer ${customerId} for order ${orderId}, navigation started for driver ${driverId}`);
      
      // Debug: Order status after acceptance
      const finalOrderDetails = await this.getOrderDetails(orderId);
      console.log(`🔧 DEBUG: Final order status after acceptance:`, finalOrderDetails?.order_status);
        }
      } else {
        // Send rejection to driver
        const driverSocket = this.getDriverSocket(driverId);
        if (driverSocket) {
          driverSocket.emit('price_rejected_by_customer', {
            orderId,
            message: 'Müşteri fiyatı reddetti'
          });
          
          // Driver hala müsait durumda, sadece pending onayı temizle
          // Sipariş durumunu güncelleme (henüz atama yapılmadı)
          await this.updateOrderStatusBeforeAssignment(orderId, 'customer_price_rejected', driverId, currentOrderStatus);
          
          // Remove all drivers from customer room since order is rejected
          const customerRoom = roomUtils.getUserRoomId('customer', customerId);
          
          // Get all drivers in customer room and notify removal
          const room = this.io.sockets.adapter.rooms.get(customerRoom);
          if (room) {
            room.forEach(socketId => {
              const socket = this.io.sockets.sockets.get(socketId);
              if (socket && socket.userType === 'driver') {
                // Inform driver to remove order from their list
                socket.emit('order_removed_from_list', {
                  orderId: orderId,
                  reason: 'customer_rejected_price',
                  message: 'Müşteri fiyatı reddetti, sipariş listeden kaldırıldı'
                });
                // Then remove driver from customer room
                socket.leave(customerRoom);
                console.log(`🚪 Notified and removed driver ${socket.userId} from customer ${customerId} room - order rejected by customer`);
              }
            });
          }
          
          // Cancel the order completely - customer rejected, order is dead
          await this.updateOrderStatusBeforeAssignment(orderId, 'cancelled', driverId, 'customer_price_rejected');
          
          // Notify customer that order is cancelled
          this.io.to(customerRoom).emit('order_status_update', {
            orderId: orderId,
            status: 'cancelled',
            message: 'Siparişiniz iptal edildi, yeni sipariş oluşturabilirsiniz'
          });
          
          // Note: Drivers in the room already received order_removed_from_list above
          
          console.log(`❌ Price rejected by customer ${customerId} for order ${orderId}, order CANCELLED, driver ${driverId} still available`);
          
          // Debug: Order status after rejection
          const finalOrderDetails = await this.getOrderDetails(orderId);
          console.log(`🔧 DEBUG: Final order status after rejection:`, finalOrderDetails?.order_status);
        }
      }
      
      // Her durumda pending onayı temizle
      if (this.pendingOrderApprovals) {
        const deletedNum = this.pendingOrderApprovals.delete(pendingKeyNum);
        const deletedStr = this.pendingOrderApprovals.delete(pendingKeyStr);
        console.log(`🧹 Pending approval cleaned for order ${orderId} (numKey=${deletedNum}, strKey=${deletedStr})`);
      }
      
      // İnceleme takibini de temizle (varsa)
      if (this.inspectingOrders && this.inspectingOrders.has(orderId)) {
        this.inspectingOrders.delete(orderId);
        console.log(`🧹 Inspecting order cleaned for order ${orderId}`);
      }
      
      // Countdown timer'ı iptal et
      if (this.orderCountdownTimers) {
        let timer = this.orderCountdownTimers.get(pendingKeyNum);
        if (!timer) timer = this.orderCountdownTimers.get(pendingKeyStr);
        if (timer) {
          clearTimeout(timer);
          this.orderCountdownTimers.delete(pendingKeyNum);
          this.orderCountdownTimers.delete(pendingKeyStr);
          console.log(`⏰ Countdown timer cancelled for order ${orderId}`);
        }
      }
      
      // Countdown interval'ı iptal et
      if (this.orderCountdownIntervals) {
        let interval = this.orderCountdownIntervals.get(pendingKeyNum);
        if (!interval) interval = this.orderCountdownIntervals.get(pendingKeyStr);
        if (interval) {
          clearInterval(interval);
          this.orderCountdownIntervals.delete(pendingKeyNum);
          this.orderCountdownIntervals.delete(pendingKeyStr);
          console.log(`⏰ Countdown interval cancelled for order ${orderId}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error handling customer price response:', error);
    }
  }

  /**
   * Handle driver started navigation
   */
  async handleDriverStartedNavigation(driverId, orderId) {
    try {
      console.log(`🚗 Driver ${driverId} started navigation for order ${orderId}`);
      
      // Get order details to find customer
      const orderDetails = await this.getOrderDetails(orderId);
      if (!orderDetails) {
        console.error(`❌ Order ${orderId} not found for navigation start`);
        return;
      }
      
      const customerId = orderDetails.user_id;
      
      // Send navigation started to customer
      const customerRoom = roomUtils.getUserRoomId('customer', customerId);
      this.io.to(customerRoom).emit('driver_started_navigation', {
        orderId,
        driverId,
        timestamp: new Date().toISOString(),
        message: 'Sürücünüz yola çıktı'
      });
      
      // Update order status to new schema compatible value
      await this.updateOrderStatus(orderId, 'driver_going_to_pickup', driverId);
      
      console.log(`🚗 Navigation started notification sent to customer ${customerId} for order ${orderId}`);
      
      // Start periodic location updates (ETA to pickup)
      this.startDriverLocationUpdates(driverId, orderId, customerId);
      
    } catch (error) {
      console.error('❌ Error handling driver navigation start:', error);
    }
  }

  /**
   * Start periodic driver location updates for customer tracking
   */
  startDriverLocationUpdates(driverId, orderId, customerId) {
    const updateInterval = setInterval(async () => {
      const driverData = this.connectedDrivers.get(driverId);
      if (!driverData || !driverData.location) {
        clearInterval(updateInterval);
        return;
      }

      // Determine target based on current order status (pickup or delivery)
      let eta = null;
      let targetLat = null;
      let targetLng = null;
      let targetType = null; // 'pickup' | 'delivery'

      try {
        const orderDetails = await this.getOrderDetails(orderId);
        const currentStatus = orderDetails?.order_status;

        // Stop updates if order is finalized or cancelled
        if (currentStatus === 'delivered' || currentStatus === 'payment_completed' || currentStatus === 'cancelled') {
          clearInterval(updateInterval);
          if (this.driverLocationIntervals) {
            this.driverLocationIntervals.delete(`${driverId}_${orderId}`);
          }
          console.log(`🛑 Stopped driver location updates for order ${orderId} (status: ${currentStatus})`);
          return;
        }

        if (currentStatus === 'driver_going_to_pickup' || currentStatus === 'confirmed' || currentStatus === 'driver_accepted_awaiting_customer') {
          targetLat = orderDetails?.pickup_latitude || null;
          targetLng = orderDetails?.pickup_longitude || null;
          targetType = 'pickup';
        } else if (currentStatus === 'pickup_completed' || currentStatus === 'in_transit') {
          // Prefer delivery_latitude/longitude, fallback to destination_latitude/longitude
          targetLat = (orderDetails?.delivery_latitude ?? orderDetails?.destination_latitude) || null;
          targetLng = (orderDetails?.delivery_longitude ?? orderDetails?.destination_longitude) || null;
          targetType = 'delivery';
        }
      } catch (e) {
        console.error('❌ Error determining target for ETA:', e);
      }

      // Calculate ETA using target if available, fallback to customer's current location
      if (targetLat != null && targetLng != null) {
        const distance = this.calculateDistance(
          driverData.location.latitude,
          driverData.location.longitude,
          targetLat,
          targetLng
        );
        const etaMinutes = Math.round((distance / 30) * 60); // 30 km/h average speed
        eta = etaMinutes;
      } else {
        const customerData = this.connectedCustomers.get(customerId);
        if (customerData && customerData.location) {
          const distance = this.calculateDistance(
            driverData.location.latitude,
            driverData.location.longitude,
            customerData.location.latitude,
            customerData.location.longitude
          );
          const etaMinutes = Math.round((distance / 30) * 60);
          eta = etaMinutes;
        }
      }

      // Send location update to customer with ETA and optional target info
      const customerRoom = roomUtils.getUserRoomId('customer', customerId);
      this.io.to(customerRoom).emit('driver_location_update', {
        orderId,
        driverId,
        location: driverData.location,
        eta: eta,
        targetType: targetType,
        target: targetLat != null && targetLng != null ? { latitude: targetLat, longitude: targetLng } : null,
        timestamp: new Date().toISOString()
      });

      console.log(`📍 Driver ${driverId} location update sent to customer ${customerId} for order ${orderId}, ETA: ${eta} minutes, target: ${targetType || 'unknown'}`);

    }, 5000); // Every 5 seconds

    // Store the interval so we can clear it later
    if (!this.driverLocationIntervals) {
      this.driverLocationIntervals = new Map();
    }
    this.driverLocationIntervals.set(`${driverId}_${orderId}`, updateInterval);
  }
}

module.exports = SocketServer;