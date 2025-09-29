import React, { useEffect } from 'react';
import socketService from '../../services/socketService';

// showModal fonksiyonu kaldırıldı - projede alert kullanılmıyor

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
    if (!token) {
      console.log('❌ Token yok, socket event listener kurulmuyor');
      return;
    }

    console.log('🔌 Socket event listener kuruluyor...');

    // Socket'i token ile bağla
    socketService.connectWithToken(token);

    // Socket bağlantı event'leri
    socketService.on('connect', () => {
      console.log('✅ Socket sunucuya bağlandı');
    });

    socketService.on('disconnect', (reason: string) => {
      console.log('❌ Socket bağlantısı kesildi:', reason);
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

    socketService.on('max_reconnect_attempts_reached', () => {
      console.log('❌ Maksimum yeniden bağlanma denemesi aşıldı');
    });

    // Authentication event'leri
    socketService.on('authenticated', (data: any) => {
      console.log('✅ Socket kimlik doğrulaması başarılı:', data);
    });

    socketService.on('authentication_error', (error: any) => {
      console.error('❌ Socket kimlik doğrulama hatası:', error);
    });

    // Driver location update
    socketService.on('driver_location_update', (data: any) => {
      if (data && data.driverId && data.latitude && data.longitude) {
        setDrivers(prevDrivers => {
          const currentDrivers = Array.isArray(prevDrivers) ? prevDrivers : [];
          const existingDriverIndex = currentDrivers.findIndex(driver => driver && driver.id === data.driverId);
          
          if (existingDriverIndex !== -1) {
            const updatedDrivers = [...currentDrivers];
            updatedDrivers[existingDriverIndex] = {
              ...updatedDrivers[existingDriverIndex],
              latitude: data.latitude,
              longitude: data.longitude,
              heading: data.heading || 0
            };
            return updatedDrivers;
          } else {
            return [...currentDrivers, {
              id: data.driverId,
              latitude: data.latitude,
              longitude: data.longitude,
              heading: data.heading || 0,
              name: data.name || 'Sürücü'
            }];
          }
        });
      }
    });

    // Driver availability update
    socketService.on('driver_availability_update', (data: any) => {
      if (data && data.driverId) {
        if (data.isAvailable) {
          // Sürücü müsait oldu
          setDrivers(prevDrivers => {
            const currentDrivers = Array.isArray(prevDrivers) ? prevDrivers : [];
            const existingDriver = currentDrivers.find(driver => driver && driver.id === data.driverId);
            
            if (!existingDriver && data.latitude && data.longitude) {
              return [...currentDrivers, {
                id: data.driverId,
                latitude: data.latitude,
                longitude: data.longitude,
                heading: data.heading || 0,
                name: data.name || 'Sürücü'
              }];
            }
            return currentDrivers;
          });
        } else {
          // Sürücü müsait değil
          setDrivers(prevDrivers => {
            const currentDrivers = Array.isArray(prevDrivers) ? prevDrivers : [];
            return currentDrivers.filter(driver => driver && driver.id !== data.driverId);
          });
        }
      }
    });

    // Order accepted event
    socketService.on('order_accepted', (data: any) => {
      console.log('✅ Sipariş kabul edildi:', data);
      
      try {
        if (data && data.order) {
          // Order bilgilerini güvenli şekilde güncelle
          if (typeof setCurrentOrder === 'function') {
            setCurrentOrder(data.order);
          }
          
          if (currentOrderRef && currentOrderRef.current !== undefined) {
            currentOrderRef.current = data.order;
          }
          
          // Assigned driver bilgilerini güncelle
          if (data.order.driver && typeof setAssignedDriver === 'function') {
            setAssignedDriver(data.order.driver);
          }
          
          // Tracking'i başlat
          if (data.order.driver) {
            if (typeof setIsTrackingDriver === 'function') {
              setIsTrackingDriver(true);
            }
          }
          
          console.log('✅ Sipariş kabul edildi - bildirim gösterilmedi (alert yasak)');
        } else {
          console.error('❌ order_accepted: order bilgisi eksik');
        }
      } catch (error) {
        console.error('❌ order_accepted event hatası:', error);
      }
    });

    socketService.on('order_status_update', (data: any) => {
      console.log('📦 Sipariş durumu güncellendi:', data);
      
      try {
        // Güvenlik kontrolleri
        if (!data) {
          console.error('❌ order_status_update: data boş');
          return;
        }
        
        // Yeni format: data.status ve data.orderId
        if (data.status && data.orderId) {
          // Mevcut siparişi güncelle
          if (currentOrderRef && currentOrderRef.current && currentOrderRef.current.id === data.orderId) {
            const updatedOrder = { ...currentOrderRef.current, status: data.status };
            
            if (typeof setCurrentOrder === 'function') {
              setCurrentOrder(updatedOrder);
            }
            
            currentOrderRef.current = updatedOrder;
          }
          
          // Status mesajları
          const statusMessages: { [key: string]: string } = {
            'confirmed': 'Sipariş onaylandı, sürücü yola çıkıyor',
            'in_progress': 'Sürücü yük alma noktasına gidiyor',
            'started': 'Yük alındı, varış noktasına gidiliyor',
            'completed': 'Sipariş tamamlandı',
            'inspecting': 'Siparişiniz inceleniyor'
          };
          
          const status = data.status || 'unknown';
          const message = data.message || statusMessages[status] || `Sipariş durumu: ${status}`;
          
          console.log(`📦 Sipariş durumu güncellendi: ${message} - bildirim gösterilmedi (alert yasak)`);
        } else if (data.order && data.order.status) {
          // Eski format desteği
          if (typeof setCurrentOrder === 'function') {
            setCurrentOrder(data.order);
          }
          
          if (currentOrderRef && currentOrderRef.current !== undefined) {
            currentOrderRef.current = data.order;
          }
          
          const statusMessages: { [key: string]: string } = {
            'confirmed': 'Sipariş onaylandı, sürücü yola çıkıyor',
            'in_progress': 'Sürücü yük alma noktasına gidiyor',
            'started': 'Yük alındı, varış noktasına gidiliyor',
            'completed': 'Sipariş tamamlandı',
            'inspecting': 'Siparişiniz inceleniyor'
          };
          
          const status = data.order.status || 'unknown';
          const message = statusMessages[status] || `Sipariş durumu: ${status}`;
          
          console.log(`📦 Sipariş durumu güncellendi: ${message} - bildirim gösterilmedi (alert yasak)`);
        } else {
          console.error('❌ order_status_update: order veya status bilgisi eksik', data);
        }
      } catch (error) {
        console.error('❌ order_status_update event hatası:', error);
      }
    });

    // Order inspection stopped event - sürücü incelemeyi bitirdiğinde
    socketService.on('order_inspection_stopped', (data: any) => {
      console.log('🔍 Sürücü incelemeyi bitirdi:', data);
      
      try {
        // Güvenlik kontrolleri
        if (!data) {
          console.error('❌ order_inspection_stopped: data boş');
          return;
        }
        
        // Yeni format: data.orderId ve data.status
        if (data.orderId) {
          // Mevcut siparişi güncelle
          if (currentOrderRef && currentOrderRef.current && currentOrderRef.current.id === data.orderId) {
            const updatedOrder = { ...currentOrderRef.current, status: 'in_progress' };
            
            if (typeof setCurrentOrder === 'function') {
              setCurrentOrder(updatedOrder);
            }
            
            currentOrderRef.current = updatedOrder;
          }
          
          const message = data.message || 'Sürücü yük incelemesini tamamladı. Sipariş durumu güncellendi.';
          console.log(`🔍 İnceleme tamamlandı: ${message} - bildirim gösterilmedi (alert yasak)`);
        } else if (data.order) {
          // Eski format desteği
          if (typeof setCurrentOrder === 'function') {
            setCurrentOrder(data.order);
          }
          
          if (currentOrderRef && currentOrderRef.current !== undefined) {
            currentOrderRef.current = data.order;
          }
          
          console.log('🔍 İnceleme tamamlandı - bildirim gösterilmedi (alert yasak)');
        } else {
          console.error('❌ order_inspection_stopped: order veya orderId bilgisi eksik', data);
        }
      } catch (error) {
        console.error('❌ order_inspection_stopped event hatası:', error);
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
      socketService.off('order_inspection_stopped');
    };
  }, []);
};