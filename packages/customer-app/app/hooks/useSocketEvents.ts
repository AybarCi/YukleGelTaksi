import React, { useEffect } from 'react';
import { Alert } from 'react-native';

const showModal = (title: string, message: string, type: string) => {
  Alert.alert(title, message);
};

// Mock socketService for now
const socketService = {
  connect: (token: string) => {},
  on: (event: string, callback: Function) => {},
  off: (event: string) => {},
};

export const useSocketEvents = (
  token: string | null,
  setDrivers: React.Dispatch<React.SetStateAction<any[]>>,
  setCurrentOrder: (order: any) => void,
  currentOrderRef: any,
  setAssignedDriver: (driver: any) => void,
  setIsTrackingDriver: (tracking: boolean) => void,
  setEstimatedArrival: (arrival: string | null) => void,
  isTrackingDriver: boolean,
  assignedDriver: any,
  mapRef: any,
  userInteractedWithMap: boolean,
  currentOrder: any,
  setCargoImages: (images: string[]) => void,
  pickupLocationRef: any,
  destinationLocationRef: any,
  setPickupLocation: (location: string) => void,
  setDestinationLocation: (location: string) => void,
  setPickupCoords: (coords: any) => void,
  setDestinationCoords: (coords: any) => void,
  setSelectedVehicleType: (type: any) => void,
  setNotes: (notes: string) => void,
  setDistance: (distance: number | null) => void,
  setRouteDuration: (duration: string | null) => void,
  setRouteCoordinates: (coords: any[]) => void
) => {
  useEffect(() => {
    if (token) {
      socketService.connect(token);
    }
  }, [token]);

  useEffect(() => {
    // Socket event listeners
    socketService.on('connect', () => {
      console.log('✅ Socket bağlantısı kuruldu');
    });

    socketService.on('disconnect', () => {
      console.log('❌ Socket bağlantısı kesildi');
    });

    socketService.on('reconnect', (attemptNumber: number) => {
      console.log(`🔄 Socket yeniden bağlandı (deneme ${attemptNumber})`);
    });

    socketService.on('reconnect_attempt', (attemptNumber: number) => {
      console.log(`🔄 Socket yeniden bağlanmaya çalışıyor (deneme ${attemptNumber})`);
    });

    socketService.on('reconnect_error', (error: any) => {
      console.log('❌ Socket yeniden bağlanma hatası:', error);
    });

    socketService.on('reconnect_failed', () => {
      console.log('❌ Socket yeniden bağlanma başarısız');
    });

    socketService.on('max_reconnect_attempts_reached', () => {
      console.log('❌ Maksimum yeniden bağlanma denemesi aşıldı');
      showModal('Bağlantı Hatası', 'Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.', 'error');
    });

    // Driver location updates
    socketService.on('driver_location_update', (data: any) => {
      if (!data || !data.driverId || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
        return;
      }

      setDrivers((prevDrivers: any[]) => {
        if (!Array.isArray(prevDrivers)) {
          return [{
            id: data.driverId,
            latitude: data.latitude,
            longitude: data.longitude,
            heading: data.heading || 0
          }];
        }

        const existingDriverIndex = prevDrivers.findIndex(d => d && d.id === data.driverId);
        if (existingDriverIndex >= 0) {
          const updatedDrivers = [...prevDrivers];
          updatedDrivers[existingDriverIndex] = {
            ...updatedDrivers[existingDriverIndex],
            latitude: data.latitude,
            longitude: data.longitude,
            heading: data.heading || updatedDrivers[existingDriverIndex].heading || 0
          };
          return updatedDrivers;
        } else {
          return [...prevDrivers, {
            id: data.driverId,
            latitude: data.latitude,
            longitude: data.longitude,
            heading: data.heading || 0
          }];
        }
      });

      // Driver tracking logic
      if (isTrackingDriver && assignedDriver && assignedDriver.id === data.driverId) {
        setAssignedDriver((prev: any) => prev ? {
          ...prev,
          latitude: data.latitude,
          longitude: data.longitude,
          heading: data.heading || prev.heading || 0
        } : null);

        if (data.estimatedArrival) {
          setEstimatedArrival(data.estimatedArrival);
        }

        if (!userInteractedWithMap && mapRef.current && currentOrder) {
          if (currentOrder.status === 'confirmed' || currentOrder.status === 'in_progress') {
            mapRef.current.animateToRegion({
              latitude: data.latitude,
              longitude: data.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }, 1000);
          } else if (currentOrder.status === 'started') {
            mapRef.current.animateToRegion({
              latitude: data.latitude,
              longitude: data.longitude,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }, 1000);
          }
        }
      }
    });

    // Other socket events
    socketService.on('nearbyDriversUpdate', (data: any) => {
      if (data && Array.isArray(data.drivers)) {
        setDrivers(data.drivers.filter((driver: any) => 
          driver && 
          typeof driver === 'object' && 
          driver.id && 
          typeof driver.latitude === 'number' && 
          typeof driver.longitude === 'number'
        ));
      }
    });

    socketService.on('driver_disconnected', (data: any) => {
      if (data && data.driverId) {
        setDrivers((prevDrivers: any[]) => 
          Array.isArray(prevDrivers) 
            ? prevDrivers.filter(driver => driver && driver.id !== data.driverId)
            : []
        );
      }
    });

    // Order events
    socketService.on('order_accepted', (data: any) => {
      console.log('✅ Sipariş kabul edildi:', data);
      if (data.order) {
        setCurrentOrder(data.order);
        currentOrderRef.current = data.order;
        
        if (data.driver) {
          setAssignedDriver(data.driver);
          setIsTrackingDriver(true);
        }
        
        showModal('Sipariş Kabul Edildi', 'Siparişiniz bir sürücü tarafından kabul edildi!', 'success');
      }
    });

    socketService.on('order_status_update', (data: any) => {
      console.log('📦 Sipariş durumu güncellendi:', data);
      if (data.order) {
        setCurrentOrder(data.order);
        currentOrderRef.current = data.order;
        
        const statusMessages: { [key: string]: string } = {
          'confirmed': 'Sipariş onaylandı, sürücü yola çıkıyor',
          'in_progress': 'Sürücü yük alma noktasına gidiyor',
          'started': 'Yük alındı, varış noktasına gidiliyor',
          'completed': 'Sipariş tamamlandı'
        };
        
        const message = statusMessages[data.order.status] || `Sipariş durumu: ${data.order.status}`;
        showModal('Sipariş Güncellendi', message, 'info');
      }
    });

    // Cleanup
    return () => {
      socketService.off('connect');
      socketService.off('disconnect');
      socketService.off('reconnect');
      socketService.off('reconnect_attempt');
      socketService.off('reconnect_error');
      socketService.off('reconnect_failed');
      socketService.off('max_reconnect_attempts_reached');
      socketService.off('driver_location_update');
      socketService.off('nearbyDriversUpdate');
      socketService.off('driver_disconnected');
      socketService.off('order_accepted');
      socketService.off('order_status_update');
    };
  }, []);
};