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
  Alert,
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
import NewOrderNotificationModal from '../components/NewOrderNotificationModal';
import OrderCancellationModal from '../components/OrderCancellationModal';

import { Header } from '../components/driver-dashboard/Header';
import MapComponent from '../components/driver-dashboard/MapComponent';
import { ActiveOrderCard } from '../components/driver-dashboard/ActiveOrderCard';
import { default as CustomerList } from '../components/driver-dashboard/CustomerList';
import { DriverInfo as DashboardDriverInfo, OrderData as DashboardOrderData, LocationCoords, MapRegion } from '../types/dashboard';
import ToggleButton from '../components/ToggleButton';
import { navigationService, NavigationUpdate } from '../services/navigationService';

const { width, height } = Dimensions.get('window');

interface Customer {
  id: number;
  name: string;
  phone: string;
  pickup_location: string;
  destination: string;
  distance: string;
  estimated_fare: number;
  status: 'pending' | 'waiting' | 'driver_accepted_awaiting_customer' | 'accepted' | 'confirmed' | 'in_progress' | 'completed' | 'inspecting' | 'rejected' | 'timeout';
  created_at: string;
  countdownTime?: number; // Geri sayım süresi (milisaniye)
  countdownTotal?: number; // Toplam süre (milisaniye)
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
  pickupLatitude: number;
  pickupLongitude: number;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
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
  
  // Yeni sipariş bildirim modal state'leri
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [newOrderData, setNewOrderData] = useState<OrderData | null>(null);
  
  // Sipariş iptali modal state'leri
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [cancellationData, setCancellationData] = useState<{
    orderId: number;
    message?: string;
    customerName?: string;
    pickupAddress?: string;
    destinationAddress?: string;
  } | null>(null);
  
  // Fotoğraf modal state'leri
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  
  // Navigasyon servisi ve state'leri
  const [navigationUpdate, setNavigationUpdate] = useState<NavigationUpdate | null>(null);
  
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
  const [isWaitingForCustomerApproval, setIsWaitingForCustomerApproval] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [pendingOrderDetails, setPendingOrderDetails] = useState<any>(null);
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

  // Navigasyon durumu değiştiğinde cleanup
  useEffect(() => {
    if (!isNavigating && navigationService.isNavigating()) {
      console.log('🧹 Navigasyon durduruluyor (isNavigating false)');
      navigationService.stopNavigation();
    }
  }, [isNavigating]);

  // Aktif sipariş değiştiğinde navigasyonu temizle
  useEffect(() => {
    if (!activeOrder && isNavigating) {
      console.log('🧹 Aktif sipariş yok, navigasyon durduruluyor');
      navigationService.stopNavigation();
      setIsNavigating(false);
      setNavigationUpdate(null);
    }
  }, [activeOrder, isNavigating]);
  useEffect(() => {
    return () => {
      console.log('🧹 Component unmount, navigasyon temizleniyor...');
      navigationService.stopNavigation();
      setIsNavigating(false);
    };
  }, []);

  // Navigasyon durumu değiştiğinde cleanup
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
        console.log('🔔 CONNECTION ERROR BİLDİRİMİ ALINDI:');
        console.log('❌ Socket bağlantı hatası:', JSON.stringify(data, null, 2));
        console.log('🔌 Bağlantı durumu:', socketService.isSocketConnected());
        showModal('Bağlantı Hatası', 'Sunucu ile bağlantı kurulamadı. Lütfen internet bağlantınızı kontrol edin.', 'error');
      });

      socketService.on('max_reconnect_attempts_reached', () => {
        console.log('🔔 MAX RECONNECT ATTEMPTS BİLDİRİMİ ALINDI:');
        console.log('❌ Maksimum yeniden bağlanma denemesi aşıldı');
        console.log('🔌 Socket durumu:', socketService.isSocketConnected());
        console.log('🆔 Socket ID:', socketService.getSocketId());
        showModal('Bağlantı Sorunu', 'Sunucu ile bağlantı kurulamıyor. Lütfen uygulamayı yeniden başlatın.', 'error');
      });
      
      // Socket event listener'ları - sadece backend'ten gelen new_order_available event'ini dinle
      socketService.on('new_order_available', (orderData: OrderData) => {
        console.log('🔔 NEW ORDER AVAILABLE BİLDİRİMİ ALINDI:');
        console.log('📋 Sipariş Detayları:', JSON.stringify(orderData, null, 2));
        console.log('👤 Müşteri:', orderData.customer_first_name, orderData.customer_last_name);
        console.log('📍 Alış Adresi:', orderData.pickupAddress);
        console.log('🎯 Varış Adresi:', orderData.destinationAddress);
        console.log('💰 Tahmini Ücret:', orderData.estimatedPrice);
        console.log('📏 Mesafe:', orderData.distance);

        console.log('👷 İşçi Sayısı:', orderData.laborCount);
        
        // Yeni sipariş bildirim modalını göster
        setNewOrderData(orderData);
        setShowNewOrderModal(true);
        
        // OrderData'yı Customer formatına dönüştür
        const newCustomer: Customer = {
          id: orderData.id || Date.now(),
          name: orderData.customer_first_name && orderData.customer_last_name 
            ? `${orderData.customer_first_name} ${orderData.customer_last_name}` 
            : (orderData.customerName || 'Müşteri'),
          phone: orderData.customerPhone || 'Bilinmiyor',
          pickup_location: orderData.pickupAddress,
          destination: orderData.destinationAddress,
          distance: orderData.distance ? `${orderData.distance.toFixed(1)} km` : 'Hesaplanıyor...',
          estimated_fare: orderData.estimatedPrice,
          status: 'pending',
          created_at: new Date().toISOString(),
        };
        
        console.log('✅ Dönüştürülen Müşteri Verisi:', JSON.stringify(newCustomer, null, 2));
        
        // Yeni siparişi customers listesine ekle
        setCustomers(prev => {
          const currentCustomers = Array.isArray(prev) ? prev : [];
          // Aynı ID'li sipariş varsa güncelle, yoksa ekle
          const existingIndex = currentCustomers.findIndex(c => c.id === newCustomer.id);
          if (existingIndex >= 0) {
            const updated = [...currentCustomers];
            updated[existingIndex] = newCustomer;
            console.log('🔄 Mevcut sipariş güncellendi:', newCustomer.id);
            return updated;
          } else {
            console.log('➕ Yeni sipariş eklendi:', newCustomer.id);
            return [newCustomer, ...currentCustomers];
          }
        });
      });
      
      socketService.on('order_cancelled', (orderId: number) => {
        console.log('🔔 ORDER CANCELLED BİLDİRİMİ ALINDI:');
        console.log('🆔 İptal Edilen Sipariş ID:', orderId);
        
        // İptal edilen siparişi listeden kaldır
        setCustomers(prev => {
          const filtered = (prev || []).filter(customer => customer.id !== orderId);
          console.log('❌ Sipariş listeden kaldırıldı:', orderId);
          console.log('📊 Kalan sipariş sayısı:', filtered.length);
          return filtered;
        });
        
        // Eğer iptal edilen sipariş aktif sipariş ise, sürücüyü ana ekrana getir
        if (activeOrder && activeOrder.id === orderId) {
          setActiveOrder(null);
          setCurrentPhase('pickup');
          setRouteCoordinates([]);
          setRouteDuration(null);
          console.log('🏠 Aktif sipariş iptal edildi, sürücü ana ekrana getirildi');
        }
        
        // Sürücüye bilgilendirme modalı göster
        showModal('Sipariş İptal Edildi', `#${orderId} numaralı sipariş müşteri tarafından iptal edildi.`, 'info');
      });

      // Sipariş başarıyla iptal edildiğinde (müşteri tarafından onay kodu ile)
      socketService.on('order_cancelled_successfully', (data: { orderId: number, message?: string }) => {
        console.log('🔔 ORDER CANCELLED SUCCESSFULLY BİLDİRİMİ ALINDI:');
        console.log('🆔 İptal Edilen Sipariş ID:', data.orderId);
        console.log('💬 Mesaj:', data.message);
        
        // İptal edilen siparişi listeden kaldır
        setCustomers(prev => {
          const filtered = (prev || []).filter(customer => customer.id !== data.orderId);
          console.log('❌ Sipariş listeden kaldırıldı:', data.orderId);
          console.log('📊 Kalan sipariş sayısı:', filtered.length);
          return filtered;
        });
        
        // Eğer iptal edilen sipariş aktif sipariş ise, sürücüyü ana ekrana getir
        if (activeOrder && activeOrder.id === data.orderId) {
          setActiveOrder(null);
          setCurrentPhase('pickup');
          setRouteCoordinates([]);
          setRouteDuration(null);
          console.log('🏠 Aktif sipariş iptal edildi, sürücü ana ekrana getirildi');
        }

        // İnceleme modalı açıksa ve iptal edilen sipariş bu sipariş ise modalı kapat
        if (selectedOrder && selectedOrder.id === data.orderId) {
          console.log('🚪 İnceleme modalı kapatılıyor - sipariş iptal edildi:', data.orderId);
          setShowInspectionModal(false);
          setSelectedOrder(null);
          setOrderDetails(null);
        }

        // İnceleme listesinden de kaldır
        setInspectingOrders(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.orderId);
          console.log('🗑️ İptal edilen sipariş inspectingOrders listesinden çıkarıldı:', data.orderId);
          return newSet;
        });
      });

      // Müşteri sipariş iptal onayı istediğinde (backend'ten gelen event)
      socketService.on('cancel_order_confirmation_required', (data: { orderId: number, message?: string }) => {
        console.log('🔔 CANCEL ORDER CONFIRMATION REQUIRED BİLDİRİMİ ALINDI:');
        console.log('🆔 İptal Onayı İstenen Sipariş ID:', data.orderId);
        console.log('💬 Mesaj:', data.message);
        
        // İptal onayı istenen siparişi listeden kaldır
        setCustomers(prev => {
          const filtered = (prev || []).filter(customer => customer.id !== data.orderId);
          console.log('❌ Sipariş listeden kaldırıldı (iptal onayı istendi):', data.orderId);
          console.log('📊 Kalan sipariş sayısı:', filtered.length);
          return filtered;
        });
        
        // İptal onayı istenen sipariş bilgilerini al ve modal göster
        const orderToCancel = customers?.find(customer => customer.id === data.orderId);
        if (orderToCancel) {
          setCancellationData({
            orderId: data.orderId,
            message: data.message || 'Müşteri sipariş iptal onayı istiyor',
            customerName: orderToCancel.name,
            pickupAddress: orderToCancel.pickup_location,
            destinationAddress: orderToCancel.destination
          });
          setShowCancellationModal(true);
        } else {
          // Sipariş bulunamazsa genel bilgilendirme modalı göster
          showModal('İptal Onayı', data.message || `#${data.orderId} numaralı sipariş için iptal onayı isteniyor.`, 'info');
        }
      });

      // Müşteri siparişi iptal ettiğinde (backend'ten gelen event)
      socketService.on('order_cancelled_by_customer', (data: { orderId: number, message?: string }) => {
        console.log('🔔 ORDER CANCELLED BY CUSTOMER BİLDİRİMİ ALINDI:');
        console.log('🆔 İptal Edilen Sipariş ID:', data.orderId);
        console.log('💬 Mesaj:', data.message);
        
        // İptal edilen siparişi listeden kaldır
        setCustomers(prev => {
          const filtered = (prev || []).filter(customer => customer.id !== data.orderId);
          console.log('❌ Sipariş listeden kaldırıldı (müşteri iptal etti):', data.orderId);
          console.log('📊 Kalan sipariş sayısı:', filtered.length);
          return filtered;
        });
        
        // İptal edilen sipariş bilgilerini al ve modal göster
        const cancelledOrder = customers?.find(customer => customer.id === data.orderId);
        if (cancelledOrder) {
          setCancellationData({
            orderId: data.orderId,
            message: data.message || 'Müşteri siparişi iptal etti',
            customerName: cancelledOrder.name,
            pickupAddress: cancelledOrder.pickup_location,
            destinationAddress: cancelledOrder.destination
          });
          setShowCancellationModal(true);
        }
        
        // Eğer iptal edilen sipariş aktif sipariş ise, sürücüyü ana ekrana getir
        if (activeOrder && activeOrder.id === data.orderId) {
          setActiveOrder(null);
          setCurrentPhase(null);
          setRouteCoordinates([]);
          setRouteDuration(null);
          console.log('🏠 Aktif sipariş iptal edildi (müşteri iptal etti), sürücü idle durumuna getirildi');
        }

        // İnceleme modalı açıksa ve iptal edilen sipariş bu sipariş ise modalı kapat
        if (selectedOrder && selectedOrder.id === data.orderId) {
          console.log('🚪 İnceleme modalı kapatılıyor - sipariş müşteri tarafından iptal edildi:', data.orderId);
          setShowInspectionModal(false);
          setSelectedOrder(null);
          setOrderDetails(null);
        }

        // İnceleme listesinden de kaldır
        setInspectingOrders(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.orderId);
          console.log('🗑️ İptal edilen sipariş inspectingOrders listesinden çıkarıldı (müşteri iptal etti):', data.orderId);
          return newSet;
        });

        // Kullanıcıya bilgi mesajı göster
        showModal('Sipariş İptal Edildi', data.message || 'Müşteri siparişi iptal etti.', 'info');
      });
      
      // Müşteri siparişi onayladığında
      socketService.on('order_confirmed_by_customer', (data: { orderId: number, customerInfo: any }) => {
        console.log('🔔 ORDER CONFIRMED BİLDİRİMİ ALINDI:');
        console.log('📋 Onay Verisi:', JSON.stringify(data, null, 2));
        console.log('🆔 Onaylanan Sipariş ID:', data.orderId);
        console.log('👤 Müşteri Bilgisi:', data.customerInfo);
        
        // Sipariş durumunu güncelle (listeden kaldırma)
        setCustomers(prev => {
          const currentCustomers = Array.isArray(prev) ? prev : [];
          const updated = currentCustomers.map(customer => {
            if (customer.id === data.orderId) {
              console.log('✅ Sipariş durumu güncellendi (müşteri onayladı):', customer.id);
              return { ...customer, status: 'confirmed' as Customer['status'] };
            }
            return customer;
          });
          return updated;
        });
        
        // Müşteri onayı geldiğinde aktif siparişi başlat
        startActiveOrderAfterCustomerApproval(data.orderId);
        
        // Başarı mesajı göster
        showModal('Müşteri Onayı Alındı', 'Müşteri fiyatı onayladı. Yük alma noktasına gitmeye başlayabilirsiniz.', 'success');
      });
      
      // Müşteri siparişi reddetti
      socketService.on('order_rejected_by_customer', (data: { orderId: number, reason?: string }) => {
        console.log('🔔 ORDER REJECTED BİLDİRİMİ ALINDI:');
        console.log('📋 Red Verisi:', JSON.stringify(data, null, 2));
        console.log('🆔 Reddedilen Sipariş ID:', data.orderId);
        console.log('❌ Red Sebebi:', data.reason || 'Belirtilmemiş');
        
        // Sipariş durumunu güncelle (listeden kaldırma)
        setCustomers(prev => {
          const currentCustomers = Array.isArray(prev) ? prev : [];
          const updated = currentCustomers.map(customer => {
            if (customer.id === data.orderId) {
              console.log('❌ Sipariş durumu güncellendi (müşteri reddetti):', customer.id);
              return { ...customer, status: 'rejected' as Customer['status'] };
            }
            return customer;
          });
          return updated;
        });
        
        // Bilgilendirme mesajı göster
        showModal('Sipariş Reddedildi', 'Müşteri siparişi reddetti.', 'info');
      });

      // Müşteri fiyat onayını kabul etti
      socketService.on('price_accepted_by_customer', (data: { orderId: number, message?: string }) => {
        console.log('🔔 PRICE ACCEPTED BY CUSTOMER BİLDİRİMİ ALINDI:');
        console.log('📋 Fiyat Onayı Verisi:', JSON.stringify(data, null, 2));
        console.log('🆔 Onaylanan Sipariş ID:', data.orderId);
        console.log('💬 Mesaj:', data.message || 'Müşteri fiyatı onayladı');
        
        // Sipariş durumunu güncelle (listeden kaldırma)
        setCustomers(prev => {
          const currentCustomers = Array.isArray(prev) ? prev : [];
          const updated = currentCustomers.map(customer => {
            if (customer.id === data.orderId) {
              console.log('✅ Sipariş durumu güncellendi (fiyat onaylandı):', customer.id);
              return { ...customer, status: 'confirmed' as Customer['status'] };
            }
            return customer;
          });
          return updated;
        });
        
        // İnceleme modalı açıksa kapat
        if (selectedOrder && selectedOrder.id === data.orderId) {
          setShowInspectionModal(false);
          setSelectedOrder(null);
          setOrderDetails(null);
        }
        
        // İnceleme listesinden kaldır
        setInspectingOrders(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.orderId);
          return newSet;
        });
        
        showModal('Fiyat Onayı', 'Müşteri fiyatı onayladı. Yük alma noktasına gitmeye başlayabilirsiniz.', 'success');
      });

      // Müşteri fiyat onayını reddetti
      socketService.on('price_rejected_by_customer', (data: { orderId: number, message?: string }) => {
        console.log('🔔 PRICE REJECTED BY CUSTOMER BİLDİRİMİ ALINDI:');
        console.log('📋 Fiyat Reddi Verisi:', JSON.stringify(data, null, 2));
        console.log('🆔 Reddedilen Sipariş ID:', data.orderId);
        console.log('💬 Mesaj:', data.message || 'Müşteri fiyatı reddetti');
        
        // Sipariş durumunu güncelle (listeden kaldırma)
        setCustomers(prev => {
          const currentCustomers = Array.isArray(prev) ? prev : [];
          const updated = currentCustomers.map(customer => {
            if (customer.id === data.orderId) {
              console.log('❌ Sipariş durumu güncellendi (fiyat reddedildi):', customer.id);
              return { ...customer, status: 'rejected' as Customer['status'] };
            }
            return customer;
          });
          return updated;
        });
        
        // İnceleme modalı açıksa kapat
        if (selectedOrder && selectedOrder.id === data.orderId) {
          setShowInspectionModal(false);
          setSelectedOrder(null);
          setOrderDetails(null);
        }
        
        // İnceleme listesinden kaldır
        setInspectingOrders(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.orderId);
          return newSet;
        });
        
        showModal('Fiyat Reddedildi', 'Müşteri fiyatı reddetti. Sipariş iptal edildi.', 'info');
      });

      // Müşteri fiyat onay süresi doldu
      socketService.on('price_confirmation_timeout', (data: { orderId: number, message?: string }) => {
        console.log('🔔 PRICE CONFIRMATION TIMEOUT BİLDİRİMİ ALINDI:');
        console.log('📋 Zaman Aşımı Verisi:', JSON.stringify(data, null, 2));
        console.log('🆔 Zaman Aşan Sipariş ID:', data.orderId);
        console.log('💬 Mesaj:', data.message || 'Müşteri onay süresi doldu');
        
        // Sipariş durumunu güncelle (listeden kaldırma)
        setCustomers(prev => {
          const currentCustomers = Array.isArray(prev) ? prev : [];
          const updated = currentCustomers.map(customer => {
            if (customer.id === data.orderId) {
              console.log('⏰ Sipariş durumu güncellendi (zaman aşımı):', customer.id);
              return { ...customer, status: 'timeout' as Customer['status'], countdownTime: 0 };
            }
            return customer;
          });
          return updated;
        });
        
        // İnceleme modalı açıksa kapat
        if (selectedOrder && selectedOrder.id === data.orderId) {
          setShowInspectionModal(false);
          setSelectedOrder(null);
          setOrderDetails(null);
        }
        
        // İnceleme listesinden kaldır
        setInspectingOrders(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.orderId);
          return newSet;
        });
        
        showModal('Zaman Aşımı', data.message || 'Müşteri onay süresi doldu. Sipariş tekrar müsait duruma döndü.', 'warning');
      });

      // Fiyat onayı geri sayımı başlatıldığında
      socketService.on('price_confirmation_countdown_started', (data: { orderId: number, timeout: number, message: string, countdownStartTime: number }) => {
        console.log('🔔 PRICE CONFIRMATION COUNTDOWN STARTED BİLDİRİMİ ALINDI:');
        console.log('📋 Geri Sayım Verisi:', JSON.stringify(data, null, 2));
        console.log('🆔 Sipariş ID:', data.orderId);
        console.log('⏰ Zaman Aşımı Süresi:', data.timeout);
        console.log('💬 Mesaj:', data.message);
        console.log('🕐 Geri Sayım Başlangıç Zamanı:', data.countdownStartTime);
        
        // İlgili siparişi customers listesinde güncelle
        setCustomers(prev => {
          const currentCustomers = Array.isArray(prev) ? prev : [];
          const updated = currentCustomers.map(customer => {
            if (customer.id === data.orderId) {
              console.log('🔄 Sipariş geri sayım durumuna geçirildi:', customer.id);
              return { 
                ...customer, 
                status: 'driver_accepted_awaiting_customer' as Customer['status'],
                countdownTime: data.timeout,
                countdownTotal: data.timeout
              };
            }
            return customer;
          });
          return updated;
        });
      });

      // Fiyat onayı geri sayım güncellendiğinde
      socketService.on('price_confirmation_countdown_update', (data: { orderId: number, remainingTime: number, totalTime: number }) => {
        console.log('🔔 PRICE CONFIRMATION COUNTDOWN UPDATE BİLDİRİMİ ALINDI:');
        console.log('📋 Geri Sayım Güncelleme Verisi:', JSON.stringify(data, null, 2));
        console.log('🆔 Sipariş ID:', data.orderId);
        console.log('⏰ Kalan Süre:', data.remainingTime);
        console.log('📊 Toplam Süre:', data.totalTime);
        
        // İlgili siparişi customers listesinde güncelle
        setCustomers(prev => {
          const currentCustomers = Array.isArray(prev) ? prev : [];
          const updated = currentCustomers.map(customer => {
            if (customer.id === data.orderId) {
              console.log('🔄 Sipariş geri sayımı güncellendi:', customer.id, 'Kalan süre:', data.remainingTime);
              return { 
                ...customer, 
                countdownTime: data.remainingTime,
                countdownTotal: data.totalTime
              };
            }
            return customer;
          });
          return updated;
        });
      });

      // Sipariş başarıyla kabul edildiğinde
      socketService.on('order_accepted_success', (data: { orderId: number, message: string }) => {
        console.log('🔔 ORDER ACCEPTED SUCCESS BİLDİRİMİ ALINDI:');
        console.log('🆔 Kabul Edilen Sipariş ID:', data.orderId);
        console.log('💬 Mesaj:', data.message);
        
        // Sipariş durumunu güncelle (listeden kaldırma)
        setCustomers(prev => {
          const currentCustomers = Array.isArray(prev) ? prev : [];
          const updated = currentCustomers.map(customer => {
            if (customer.id === data.orderId) {
              console.log('✅ Sipariş durumu güncellendi (kabul edildi):', customer.id);
              return { ...customer, status: 'accepted' as Customer['status'] };
            }
            return customer;
          });
          return updated;
        });
        
        // İnceleme modalı açıksa kapat
        if (selectedOrder && selectedOrder.id === data.orderId) {
          setShowInspectionModal(false);
          setSelectedOrder(null);
          setOrderDetails(null);
        }
        
        // İnceleme listesinden kaldır
        setInspectingOrders(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.orderId);
          return newSet;
        });
        
        showModal('Başarılı', data.message, 'success');
      });

      // Sipariş kabul edilirken hata oluştuğunda
      socketService.on('order_accept_error', (data: { message: string }) => {
        console.log('🔔 ORDER ACCEPT ERROR BİLDİRİMİ ALINDI:');
        console.log('❌ Hata Mesajı:', data.message);
        
        showModal('Hata', data.message, 'error');
      });
      
      // Server konum güncellemesi istediğinde mevcut konumu gönder
      socketService.on('request_location_update', async () => {
        console.log('🔔 LOCATION UPDATE REQUEST BİLDİRİMİ ALINDI:');
        console.log('📍 Server konum güncellemesi istiyor, mevcut konum gönderiliyor...');
        console.log('🗺️ Mevcut Konum:', currentLocation);
        
        if (currentLocation) {
          socketService.updateLocation({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            heading: 0
          });
          console.log('✅ Mevcut konum sunucuya gönderildi:', currentLocation);
        } else {
          console.log('❌ Konum bilgisi yok, konum alınmaya çalışılıyor...');
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
            console.log('✅ Yeni konum alındı ve sunucuya gönderildi:', newLocation);
          } catch (error) {
            console.error('❌ Konum alınırken hata:', error);
          }
        }
      });
      
      // Sipariş durumu güncellemelerini dinle
      socketService.on('order_status_update', (data: { orderId: number, status: string }) => {
        console.log('🔔 ORDER STATUS UPDATE BİLDİRİMİ ALINDI:');
        console.log('📋 Durum Güncelleme Verisi:', JSON.stringify(data, null, 2));
        console.log('🆔 Sipariş ID:', data.orderId);
        console.log('📊 Yeni Durum:', data.status);
        
        // İlgili siparişi customers listesinde güncelle
        setCustomers(prev => {
          const currentCustomers = Array.isArray(prev) ? prev : [];
          const updated = currentCustomers.map(customer => {
            if (customer.id === data.orderId) {
              console.log('🔄 Sipariş durumu güncellendi:', customer.id, 'Eski:', customer.status, 'Yeni:', data.status);
              
              // Sipariş iptal edildiyse bildirim göster
              if (data.status === 'cancelled') {
                Alert.alert(
                  '📱 Sipariş İptal Edildi',
                  `Sipariş #${data.orderId} müşteri tarafından iptal edildi.`,
                  [{ text: 'Tamam', style: 'default' }]
                );
              }
              
              return { ...customer, status: data.status as Customer['status'] };
            }
            return customer;
          });
          return updated;
        });
        
        // Sipariş tamamlandıysa listeden kaldır
        if (data.status === 'completed' || data.status === 'cancelled') {
          setCustomers(prev => {
            const filtered = (prev || []).filter(customer => customer.id !== data.orderId);
            console.log('✅ Tamamlanan/İptal edilen sipariş listeden kaldırıldı:', data.orderId);
            return filtered;
          });
        }
      });
      
      // Sipariş faz güncellemelerini dinle
      socketService.on('order_phase_update', (data: { orderId: number, currentPhase: 'pickup' | 'delivery', status: string }) => {
        console.log('🔔 ORDER PHASE UPDATE BİLDİRİMİ ALINDI:');
        console.log('📋 Faz Güncelleme Verisi:', JSON.stringify(data, null, 2));
        console.log('🆔 Sipariş ID:', data.orderId);
        console.log('🔄 Yeni Faz:', data.currentPhase);
        console.log('📊 Durum:', data.status);
        
        // Aktif sipariş varsa ve ID eşleşiyorsa faz bilgisini güncelle
        if (activeOrder && activeOrder.id === data.orderId) {
          setCurrentPhase(data.currentPhase);
          console.log('✅ Aktif sipariş fazı güncellendi:', data.currentPhase);
        } else {
          console.log('ℹ️ Faz güncellemesi aktif sipariş için değil veya aktif sipariş yok');
        }
      });
      
      // İnceleme başlatıldığında sipariş detaylarını al
      socketService.on('order_inspection_started', (data: { orderId: number, orderDetails: any }) => {
        console.log('🔔 ORDER INSPECTION STARTED BİLDİRİMİ ALINDI:');
        console.log('📋 İnceleme Başlatma Verisi:', JSON.stringify(data, null, 2));
        console.log('🆔 Sipariş ID:', data.orderId);
        console.log('📄 Sipariş Detayları:', data.orderDetails);
        
        // Sipariş detaylarını set et
        if (data.orderDetails) {
          setOrderDetails(data.orderDetails);
          console.log('📄 Sipariş detayları set edildi');
        }
        
        // İnceleme başladığında inspectingOrders state'ini temizle
        // Çünkü artık sipariş durumu 'inspecting' olacak
        setInspectingOrders(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.orderId);
          console.log('🗑️ İnceleme başladı, inspectingOrders listesinden çıkarıldı:', data.orderId);
          return newSet;
        });
        
        // İlgili siparişi customers listesinde 'inspecting' durumuna güncelle
        setCustomers(prev => {
          const currentCustomers = Array.isArray(prev) ? prev : [];
          
          // Önce mevcut siparişi bul
          const existingOrder = currentCustomers.find(customer => customer.id === data.orderId);
          
          if (existingOrder) {
            console.log('✅ Sipariş customers listesinde bulundu:', data.orderId);
            
            // Siparişi güncelle
            const updated = currentCustomers.map(customer => {
              if (customer.id === data.orderId) {
                console.log('🔍 Sipariş inceleme durumuna geçirildi:', customer.id);
                const updatedOrder = { ...customer, status: 'inspecting' as Customer['status'] };
                
                // Modal için selectedOrder'ı set et
                setSelectedOrder(updatedOrder);
                setShowInspectionModal(true);
                console.log('📱 İnceleme modalı açıldı');
                
                return updatedOrder;
              }
              return customer;
            });
            
            return updated;
          } else {
            console.log('❌ İlgili sipariş customers listesinde bulunamadı:', data.orderId);
            return currentCustomers;
          }
        });
      });
      
      // İnceleme durdurulduğunda sipariş durumunu güncelle
      socketService.on('order_inspection_stopped', (data: { orderId: number, status: string }) => {
        console.log('🔔 ORDER INSPECTION STOPPED BİLDİRİMİ ALINDI:');
        console.log('📋 İnceleme Durdurma Verisi:', JSON.stringify(data, null, 2));
        console.log('🆔 Sipariş ID:', data.orderId);
        console.log('📊 Yeni Durum:', data.status);
        
        // İncelenen siparişler listesinden çıkar
        setInspectingOrders(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.orderId);
          console.log('🗑️ Sipariş inspectingOrders listesinden çıkarıldı:', data.orderId);
          return newSet;
        });
        
        // Eğer şu anda incelenen sipariş bu sipariş ise modalı kapat
        if (selectedOrder && selectedOrder.id === data.orderId) {
          console.log('🚪 İnceleme modalı kapatılıyor - sipariş başka sürücü tarafından alındı:', data.orderId);
          setShowInspectionModal(false);
          setSelectedOrder(null);
          setOrderDetails(null);
        }
        
        // İlgili siparişi customers listesinde backend'ten gelen status'e güncelle
        setCustomers(prev => {
          const currentCustomers = Array.isArray(prev) ? prev : [];
          const updated = currentCustomers.map(customer => {
            if (customer.id === data.orderId) {
              console.log('🔄 İnceleme durduruldu, durum güncellendi:', customer.id, 'Yeni durum:', data.status);
              // Backend'den gelen status değerini direkt kullan
              return { ...customer, status: data.status as Customer['status'] };
            }
            return customer;
          });
          return updated;
        });
      });

      // 🔧 FIX: Sipariş tekrar müsait olduğunda event listener'ı
      socketService.on('order_available_again', (data: { orderId: number }) => {
        console.log('🔔 ORDER AVAILABLE AGAIN BİLDİRİMİ ALINDI:');
        console.log('📋 Tekrar Müsait Olma Verisi:', JSON.stringify(data, null, 2));
        console.log('🆔 Sipariş ID:', data.orderId);
        
        // İlgili siparişi customers listesinde 'waiting' durumuna güncelle
        setCustomers(prev => {
          const currentCustomers = Array.isArray(prev) ? prev : [];
          const updated = currentCustomers.map(customer => {
            if (customer.id === data.orderId) {
              console.log('⏳ Sipariş tekrar bekleme durumuna geçirildi:', customer.id);
              return { ...customer, status: 'waiting' as Customer['status'] };
            }
            return customer;
          });
          return updated;
        });
      });
    }
    
    return () => {
      // Cleanup socket listeners
      socketService.off('connection_error');
      socketService.off('max_reconnect_attempts_reached');
      socketService.off('new_order');
      socketService.off('order_created');
      socketService.off('order_cancelled');
      socketService.off('order_cancelled_by_customer');
      socketService.off('request_location_update');
      socketService.off('order_status_update');
      socketService.off('order_phase_update');
      socketService.off('order_inspection_started');
      socketService.off('order_inspection_stopped');
      socketService.off('order_available_again'); // 🔧 FIX: Cleanup eklendi
      // Cleanup location watch
      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
      }
      // Cleanup navigation service
      navigationService.stopNavigation();
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
            id: order.id || Date.now() + Math.random(),
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
            status: order.order_status,
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
            // Socket üzerinden sipariş kabul et (varsayılan 1 hammal ile)
            socketService.acceptOrderWithLabor(customerId, 1);
          },
        },
      ]
    );
  };

  const inspectOrder = async (order: Customer) => {
    try {
      // Sürücü offline modda iken sipariş incelemesini engelle
      if (!isOnline) {
        showModal('Çevrimdışı Durum', 'Çevrimdışı olduğunuzda sipariş inceleyemezsiniz. Lütfen önce çevrimiçi olun.', 'warning');
        return;
      }
      
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
        console.log('✅ Sipariş detayları API yanıtı:', JSON.stringify(data, null, 2));
        setOrderDetails(data.order);
        // API'den gelen labor_count değerini laborCount state'ine set et
        if (data.order?.labor_count) {
          setLaborCount(data.order.labor_count.toString());
        }
      } else {
        const errorData = await response.json();
        console.error('❌ Sipariş detayları API hatası:', errorData);
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
    
    // Siparişin durumunu pending'e güncelle
    setCustomers(prev => {
      const currentCustomers = Array.isArray(prev) ? prev : [];
      const updated = currentCustomers.map(customer => {
        if (customer.id === orderId) {
          console.log('🔄 İnceleme durduruldu, durum pending\'e güncellendi:', customer.id);
          return { ...customer, status: 'pending' as Customer['status'] };
        }
        return customer;
      });
      return updated;
    });
    
    setShowInspectionModal(false);
    setSelectedOrder(null);
    setOrderDetails(null);
  };

  const acceptOrderWithLabor = (orderId: number, laborCount: number) => {
    // Zaten bekliyorsak tekrar gönderme
    if (isWaitingForCustomerApproval || pendingOrderId) {
      console.log('⚠️ acceptOrderWithLabor: Zaten müşteri onayı bekleniyor, tekrar gönderme engellendi');
      return;
    }
    
    // Socket üzerinden hammaliye ile kabul et
    socketService.acceptOrderWithLabor(orderId, laborCount);
    
    // Müşteri onayı bekleme durumuna geç
    setIsWaitingForCustomerApproval(true);
    setPendingOrderId(orderId);
    
    // Sipariş detaylarını sakla ama aktif siparişi henüz ayarlama
    if (orderDetails) {
      console.log('📍 acceptOrderWithLabor: Sürücü kabul etti, müşteri onayı bekleniyor:', orderId);
      
      // Sipariş detaylarını sakla (sonra kullanılacak)
      setPendingOrderDetails(orderDetails);
    } else {
      console.error('❌ acceptOrderWithLabor: orderDetails null veya undefined');
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
                  latitude: activeOrder.destinationLatitude,
                  longitude: activeOrder.destinationLongitude
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

  // Müşteri onayı geldiğinde aktif siparişi başlat
  const startActiveOrderAfterCustomerApproval = useCallback((orderId: number) => {
    if (pendingOrderDetails && pendingOrderId === orderId) {
      console.log('✅ Müşteri onayı geldi, aktif sipariş başlatılıyor:', orderId);
      
      // Koordinatları kontrol et ve varsayılan değerler kullan
      const pickupLat = pendingOrderDetails.pickupLatitude ?? 41.0082; // Istanbul default
        const pickupLng = pendingOrderDetails.pickupLongitude ?? 28.9784; // Istanbul default
      const deliveryLat = pendingOrderDetails.destination_latitude ?? 41.0082; // Istanbul default
      const deliveryLng = pendingOrderDetails.destination_longitude ?? 28.9784; // Istanbul default
      
      console.log('📍 startActiveOrderAfterCustomerApproval koordinatları:', {
        pickupLat, pickupLng, deliveryLat, deliveryLng,
        originalPickupLat: pendingOrderDetails.pickupLatitude,
          originalPickupLng: pendingOrderDetails.pickupLongitude,
        originalDeliveryLat: pendingOrderDetails.destination_latitude,
        originalDeliveryLng: pendingOrderDetails.destination_longitude
      });
      
      const newActiveOrder: OrderData = {
        id: orderId,
        pickupAddress: pendingOrderDetails.pickup_address || '',
        pickupLatitude: pickupLat,
          pickupLongitude: pickupLng,
          destinationAddress: pendingOrderDetails.destination_address,
          destinationLatitude: deliveryLat,
          destinationLongitude: deliveryLng,
        laborCount: pendingOrderDetails.laborCount || 0,
        estimatedPrice: pendingOrderDetails.estimated_price || 0,
        customerId: pendingOrderDetails.customer_id || 0,
        customerName: pendingOrderDetails.customer_name,
        customerPhone: pendingOrderDetails.customer_phone
      };
      
      setActiveOrder(newActiveOrder);
      setCurrentPhase('pickup');
      setIsWaitingForCustomerApproval(false);
      setPendingOrderId(null);
      setPendingOrderDetails(null);
      
      // Yük alma noktasına rota çiz - currentLocation kontrolü ile
      if (currentLocation && currentLocation.latitude && currentLocation.longitude) {
        getDirectionsRoute(
          currentLocation,
          {
            latitude: pickupLat,
            longitude: pickupLng
          }
        );
      } else {
        // Konum bilinmiyorsa, varsayılan konumu kullan
        const defaultLocation = {
          latitude: 41.0082,
          longitude: 28.9784
        };
        getDirectionsRoute(
          defaultLocation,
          {
            latitude: pickupLat,
            longitude: pickupLng
          }
        );
      }
    } else {
      console.error('❌ startActiveOrderAfterCustomerApproval: pendingOrderDetails yok veya orderId uyuşmuyor');
    }
  }, [pendingOrderDetails, pendingOrderId, currentLocation, getDirectionsRoute]);
  
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

    // Zaten navigasyon başlatılmışsa tekrar başlatma
    if (isNavigating) {
      console.log('Navigasyon zaten aktif, tekrar başlatılmıyor');
      return;
    }

    console.log('🧭 Navigasyon başlatılıyor...', {
      orderId: activeOrder.id,
      currentPhase: currentPhase,
      currentLocation: currentLocation
    });

    setIsNavigating(true);
    
    try {
      let destination;
      let destinationAddress;
      
      if (currentPhase === 'pickup') {
        // Yük alma fazında - yük konumuna git
        destination = {
          latitude: activeOrder.pickupLatitude,
            longitude: activeOrder.pickupLongitude
        };
        destinationAddress = activeOrder.pickupAddress;
      } else {
        // Teslimat fazında - varış noktasına git
        destination = {
          latitude: activeOrder.destinationLatitude,
            longitude: activeOrder.destinationLongitude
        };
        destinationAddress = activeOrder.destinationAddress;
      }
      
      console.log('📍 Hedef:', destination);
      
      // Backend API ile rota hesapla
      let routeCalculated = false;
      
      if (currentPhase) {
        console.log('🗺️ Backend API ile rota hesaplanıyor...');
        const routeResult = await calculateRouteFromAPI(activeOrder.id, currentPhase);
        
        if (routeResult.success && routeResult.route) {
          console.log('✅ Backend rota hesaplandı:', routeResult.route);
          
          // Backend'den gelen rotayı navigation service'e ayarla
          try {
            // Navigation service'e rotayı ayarla (sadece origin ve destination)
            await navigationService.calculateRoute(currentLocation, destination);
            routeCalculated = true;
            console.log('✅ Navigation service rota ayarlandı');
          } catch (calcError) {
            console.error('❌ Navigation service rota ayarlama hatası:', calcError);
          }
        } else {
          console.warn('⚠️ Backend rota hesaplaması başarısız, Google Directions API kullanılıyor');
        }
      }
      
      // Eğer backend rota hesaplamadıysa veya currentPhase null ise Google Directions API kullan
      if (!routeCalculated) {
        console.log('🗺️ Google Directions API ile rota hesaplanıyor...');
        await getDirectionsRoute(currentLocation, destination);
        
        // Google Directions'dan gelen veriyi navigation service'e aktar
        // Bu durumda basit bir rota oluşturalım
        if (routeCoordinates.length > 0) {
          console.log('✅ Google Directions rota alındı, navigation service ayarlanıyor...');
          
          const simpleSteps = [{
            instruction: `${destinationAddress} konumuna gidin`,
            maneuver: 'straight',
            location: destination,
            distance: routeDuration ? routeDuration * 30 : 300 // Yaklaşık mesafe hesabı, null check
          }];
          
          try {
            // Navigation service'e rotayı Google Directions verisiyle ayarla
            // calculateRoute sadece 2-3 parametre alır: origin, destination, waypoints
            // simpleSteps'ı ayrıca ayarlamamız gerekecek
            await navigationService.calculateRoute(currentLocation, destination);
            
            // Navigation service'e manuel adımları ekle
            const currentRoute = navigationService.getCurrentRoute();
            if (currentRoute && simpleSteps.length > 0) {
              currentRoute.steps = simpleSteps.map(step => ({
                instruction: step.instruction,
                distance: `${step.distance}m`,
                duration: Math.round(step.distance / 30), // Yaklaşık süre
                maneuver: step.maneuver,
                location: step.location
              }));
            }
            routeCalculated = true;
            console.log('✅ Navigation service Google rotası ayarlandı');
          } catch (calcError) {
            console.error('❌ Navigation service Google rota ayarlama hatası:', calcError);
          }
        } else {
          console.error('❌ Google Directions rota alınamadı');
        }
      }
      
      // Rota hesaplandıysa navigasyonu başlat
      if (routeCalculated) {
        console.log('🚀 Navigation service başlatılıyor...');
        
        // Navigasyon servisini başlat ve güncellemeleri dinle
        await navigationService.startNavigation(currentLocation, (update: NavigationUpdate) => {
          console.log('📡 Navigation update:', update);
          setNavigationUpdate(update);
        });
        
        // Sunucuya sürücünün navigasyonu başlattığını bildir
        try {
          if (activeOrder?.id) {
            console.log('📣 Emitting driver_started_navigation for order:', activeOrder.id);
            socketService.driverStartedNavigation(activeOrder.id);
          }
        } catch (emitError) {
          console.error('driver_started_navigation emit error:', emitError);
        }
        
        console.log('✅ Navigasyon başarıyla başlatıldı');
      } else {
        throw new Error('Rota hesaplanamadı, navigasyon başlatılamıyor');
      }
      
    } catch (error) {
      console.error('❌ Navigasyon başlatma hatası:', error);
      showModal('Hata', 'Navigasyon başlatılamadı', 'error');
      setIsNavigating(false);
    }
  }, [activeOrder, currentLocation, currentPhase, calculateRouteFromAPI, getDirectionsRoute, showModal, isNavigating, routeCoordinates, routeDuration]);
  
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
            // Navigasyonu durdur
            navigationService.stopNavigation();
            await logout();
            router.replace('/phone-auth');
          },
        },
      ]
    );
  };

  // Navigasyon güncellemelerini işle
  const handleNavigationUpdate = (update: NavigationUpdate) => {
    setNavigationUpdate(update);
    
    // Rota süresini güncelle
    if (update.timeToDestination) {
      setRouteDuration(update.timeToDestination);
    }
    
    // Hedefe ulaşıldı mı kontrol et
    if (update.distanceToDestination && update.distanceToDestination < 50) {
      // 50 metre yaklaşıldı
      console.log('🎯 Hedefe yaklaşıldı:', update.distanceToDestination, 'metre');
    }
  };

  const renderCustomerItem = ({ item }: { item: Customer }) => {
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'pending': return '#FFD700';
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
        case 'pending': return 'Bekliyor';
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
        
        {item.status === 'pending' && (
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

      {/* Navigasyon Durum Göstergesi */}
      {isNavigating && navigationUpdate && (
        <View style={styles.navigationStatusContainer}>
          <View style={styles.navigationStatusContent}>
            <Ionicons name="navigate" size={20} color="#FFFFFF" />
            <View style={styles.navigationStatusText}>
              <Text style={styles.navigationStatusTitle}>
                {navigationUpdate.currentStep?.maneuver || 'Navigasyon devam ediyor'}
              </Text>
              <Text style={styles.navigationStatusSubtitle}>
                Hedefe: {Math.round(navigationUpdate.distanceToDestination)}m • {navigationUpdate.timeToDestination}dk
              </Text>
            </View>
          </View>
        </View>
      )}

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
        onNavigationUpdate={handleNavigationUpdate}
      />

      {/* Aktif Sipariş Kartı - Hide when waiting for customer approval */}
      {activeOrder && currentPhase && !isWaitingForCustomerApproval && (
        <ActiveOrderCard
          activeOrder={activeOrder}
          currentPhase={currentPhase}
          routeDuration={routeDuration || undefined}
          onPickupComplete={handlePickupComplete}
          onDeliveryComplete={handleDeliveryComplete}
        />
      )}

      {/* Navigation Button - Hide when waiting for customer approval */}
      {activeOrder && !isWaitingForCustomerApproval && (
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
        isOnline={isOnline}
        isWaitingForCustomerApproval={isWaitingForCustomerApproval}
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
          isWaitingForCustomerApproval={isWaitingForCustomerApproval}
        />

        {/* Fotoğraf Modal */}
        <PhotoModal
          visible={photoModalVisible}
          photoUrls={photoUrls}
          currentImageIndex={currentImageIndex}
          onClose={closePhotoModal}
          onImageIndexChange={handleImageIndexChange}
        />

        {/* Yeni Sipariş Bildirim Modalı */}
        <NewOrderNotificationModal
          visible={showNewOrderModal}
          onClose={() => setShowNewOrderModal(false)}
          onViewOrder={() => {
            setShowNewOrderModal(false);
            // Yeni sipariş geldiğinde direkt inceleme moduna geç
            if (newOrderData) {
              // newOrderData'yi Customer formatına çevir
              const customerOrder: Customer = {
                id: newOrderData.id || 0,
                name: newOrderData.customerName || newOrderData.customer_first_name + ' ' + newOrderData.customer_last_name,
                phone: newOrderData.customerPhone || '',
                pickup_location: newOrderData.pickupAddress,
                destination: newOrderData.destinationAddress,
                estimated_fare: newOrderData.estimatedPrice || 0,
                distance: String(newOrderData.distance || 0),
                status: 'pending' as Customer['status'],
                created_at: new Date().toISOString()
              };
              inspectOrder(customerOrder);
            }
          }}
          orderData={newOrderData}
        />

        {/* Sipariş İptal Bildirim Modalı */}
        <OrderCancellationModal
          visible={showCancellationModal}
          orderData={cancellationData}
          onClose={() => {
            setShowCancellationModal(false);
            setCancellationData(null);
          }}
        />


      </View>
    );
  }