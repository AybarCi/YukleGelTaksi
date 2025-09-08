import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Modal,
  ScrollView,
  TextInput,
  Linking,
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

const { width, height } = Dimensions.get('window');

interface Customer {
  id: number;
  name: string;
  phone: string;
  pickup_location: string;
  destination: string;
  distance: string;
  estimated_fare: number;
  status: 'waiting' | 'accepted' | 'confirmed' | 'in_progress' | 'completed';
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
  const [menuVisible, setMenuVisible] = useState(false);
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Customer | null>(null);
  const [inspectingOrders, setInspectingOrders] = useState<Set<number>>(new Set());
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [laborCount, setLaborCount] = useState('1');
  const [laborPrice, setLaborPrice] = useState(800); // Default değer pricing_settings tablosundan
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  
  // Aşamalı rota sistemi için state'ler
  const [activeOrder, setActiveOrder] = useState<OrderData | null>(null);
  const [currentPhase, setCurrentPhase] = useState<'pickup' | 'delivery' | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<{latitude: number, longitude: number}[]>([]);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const mapRef = useRef<MapView>(null);

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
        setIsOnline(shouldBeOnline); // Online durumunu hemen set et
        if (shouldBeOnline) {
          socketService.connect(token);
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
          name: orderData.customerName || 'Müşteri',
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
        
        // Sipariş detaylarını set et
        if (data.orderDetails) {
          setOrderDetails(data.orderDetails);
          
          // İlgili siparişi selectedOrder olarak set et
          const order = customers?.find(c => c.id === data.orderId);
          if (order) {
            setSelectedOrder(order);
            setShowInspectionModal(true);
          }
        }
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

      console.log('API çağrısı yapılıyor:', `${API_CONFIG.BASE_URL}/api/drivers/status`);
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/drivers/status`, {
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
      setDriverLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      // Socket ile konum gönder
      if (socketService.isSocketConnected()) {
        socketService.updateLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          heading: location.coords.heading || 0,
        });
      }
      
      // Konum takibini başlat (her 10 saniyede bir güncelle)
      locationWatchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // 10 saniye
          distanceInterval: 10, // 10 metre
        },
        (location) => {
          const newLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          };
          
          setCurrentLocation(newLocation);
          setDriverLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          
          // Socket ile konum gönder
          if (socketService.isSocketConnected() && isOnline) {
            socketService.updateLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              heading: location.coords.heading || 0,
            });
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
            name: order.customerName || 'Müşteri',
            phone: order.customerPhone || 'Bilinmiyor',
            pickup_location: order.pickupAddress,
            destination: order.destinationAddress,
            distance: order.distance ? `${order.distance.toFixed(1)} km` : 'Hesaplanıyor...',
            estimated_fare: order.estimatedPrice,
            status: 'waiting',
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
        showModal('Hata', errorData.message || 'Bekleyen siparişler yüklenirken bir hata oluştu.', 'error');
      }
    } catch (error) {
      console.error('Bekleyen siparişler yüklenirken hata:', error);
      showModal('Bağlantı Hatası', 'Sunucuya bağlanırken bir hata oluştu. Lütfen internet bağlantınızı kontrol edin.', 'error');
    }
  };

  const toggleOnlineStatus = async () => {
    try {
      const newStatus = !isOnline;
      
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
      showModal('Hata', 'Durum güncellenirken hata oluştu.', 'error');
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
      
      // Socket üzerinden inceleme başlat
      socketService.inspectOrder(order.id);
      
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
    if (!activeOrder || !driverLocation) {
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
          await getDirectionsRoute(driverLocation, destination);
        }
      } else {
        // currentPhase null ise sadece Google Directions API kullan
        await getDirectionsRoute(driverLocation, destination);
      }
      
      // Harici navigasyon uygulamasını aç
      const url = `https://www.google.com/maps/dir/?api=1&origin=${driverLocation.latitude},${driverLocation.longitude}&destination=${destination?.latitude},${destination?.longitude}&travelmode=driving`;
      
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
  }, [activeOrder, driverLocation, currentPhase, calculateRouteFromAPI, getDirectionsRoute, showModal]);
  
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
        default: return 'Bekliyor';
      }
    };

    return (
      <View style={styles.customerCard}>
        <View style={styles.customerHeader}>
          <View>
            <Text style={styles.customerName}>{item.name}</Text>
            <Text style={styles.customerPhone}>{item.phone}</Text>
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
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.placeholder} />
        <Text style={styles.headerTitle}>Sürücü Paneli</Text>
        <TouchableOpacity style={styles.menuButton} onPress={() => router.push('/driver-menu')}>
          <Ionicons name="menu" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: currentLocation.latitude - 0.001,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.006,
          }}
          region={activeOrder ? undefined : {
            latitude: currentLocation.latitude - 0.001,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.006,
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
          followsUserLocation={!activeOrder}
          userLocationPriority="high"
          userLocationUpdateInterval={3000}
          userLocationAnnotationTitle="Konumunuz"
          zoomEnabled={true}
          scrollEnabled={true}
          pitchEnabled={true}
          rotateEnabled={true}
        >
          <Marker
            coordinate={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }}
            title="Konumunuz"
            description="Mevcut konum"
          />
          
          {/* Aktif sipariş varsa pickup ve destination marker'ları göster */}
          {activeOrder && currentPhase === 'pickup' && (
            <Marker
              coordinate={{
                latitude: activeOrder.pickup_latitude,
                longitude: activeOrder.pickup_longitude,
              }}
              title="Yük Alma Noktası"
              description={activeOrder.pickupAddress}
              pinColor="green"
            />
          )}
          
          {activeOrder && currentPhase === 'delivery' && (
            <Marker
              coordinate={{
                latitude: activeOrder.delivery_latitude,
                longitude: activeOrder.delivery_longitude,
              }}
              title="Varış Noktası"
              description={activeOrder.destinationAddress}
              pinColor="red"
            />
          )}
          
          {/* Rota çizgisi */}
          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#FFD700"
              strokeWidth={4}
            />
          )}
        </MapView>
        
        {/* Navigasyon butonu */}
        {activeOrder && (
          <TouchableOpacity
            style={styles.navigationButton}
            onPress={startNavigation}
          >
            <MaterialIcons name="navigation" size={24} color="#FFFFFF" />
            <Text style={styles.navigationButtonText}>Navigasyon</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Aktif Sipariş Kartı */}
      {activeOrder && (
        <View style={styles.activeOrderContainer}>
          <View style={styles.activeOrderHeader}>
            <Text style={styles.activeOrderTitle}>
              {currentPhase === 'pickup' ? 'Yük Alma' : 'Teslimat'} - {activeOrder.customerName}
            </Text>
            <View style={[styles.phaseIndicator, { backgroundColor: currentPhase === 'pickup' ? '#10B981' : '#EF4444' }]}>
              <Text style={styles.phaseIndicatorText}>
                {currentPhase === 'pickup' ? 'Yük Alma' : 'Teslimat'}
              </Text>
            </View>
          </View>
          
          <View style={styles.activeOrderInfo}>
            <View style={styles.activeOrderRow}>
              <Ionicons name="location" size={16} color="#6B7280" />
              <Text style={styles.activeOrderText}>
                {currentPhase === 'pickup' ? activeOrder.pickupAddress : activeOrder.destinationAddress}
              </Text>
            </View>
            
            {routeDuration && (
              <View style={styles.activeOrderRow}>
                <Ionicons name="time" size={16} color="#6B7280" />
                <Text style={styles.activeOrderText}>
                  Tahmini Süre: {Math.round(routeDuration / 60)} dakika
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.activeOrderActions}>
            {currentPhase === 'pickup' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.pickupButton]}
                onPress={() => updateOrderStatus(activeOrder.id, 'started')}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Yük Alındı</Text>
              </TouchableOpacity>
            )}
            
            {currentPhase === 'delivery' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.deliveryButton]}
                onPress={() => updateOrderStatus(activeOrder.id, 'completed')}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Teslim Edildi</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[styles.actionButton, styles.callButton]}
              onPress={() => {
                const phoneNumber = activeOrder.customerPhone?.replace(/[^0-9]/g, '');
                if (phoneNumber) {
                  Linking.openURL(`tel:${phoneNumber}`);
                }
              }}
            >
              <Ionicons name="call" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Ara</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Customer List */}
      <View style={styles.customerListContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Müşteri İstekleri</Text>
          <TouchableOpacity onPress={loadCustomers}>
            <Ionicons name="refresh" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
        
        <FlatList
          data={(customers || []).filter(c => c.status === 'waiting' || c.status === 'accepted')}
          renderItem={renderCustomerItem}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="car" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>Henüz müşteri isteği yok</Text>
            </View>
          }
        />
      </View>

      {/* Hamburger Menu Modal */}
       <Modal
         visible={menuVisible}
         animationType="slide"
         transparent
         onRequestClose={() => setMenuVisible(false)}
       >
         <View style={styles.modalOverlay}>
           <View style={styles.menuContainer}>
             <View style={styles.menuHeader}>
               <View style={styles.profileSection}>
                 <View style={styles.profileImage}>
                   <Ionicons name="person" size={32} color="#FFD700" />
                 </View>
                 <View style={styles.profileInfo}>
                   {driverInfo && (
                      <Text style={styles.driverNameMenu}>
                        {`${driverInfo.first_name} ${driverInfo.last_name}`}
                      </Text>
                    )}
                   <View style={styles.ratingContainer}>
                     <Ionicons name="star" size={16} color="#FCD34D" />
                     <Text style={styles.ratingText}>4.8</Text>
                     <Text style={styles.ratingCount}>(127 değerlendirme)</Text>
                   </View>
                   <View style={[styles.statusBadgeMenu, { backgroundColor: isOnline ? '#FFD700' : '#EF4444' }]}>
                     <Text style={styles.statusBadgeText}>
                       {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                     </Text>
                   </View>
                 </View>
               </View>
               <TouchableOpacity 
                 style={styles.closeButton}
                 onPress={() => setMenuVisible(false)}
               >
                 <Ionicons name="close" size={24} color="#000000" />
               </TouchableOpacity>
             </View>

             <ScrollView style={styles.menuContent}>
               {/* Sürücü Bilgileri */}
               <TouchableOpacity 
                 style={styles.menuItem}
                 onPress={() => {
                   setMenuVisible(false);
                   router.push('/driver-profile');
                 }}
               >
                 <Ionicons name="person-outline" size={24} color="#374151" />
                 <View style={styles.menuItemContent}>
                   <Text style={styles.menuItemTitle}>Sürücü Bilgileri</Text>
                   <Text style={styles.menuItemSubtitle}>Profil bilgilerinizi görüntüleyin ve düzenleyin</Text>
                 </View>
                 <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
               </TouchableOpacity>
               
               {/* Sipariş Geçmişi */}
               <TouchableOpacity 
                 style={styles.menuItem}
                 onPress={() => {
                   setMenuVisible(false);
                   router.push('/driver-order-history');
                 }}
               >
                 <Ionicons name="time-outline" size={24} color="#374151" />
                 <View style={styles.menuItemContent}>
                   <Text style={styles.menuItemTitle}>Sipariş Geçmişi</Text>
                   <Text style={styles.menuItemSubtitle}>Tamamladığınız siparişleri görüntüleyin</Text>
                 </View>
                 <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
               </TouchableOpacity>
               
               {/* Kazançlar */}
               <TouchableOpacity 
                 style={styles.menuItem}
                 onPress={() => {
                   setMenuVisible(false);
                   router.push('/driver-earnings');
                 }}
               >
                 <Ionicons name="wallet-outline" size={24} color="#374151" />
                 <View style={styles.menuItemContent}>
                   <Text style={styles.menuItemTitle}>Kazançlarım</Text>
                   <Text style={styles.menuItemSubtitle}>Günlük ve aylık kazançlarınızı görüntüleyin</Text>
                 </View>
                 <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
               </TouchableOpacity>
               
               {/* Değerlendirmeler */}
               <TouchableOpacity 
                 style={styles.menuItem}
                 onPress={() => {
                   setMenuVisible(false);
                   router.push('/driver-reviews');
                 }}
               >
                 <Ionicons name="star-outline" size={24} color="#374151" />
                 <View style={styles.menuItemContent}>
                   <Text style={styles.menuItemTitle}>Değerlendirmeler</Text>
                   <Text style={styles.menuItemSubtitle}>Müşteri değerlendirmelerinizi görüntüleyin</Text>
                 </View>
                 <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
               </TouchableOpacity>
               
               {/* Ayarlar */}
               <TouchableOpacity 
                 style={styles.menuItem}
                 onPress={() => {
                   setMenuVisible(false);
                   router.push('/driver-settings');
                 }}
               >
                 <Ionicons name="settings-outline" size={24} color="#374151" />
                 <View style={styles.menuItemContent}>
                   <Text style={styles.menuItemTitle}>Ayarlar</Text>
                   <Text style={styles.menuItemSubtitle}>Uygulama ayarlarını düzenleyin</Text>
                 </View>
                 <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
               </TouchableOpacity>
               
               {/* Yardım ve Destek */}
               <TouchableOpacity 
                 style={styles.menuItem}
                 onPress={() => {
                   setMenuVisible(false);
                   router.push('/settings');
                 }}
               >
                 <Ionicons name="help-circle-outline" size={24} color="#374151" />
                 <View style={styles.menuItemContent}>
                   <Text style={styles.menuItemTitle}>Yardım ve Destek</Text>
                   <Text style={styles.menuItemSubtitle}>SSS ve destek talebi oluşturun</Text>
                 </View>
                 <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
               </TouchableOpacity>
               
               <View style={styles.menuDivider} />
               
               {/* Çıkış Yap */}
               <TouchableOpacity 
                 style={styles.menuItem}
                 onPress={() => {
                   setMenuVisible(false);
                   handleLogout();
                 }}
               >
                 <Ionicons name="log-out-outline" size={24} color="#EF4444" />
                 <View style={styles.menuItemContent}>
                   <Text style={[styles.menuItemTitle, { color: '#EF4444' }]}>Çıkış Yap</Text>
                   <Text style={styles.menuItemSubtitle}>Hesabınızdan çıkış yapın</Text>
                 </View>
               </TouchableOpacity>
             </ScrollView>
           </View>
         </View>
       </Modal>

        {/* Sipariş İnceleme Modalı */}
        <Modal
          visible={showInspectionModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => selectedOrder && stopInspecting(selectedOrder.id)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.inspectionModalContainer}>
              <View style={styles.inspectionModalHeader}>
                <Text style={styles.inspectionModalTitle}>Sipariş Detayları</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => selectedOrder && stopInspecting(selectedOrder.id)}
                >
                  <Ionicons name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.inspectionModalContent}>
                {selectedOrder && (
                  <>
                    <View style={styles.orderInfoSection}>
                      <Text style={styles.sectionTitle}>Müşteri Bilgileri</Text>
                      <View style={styles.infoRow}>
                        <Ionicons name="person" size={16} color="#6B7280" />
                        <Text style={styles.infoText}>
                          {orderDetails?.customer_first_name && orderDetails?.customer_last_name 
                            ? `${orderDetails.customer_first_name} ${orderDetails.customer_last_name}` 
                            : selectedOrder.name || 'Müşteri'}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Ionicons name="call" size={16} color="#6B7280" />
                        <Text style={styles.infoText}>{orderDetails?.customer_phone ? maskPhoneNumber(orderDetails.customer_phone) : 'Bilinmiyor'}</Text>
                        {orderDetails?.customer_phone && (
                          <TouchableOpacity 
                            style={styles.callButton}
                            onPress={() => makePhoneCall(orderDetails.customer_phone)}
                          >
                            <Ionicons name="call" size={16} color="#FFFFFF" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    <View style={styles.orderInfoSection}>
                      <Text style={styles.sectionTitle}>Konum Bilgileri</Text>
                      <View style={styles.infoRow}>
                        <Ionicons name="location" size={16} color="#FFD700" />
                        <Text style={styles.infoText}>Alış: {selectedOrder.pickup_location}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Ionicons name="flag" size={16} color="#EF4444" />
                        <Text style={styles.infoText}>Varış: {selectedOrder.destination}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Ionicons name="map" size={16} color="#6B7280" />
                        <Text style={styles.infoText}>Mesafe: {selectedOrder.distance}</Text>
                      </View>
                    </View>

                    {orderDetails && (
                      <View style={styles.orderInfoSection}>
                        <Text style={styles.sectionTitle}>Yük Bilgileri</Text>
                        <View style={styles.infoRow}>
                          <Ionicons name="cube" size={16} color="#6B7280" />
                          <Text style={styles.infoText}>Ağırlık: {orderDetails.weight_kg} kg</Text>
                        </View>
                        <View style={styles.infoRow}>
                          <Ionicons name="people" size={16} color="#6B7280" />
                          <Text style={styles.infoText}>Hammal Sayısı:</Text>
                          <TextInput
                            style={styles.laborInput}
                            value={laborCount}
                            onChangeText={setLaborCount}
                            keyboardType="numeric"
                            placeholder={orderDetails?.labor_count?.toString() || "1"}
                          />
                        </View>
                        {orderDetails.cargo_photo_url && (
                          <View style={styles.infoRow}>
                            <Ionicons name="camera" size={16} color="#6B7280" />
                            <Text style={styles.infoText}>Yük fotoğrafı mevcut</Text>
                          </View>
                        )}
                      </View>
                    )}

                    <View style={styles.orderInfoSection}>
                      <Text style={styles.sectionTitle}>Fiyat Bilgileri</Text>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Tahmini Ücret:</Text>
                        <Text style={styles.priceValue}>₺{selectedOrder.estimated_fare}</Text>
                      </View>
                      {laborCount && parseInt(laborCount) > 0 && (
                        <View style={styles.priceRow}>
                          <Text style={styles.priceLabel}>Hammaliye:</Text>
                          <Text style={styles.priceValue}>₺{parseInt(laborCount) * laborPrice}</Text>
                        </View>
                      )}
                      <View style={[styles.priceRow, styles.totalPriceRow]}>
                        <Text style={styles.totalPriceLabel}>Toplam:</Text>
                        <Text style={styles.totalPriceValue}>₺{selectedOrder.estimated_fare + (laborCount && parseInt(laborCount) > 0 ? parseInt(laborCount) * laborPrice : 0)}</Text>
                      </View>
                    </View>
                  </>
                )}
              </ScrollView>
              
              <View style={styles.inspectionModalActions}>
                <TouchableOpacity
                  style={[styles.modalActionButton, styles.cancelInspectionButton]}
                  onPress={() => selectedOrder && stopInspecting(selectedOrder.id)}
                >
                  <Text style={styles.cancelInspectionButtonText}>İncelemeyi Bitir</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalActionButton, styles.acceptInspectionButton]}
                  onPress={() => {
                    if (selectedOrder) {
                      const laborValue = laborCount && parseInt(laborCount) > 0 ? parseInt(laborCount) : 1;
                      acceptOrderWithLabor(selectedOrder.id, laborValue);
                    }
                  }}
                >
                  <Text style={styles.acceptInspectionButtonText}>Kabul Et</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  placeholder: {
    width: 40,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  modalOverlay: {
     flex: 1,
     backgroundColor: 'rgba(0, 0, 0, 0.5)',
     justifyContent: 'flex-end',
   },
   menuContainer: {
     backgroundColor: '#FFFFFF',
     borderTopLeftRadius: 20,
     borderTopRightRadius: 20,
     maxHeight: '80%',
   },
   menuHeader: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
     paddingHorizontal: 20,
     paddingTop: 20,
     paddingBottom: 16,
     borderBottomWidth: 1,
     borderBottomColor: '#E5E7EB',
   },
   profileSection: {
     flexDirection: 'row',
     alignItems: 'center',
     flex: 1,
   },
   profileImage: {
     width: 60,
     height: 60,
     borderRadius: 30,
     backgroundColor: '#F3F4F6',
     justifyContent: 'center',
     alignItems: 'center',
     marginRight: 12,
   },
   profileInfo: {
     flex: 1,
   },
   driverNameMenu: {
     fontSize: 18,
     fontWeight: 'bold',
     color: '#000000',
     marginBottom: 4,
   },
   ratingContainer: {
     flexDirection: 'row',
     alignItems: 'center',
     marginBottom: 8,
   },
   ratingText: {
     fontSize: 14,
     fontWeight: '600',
     color: '#374151',
     marginLeft: 4,
   },
   ratingCount: {
     fontSize: 12,
     color: '#9CA3AF',
     marginLeft: 4,
   },
   statusBadgeMenu: {
     paddingHorizontal: 12,
     paddingVertical: 4,
     borderRadius: 12,
     alignSelf: 'flex-start',
   },
   statusBadgeText: {
     fontSize: 12,
     fontWeight: 'bold',
     color: '#FFFFFF',
   },
   closeButton: {
     width: 32,
     height: 32,
     borderRadius: 16,
     backgroundColor: '#F3F4F6',
     justifyContent: 'center',
     alignItems: 'center',
   },
   menuContent: {
     paddingHorizontal: 20,
     paddingBottom: 20,
   },
   menuItem: {
     flexDirection: 'row',
     alignItems: 'center',
     paddingVertical: 16,
     borderBottomWidth: 1,
     borderBottomColor: '#F3F4F6',
   },
   menuItemContent: {
     flex: 1,
     marginLeft: 12,
   },
   menuItemTitle: {
     fontSize: 16,
     fontWeight: '600',
     color: '#374151',
     marginBottom: 2,
   },
   menuItemSubtitle: {
     fontSize: 14,
     color: '#9CA3AF',
   },
   menuDivider: {
     height: 1,
     backgroundColor: '#E5E7EB',
     marginVertical: 8,
   },
  mapContainer: {
    height: height * 0.4,
  },
  map: {
    flex: 1,
  },
  customerListContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  listContent: {
    padding: 16,
  },
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  customerPhone: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  locationInfo: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  fareInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  distanceText: {
    fontSize: 14,
    color: '#6B7280',
  },
  fareText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  acceptButton: {
    backgroundColor: '#FFD700',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  inspectButton: {
    backgroundColor: '#3B82F6',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 12,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  startButton: {
    backgroundColor: '#10B981',
  },
  completeButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  inspectionModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '60%',
  },
  inspectionModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  inspectionModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  inspectionModalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  orderInfoSection: {
    marginVertical: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  totalPriceRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    marginTop: 8,
  },
  totalPriceLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  totalPriceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  inspectionModalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  cancelInspectionButton: {
    backgroundColor: '#6B7280',
  },
  acceptInspectionButton: {
    backgroundColor: '#FFD700',
  },
  cancelInspectionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  acceptInspectionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  callButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  laborInput: {
     backgroundColor: '#FFFFFF',
     borderWidth: 1,
     borderColor: '#D1D5DB',
     borderRadius: 8,
     paddingHorizontal: 12,
     paddingVertical: 8,
     marginLeft: 8,
     width: 60,
     textAlign: 'center',
     fontSize: 14,
   },
   navigationButton: {
     position: 'absolute',
     top: 16,
     right: 16,
     backgroundColor: '#FFD700',
     flexDirection: 'row',
     alignItems: 'center',
     paddingHorizontal: 16,
     paddingVertical: 12,
     borderRadius: 25,
     elevation: 3,
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.25,
     shadowRadius: 4,
   },
   navigationButtonText: {
     color: '#FFFFFF',
     fontWeight: 'bold',
     marginLeft: 8,
     fontSize: 14,
   },
   activeOrderContainer: {
     backgroundColor: '#FFFFFF',
     margin: 16,
     borderRadius: 12,
     padding: 16,
     elevation: 3,
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.1,
     shadowRadius: 4,
   },
   activeOrderHeader: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
     marginBottom: 12,
   },
   activeOrderTitle: {
     fontSize: 16,
     fontWeight: 'bold',
     color: '#000000',
     flex: 1,
   },
   phaseIndicator: {
     paddingHorizontal: 12,
     paddingVertical: 4,
     borderRadius: 12,
   },
   phaseIndicatorText: {
     fontSize: 12,
     fontWeight: 'bold',
     color: '#FFFFFF',
   },
   activeOrderInfo: {
     marginBottom: 16,
   },
   activeOrderRow: {
     flexDirection: 'row',
     alignItems: 'center',
     marginBottom: 8,
   },
   activeOrderText: {
     fontSize: 14,
     color: '#374151',
     marginLeft: 8,
     flex: 1,
   },
   activeOrderActions: {
     flexDirection: 'row',
     justifyContent: 'space-between',
   },
   pickupButton: {
     backgroundColor: '#10B981',
     flex: 1,
     marginRight: 8,
   },
   deliveryButton: {
     backgroundColor: '#EF4444',
     flex: 1,
     marginRight: 8,
   },
 });