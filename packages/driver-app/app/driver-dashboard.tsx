import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Modal,
  ScrollView,
  TextInput,
  Linking,
  Image,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { API_CONFIG } from '../config/api';
import socketService from '../services/socketService';
import { styles } from './driver-dashboard.styles';
import { PhotoModal } from '../components/PhotoModal';
import OrderInspectionModal from '../components/OrderInspectionModal';

import { Header } from '../components/driver-dashboard/Header';
import { MapComponent } from '../components/driver-dashboard/MapComponent';
import { ActiveOrderCard } from '../components/driver-dashboard/ActiveOrderCard';
import { default as CustomerList } from '../components/driver-dashboard/CustomerList';
import { DriverInfo as DashboardDriverInfo, OrderData as DashboardOrderData, LocationCoords, MapRegion } from '../types/dashboard';
import ToggleButton from '../components/ToggleButton';

const { width, height } = Dimensions.get('window');

interface Customer {
  id: number;
  name: string;
  phone: string;
  pickup_location: string;
  destination: string;
  distance: string;
  estimated_fare: number;
  status: 'waiting' | 'accepted' | 'confirmed' | 'in_progress' | 'completed' | 'inspecting';
  created_at: string;
}

interface DriverInfo {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  is_active: boolean;
}

interface OrderData {
  id: number;
  pickupAddress: string;
  pickup_latitude: number;
  pickup_longitude: number;
  destinationAddress: string;
  delivery_latitude: number;
  delivery_longitude: number;
  weight: number;
  laborCount: number;
  estimatedPrice: number;
  customerId: number;
  customerName?: string;
  customerPhone?: string;
  customer_first_name?: string;
  customer_last_name?: string;
  distance?: number;
  estimatedArrival?: number;
  cargo_photo_urls?: string;
}

interface RoutePhase {
  type: 'pickup' | 'delivery';
  destination: {
    latitude: number;
    longitude: number;
    address: string;
  };
  completed: boolean;
}

export default function DriverDashboardScreen() {
  const { showModal, logout, token } = useAuth();
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [currentLocation, setCurrentLocation] = useState({
    latitude: 41.0082,
    longitude: 28.9784,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Customer | null>(null);
  const [inspectingOrders, setInspectingOrders] = useState<Set<number>>(new Set());
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [laborCount, setLaborCount] = useState('1');
  const [laborPrice, setLaborPrice] = useState(800); // Default değer pricing_settings tablosundan
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Fotoğraf modal state'leri
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  
  // Fotoğraf slider fonksiyonları
  const openPhotoModal = (urls: string[], index: number = 0) => {
    setPhotoUrls(urls);
    setCurrentImageIndex(index);
    setPhotoModalVisible(true);
  };

  const closePhotoModal = () => {
    setPhotoModalVisible(false);
    setCurrentImageIndex(0);
    setPhotoUrls([]);
  };

  const handleImageIndexChange = (index: number) => {
    setCurrentImageIndex(index);
  };


  
  // Aşamalı rota sistemi için state'ler
  const [activeOrder, setActiveOrder] = useState<OrderData | null>(null);
  const [currentPhase, setCurrentPhase] = useState<'pickup' | 'delivery' | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<{latitude: number, longitude: number}[]>([]);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 41.0082,
    longitude: 28.9784,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const mapRef = useRef<MapView>(null);

  // Handle pickup complete function
  const handlePickupComplete = (orderId: number) => {
    console.log('Pickup completed for order:', orderId);
    setCurrentPhase('delivery');
    // API call to update order status
  };

  // Handle delivery complete function
  const handleDeliveryComplete = (orderId: number) => {
    console.log('Delivery completed for order:', orderId);
    setActiveOrder(null);
    setCurrentPhase(null);
    // API call to complete order
  };

  useEffect(() => {
    loadDriverInfo();
    loadCustomers();
    requestLocationPermission();
    fetchLaborPrice();
    
    // Socket bağlantısını kur - sadece sürücü çevrimiçiyse
    if (token) {
      // AsyncStorage'dan son online durumunu kontrol et
      AsyncStorage.getItem('driver_online_status').then(savedStatus => {
        const shouldBeOnline = savedStatus === 'true';
        console.log('🔌 Driver online status:', shouldBeOnline);
        setIsOnline(shouldBeOnline); // Online durumunu hemen set et
        if (shouldBeOnline) {
          console.log('🔌 Connecting socket for driver...');
          socketService.connect(token);
          
          // Bağlantı durumunu kontrol et
          setTimeout(() => {
            console.log('🔌 Socket connection status after connect:', socketService.isSocketConnected());
            console.log('🔌 Socket ID after connect:', socketService.getSocketId());
          }, 2000);
        }
      });
      
      // Socket bağlantı durumu event'lerini dinle
      socketService.on('connection_error', (data: any) => {
        console.error('Socket bağlantı hatası:', data.error);
        showModal('Bağlantı Hatası', 'Sunucuya bağlanırken bir hata oluştu. Lütfen internet bağlantınızı kontrol edin.', 'error');
      });

      socketService.on('max_reconnect_attempts_reached', () => {
        console.log('Maksimum yeniden bağlanma denemesi aşıldı');
        showModal('Bağlantı Sorunu', 'Sunucuya bağlanılamıyor. Lütfen uygulamayı yeniden başlatın.', 'warning');
      });
      
      // Socket event listener'ları
      socketService.on('new_order', (orderData: OrderData) => {
        console.log('New order received:', orderData);
        
        // OrderData'yı Customer formatına dönüştür
        const newCustomer: Customer = {
          id: orderData.id,
          name: orderData.customer_first_name && orderData.customer_last_name 
            ? `${orderData.customer_first_name} ${orderData.customer_last_name}` 
            : (orderData.customerName || 'Müşteri'),
          phone: orderData.customerPhone || 'Bilinmiyor',
          pickup_location: orderData.pickupAddress,
          destination: orderData.destinationAddress,
          distance: orderData.distance ? `${orderData.distance.toFixed(1)} km` : 'Hesaplanıyor...',
          estimated_fare: orderData.estimatedPrice,
          status: 'waiting',
          created_at: new Date().toISOString(),
        };
        
        // Yeni siparişi customers listesine ekle
        setCustomers(prev => {
          const currentCustomers = Array.isArray(prev) ? prev : [];
          // Aynı ID'li sipariş varsa güncelle, yoksa ekle
          const existingIndex = currentCustomers.findIndex(c => c.id === newCustomer.id);
          if (existingIndex >= 0) {
            const updated = [...currentCustomers];
            updated[existingIndex] = newCustomer;
            return updated;
          } else {
            return [newCustomer, ...currentCustomers];
          }
        });
      });
      
      socketService.on('order_cancelled', (orderId: number) => {
        console.log('Order cancelled:', orderId);
        // İptal edilen siparişi listeden kaldır
        setCustomers(prev => (prev || []).filter(customer => customer.id !== orderId));
        
        // Eğer iptal edilen sipariş aktif sipariş ise, sürücüyü ana ekrana getir
        if (activeOrder && activeOrder.id === orderId) {
          setActiveOrder(null);
          setCurrentPhase('pickup');
          setRouteCoordinates([]);
          setRouteDuration(null);
          console.log('Aktif sipariş iptal edildi, sürücü ana ekrana getirildi');
        }
      });
      
      // Müşteri siparişi onayladığında
      socketService.on('order_confirmed_by_customer', (data: { orderId: number, customerInfo: any }) => {
        console.log('Müşteri siparişi onayladı:', data);
        // Siparişi listeden kaldır ve başarı mesajı göster
        setCustomers(prev => (prev || []).filter(customer => customer.id !== data.orderId));
        // TODO: Başarı mesajı modal'ı göster
      });
      
      // Müşteri siparişi reddetti
      socketService.on('order_rejected_by_customer', (data: { orderId: number, reason?: string }) => {
        console.log('Müşteri siparişi reddetti:', data);
        // Siparişi listeden kaldır
        setCustomers(prev => (prev || []).filter(customer => customer.id !== data.orderId));
        // TODO: Bilgilendirme mesajı göster
      });
      
      // Server konum güncellemesi istediğinde mevcut konumu gönder
      socketService.on('request_location_update', async () => {
        console.log('Server konum güncellemesi istiyor, mevcut konum gönderiliyor...');
        if (currentLocation) {
          socketService.updateLocation({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            heading: 0
          });
          console.log('Mevcut konum sunucuya gönderildi:', currentLocation);
        } else {
          console.log('Konum bilgisi yok, konum alınmaya çalışılıyor...');
          // Konum bilgisi yoksa yeniden al
          try {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            const newLocation = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            };
            setCurrentLocation(newLocation);
            socketService.updateLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              heading: location.coords.heading || 0,
            });
            console.log('Yeni konum alındı ve sunucuya gönderildi:', newLocation);
          } catch (error) {
            console.error('Konum alınırken hata:', error);
          }
        }
      });
      
      // Sipariş durumu güncellemelerini dinle
      socketService.on('order_status_update', (data: { orderId: number, status: string }) => {
        console.log('Sipariş durumu güncellendi:', data);
        
        // İlgili siparişi customers listesinde güncelle
        setCustomers(prev => {
          const currentCustomers = Array.isArray(prev) ? prev : [];
          return currentCustomers.map(customer => {
            if (customer.id === data.orderId) {
              return { ...customer, status: data.status as Customer['status'] };
            }
            return customer;
          });
        });
        
        // Sipariş tamamlandıysa listeden kaldır
        if (data.status === 'completed' || data.status === 'cancelled') {
          setCustomers(prev => (prev || []).filter(customer => customer.id !== data.orderId));
        }
      });
      
      // Sipariş faz güncellemelerini dinle
      socketService.on('order_phase_update', (data: { orderId: number, currentPhase: 'pickup' | 'delivery', status: string }) => {
        console.log('Sipariş faz güncellendi:', data);
        
        // Aktif sipariş varsa ve ID eşleşiyorsa faz bilgisini güncelle
        if (activeOrder && activeOrder.id === data.orderId) {
          setCurrentPhase(data.currentPhase);
          console.log('Aktif sipariş fazı güncellendi:', data.currentPhase);
        }
      });
      
      // İnceleme başlatıldığında sipariş detaylarını al
      socketService.on('order_inspection_started', (data: { orderId: number, orderDetails: any }) => {
        console.log('Sipariş incelemesi başlatıldı:', data);
        
        // İlgili siparişi customers listesinde 'inspecting' durumuna güncelle
        setCustomers(prev => {
          const currentCustomers = Array.isArray(prev) ? prev : [];
          return currentCustomers.map(customer => {
            if (customer.id === data.orderId) {
              return { ...customer, status: 'inspecting' as Customer['status'] };
            }
            return customer;
          });
        });
        
        // Sipariş detaylarını set et
        if (data.orderDetails) {
          setOrderDetails(data.orderDetails);
          
          // İlgili siparişi selectedOrder olarak set et
          const order = customers?.find(c => c.id === data.orderId);
          if (order) {
            setSelectedOrder({...order, status: 'inspecting'});
            setShowInspectionModal(true);
          }
        }
      });
      
      // İnceleme durdurulduğunda sipariş durumunu güncelle
      socketService.on('order_inspection_stopped', (data: { orderId: number, status: string }) => {
        console.log('Sipariş incelemesi durduruldu:', data);
        
        // İlgili siparişi customers listesinde 'waiting' durumuna güncelle
        setCustomers(prev => {
          const currentCustomers = Array.isArray(prev) ? prev : [];
          return currentCustomers.map(customer => {
            if (customer.id === data.orderId) {
              return { ...customer, status: 'waiting' as Customer['status'] };
            }
            return customer;
          });
        });
      });
    }
    
    return () => {
      // Cleanup socket listeners
      socketService.off('connection_error');
      socketService.off('max_reconnect_attempts_reached');
      socketService.off('new_order');
      socketService.off('order_cancelled');
      socketService.off('request_location_update');
      socketService.off('order_status_update');
      socketService.off('order_phase_update');
      socketService.off('order_inspection_started');
      socketService.off('order_inspection_stopped');
      // Cleanup location watch
      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
      }
    };
  }, [token]);

  const loadDriverInfo = async () => {
    try {
      // Önce AsyncStorage'dan kaydedilmiş sürücü bilgilerini oku
      const savedDriverInfo = await AsyncStorage.getItem('driver_info');
      if (savedDriverInfo) {
        const driverData = JSON.parse(savedDriverInfo);
        console.log('AsyncStorage\'dan sürücü bilgileri yüklendi:', driverData);
        setDriverInfo(driverData);
      }

      // Online durumunu AsyncStorage'dan oku
      const savedOnlineStatus = await AsyncStorage.getItem('driver_online_status');
      const shouldBeOnline = savedOnlineStatus === 'true';
      setIsOnline(shouldBeOnline);

      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        router.replace('/phone-auth');
        return;
      }

      console.log('API çağrısı yapılıyor:', `${API_CONFIG.BASE_URL}/api/drivers/profile`);
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/drivers/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('API yanıt durumu:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('API yanıtı:', result);
        
        if (result.success && result.data) {
          console.log('Sürücü bilgileri set ediliyor:', result.data);
          setDriverInfo(result.data);
          // Sürücü bilgilerini AsyncStorage'a kaydet
          await AsyncStorage.setItem('driver_info', JSON.stringify(result.data));
        } else {
          console.log('API yanıtında veri yok:', result);
        }
      } else {
        console.log('API yanıt hatası:', response.status, response.statusText);
        const errorText = await response.text();
        console.log('Hata detayı:', errorText);
      }
    } catch (error) {
      console.log('Error loading driver info:', error);
      // Network error durumunda AsyncStorage'dan yüklenen bilgileri kullan
      // Sadece hiç bilgi yoksa logout yap
      if (!driverInfo) {
        await logout();
        router.replace('/phone-auth');
      }
    }
  };

  const fetchLaborPrice = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/system-settings/labor-price`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.laborPrice) {
          setLaborPrice(result.laborPrice);
        }
      }
    } catch (error) {
      console.error('Error fetching labor price:', error);
      // Hata durumunda varsayılan değer kullanılır (800)
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showModal('Konum İzni', 'Konum izni gerekli. Lütfen ayarlardan konum iznini açın.', 'warning');
        return;
      }
      
      // Konum izni alındıktan sonra konum takibini başlat
      startLocationTracking();
    } catch (error) {
      console.error('Location permission error:', error);
      showModal('Hata', 'Konum izni alınırken hata oluştu.', 'error');
    }
  };

  const maskPhoneNumber = (phone: string) => {
    if (!phone || phone.length < 4) return phone;
    const visiblePart = phone.slice(0, -4);
    const maskedPart = '****';
    return visiblePart + maskedPart;
  };

  const makePhoneCall = (phone: string) => {
    const maskedNumber = '0850' + Math.floor(Math.random() * 9000000 + 1000000);
    Linking.openURL(`tel:${maskedNumber}`);
  };

  const startLocationTracking = async () => {
    try {
      // İlk konumu al
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      
      setCurrentLocation(newLocation);
      
      // Socket ile konum gönder
      if (socketService.isSocketConnected()) {
        socketService.updateLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          heading: location.coords.heading || 0,
        });
      }
      
      // Konum takibini başlat (her 5 saniyede bir güncelle)
      locationWatchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // 5 saniye
          distanceInterval: 5, // 5 metre
        },
        (location) => {
          const newLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          };
          
          setCurrentLocation(newLocation);
          
          // Socket ile konum gönder - isOnline kontrolünü kaldırdık
          if (socketService.isSocketConnected()) {
            console.log('Konum güncelleniyor:', {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              heading: location.coords.heading || 0,
            });
            
            socketService.updateLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              heading: location.coords.heading || 0,
            });
          } else {
            console.log('Socket bağlantısı yok, konum gönderilemedi');
          }
        }
      );
    } catch (error) {
      console.error('Location tracking error:', error);
      showModal('Hata', 'Konum takibi başlatılırken hata oluştu.', 'error');
    }
  };

  const loadCustomers = async () => {
    try {
      if (!token) {
        console.log('Token bulunamadı, bekleyen siparişler yüklenemedi');
        return;
      }

      if (!currentLocation) {
        console.log('Konum bilgisi bulunamadı, bekleyen siparişler yüklenemedi');
        return;
      }

      console.log('Bekleyen siparişler yükleniyor...');
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/orders/pending`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Bekleyen siparişler başarıyla yüklendi:', data);
        
        if (data.success && data.orders && Array.isArray(data.orders)) {
          // API'den gelen siparişleri Customer formatına dönüştür
          const pendingCustomers: Customer[] = data.orders.map((order: any) => ({
            id: order.id,
            name: order.customer && order.customer.firstName && order.customer.lastName 
              ? `${order.customer.firstName} ${order.customer.lastName}` 
              : order.customerName || 'Müşteri',
            phone: order.customer && order.customer.phone 
              ? order.customer.phone 
              : order.customerPhone || 'Bilinmiyor',
            pickup_location: order.pickupAddress,
            destination: order.destinationAddress,
            distance: order.distance ? `${order.distance.toFixed(1)} km` : 'Hesaplanıyor...',
            estimated_fare: order.estimatedPrice,
            status: order.order_status === 'pending' ? 'waiting' : order.order_status === 'inspecting' ? 'inspecting' : 'waiting',
            created_at: order.created_at || new Date().toISOString(),
          }));
          
          // Mevcut customers listesini güncelle
          setCustomers(pendingCustomers);
          console.log(`${pendingCustomers.length} bekleyen sipariş yüklendi`);
        } else {
          console.log('Bekleyen sipariş bulunamadı');
          setCustomers([]);
        }
      } else {
        const errorData = await response.json();
        console.error('Bekleyen siparişler yüklenirken hata:', errorData);
        
        // Sürücü konumu bulunamadı veya sürücü aktif değil hatası için özel mesaj
        if (errorData.error === "Sürücü konumu bulunamadı veya sürücü aktif değil") {
          showModal('Çevrimdışı Durum', 'Çevrimdışı olduğunuzda yeni siparişleri listeleyemezsiniz.', 'error');
        } else {
          showModal('Hata', errorData.message || 'Bekleyen siparişler yüklenirken bir hata oluştu.', 'error');
        }
      }
    } catch (error) {
      console.error('Bekleyen siparişler yüklenirken hata:', error);
      showModal('Bağlantı Hatası', 'Sunucuya bağlanırken bir hata oluştu. Lütfen internet bağlantınızı kontrol edin.', 'error');
    }
  };

  const refreshCustomers = useCallback(async () => {
    setIsRefreshing(true);
    await loadCustomers();
    setIsRefreshing(false);
  }, []);

  const toggleOnlineStatus = async () => {
    try {
      const newStatus = !isOnline;
      
      // Backend'de sürücü durumunu güncelle
      if (token) {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/drivers/status`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            is_active: newStatus,
            is_available: newStatus
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Sürücü durumu güncellenirken hata oluştu');
        }

        console.log('Sürücü durumu backend\'de güncellendi:', { is_active: newStatus, is_available: newStatus });
      }
      
      if (newStatus) {
        // Online olduğunda socket bağlantısını kur ve müsaitlik durumunu güncelle
        if (token) {
          await socketService.connect(token);
        }
        if (socketService.isSocketConnected()) {
          socketService.updateAvailability(newStatus);
        }
        // Online olduğunda konum takibini başlat
        await startLocationTracking();
        // Online durumunu AsyncStorage'da sakla
        await AsyncStorage.setItem('driver_online_status', 'true');
      } else {
        // Offline olduğunda önce socket disconnect yap
        if (socketService.isSocketConnected()) {
          socketService.goOffline(); // Bu fonksiyon socket'i disconnect edecek
        }
        // Offline olduğunda konum takibini durdur
        if (locationWatchRef.current) {
          locationWatchRef.current.remove();
          locationWatchRef.current = null;
        }
        // Offline durumunu AsyncStorage'da sakla
        await AsyncStorage.setItem('driver_online_status', 'false');
      }
      
      setIsOnline(newStatus);
      
      showModal(
        'Durum Güncellendi',
        newStatus ? 'Artık çevrimiçisiniz ve konum takibi başlatıldı' : 'Çevrimdışı oldunuz ve bağlantı kesildi',
        'success'
      );
    } catch (error) {
      console.error('Toggle online status error:', error);
      showModal('Hata', error instanceof Error ? error.message : 'Durum güncellenirken hata oluştu.', 'error');
    }
  };

  const acceptCustomer = (customerId: number) => {
    showModal(
      'Müşteriyi Kabul Et',
      'Bu müşteriyi kabul etmek istediğinizden emin misiniz?',
      'warning',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kabul Et',
          onPress: () => {
            // Socket üzerinden sipariş kabul et
            socketService.acceptOrder(customerId);
          },
        },
      ]
    );
  };

  const inspectOrder = async (order: Customer) => {
    try {
      setLoadingDetails(true);
      setSelectedOrder(order);
      
      // Socket bağlantısını kontrol et
      console.log('🔍 Socket bağlantı durumu:', socketService.isSocketConnected());
      console.log('🔍 Socket ID:', socketService.getSocketId());
      
      // Socket üzerinden inceleme başlat
      const inspectResult = socketService.inspectOrder(order.id);
      console.log('🔍 inspectOrder sonucu:', inspectResult);
      
      // İncelenen siparişler listesine ekle
      setInspectingOrders(prev => new Set([...prev, order.id]));
      
      // Sipariş detaylarını al
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/orders/${order.id}/details`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrderDetails(data.order);
        // API'den gelen labor_count değerini laborCount state'ine set et
        if (data.order?.labor_count) {
          setLaborCount(data.order.labor_count.toString());
        }
      }
      
      setShowInspectionModal(true);
    } catch (error) {
      console.error('Sipariş inceleme hatası:', error);
      showModal('Hata', 'Sipariş detayları yüklenirken bir hata oluştu.', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  const stopInspecting = (orderId: number) => {
    // Socket üzerinden incelemeyi durdur
    socketService.stopInspectingOrder(orderId);
    
    // İncelenen siparişler listesinden çıkar
    setInspectingOrders(prev => {
      const newSet = new Set(prev);
      newSet.delete(orderId);
      return newSet;
    });
    
    setShowInspectionModal(false);
    setSelectedOrder(null);
    setOrderDetails(null);
  };

  const acceptOrderWithLabor = (orderId: number, laborCount: number) => {
    // Socket üzerinden hammaliye ile kabul et
    socketService.acceptOrderWithLabor(orderId, laborCount);
    
    // İncelemeyi durdur
    stopInspecting(orderId);
    
    // Aktif siparişi ayarla ve pickup fazını başlat
    if (orderDetails) {
      const newActiveOrder: OrderData = {
        id: orderId,
        pickupAddress: orderDetails.pickup_address,
        pickup_latitude: orderDetails.pickup_latitude,
        pickup_longitude: orderDetails.pickup_longitude,
        destinationAddress: orderDetails.destination_address,
        delivery_latitude: orderDetails.destination_latitude,
        delivery_longitude: orderDetails.destination_longitude,
        weight: orderDetails.weight,
        laborCount: laborCount,
        estimatedPrice: orderDetails.estimated_price,
        customerId: orderDetails.customer_id,
        customerName: orderDetails.customer_name,
        customerPhone: orderDetails.customer_phone
      };
      
      setActiveOrder(newActiveOrder);
      setCurrentPhase('pickup');
      
      // Yük alma noktasına rota çiz
      getDirectionsRoute(
        currentLocation,
        {
          latitude: orderDetails.pickup_latitude,
          longitude: orderDetails.pickup_longitude
        }
      );
    }
  };

  const updateOrderStatus = (orderId: number, status: 'started' | 'completed') => {
    const statusText = status === 'started' ? 'Yük Alındı' : 'Teslim Edildi';
    const confirmText = status === 'started' ? 'Yükü aldığınızı onaylıyor musunuz?' : 'Yükü teslim ettiğinizi onaylıyor musunuz?';
    
    showModal(
      statusText,
      confirmText,
      'warning',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Onayla',
          onPress: () => {
            // Socket üzerinden sipariş durumu güncelle
            socketService.updateOrderStatus(orderId, status);
            
            // Aşamalı rota sistemini güncelle
            if (status === 'started' && activeOrder && activeOrder.id === orderId) {
              // Yük alındı - delivery fazına geç
              setCurrentPhase('delivery');
              // Varış noktasına rota çiz
              getDirectionsRoute(
                currentLocation,
                {
                  latitude: activeOrder.delivery_latitude,
                  longitude: activeOrder.delivery_longitude
                }
              );
            } else if (status === 'completed') {
              // Teslimat tamamlandı - rotayı temizle
              setActiveOrder(null);
              setCurrentPhase(null);
              setRouteCoordinates([]);
              setIsNavigating(false);
            }
            
            showModal('Başarılı', `Sipariş durumu güncellendi: ${statusText}`, 'success');
          },
        },
      ]
    );
  };

  // Backend API ile rota hesaplama
  const calculateRouteFromAPI = useCallback(async (orderId: number, phase: 'pickup' | 'delivery') => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/orders/route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId,
          phase
        })
      });

      const data = await response.json();
      
      if (data.success && data.route) {
        const { coordinates, distance, duration, instructions } = data.route;
        
        // Koordinatları harita formatına çevir
        const routePoints = coordinates.map((coord: [number, number]) => ({
          latitude: coord[0],
          longitude: coord[1]
        }));
        
        setRouteCoordinates(routePoints);
        setRouteDuration(duration); // saniye cinsinden
        
        // Haritayı rotaya odakla
        if (mapRef.current && routePoints.length > 0) {
          mapRef.current.fitToCoordinates(routePoints, {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true,
          });
        }
        
        return { success: true, route: data.route };
      } else {
        console.error('Rota hesaplama hatası:', data.error);
        showModal('Hata', data.error || 'Rota hesaplanamadı', 'error');
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Rota hesaplama hatası:', error);
      showModal('Hata', 'Rota hesaplanamadı', 'error');
      return { success: false, error: 'Network error' };
    }
  }, [token, showModal]);

  // Google Directions API ile rota çizimi (fallback)
  const getDirectionsRoute = useCallback(async (origin: {latitude: number, longitude: number}, destination: {latitude: number, longitude: number}) => {
    try {
      const GOOGLE_MAPS_API_KEY = 'AIzaSyBh078SvpaOnhvq5QGkGJ4hQV-Z0mpI81M';
      
      const originStr = `${origin.latitude},${origin.longitude}`;
      const destinationStr = `${destination.latitude},${destination.longitude}`;
      
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destinationStr}&key=${GOOGLE_MAPS_API_KEY}&mode=driving&departure_time=now&traffic_model=best_guess`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        
        // Polyline decode etme
        const points = decodePolyline(route.overview_polyline.points);
        setRouteCoordinates(points);
        
        // Süre bilgisini kaydet
        setRouteDuration(leg.duration.value); // saniye cinsinden
        
        // Haritayı rotaya odakla
        if (mapRef.current) {
          const coordinates = [origin, destination];
          mapRef.current.fitToCoordinates(coordinates, {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true,
          });
        }
      }
    } catch (error) {
      console.error('Rota çizimi hatası:', error);
    }
  }, []);
  
  // Polyline decode fonksiyonu
  const decodePolyline = (encoded: string) => {
    const points = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;
    
    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;
      
      shift = 0;
      result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;
      
      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }
    
    return points;
  };
  
  // Navigasyonu başlat
  const startNavigation = useCallback(async () => {
    if (!activeOrder || !currentLocation) {
      showModal('Hata', 'Aktif sipariş veya konum bilgisi bulunamadı', 'error');
      return;
    }

    setIsNavigating(true);
    
    try {
      let destination;
      
      if (currentPhase === 'pickup') {
        // Yük alma fazında - yük konumuna git
        destination = {
          latitude: activeOrder.pickup_latitude,
          longitude: activeOrder.pickup_longitude
        };
      } else {
        // Teslimat fazında - varış noktasına git
        destination = {
          latitude: activeOrder.delivery_latitude,
          longitude: activeOrder.delivery_longitude
        };
      }
      
      // Backend API ile rota hesapla
      if (currentPhase) {
        const routeResult = await calculateRouteFromAPI(activeOrder.id, currentPhase);
        
        if (!routeResult.success) {
          // Fallback olarak Google Directions API kullan
          await getDirectionsRoute(currentLocation, destination);
        }
      } else {
        // currentPhase null ise sadece Google Directions API kullan
        await getDirectionsRoute(currentLocation, destination);
      }
      
      // Harici navigasyon uygulamasını aç
      const url = `https://www.google.com/maps/dir/?api=1&origin=${currentLocation.latitude},${currentLocation.longitude}&destination=${destination?.latitude},${destination?.longitude}&travelmode=driving`;
      
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showModal('Hata', 'Navigasyon uygulaması açılamadı', 'error');
      }
    } catch (error) {
      console.error('Navigasyon başlatma hatası:', error);
      showModal('Hata', 'Navigasyon başlatılamadı', 'error');
      setIsNavigating(false);
    }
  }, [activeOrder, currentLocation, currentPhase, calculateRouteFromAPI, getDirectionsRoute, showModal]);
  
  const handleLogout = async () => {
    showModal(
      'Çıkış Yap',
      'Çıkış yapmak istediğinizden emin misiniz?',
      'warning',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          onPress: async () => {
            await logout();
            router.replace('/phone-auth');
          },
        },
      ]
    );
  };

  const renderCustomerItem = ({ item }: { item: Customer }) => {
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'waiting': return '#FFD700';
        case 'accepted': return '#FFD700';
        case 'confirmed': return '#10B981';
        case 'in_progress': return '#3B82F6';
        case 'completed': return '#6B7280';
        case 'inspecting': return '#F59E0B';
        default: return '#FFD700';
      }
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case 'waiting': return 'Bekliyor';
        case 'accepted': return 'Kabul Edildi';
        case 'confirmed': return 'Onaylandı';
        case 'in_progress': return 'Devam Ediyor';
        case 'completed': return 'Tamamlandı';
        case 'inspecting': return 'İnceleniyor';
        default: return 'Bekliyor';
      }
    };

    return (
      <View style={styles.customerCard}>
        <View style={styles.customerHeader}>
          <View>
            <Text style={styles.customerName}>{item.name}</Text>
            <Text style={styles.customerPhone}>{maskPhoneNumber(item.phone)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>
        
        <View style={styles.locationInfo}>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color="#FFD700" />
            <Text style={styles.locationText}>Alış: {item.pickup_location}</Text>
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="flag" size={16} color="#EF4444" />
            <Text style={styles.locationText}>Varış: {item.destination}</Text>
          </View>
        </View>
        
        <View style={styles.fareInfo}>
          <Text style={styles.distanceText}>{item.distance}</Text>
          <Text style={styles.fareText}>₺{item.estimated_fare}</Text>
        </View>
        
        {item.status === 'waiting' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.inspectButton, { marginHorizontal: 0 }]}
            onPress={() => inspectOrder(item)}
            disabled={inspectingOrders.has(item.id)}
          >
            <Ionicons name="eye" size={16} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>
              {inspectingOrders.has(item.id) ? 'İnceleniyor...' : 'İncele'}
            </Text>
          </TouchableOpacity>
        )}
        
        {item.status === 'inspecting' && (
          <View style={[styles.actionButton, { backgroundColor: '#F59E0B', marginHorizontal: 0 }]}>
            <Ionicons name="eye" size={16} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>İnceleme Devam Ediyor</Text>
          </View>
        )}
        
        {item.status === 'confirmed' && (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.startButton]}
              onPress={() => updateOrderStatus(item.id, 'started')}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Yük Aldım</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {item.status === 'in_progress' && (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={() => updateOrderStatus(item.id, 'completed')}
            >
              <Ionicons name="flag" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Teslim Ettim</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Hamburger Menu Button */}
      <TouchableOpacity
        style={styles.hamburgerButton}
        onPress={() => router.push('/driver-menu')}
      >
        <Ionicons name="menu" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Online/Offline Status Toggle */}
      <View
        style={{
          position: 'absolute',
          top: 60,
          right: 20,
          zIndex: 1000,
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        }}
      >
        <ToggleButton
          isOn={isOnline}
          onToggle={toggleOnlineStatus}
          onColors={['#10B981', '#34D399']}
          offColors={['#EF4444', '#F87171']}
          size="medium"
        />
      </View>

      {/* Map */}
      <MapComponent
        region={mapRegion}
        driverLocation={currentLocation}
        routeCoordinates={routeCoordinates}
        activeOrder={activeOrder}
        currentPhase={currentPhase || 'pickup'}
        isNavigating={isNavigating}
        onStartNavigation={() => startNavigation()}
        onRegionChange={(region) => setMapRegion(region)}
      />

      {/* Aktif Sipariş Kartı */}
      {activeOrder && currentPhase && (
        <ActiveOrderCard
          activeOrder={activeOrder}
          currentPhase={currentPhase}
          routeDuration={routeDuration || undefined}
          onPickupComplete={handlePickupComplete}
          onDeliveryComplete={handleDeliveryComplete}
        />
      )}

      {/* Navigation Button */}
      {activeOrder && (
        <TouchableOpacity
          style={styles.navigationButton}
          onPress={() => startNavigation()}
        >
          <Ionicons name="navigate" size={20} color="#FFFFFF" />
          <Text style={styles.navigationButtonText}>Navigasyon</Text>
        </TouchableOpacity>
      )}

      {/* Customer List */}
      <CustomerList 
        customers={customers}
        onInspectOrder={inspectOrder}
        onUpdateOrderStatus={(orderId, status) => {
          // Status güncelleme işlemi
          console.log('Status update:', orderId, status);
        }}
        inspectingOrders={inspectingOrders}
        maskPhoneNumber={(phone) => phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')}
        onRefresh={refreshCustomers}
        isRefreshing={isRefreshing}
      />



        {/* Sipariş İnceleme Modalı */}
        <OrderInspectionModal
          visible={showInspectionModal}
          selectedOrder={selectedOrder}
          orderDetails={orderDetails}
          laborCount={laborCount}
          laborPrice={laborPrice}
          onLaborCountChange={setLaborCount}
          onClose={() => selectedOrder && stopInspecting(selectedOrder.id)}
          onAccept={acceptOrderWithLabor}
          onOpenPhotoModal={openPhotoModal}
          styles={styles}
        />

        {/* Fotoğraf Modal */}
        <PhotoModal
          visible={photoModalVisible}
          photoUrls={photoUrls}
          currentImageIndex={currentImageIndex}
          onClose={closePhotoModal}
          onImageIndexChange={handleImageIndexChange}
        />
      </View>
    );
  }