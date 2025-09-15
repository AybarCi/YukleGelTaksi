import { Middleware, AnyAction } from '@reduxjs/toolkit';
import { RootState } from '../index';
import { setNetworkStatus, showModal } from '../slices/uiSlice';
import { logout } from '../slices/authSlice';
import { API_CONFIG } from '../../config/api';
import { io, Socket } from 'socket.io-client';

interface SocketMiddlewareOptions {
  url?: string;
  autoConnect?: boolean;
}

class SocketManager {
  private socket: Socket | null = null;
  private store: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(private options: SocketMiddlewareOptions = {}) {
    this.options = {
      url: API_CONFIG.BASE_URL,
      autoConnect: true,
      ...options
    };
  }

  setStore(store: any) {
    this.store = store;
  }

  connect(token?: string) {
    if (this.socket?.connected) {
      return this.socket;
    }

    // Socket server genellikle farklı port kullanır
    const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL || 'ws://192.168.1.134:3001';
    
    this.socket = io(socketUrl, {
      auth: {
        token: token,
        userType: 'customer'
      },
      transports: ['websocket'],
      timeout: 10000,
      forceNew: true
    });

    this.setupEventListeners();
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.reconnectAttempts = 0;
  }

  emit(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  private setupEventListeners() {
    if (!this.socket || !this.store) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.store.dispatch(setNetworkStatus(true));
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.store.dispatch(setNetworkStatus(false));
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.handleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.store.dispatch(setNetworkStatus(false));
      this.handleReconnect();
    });

    // Auth events
    this.socket.on('auth_error', (data) => {
      console.error('Socket auth error:', data);
      this.store.dispatch(logout());
      this.store.dispatch(showModal({
        title: 'Oturum Hatası',
        message: 'Oturumunuz sonlandırıldı. Lütfen tekrar giriş yapın.',
        type: 'error' as const,
        buttons: [{
          text: 'Tamam',
          onPress: () => {}
        }]
      }));
    });

    // Customer specific events
    this.socket.on('nearbyDriversUpdate', (data) => {
      // Dispatch to appropriate slice
      console.log('Nearby drivers update:', data);
    });

    this.socket.on('rideUpdate', (data) => {
      console.log('Ride update:', data);
    });

    this.socket.on('driverLocationUpdate', (data) => {
      console.log('Driver location update:', data);
    });

    this.socket.on('order_status_update', (data) => {
      console.log('Order status update:', data);
    });

    this.socket.on('order_cancelled', (data) => {
      console.log('Order cancelled:', data);
      this.store.dispatch(showModal({
        title: 'Sipariş İptal Edildi',
        message: 'Siparişiniz iptal edildi.',
        type: 'warning' as const,
        buttons: [{
          text: 'Tamam',
          onPress: () => {}
        }]
      }));
    });

    this.socket.on('driver_assigned', (data) => {
      console.log('Driver assigned:', data);
      this.store.dispatch(showModal({
        title: 'Sürücü Atandı',
        message: `Sürücünüz: ${data.driverName}`,
        type: 'success' as const,
        buttons: [{
          text: 'Tamam',
          onPress: () => {}
        }]
      }));
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.socket?.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.store?.dispatch(showModal({
        title: 'Bağlantı Hatası',
        message: 'Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.',
        type: 'error' as const,
        buttons: [{
          text: 'Tamam',
          onPress: () => {}
        }]
      }));
    }
  }
}

const socketManager = new SocketManager();

export const socketMiddleware = (store: any) => {
  socketManager.setStore(store);
  
  return (next: any) => (action: unknown) => {
    const result = next(action);
    const state = store.getState();

    const actionWithType = action as AnyAction;

    // Handle auth actions
    if (actionWithType.type === 'auth/login/fulfilled' || actionWithType.type === 'auth/loadStoredAuth/fulfilled') {
      if (state.auth.token) {
        socketManager.connect(state.auth.token);
      }
    }

    if (actionWithType.type === 'auth/logout/fulfilled') {
      socketManager.disconnect();
    }

    // Handle location updates
    if (actionWithType.type === 'ui/updateLocation') {
      if (state.auth.token && actionWithType.payload) {
        socketManager.emit('customer_location_update', {
          customerId: state.auth.user?.id,
          location: actionWithType.payload
        });
      }
    }

    // Handle ride requests
    if (actionWithType.type === 'api/createRide/pending') {
      const { pickupLocation, dropoffLocation } = actionWithType.meta?.arg || {};
      if (pickupLocation && dropoffLocation) {
        socketManager.emit('ride_request', {
          customerId: state.auth.user?.id,
          pickupLocation,
          dropoffLocation
        });
      }
    }

    return result;
  };
};

export { socketManager };