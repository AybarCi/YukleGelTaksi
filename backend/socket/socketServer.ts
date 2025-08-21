import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import DatabaseConnection from '../config/database.js';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  userType?: 'customer' | 'driver';
  driverId?: number;
}

interface OrderData {
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  weight: number;
  laborCount: number;
  estimatedPrice: number;
}

interface LocationUpdate {
  latitude: number;
  longitude: number;
  heading?: number;
}

class SocketServer {
  private io: SocketIOServer;
  private connectedDrivers: Map<number, string> = new Map(); // driverId -> socketId
  private connectedCustomers: Map<number, string> = new Map(); // userId -> socketId
  private activeOrders: Map<number, any> = new Map(); // orderId -> orderData

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.use(this.authenticateSocket.bind(this));

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User connected: ${socket.userId} (${socket.userType})`);

      // Kullanıcı tipine göre bağlantıyı kaydet
      if (socket.userType === 'driver' && socket.driverId) {
        this.connectedDrivers.set(socket.driverId, socket.id);
        this.handleDriverConnection(socket);
      } else if (socket.userType === 'customer' && socket.userId) {
        this.connectedCustomers.set(socket.userId, socket.id);
        this.handleCustomerConnection(socket);
      }

      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });
    });
  }

  private async authenticateSocket(socket: AuthenticatedSocket, next: any) {
    try {
      const token = socket.handshake.auth.token;
      const refreshToken = socket.handshake.auth.refreshToken;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      try {
        // İlk olarak mevcut token'ı doğrula
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
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
      } catch (tokenError: any) {
        // Token süresi dolmuşsa refresh token ile yenile
        if (tokenError.name === 'TokenExpiredError' && refreshToken) {
          console.log('Token expired, attempting refresh for socket connection');
          
          try {
            const newToken = await this.refreshSocketToken(refreshToken);
            if (newToken) {
              // Yeni token ile tekrar doğrula
              const decoded = jwt.verify(newToken, process.env.JWT_SECRET || 'your-secret-key') as any;
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
          return next(new Error('Authentication error'));
        }
      }
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  }

  private handleDriverConnection(socket: AuthenticatedSocket) {
    // Her sürücüyü kendi unique room'una ekle
    const driverRoom = `driver_${socket.driverId}`;
    socket.join(driverRoom);
    console.log(`Driver ${socket.driverId} joined private room: ${driverRoom}`);
    
    // Sürücü lokasyon güncellemelerini dinle
    socket.on('location_update', async (data: LocationUpdate) => {
      await this.updateDriverLocation(socket.driverId!, data);
      
      // Aktif siparişi olan müşterilere lokasyon güncellemesi gönder
      this.broadcastDriverLocationToCustomers(socket.driverId!, data);
    });

    // Sürücü müsaitlik durumu güncellemesi
    socket.on('availability_update', async (isAvailable: boolean) => {
      await this.updateDriverAvailability(socket.driverId!, isAvailable);
    });

    // Sipariş kabul etme
    socket.on('accept_order', async (orderId: number) => {
      await this.handleOrderAcceptance(socket.driverId!, orderId);
    });

    // Sipariş durumu güncelleme
    socket.on('update_order_status', async (data: { orderId: number, status: string }) => {
      await this.updateOrderStatus(data.orderId, data.status, socket.driverId!);
    });
  }

  private handleCustomerConnection(socket: AuthenticatedSocket) {
    // Her müşteriyi kendi unique room'una ekle - müşteriler birbirini görmemeli
    const customerRoom = `customer_${socket.userId}`;
    socket.join(customerRoom);
    console.log(`🏠 Customer ${socket.userId} joined private room: ${customerRoom}`);
    
    // Room'daki mevcut üyeleri logla
    const roomMembers = this.io.sockets.adapter.rooms.get(customerRoom);
    console.log(`📊 Room ${customerRoom} current members:`, roomMembers ? Array.from(roomMembers) : []);
    
    // Yakındaki müsait sürücüleri bu müşterinin room'una connect et
    this.connectNearbyDriversToCustomerRoom(socket.userId!, customerRoom);
    
    // Müşteriye mevcut çevrimiçi sürücülerin konumlarını gönder
    this.sendNearbyDriversToCustomer(socket);
    
    // Müşteri konum güncellemesi
    socket.on('customer_location_update', async (data: LocationUpdate) => {
      await this.updateCustomerLocation(socket.userId!, data);
    });

    // Yeni sipariş oluşturma
    socket.on('create_order', async (orderData: OrderData) => {
      const orderId = await this.createOrder(socket.userId!, orderData);
      if (orderId) {
        // Yakındaki sürücülere sipariş bilgisini gönder
        await this.broadcastOrderToNearbyDrivers(orderId, orderData);
        
        // Müşteriye sipariş oluşturuldu onayı gönder
        socket.emit('order_created', { orderId, status: 'pending' });
      }
    });

    // Sipariş iptal etme
    socket.on('cancel_order', async (orderId: number) => {
      await this.cancelOrder(orderId, socket.userId!);
    });
  }

  private handleDisconnection(socket: AuthenticatedSocket) {
    console.log(`User disconnected: ${socket.userId} (${socket.userType})`);
    
    if (socket.userType === 'driver' && socket.driverId) {
      this.connectedDrivers.delete(socket.driverId);
      // Sürücüyü offline yap
      this.updateDriverAvailability(socket.driverId, false);
    } else if (socket.userType === 'customer' && socket.userId) {
      this.connectedCustomers.delete(socket.userId);
    }
  }

  private async createOrder(userId: number, orderData: OrderData): Promise<number | null> {
    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      let pickupLatitude = orderData.pickupLatitude;
      let pickupLongitude = orderData.pickupLongitude;

      // Eğer pickup adresi "Mevcut Konumum" ise, kullanıcının veritabanındaki konumunu al
      if (orderData.pickupAddress === 'Mevcut Konumum') {
        const userLocationResult = await pool.request()
          .input('userId', userId)
          .query(`
            SELECT current_latitude, current_longitude 
            FROM users 
            WHERE id = @userId AND current_latitude IS NOT NULL AND current_longitude IS NOT NULL
          `);

        if (userLocationResult.recordset.length > 0) {
          pickupLatitude = userLocationResult.recordset[0].current_latitude;
          pickupLongitude = userLocationResult.recordset[0].current_longitude;
        } else {
          console.error('User location not found in database for userId:', userId);
          // Fallback: orderData'daki koordinatları kullan
        }
      }

      const result = await pool.request()
        .input('user_id', userId)
        .input('pickup_address', orderData.pickupAddress)
        .input('pickup_latitude', pickupLatitude)
        .input('pickup_longitude', pickupLongitude)
        .input('destination_address', orderData.destinationAddress)
        .input('destination_latitude', orderData.destinationLatitude)
        .input('destination_longitude', orderData.destinationLongitude)
        .input('weight', orderData.weight)
        .input('labor_count', orderData.laborCount)
        .input('estimated_price', orderData.estimatedPrice)
        .query(`
          INSERT INTO orders (
            user_id, pickup_address, pickup_latitude, pickup_longitude,
            destination_address, destination_latitude, destination_longitude,
            weight, labor_count, estimated_price, status
          )
          OUTPUT INSERTED.id
          VALUES (
            @user_id, @pickup_address, @pickup_latitude, @pickup_longitude,
            @destination_address, @destination_latitude, @destination_longitude,
            @weight, @labor_count, @estimated_price, 'pending'
          )
        `);

      const orderId = result.recordset[0].id;
      // Güncellenmiş koordinatlarla activeOrders'a ekle
      const updatedOrderData = {
        ...orderData,
        pickupLatitude,
        pickupLongitude
      };
      this.activeOrders.set(orderId, { ...updatedOrderData, userId, status: 'pending' });
      return orderId;
    } catch (error) {
      console.error('Error creating order:', error);
      return null;
    }
  }

  private async broadcastOrderToNearbyDrivers(orderId: number, orderData: OrderData) {
    try {
      const nearbyDrivers = await this.getNearbyAvailableDrivers(
        orderData.pickupLatitude,
        orderData.pickupLongitude,
        15, // 15 km radius - genişletildi
        orderData.weight // Yük ağırlığını da gönder
      );

      console.log(`Found ${nearbyDrivers.length} suitable drivers for order ${orderId}`);
      
      // En iyi 5 sürücüye sipariş gönder (spam önlemek için)
      const topDrivers = nearbyDrivers.slice(0, 5);
      
      topDrivers.forEach((driver, index) => {
        const socketId = this.connectedDrivers.get(driver.id);
        if (socketId) {
          this.io.to(socketId).emit('new_order', {
            orderId,
            ...orderData,
            distance: driver.distance,
            matchingScore: driver.matchingScore,
            priority: index + 1, // Öncelik sırası
            estimatedArrival: Math.round(driver.distance * 2) // Tahmini varış süresi (dakika)
          });
          
          console.log(`Order sent to driver ${driver.id} (${driver.first_name} ${driver.last_name}) - Score: ${driver.matchingScore}, Distance: ${driver.distance.toFixed(2)}km`);
        }
      });
      
      // Eşleştirme istatistiklerini logla
      if (nearbyDrivers.length > 0) {
        const avgScore = nearbyDrivers.reduce((sum, d) => sum + d.matchingScore, 0) / nearbyDrivers.length;
        console.log(`Matching stats - Avg Score: ${avgScore.toFixed(1)}, Best: ${nearbyDrivers[0].matchingScore}, Worst: ${nearbyDrivers[nearbyDrivers.length-1].matchingScore}`);
      }
    } catch (error) {
      console.error('Error broadcasting order to drivers:', error);
    }
  }

  private async getNearbyAvailableDrivers(latitude: number, longitude: number, radiusKm: number, orderWeight?: number) {
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    const result = await pool.request()
      .input('latitude', latitude)
      .input('longitude', longitude)
      .input('radius', radiusKm)
      .query(`
        SELECT 
          d.id,
          u.current_latitude,
          u.current_longitude,
          u.first_name,
          u.last_name,
          d.vehicle_plate,
          d.vehicle_model,
          d.vehicle_capacity,
          d.rating,
          d.total_trips,
          u.last_location_update,
          (
            6371 * acos(
              cos(radians(@latitude)) * cos(radians(u.current_latitude)) *
              cos(radians(u.current_longitude) - radians(@longitude)) +
              sin(radians(@latitude)) * sin(radians(u.current_latitude))
            )
          ) AS distance,
          DATEDIFF(minute, u.last_location_update, GETDATE()) as minutes_since_last_update
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
          AND DATEDIFF(minute, u.last_location_update, GETDATE()) <= 10
        ORDER BY distance ASC
      `);

    // Gelişmiş eşleştirme algoritması uygula
    return this.applyAdvancedMatchingAlgorithm(result.recordset, orderWeight);
  }

  private applyAdvancedMatchingAlgorithm(drivers: any[], orderWeight?: number) {
    return drivers.map(driver => {
      let score = 0;
      
      // Mesafe skoru (0-40 puan) - yakın sürücüler daha yüksek puan
      const distanceScore = Math.max(0, 40 - (driver.distance * 2));
      score += distanceScore;
      
      // Rating skoru (0-25 puan)
      const ratingScore = (driver.rating || 0) * 5;
      score += ratingScore;
      
      // Deneyim skoru (0-20 puan) - toplam trip sayısına göre
      const experienceScore = Math.min(20, (driver.total_trips || 0) * 0.1);
      score += experienceScore;
      
      // Kapasite skoru (0-15 puan) - yük ağırlığına uygunluk
      let capacityScore = 15;
      if (orderWeight && driver.vehicle_capacity) {
        if (orderWeight > driver.vehicle_capacity) {
          capacityScore = 0; // Kapasite yetersizse sıfır puan
        } else {
          // Kapasite ne kadar uygunsa o kadar yüksek puan
          const utilizationRatio = orderWeight / driver.vehicle_capacity;
          capacityScore = 15 * (1 - Math.abs(0.7 - utilizationRatio)); // Optimal %70 kullanım
        }
      }
      score += capacityScore;
      
      // Aktiflik skoru (0-10 puan) - son konum güncellemesine göre
      const activityScore = Math.max(0, 10 - driver.minutes_since_last_update);
      score += activityScore;
      
      return {
        ...driver,
        matchingScore: Math.round(score),
        distanceScore: Math.round(distanceScore),
        ratingScore: Math.round(ratingScore),
        experienceScore: Math.round(experienceScore),
        capacityScore: Math.round(capacityScore),
        activityScore: Math.round(activityScore)
      };
    }).sort((a, b) => b.matchingScore - a.matchingScore); // En yüksek skordan düşüğe sırala
  }

  private async updateDriverLocation(driverId: number, location: LocationUpdate) {
    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Update location in users table via driver's user_id
      await pool.request()
        .input('driverId', driverId)
        .input('latitude', location.latitude)
        .input('longitude', location.longitude)
        .query(`
          UPDATE users 
          SET current_latitude = @latitude,
              current_longitude = @longitude,
              last_location_update = GETDATE(),
              updated_at = GETDATE()
          WHERE id = (SELECT user_id FROM drivers WHERE id = @driverId)
        `);
        
      // Update last_location_update in drivers table
      await pool.request()
        .input('driverId', driverId)
        .query(`
          UPDATE drivers 
          SET last_location_update = GETDATE()
          WHERE id = @driverId
        `);
      
      // Tüm müşterilere sürücü konum güncellemesini broadcast et
      this.broadcastDriverLocationToCustomers(driverId, location);
      
    } catch (error) {
      console.error('Error updating driver location:', error);
    }
  }

  private async updateDriverAvailability(driverId: number, isAvailable: boolean) {
    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      await pool.request()
        .input('driverId', driverId)
        .input('isAvailable', isAvailable)
        .query(`
          UPDATE drivers 
          SET is_available = @isAvailable,
              updated_at = GETDATE()
          WHERE id = @driverId
        `);
      
      // Sürücü availability değiştiğinde tüm müşterilere güncellenmiş sürücü listesini gönder
      await this.broadcastNearbyDriversToAllCustomers();
      
    } catch (error) {
      console.error('Error updating driver availability:', error);
    }
  }

  private async updateCustomerLocation(userId: number, location: LocationUpdate) {
    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      await pool.request()
        .input('userId', userId)
        .input('latitude', location.latitude)
        .input('longitude', location.longitude)
        .query(`
          UPDATE users 
          SET current_latitude = @latitude,
              current_longitude = @longitude,
              last_location_update = GETDATE(),
              updated_at = GETDATE()
          WHERE id = @userId
        `);
    } catch (error) {
      console.error('Error updating customer location:', error);
    }
  }

  private async refreshSocketToken(refreshToken: string): Promise<string | null> {
    try {
      // Refresh token'ı doğrula
      const refreshDecoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh-secret') as any;
      
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

  private async connectNearbyDriversToCustomerRoom(customerId: number, customerRoom: string) {
    try {
      console.log(`🔍 Connecting nearby drivers to room: ${customerRoom} for customer: ${customerId}`);
      
      // Müşterinin konumunu al
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();
      
      const customerResult = await pool.request()
        .input('customerId', customerId)
        .query(`
          SELECT current_latitude, current_longitude 
          FROM users 
          WHERE id = @customerId AND current_latitude IS NOT NULL AND current_longitude IS NOT NULL
        `);
      
      if (customerResult.recordset.length === 0) {
        console.log(`❌ Customer ${customerId} location not found`);
        return;
      }
      
      const { current_latitude, current_longitude } = customerResult.recordset[0];
      console.log(`📍 Customer ${customerId} location: ${current_latitude}, ${current_longitude}`);
      
      // Yakındaki müsait sürücüleri bul (5km yarıçap)
      const nearbyDrivers = await this.getNearbyAvailableDrivers(
        current_latitude, 
        current_longitude, 
        5 // 5km yarıçap
      );
      
      console.log(`🚗 Found ${nearbyDrivers.length} nearby drivers for customer ${customerId}:`, 
        nearbyDrivers.map(d => ({ id: d.id, distance: d.distance })));
      
      let connectedDriversCount = 0;
      
      // Her yakındaki sürücüyü müşteri room'una connect et
      nearbyDrivers.forEach((driver: any) => {
        const driverSocketId = this.connectedDrivers.get(driver.id);
        if (driverSocketId) {
          const driverSocket = this.io.sockets.sockets.get(driverSocketId);
          if (driverSocket) {
            driverSocket.join(customerRoom);
            connectedDriversCount++;
            console.log(`✅ Driver ${driver.id} connected to customer room: ${customerRoom}`);
          } else {
            console.log(`❌ Driver ${driver.id} socket not found (socketId: ${driverSocketId})`);
          }
        } else {
          console.log(`❌ Driver ${driver.id} not connected (no socketId)`);
        }
      });
      
      // Room'daki güncel üye sayısını logla
      const roomMembers = this.io.sockets.adapter.rooms.get(customerRoom);
      console.log(`📊 Room ${customerRoom} final members count: ${roomMembers ? roomMembers.size : 0}`);
      console.log(`🔗 Successfully connected ${connectedDriversCount} drivers to room ${customerRoom}`);
      
    } catch (error) {
      console.error('❌ Error connecting nearby drivers to customer room:', error);
    }
  }

  private async sendNearbyDriversToCustomer(socket: AuthenticatedSocket) {
    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();
      
      // Çevrimiçi ve müsait sürücüleri getir
      const result = await pool.request()
        .query(`
          SELECT 
            d.id,
            u.current_latitude,
            u.current_longitude,
            d.first_name,
            d.last_name,
            d.vehicle_plate,
            d.vehicle_model,
            d.vehicle_color
          FROM drivers d
          INNER JOIN users u ON d.user_id = u.id
          WHERE d.is_active = 1 
            AND u.current_latitude IS NOT NULL 
            AND u.current_longitude IS NOT NULL
        `);
      
      const drivers = (result.recordset || []).map(driver => ({
        id: driver.id.toString(),
        latitude: driver.current_latitude,
        longitude: driver.current_longitude,
        heading: 0, // Default heading value
        name: `${driver.first_name} ${driver.last_name}`,
        vehicle: `${driver.vehicle_color} ${driver.vehicle_model}`,
        plate: driver.vehicle_plate
      }));
      
      // Müşteriye çevrimiçi sürücüleri gönder
      socket.emit('nearbyDriversUpdate', { drivers });
      
    } catch (error) {
      console.error('Error sending nearby drivers to customer:', error);
    }
  }

  private async broadcastNearbyDriversToAllCustomers() {
    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();
      
      // Çevrimiçi ve müsait sürücüleri getir
      const result = await pool.request()
        .query(`
          SELECT 
            d.id,
            u.current_latitude,
            u.current_longitude,
            d.first_name,
            d.last_name,
            d.vehicle_plate,
            d.vehicle_model,
            d.vehicle_color
          FROM drivers d
          INNER JOIN users u ON d.user_id = u.id
          WHERE d.is_active = 1 
            AND u.current_latitude IS NOT NULL 
            AND u.current_longitude IS NOT NULL
        `);
      
      const drivers = (result.recordset || []).map(driver => ({
        id: driver.id.toString(),
        latitude: driver.current_latitude,
        longitude: driver.current_longitude,
        heading: 0, // Default heading value
        name: `${driver.first_name} ${driver.last_name}`,
        vehicle: `${driver.vehicle_color} ${driver.vehicle_model}`,
        plate: driver.vehicle_plate
      }));
      
      // Her müşteriye ayrı ayrı güncellenmiş sürücü listesini gönder
      this.connectedCustomers.forEach((socketId, userId) => {
        const customerRoom = `customer_${userId}`;
        this.io.to(customerRoom).emit('nearbyDriversUpdate', { drivers });
      });
      
    } catch (error) {
      console.error('Error broadcasting nearby drivers to all customers:', error);
    }
  }

  private async broadcastDriverLocationToCustomers(driverId: number, location: LocationUpdate) {
    // Aktif siparişi olan müşterilere sürücü lokasyonunu gönder
    this.activeOrders.forEach((order, orderId) => {
      if (order.driverId === driverId) {
        const customerSocketId = this.connectedCustomers.get(order.userId);
        if (customerSocketId) {
          this.io.to(customerSocketId).emit('driver_location_update', {
            orderId,
            driverId,
            location
          });
        }
      }
    });
    
    // Tüm müşterilere güncel sürücü listesini gönder (nearbyDriversUpdate event'i ile)
    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();
      
      const result = await pool.request().query(`
        SELECT 
          d.id as driver_id,
          u.current_latitude,
          u.current_longitude,
          d.is_available,
          d.vehicle_type,
          d.vehicle_model,
          d.vehicle_plate,
          u.first_name,
          u.last_name,
          u.phone_number,
          d.rating
        FROM drivers d
        INNER JOIN users u ON d.user_id = u.id
        WHERE d.is_active = 1 
          AND d.is_available = 1
          AND u.current_latitude IS NOT NULL 
          AND u.current_longitude IS NOT NULL
      `);
      
      const drivers = (result.recordset || []).map((driver: any) => ({
        id: driver.driver_id,
        latitude: driver.current_latitude,
        longitude: driver.current_longitude,
        heading: 0, // Default heading value
        isAvailable: driver.is_available,
        vehicleType: driver.vehicle_type,
        vehicleModel: driver.vehicle_model,
        vehiclePlate: driver.vehicle_plate,
        firstName: driver.first_name,
        lastName: driver.last_name,
        phone: driver.phone_number,
        rating: driver.rating || 5.0
      }));
      
      // Her müşteriye ayrı ayrı güncel sürücü listesini gönder
      this.connectedCustomers.forEach((socketId, userId) => {
        const customerRoom = `customer_${userId}`;
        this.io.to(customerRoom).emit('nearbyDriversUpdate', {
          success: true,
          drivers: drivers
        });
      });
      
    } catch (error) {
      console.error('Error broadcasting driver locations to customers:', error);
    }
  }

  private async handleOrderAcceptance(driverId: number, orderId: number) {
    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Önce siparişin hala müsait olup olmadığını kontrol et
      const orderCheck = await pool.request()
        .input('orderId', orderId)
        .query(`SELECT status, weight FROM orders WHERE id = @orderId`);
      
      if (orderCheck.recordset.length === 0 || orderCheck.recordset[0].status !== 'pending') {
        // Sipariş artık müsait değil
        const driverSocketId = this.connectedDrivers.get(driverId);
        if (driverSocketId) {
          this.io.to(driverSocketId).emit('order_no_longer_available', { orderId });
        }
        return;
      }

      // Sürücü kapasitesi kontrolü
      const capacityCheck = await this.checkDriverCapacity(driverId, orderCheck.recordset[0].weight);
      if (!capacityCheck.suitable) {
        const driverSocketId = this.connectedDrivers.get(driverId);
        if (driverSocketId) {
          this.io.to(driverSocketId).emit('order_capacity_exceeded', { 
            orderId, 
            message: capacityCheck.message 
          });
        }
        return;
      }

      // Siparişi kabul et
      const updateResult = await pool.request()
        .input('orderId', orderId)
        .input('driverId', driverId)
        .query(`
          UPDATE orders 
          SET driver_id = @driverId,
              status = 'accepted',
              accepted_at = GETDATE()
          WHERE id = @orderId AND status = 'pending'
        `);

      if (updateResult.rowsAffected[0] === 0) {
        // Sipariş başka bir sürücü tarafından alınmış
        const driverSocketId = this.connectedDrivers.get(driverId);
        if (driverSocketId) {
          this.io.to(driverSocketId).emit('order_already_taken', { orderId });
        }
        return;
      }

      // Aktif siparişleri güncelle
      const order = this.activeOrders.get(orderId);
      if (order) {
        order.driverId = driverId;
        order.status = 'accepted';
        this.activeOrders.set(orderId, order);

        // Sürücüyü müsait olmayan duruma getir
        await this.updateDriverAvailability(driverId, false);

        // Müşteriye bildirim gönder
        const customerSocketId = this.connectedCustomers.get(order.userId);
        if (customerSocketId) {
          // Sürücü bilgilerini al
          const driverInfo = await this.getDriverInfo(driverId);
          this.io.to(customerSocketId).emit('order_accepted', {
            orderId,
            driver: driverInfo,
            estimatedArrival: Math.round(driverInfo.distance * 2) // Tahmini varış süresi
          });
        }

        // Diğer sürücülere siparişin alındığını bildir
        this.connectedDrivers.forEach((socketId, otherDriverId) => {
          if (otherDriverId !== driverId) {
            this.io.to(socketId).emit('order_taken', { orderId });
          }
        });

        // Kabul eden sürücüye onay gönder
        const driverSocketId = this.connectedDrivers.get(driverId);
        if (driverSocketId) {
          this.io.to(driverSocketId).emit('order_acceptance_confirmed', {
            orderId,
            customerInfo: {
              pickupAddress: order.pickupAddress,
              destinationAddress: order.destinationAddress,
              weight: order.weight,
              laborCount: order.laborCount
            }
          });
        }

        console.log(`Order ${orderId} accepted by driver ${driverId}`);
      }
    } catch (error) {
      console.error('Error accepting order:', error);
    }
  }

  private async checkDriverCapacity(driverId: number, orderWeight: number) {
    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      const result = await pool.request()
        .input('driverId', driverId)
        .query(`SELECT vehicle_capacity FROM drivers WHERE id = @driverId`);

      if (result.recordset.length === 0) {
        return { suitable: false, message: 'Sürücü bilgisi bulunamadı' };
      }

      const vehicleCapacity = result.recordset[0].vehicle_capacity;
      
      if (!vehicleCapacity) {
        return { suitable: true, message: 'Kapasite bilgisi yok, kabul edildi' };
      }

      if (orderWeight > vehicleCapacity) {
        return { 
          suitable: false, 
          message: `Yük ağırlığı (${orderWeight}kg) araç kapasitesini (${vehicleCapacity}kg) aşıyor` 
        };
      }

      return { suitable: true, message: 'Kapasite uygun' };
    } catch (error) {
      console.error('Error checking driver capacity:', error);
      return { suitable: true, message: 'Kapasite kontrolü yapılamadı, kabul edildi' };
    }
  }

  private async updateOrderStatus(orderId: number, status: string, driverId: number) {
    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      const updateField = status === 'started' ? 'started_at' : 
                         status === 'completed' ? 'completed_at' : null;

      let query = `UPDATE orders SET status = @status`;
      if (updateField) {
        query += `, ${updateField} = GETDATE()`;
      }
      query += ` WHERE id = @orderId AND driver_id = @driverId`;

      await pool.request()
        .input('orderId', orderId)
        .input('status', status)
        .input('driverId', driverId)
        .query(query);

      // Aktif siparişleri güncelle
      const order = this.activeOrders.get(orderId);
      if (order) {
        order.status = status;
        this.activeOrders.set(orderId, order);

        // Müşteriye durum güncellemesi gönder
        const customerSocketId = this.connectedCustomers.get(order.userId);
        if (customerSocketId) {
          this.io.to(customerSocketId).emit('order_status_update', {
            orderId,
            status
          });
        }

        // Sipariş tamamlandıysa aktif siparişlerden kaldır
        if (status === 'completed' || status === 'cancelled') {
          this.activeOrders.delete(orderId);
        }
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  }

  private async cancelOrder(orderId: number, userId: number) {
    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      await pool.request()
        .input('orderId', orderId)
        .input('userId', userId)
        .query(`
          UPDATE orders 
          SET status = 'cancelled',
              cancelled_at = GETDATE()
          WHERE id = @orderId AND user_id = @userId AND status IN ('pending', 'accepted')
        `);

      // Aktif siparişlerden kaldır
      const order = this.activeOrders.get(orderId);
      if (order) {
        // Eğer sürücü atanmışsa, sürücüye iptal bilgisi gönder
        if (order.driverId) {
          const driverSocketId = this.connectedDrivers.get(order.driverId);
          if (driverSocketId) {
            this.io.to(driverSocketId).emit('order_cancelled', { orderId });
          }
        }

        this.activeOrders.delete(orderId);
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
    }
  }

  private async getDriverInfo(driverId: number) {
    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      const result = await pool.request()
        .input('driverId', driverId)
        .query(`
          SELECT 
            d.id,
            u.first_name,
            u.last_name,
            u.phone_number,
            d.vehicle_plate,
            d.vehicle_model,
            d.vehicle_color,
            d.rating,
            u.current_latitude,
            u.current_longitude
          FROM drivers d
          INNER JOIN users u ON d.user_id = u.id
          WHERE d.id = @driverId
        `);

      return result.recordset[0] || null;
    } catch (error) {
      console.error('Error getting driver info:', error);
      return null;
    }
  }

  // Genel broadcast metodları
  public broadcastToAllDrivers(event: string, data: any) {
    this.connectedDrivers.forEach((socketId, driverId) => {
      const driverRoom = `driver_${driverId}`;
      this.io.to(driverRoom).emit(event, data);
    });
  }

  public broadcastToAllCustomers(event: string, data: any) {
    this.connectedCustomers.forEach((socketId, userId) => {
      const customerRoom = `customer_${userId}`;
      this.io.to(customerRoom).emit(event, data);
    });
  }

  public getConnectedDriversCount(): number {
    return this.connectedDrivers.size;
  }

  public getConnectedCustomersCount(): number {
    return this.connectedCustomers.size;
  }
}

export default SocketServer;