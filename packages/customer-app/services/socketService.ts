import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';

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

interface DriverInfo {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  vehicle_plate: string;
  vehicle_model: string;
  vehicle_color: string;
  rating: number;
  current_latitude: number;
  current_longitude: number;
}

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  private hasShownConnectionError: boolean = false;

  // Event listeners
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    this.initializeSocket();
  }

  private async initializeSocket(token?: string) {
    try {
      let authToken: string | null = token || null;
      let refreshToken: string | null = null;
      
      if (!authToken) {
        authToken = await AsyncStorage.getItem('auth_token');
      }
      
      // Refresh token'ı da al
      refreshToken = await AsyncStorage.getItem('refresh_token');
      
      if (!authToken) {
        console.log('No token found, cannot connect to socket');
        return;
      }

      // Cleanup existing socket if any
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
      }

      // API config'den base URL'i al ve socket için düzenle
      const serverUrl = API_CONFIG.BASE_URL;
      
      this.socket = io(serverUrl, {
        auth: {
          token: authToken,
          refreshToken: refreshToken
        },
        transports: ['websocket', 'polling'], // websocket öncelikli
        timeout: 20000, // 20 saniye timeout
        forceNew: false,
        reconnection: false, // Otomatik yeniden bağlanmayı kapat
        autoConnect: false,
        upgrade: true,
        rememberUpgrade: false
      });

      this.setupEventHandlers();
      
      // Manuel olarak bağlan
      this.socket.connect();
    } catch (error) {
      console.error('Error initializing socket:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.emit('connection_error', { error: errorMessage });
    }
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      this.isConnected = true;
      this.reconnectAttempts = 0; // Başarılı bağlantı sonrası sayacı sıfırla
      this.hasShownConnectionError = false;
      this.emit('connected', { socketId: this.socket?.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.isConnected = false;
      this.emit('disconnected', { reason });
      
      // Sadece client tarafından disconnect edilmemişse ve server disconnect değilse yeniden bağlan
      if (reason !== 'io client disconnect' && 
          reason !== 'io server disconnect' && 
          this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(2000 * this.reconnectAttempts, 10000); // 2s, 4s, 6s, 8s, 10s
        
        console.log(`Attempting reconnection in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
          if (!this.isConnected && this.socket) {
            this.socket.connect();
          }
        }, delay);
      } else if (reason === 'io server disconnect') {
        console.log('Server disconnected client, not attempting reconnection');
      }
    });

    // Token yenileme olayını dinle
    this.socket.on('token_refreshed', async (data) => {
      console.log('Token refreshed by server:', data);
      if (data.token) {
        // Yeni token'ı kaydet
        await AsyncStorage.setItem('auth_token', data.token);
        this.emit('token_refreshed', data);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.isConnected = false;
      
      // Sadece birkaç deneme sonrasında ve daha önce gösterilmemişse modal göster
      if (this.reconnectAttempts >= 3 && !this.hasShownConnectionError) {
        this.hasShownConnectionError = true;
        // Timeout hatası özel olarak handle et
        if (error.message.includes('timeout')) {
          console.log('Connection timeout, will retry with different transport');
          this.emit('connection_error', { error: 'Bağlantı zaman aşımı. Yeniden deneniyor...' });
        } else {
          this.emit('connection_error', { error: error.message });
        }
      }
      
      // handleReconnection() çağrısını kaldırdık - disconnect event'inde zaten var
    });

    // Order related events
    this.socket.on('order_created', (data) => {
      console.log('Order created:', data);
      this.emit('order_created', data);
    });

    this.socket.on('order_accepted', (data) => {
      console.log('Order accepted:', data);
      this.emit('order_accepted', data);
    });

    this.socket.on('order_status_update', (data) => {
      console.log('Order status update:', data);
      this.emit('order_status_update', data);
    });

    this.socket.on('order_cancelled', (data) => {
      console.log('Order cancelled:', data);
      this.emit('order_cancelled', data);
    });

    this.socket.on('order_taken', (data) => {
      console.log('Order taken by another driver:', data);
      this.emit('order_taken', data);
    });

    // Driver location events
    this.socket.on('driver_location_update', (data) => {
      console.log('Driver location update:', data);
      this.emit('driver_location_update', data);
    });

    // Nearby drivers update event
    this.socket.on('nearbyDriversUpdate', (data) => {
      console.log('Nearby drivers update:', data);
      this.emit('nearbyDriversUpdate', data);
    });

    // New order for drivers
    this.socket.on('new_order_available', (data) => {
      console.log('New order available:', data);
      this.emit('new_order', data);
    });

    // Driver offline event
    this.socket.on('driver_offline', (data) => {
      console.log('Driver went offline:', data);
      this.emit('driver_offline', data);
    });

    // Driver went offline event (when driver voluntarily goes offline)
    this.socket.on('driver_went_offline', (data) => {
      console.log('Driver went offline voluntarily:', data);
      this.emit('driver_went_offline', data);
    });

    // Server konum güncellemesi istediğinde
    this.socket.on('request_location_update', async () => {
      console.log('Server konum güncellemesi istiyor...');
      this.emit('request_location_update', {});
    });

    // Sürücü disconnect olduğunda
    this.socket.on('driver_disconnected', (data) => {
      console.log('Driver disconnected:', data);
      this.emit('driver_disconnected', data);
    });

    // Backend'den gelen eksik eventleri ekle
    this.socket.on('order_locked_for_inspection', (data) => {
      console.log('Order locked for inspection:', data);
      this.emit('order_locked_for_inspection', data);
    });

    this.socket.on('order_already_taken', (data) => {
      console.log('Order already taken:', data);
      this.emit('order_already_taken', data);
    });

    this.socket.on('order_acceptance_confirmed', (data) => {
      console.log('Order acceptance confirmed:', data);
      this.emit('order_acceptance_confirmed', data);
    });

    this.socket.on('order_phase_update', (data) => {
      console.log('Order phase update:', data);
      this.emit('order_phase_update', data);
    });

    this.socket.on('order_inspection_started', (data) => {
      console.log('Order inspection started:', data);
      this.emit('order_inspection_started', data);
    });

    this.socket.on('order_inspection_stopped', (data) => {
      console.log('Order inspection stopped:', data);
      this.emit('order_inspection_stopped', data);
    });

    // Sipariş iptal eventleri
    this.socket.on('cancel_order_confirmation_required', (data) => {
      console.log('Cancel order confirmation required:', data);
      this.emit('cancel_order_confirmation_required', data);
    });

    this.socket.on('order_cancelled_successfully', (data) => {
      console.log('Order cancelled successfully:', data);
      this.emit('order_cancelled_successfully', data);
    });

    this.socket.on('cancel_order_error', (data) => {
      console.log('Cancel order error:', data);
      this.emit('cancel_order_error', data);
    });

    // Confirm code eventleri
    this.socket.on('confirm_code_verified', (data) => {
      console.log('Confirm code verified:', data);
      this.emit('confirm_code_verified', data);
    });

    this.socket.on('confirm_code_error', (data) => {
      console.log('Confirm code error:', data);
      this.emit('confirm_code_error', data);
    });
  }

  private handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      this.emit('max_reconnect_attempts_reached', {});
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(2000 * this.reconnectAttempts, 10000); // 2s, 4s, 6s, 8s, 10s
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, maxAttempts: this.maxReconnectAttempts, delay });
    
    setTimeout(() => {
      if (!this.isConnected && this.socket) {
        this.socket.connect();
      }
    }, delay);
  }

  // Public methods for customers
  public createOrder(orderData: OrderData) {
    if (!this.isConnected || !this.socket) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('create_order', orderData);
    return true;
  }

  public getConnectionStatus() {
    return this.isConnected;
  }

  public cancelOrder(orderId: number) {
    console.log(`🔴 cancelOrder called with orderId: ${orderId}`);
    console.log(`🔗 Socket connected: ${this.isConnected}`);
    console.log(`🔌 Socket object exists: ${!!this.socket}`);
    console.log(`🆔 Socket ID: ${this.socket?.id}`);
    
    if (!this.isConnected || !this.socket) {
      console.error('❌ Socket not connected or socket object missing');
      return false;
    }

    console.log(`📤 Emitting cancel_order event with orderId: ${orderId} from socket: ${this.socket.id}`);
    this.socket.emit('cancel_order', orderId);
    console.log(`✅ cancel_order event emitted successfully from socket: ${this.socket.id}`);
    return true;
  }

  // Public methods for drivers
  public updateLocation(location: LocationUpdate) {
    if (!this.isConnected || !this.socket) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('location_update', location);
    return true;
  }

  public updateAvailability(isAvailable: boolean) {
    if (!this.isConnected || !this.socket) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('availability_update', isAvailable);
    return true;
  }

  // Driver offline event - sürücü çevrimdışı olduğunda socket disconnect yapar
  public goOffline() {
    if (!this.isConnected || !this.socket) {
      console.log('Socket already disconnected');
      return true;
    }

    console.log('Driver going offline, disconnecting socket...');
    // Önce server'a offline olduğunu bildir
    this.socket.emit('driver_going_offline');
    
    // Sonra socket bağlantısını kapat
    this.disconnect();
    return true;
  }

  // Public method for customers
  public updateCustomerLocation(location: LocationUpdate) {
    if (!this.isConnected || !this.socket) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('customer_location_update', location);
    return true;
  }

  public acceptOrder(orderId: number) {
    if (!this.isConnected || !this.socket) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('accept_order', orderId);
    return true;
  }

  public updateOrderStatus(orderId: number, status: string) {
    if (!this.isConnected || !this.socket) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('update_order_status', { orderId, status });
    return true;
  }

  public rejectOrder(orderId: number) {
    if (!this.isConnected || !this.socket) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('customer_reject_order', { orderId });
    return true;
  }

  public confirmOrder(orderId: number) {
    if (!this.isConnected || !this.socket) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('customer_confirm_order', { orderId });
    return true;
  }

  public verifyConfirmCode(orderId: number, confirmCode: string) {
    if (!this.isConnected || !this.socket) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('verify_confirm_code', { orderId, confirmCode });
    return true;
  }

  public cancelOrderWithCode(orderId: number, confirmCode: string) {
    if (!this.isConnected || !this.socket) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('cancel_order_with_code', { orderId, confirmCode });
    return true;
  }

  public verifyCancelCode(orderId: number, confirmCode: string) {
    if (!this.isConnected || !this.socket) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('verify_cancel_code', { orderId, confirmCode });
    return true;
  }

  public inspectOrder(orderId: number) {
    if (!this.isConnected || !this.socket) {
      console.error('Socket not connected');
      return false;
    }
    this.socket.emit('inspect_order', { orderId });
    return true;
  }

  public stopInspectingOrder(orderId: number) {
    if (!this.isConnected || !this.socket) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('stop_inspecting_order', { orderId });
    return true;
  }

  public acceptOrderWithLabor(orderId: number, laborCount: number) {
    if (!this.isConnected || !this.socket) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('accept_order_with_labor', { orderId, laborCount });
    return true;
  }

  // Event listener management
  public on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)?.push(callback);
  }

  public off(event: string, callback?: Function) {
    if (!this.eventListeners.has(event)) return;

    if (callback) {
      const listeners = this.eventListeners.get(event) || [];
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    } else {
      this.eventListeners.set(event, []);
    }
  }

  private emit(event: string, data: any) {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  // Connection management
  public async connect(token?: string) {
    if (this.isConnected) {
      console.log('Socket already connected');
      return;
    }

    if (!this.socket || token) {
      // If token is provided or socket doesn't exist, reinitialize
      if (this.socket) {
        this.cleanup();
      }
      await this.initializeSocket(token);
    } else {
      this.socket.connect();
    }
  }

  // Connect with specific token
  public async connectWithToken(token: string) {
    console.log('Connecting socket with provided token');
    await this.connect(token);
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
    }
  }

  public isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  public getSocketId(): string | undefined {
    return this.socket?.id;
  }

  // Cleanup
  public cleanup() {
    this.eventListeners.clear();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
  }

  // Reconnect manually
  public async reconnect() {
    this.disconnect();
    this.reconnectAttempts = 0;
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    await this.connect();
  }
}

// Singleton instance
const socketService = new SocketService();
export default socketService;

// Export types for use in components
export type { OrderData, LocationUpdate, DriverInfo };