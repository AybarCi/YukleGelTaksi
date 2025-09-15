import { useEffect, useRef, useState } from 'react';
import socketService from '../services/socketService';
import { OrderData } from '../types/dashboard';

interface UseSocketReturn {
  isConnected: boolean;
  connectionError: string | null;
  connect: (driverId: number) => void;
  disconnect: () => void;
  updateLocation: (location: { latitude: number; longitude: number }) => void;
  updateOrderStatus: (orderId: number, status: string) => void;
}

export const useSocket = (
  onNewOrder?: (order: OrderData) => void,
  onOrderUpdate?: (order: OrderData) => void,
  onOrderCancelled?: (orderId: number) => void
): UseSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const driverIdRef = useRef<number | null>(null);

  const connect = async (driverId: number) => {
    try {
      driverIdRef.current = driverId;
      await socketService.connect();
      
      // Bağlantı durumu kontrol et
      setIsConnected(socketService.isSocketConnected());
      setConnectionError(null);

      // Event dinleyicileri ekle
      if (onNewOrder) {
        socketService.on('new-order', onNewOrder);
      }

      if (onOrderUpdate) {
        socketService.on('order-updated', onOrderUpdate);
      }

      if (onOrderCancelled) {
        socketService.on('order-cancelled', onOrderCancelled);
      }

      // Bağlantı durumu dinleyicileri
      socketService.on('connect', () => {
        console.log('Socket bağlandı');
        setIsConnected(true);
        setConnectionError(null);
      });

      socketService.on('disconnect', () => {
        console.log('Socket bağlantısı kesildi');
        setIsConnected(false);
      });

      socketService.on('connect_error', (error: any) => {
        console.error('Socket bağlantı hatası:', error);
        setConnectionError('Bağlantı hatası');
        setIsConnected(false);
      });

    } catch (error) {
      console.error('Socket bağlantı hatası:', error);
      setConnectionError('Bağlantı kurulamadı');
    }
  };

  const disconnect = () => {
    socketService.goOffline();
    socketService.disconnect();
    setIsConnected(false);
    setConnectionError(null);
    driverIdRef.current = null;
  };

  const updateLocation = (location: { latitude: number; longitude: number }) => {
    if (isConnected) {
      socketService.updateLocation(location);
    }
  };

  const updateOrderStatus = (orderId: number, status: string) => {
    if (isConnected) {
      socketService.updateOrderStatus(orderId, status);
    }
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    connectionError,
    connect,
    disconnect,
    updateLocation,
    updateOrderStatus,
  };
};