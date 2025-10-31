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
        // No token found, cannot connect to socket
        return;
      }

      // Cleanup existing socket if any
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
      }

      // API config'den base URL'i al ve socket için düzenle
      const serverUrl = API_CONFIG.SOCKET_URL;
      
      this.socket = io(serverUrl, {
        auth: {
          token: authToken,
          refreshToken: refreshToken
        },
        transports: ['websocket', 'polling'], // websocket öncelikli
        timeout: 20000, // 20 saniye timeout
        forceNew: false,
        reconnection: true, // Otomatik yeniden bağlanmayı aç
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        autoConnect: true, // Otomatik bağlanmayı aç
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
      this.reconnectAttempts = 0;
      this.hasShownConnectionError = false;
      this.emit('connected', { socketId: this.socket?.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔴 Socket disconnected:', reason);
      this.isConnected = false;
      this.emit('disconnected', { reason });
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
      console.error('🔴 Socket connection error:', error);
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

    // New order for drivers - doğrudan backend'ten gelen event'i expose et
    this.socket.on('new_order_available', (data) => {
      console.log('🔔 NEW ORDER AVAILABLE EVENT ALINDI:', data);
      // Doğrudan new_order_available event'ini emit et, gereksiz re-naming yok
      this.emit('new_order_available', data);
    });

    // Driver offline event
    this.socket.on('driver_offline', (data) => {
      // Driver went offline
      this.emit('driver_offline', data);
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

    this.socket.on('order_cancelled_by_customer', (data) => {
      // Order cancelled by customer
      this.emit('order_cancelled_by_customer', data);
    });

    this.socket.on('order_removed_from_list', (data) => {
      // Order removed from driver's list (customer rejected price)
      this.emit('order_removed_from_list', data);
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
  }

  private handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // Max reconnection attempts reached
      this.emit('max_reconnect_attempts_reached', {});
      return;
    }

    // Sadece connection error durumunda manuel yeniden bağlanma
    if (!this.isConnected && this.socket) {
      const delay = Math.min(3000 * this.reconnectAttempts, 15000);
      // Connection error - attempting reconnection with delay
      
      setTimeout(() => {
        if (!this.isConnected && this.socket) {
          this.socket.connect();
        }
      }, delay);
    }
  }

  public getConnectionStatus() {
    return this.isConnected;
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

  public driverStartedNavigation(orderId: number) {
    if (!this.isConnected || !this.socket) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('driver_started_navigation', { orderId });
    return true;
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