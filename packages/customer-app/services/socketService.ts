import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';

interface OrderData {
  orderId?: number; // API'den dönen sipariş ID'si
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  weight: number;
  laborCount: number;
  estimatedPrice: number;
  vehicle_type_id?: number; // Araç tipi ID'si
  cargo_type_id?: number; // Kargo tipi ID'si
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
        // No token found, cannot connect to socket
        return;
      }

      // Cleanup existing socket if any
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
      }

      // Socket için doğru URL'i kullan
      const serverUrl = API_CONFIG.SOCKET_URL;
      
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
      // Socket connected
      this.isConnected = true;
      this.reconnectAttempts = 0; // Başarılı bağlantı sonrası sayacı sıfırla
      this.hasShownConnectionError = false;
      this.emit('connected', { socketId: this.socket?.id });
    });

    this.socket.on('disconnect', (reason) => {
      // Socket disconnected
      this.isConnected = false;
      this.emit('disconnected', { reason });
      
      // Sadece client tarafından disconnect edilmemişse ve server disconnect değilse yeniden bağlan
      if (reason !== 'io client disconnect' && 
          reason !== 'io server disconnect' && 
          this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(2000 * this.reconnectAttempts, 10000); // 2s, 4s, 6s, 8s, 10s
        
        // Attempting reconnection with delay
        
        setTimeout(() => {
          if (!this.isConnected && this.socket) {
            this.socket.connect();
          }
        }, delay);
      } else if (reason === 'io server disconnect') {
        // Server disconnected client, not attempting reconnection
      }
    });

    // Token yenileme olayını dinle
    this.socket.on('token_refreshed', async (data) => {
      // Token refreshed by server
      if (data.token) {
        // Yeni token'ı kaydet
        await AsyncStorage.setItem('auth_token', data.token);
        this.emit('token_refreshed', data);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.isConnected = false;
      this.emit('connection_error', { error: error.message });
    });

    // Order related events
    this.socket.on('order_created', (data) => {
      // Order created
      this.emit('order_created', data);
    });

    this.socket.on('order_accepted', (data) => {
      // Order accepted
      this.emit('order_accepted', data);
    });

    this.socket.on('order_status_update', (data) => {
      // Order status update
      this.emit('order_status_update', data);
    });

    this.socket.on('order_cancelled', (data) => {
      // Order cancelled
      this.emit('order_cancelled', data);
    });

    this.socket.on('order_taken', (data) => {
      // Order taken by another driver
      this.emit('order_taken', data);
    });

    // Driver location events
    this.socket.on('driver_location_update', (data) => {
      // Driver location update
      this.emit('driver_location_update', data);
    });

    // Nearby drivers update event
    this.socket.on('nearbyDriversUpdate', (data) => {
      // Nearby drivers update
      this.emit('nearbyDriversUpdate', data);
    });

    // New order for drivers
    this.socket.on('new_order_available', (data) => {
      // New order available
      this.emit('new_order', data);
    });

    // Driver offline event
    this.socket.on('driver_offline', (data) => {
      // Driver went offline
      this.emit('driver_offline', data);
    });

    // Driver went offline event (when driver voluntarily goes offline)
    this.socket.on('driver_went_offline', (data) => {
      // Driver went offline voluntarily
      this.emit('driver_went_offline', data);
    });

    // Server konum güncellemesi istediğinde
    this.socket.on('request_location_update', async () => {
      // Server requesting location update
      this.emit('request_location_update', {});
    });

    // Sürücü disconnect olduğunda
    this.socket.on('driver_disconnected', (data) => {
      // Driver disconnected
      this.emit('driver_disconnected', data);
    });

    // Backend'den gelen eksik eventleri ekle
    this.socket.on('order_locked_for_inspection', (data) => {
      // Order locked for inspection
      this.emit('order_locked_for_inspection', data);
    });

    this.socket.on('order_already_taken', (data) => {
      // Order already taken
      this.emit('order_already_taken', data);
    });

    this.socket.on('order_acceptance_confirmed', (data) => {
      // Order acceptance confirmed
      this.emit('order_acceptance_confirmed', data);
    });

    this.socket.on('order_phase_update', (data) => {
      // Order phase update
      this.emit('order_phase_update', data);
    });

    this.socket.on('order_inspection_started', (data) => {
      // Order inspection started
      this.emit('order_inspection_started', data);
    });

    this.socket.on('order_inspection_stopped', (data) => {
      // Order inspection stopped
      this.emit('order_inspection_stopped', data);
    });

    // Sipariş iptal eventleri
    this.socket.on('cancel_order_confirmation_required', (data) => {
      // Cancel order confirmation required
      this.emit('cancel_order_confirmation_required', data);
    });

    this.socket.on('order_cancelled_successfully', (data) => {
      // Order cancelled successfully
    this.emit('order_cancelled_successfully', data);
    });

    this.socket.on('cancel_order_error', (data) => {
      // Cancel order error
      this.emit('cancel_order_error', data);
    });

    // Confirm code eventleri
    this.socket.on('confirm_code_verified', (data) => {
      // Confirm code verified
      this.emit('confirm_code_verified', data);
    });

    this.socket.on('confirm_code_error', (data) => {
      // Confirm code error
      this.emit('confirm_code_error', data);
    });

    // Price confirmation events
    this.socket.on('price_confirmation_requested', (data) => {
      // Price confirmation requested
      this.emit('price_confirmation_requested', data);
    });

    this.socket.on('price_confirmation_response', (data) => {
      // Price confirmation response
      this.emit('price_confirmation_response', data);
    });

    // Navigation events for customer after acceptance
    this.socket.on('driver_started_navigation', (data) => {
      // Driver started navigation
      this.emit('driver_started_navigation', data);
    });

    this.socket.on('driver_location_update_for_customer', (data) => {
      // Driver location updates for customer
      this.emit('driver_location_update_for_customer', data);
    });
  }

  private handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // Max reconnection attempts reached
      this.emit('max_reconnect_attempts_reached', {});
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(2000 * this.reconnectAttempts, 10000); // 2s, 4s, 6s, 8s, 10s
    
    // Attempting to reconnect with delay
    this.emit('reconnecting', { attempt: this.reconnectAttempts, maxAttempts: this.maxReconnectAttempts, delay });
    
    setTimeout(() => {
      if (!this.isConnected && this.socket) {
        this.socket.connect();
      }
    }, delay);
  }

  // Public methods for customers
  public createOrder(orderData: OrderData) {
    try {
      if (!this.isSocketConnected()) {
        console.error('Socket not connected for create_order');
        return false;
      }

      if (!orderData || typeof orderData !== 'object') {
        console.error('Invalid order data provided');
        return false;
      }

      this.socket!.emit('create_order', orderData);
      // create_order event emitted successfully
      return true;
    } catch (error) {
      console.error('Error in createOrder:', error);
      return false;
    }
  }

  public getConnectionStatusSimple(): boolean {
    return this.isConnected;
  }

  public cancelOrder(orderId: number) {
    try {
      // cancelOrder called
      
      if (!this.isSocketConnected()) {
        console.error('❌ Socket not connected for cancel_order');
        return false;
      }

      if (!orderId || typeof orderId !== 'number' || orderId <= 0) {
        console.error('❌ Invalid orderId provided:', orderId);
        return false;
      }

      const status = this.getConnectionStatus();
      // Connection status check
      
      // Emitting cancel_order event
      this.socket!.emit('cancel_order', orderId);
      // cancel_order event emitted successfully
      return true;
    } catch (error) {
      console.error('❌ Error in cancelOrder:', error);
      return false;
    }
  }

  // Public methods for drivers
  public updateLocation(location: LocationUpdate) {
    try {
      if (!this.isSocketConnected()) {
        console.error('Socket not connected for location_update');
        return false;
      }

      if (!location || typeof location !== 'object' || 
          typeof location.latitude !== 'number' || 
          typeof location.longitude !== 'number') {
        console.error('Invalid location data provided:', location);
        return false;
      }

      this.socket!.emit('location_update', location);
      return true;
    } catch (error) {
      console.error('Error in updateLocation:', error);
      return false;
    }
  }

  public updateAvailability(isAvailable: boolean) {
    try {
      if (!this.isSocketConnected()) {
        console.error('Socket not connected for availability_update');
        return false;
      }

      if (typeof isAvailable !== 'boolean') {
        console.error('Invalid availability value provided:', isAvailable);
        return false;
      }

      this.socket!.emit('availability_update', isAvailable);
      return true;
    } catch (error) {
      console.error('Error in updateAvailability:', error);
      return false;
    }
  }

  // Driver offline event - sürücü çevrimdışı olduğunda socket disconnect yapar
  public goOffline() {
    if (!this.isConnected || !this.socket) {
      // Socket already disconnected
      return true;
    }

    // Driver going offline, disconnecting socket
    // Önce server'a offline olduğunu bildir
    this.socket.emit('driver_going_offline');
    
    // Sonra socket bağlantısını kapat
    this.disconnect();
    return true;
  }

  // Public method for customers
  public updateCustomerLocation(location: LocationUpdate, customerId?: number) {
    try {
      if (!this.isSocketConnected()) {
        console.error('Socket not connected for customer_location_update');
        return false;
      }

      if (!location || typeof location !== 'object' || 
          typeof location.latitude !== 'number' || 
          typeof location.longitude !== 'number') {
        console.error('Invalid location data provided:', location);
        return false;
      }

      if (customerId !== undefined && (typeof customerId !== 'number' || customerId <= 0)) {
        console.error('Invalid customerId provided:', customerId);
        return false;
      }

      const locationData = customerId ? { ...location, customerId } : location;
      this.socket!.emit('customer_location_update', locationData);
      return true;
    } catch (error) {
      console.error('Error in updateCustomerLocation:', error);
      return false;
    }
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



  public acceptOrderWithLabor(orderId: number, laborCount: number) {
    if (!this.isConnected || !this.socket) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('accept_order_with_labor', { orderId, laborCount });
    return true;
  }

  public priceConfirmationResponse(orderId: number, isAccepted: boolean) {
    if (!this.isConnected || !this.socket) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('price_confirmation_response', { orderId, isAccepted });
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
      // Socket already connected
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
    // Connecting socket with provided token
    await this.connect(token);
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
    }
  }

  public isSocketConnected(): boolean {
    try {
      return (
        this.isConnected && 
        this.socket !== null && 
        this.socket !== undefined && 
        this.socket.connected === true &&
        this.socket.id !== undefined
      );
    } catch (error) {
      console.error('Error checking socket connection:', error);
      return false;
    }
  }

  public getConnectionStatus(): {
    isConnected: boolean;
    socketExists: boolean;
    socketConnected: boolean;
    socketId?: string;
    reconnectAttempts: number;
  } {
    try {
      return {
        isConnected: this.isConnected,
        socketExists: this.socket !== null && this.socket !== undefined,
        socketConnected: this.socket?.connected === true,
        socketId: this.socket?.id,
        reconnectAttempts: this.reconnectAttempts
      };
    } catch (error) {
      console.error('Error getting connection status:', error);
      return {
        isConnected: false,
        socketExists: false,
        socketConnected: false,
        reconnectAttempts: this.reconnectAttempts
      };
    }
  }

  public getSocketId(): string | undefined {
    try {
      return this.socket?.id;
    } catch (error) {
      console.error('Error getting socket ID:', error);
      return undefined;
    }
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