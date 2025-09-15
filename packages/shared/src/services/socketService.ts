import { io, Socket } from 'socket.io-client';
import { SocketEvents, Location, UserType } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private serverUrl: string;
  private userType: UserType;
  private userId: string | null = null;

  constructor(serverUrl: string = 'http://192.168.1.134:3001', userType: UserType) {
    this.serverUrl = serverUrl;
    this.userType = userType;
  }

  connect(userId: string, location?: Location): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.userId = userId;
        this.socket = io(this.serverUrl, {
          transports: ['websocket'],
          autoConnect: true,
        });

        this.socket.on('connect', () => {
          console.log('Socket connected:', this.socket?.id);
          
          // Send initial connection event based on user type
          if (this.userType === 'driver' && location) {
            this.emit('driver_connect', { driverId: userId, location });
          } else if (this.userType === 'customer') {
            this.emit('customer_connect', { customerId: userId });
          }
          
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          reject(error);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      // Send disconnect event based on user type
      if (this.userType === 'driver' && this.userId) {
        this.emit('driver_disconnect', { driverId: this.userId });
      } else if (this.userType === 'customer' && this.userId) {
        this.emit('customer_disconnect', { customerId: this.userId });
      }
      
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit<K extends keyof SocketEvents>(event: K, data: SocketEvents[K]): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected. Cannot emit event:', event);
    }
  }

  on<K extends keyof SocketEvents>(event: K, callback: (data: SocketEvents[K]) => void): void {
    if (this.socket) {
      this.socket.on(event as string, callback);
    }
  }

  off<K extends keyof SocketEvents>(event: K, callback?: (data: SocketEvents[K]) => void): void {
    if (this.socket) {
      this.socket.off(event as string, callback);
    }
  }

  // Driver specific methods
  updateLocation(location: Location): void {
    if (this.userType === 'driver' && this.userId) {
      this.emit('location_update', { driverId: this.userId, location });
    }
  }

  updateAvailability(isAvailable: boolean): void {
    if (this.userType === 'driver' && this.userId) {
      this.emit('availability_update', { driverId: this.userId, isAvailable });
    }
  }

  acceptRide(rideId: string): void {
    if (this.userType === 'driver' && this.userId) {
      this.emit('ride_accept', { rideId, driverId: this.userId });
    }
  }

  // Customer specific methods
  updateCustomerLocation(location: Location): void {
    if (this.userType === 'customer' && this.userId) {
      this.emit('customer_location_update', { customerId: this.userId, location });
    }
  }

  requestRide(pickupLocation: Location, dropoffLocation: Location): void {
    if (this.userType === 'customer' && this.userId) {
      this.emit('ride_request', { 
        customerId: this.userId, 
        pickupLocation, 
        dropoffLocation 
      });
    }
  }

  cancelRide(rideId: string): void {
    if (this.userType === 'customer' && this.userId) {
      this.emit('ride_cancel', { rideId, customerId: this.userId });
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

export default SocketService;