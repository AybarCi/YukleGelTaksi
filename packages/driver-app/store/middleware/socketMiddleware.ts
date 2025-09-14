import { Middleware, AnyAction } from '@reduxjs/toolkit';
import { io, Socket } from 'socket.io-client';
import { RootState } from '../index';
import { showModal } from '../slices/uiSlice';

class SocketManager {
  private socket: Socket | null = null;
  private store: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  setStore(store: any) {
    this.store = store;
  }

  connect(token: string) {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(process.env.EXPO_PUBLIC_SOCKET_URL || 'ws://localhost:3001', {
      auth: {
        token,
        userType: 'driver'
      },
      transports: ['websocket'],
      timeout: 10000,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket || !this.store) return;

    this.socket.on('connect', () => {
      console.log('Driver socket connected');
      this.reconnectAttempts = 0;
      
      // Join driver room
      const state = this.store.getState();
      if (state.auth.user?.id) {
        this.socket?.emit('join_driver_room', { driverId: state.auth.user.id });
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Driver socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        this.reconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Driver socket connection error:', error);
      this.reconnect();
    });

    // Driver-specific events
    this.socket.on('new_ride_request', (data) => {
      // Store ride request data in UI state
      console.log('New ride request received:', data);
      
      this.store.dispatch(showModal({
        type: 'info',
        title: 'Yeni Yolculuk Talebi',
        message: `${data.customerName} tarafından yeni bir yolculuk talebi`
      }));
    });

    this.socket.on('ride_cancelled', (data) => {
      console.log('Ride cancelled:', data);
      
      this.store.dispatch(showModal({
        type: 'warning',
        title: 'Yolculuk İptal Edildi',
        message: 'Müşteri yolculuğu iptal etti'
      }));
    });

    this.socket.on('customer_location_update', (data) => {
      // Update customer location in relevant order
      console.log('Customer location updated:', data);
    });

    this.socket.on('ride_status_update', (data) => {
      console.log('Ride status updated:', data);
    });

    this.socket.on('driver_status_update', (data) => {
      // Handle driver status updates from admin
      console.log('Driver status updated:', data);
    });
  }

  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.socket?.connect();
    }, delay);
  }

  emit(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
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

    // Handle driver location updates
    if (actionWithType.type === 'driver/updateLocation') {
      if (state.auth.token && actionWithType.payload) {
        socketManager.emit('driver_location_update', {
          driverId: state.auth.user?.id,
          location: actionWithType.payload,
          isAvailable: state.auth.driverStatus === 'online'
        });
      }
    }

    // Handle driver status changes
    if (actionWithType.type === 'driver/setAvailability') {
      if (state.auth.token) {
        socketManager.emit('driver_status_change', {
          driverId: state.auth.user?.id,
          isAvailable: actionWithType.payload
        });
      }
    }

    // Handle ride responses
    if (actionWithType.type === 'api/acceptRide/pending') {
      const rideId = actionWithType.meta?.arg;
      if (rideId) {
        socketManager.emit('ride_accepted', {
          rideId,
          driverId: state.auth.user?.id
        });
      }
    }

    if (actionWithType.type === 'api/rejectRide/pending') {
      const rideId = actionWithType.meta?.arg;
      if (rideId) {
        socketManager.emit('ride_rejected', {
          rideId,
          driverId: state.auth.user?.id
        });
      }
    }

    // Handle ride completion
    if (actionWithType.type === 'api/completeRide/pending') {
      const rideId = actionWithType.meta?.arg;
      if (rideId) {
        socketManager.emit('ride_completed', {
          rideId,
          driverId: state.auth.user?.id
        });
      }
    }

    return result;
  };
};

export { socketManager };