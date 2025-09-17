import * as React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Dimensions,
  ActivityIndicator,
  Animated,
  PanResponder,
  Alert,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';

// Lazy loaded map component for better performance

import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useCameraPermissions } from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import socketService from '../services/socketService';
import { API_CONFIG } from '../config/api';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchActiveOrders, fetchCancellationFee, createOrder, setCurrentOrder as setReduxCurrentOrder } from '../store/slices/orderSlice';
import { loadVehicleTypes } from '../store/slices/vehicleSlice';
import { checkDriverAvailability } from '../store/slices/driverSlice';
import YukKonumuInput, { YukKonumuInputRef } from '../components/YukKonumuInput';
import VarisNoktasiInput, { VarisNoktasiInputRef } from '../components/VarisNoktasiInput';
import LoadingSplash from '../components/LoadingSplash';
import CancelOrderModal from '../components/CancelOrderModal';
import FreeCancelModal from '../components/FreeCancelModal';
import PendingOrderModal from '../components/PendingOrderModal';
import ImagePickerModal from '../components/ImagePickerModal';
import VehicleTypeModal from '../components/VehicleTypeModal';
import ActiveOrderCard from '../components/ActiveOrderCard';
import NewOrderForm from '../components/NewOrderForm';
import { DriverMarker, PickupMarker, DestinationMarker } from './components/MapMarkers';
import { calculateZoomLevel, animateToRegionWithOffset, animateToShowBothPoints } from './utils/mapUtils';
import { useImagePicker } from './utils/imageUtils';
import { usePriceCalculation } from './utils/priceUtils';
import { styles } from './styles';


interface Driver {
  id: string;
  latitude: number;
  longitude: number;
  heading: number;
  name?: string;
}

interface VehicleType {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  image_url?: string;
  base_price?: number;
}



function HomeScreen() {
  const dispatch = useAppDispatch();
  const { currentOrder: reduxCurrentOrder, loading: orderLoading, error: orderError } = useAppSelector(state => state.order);
  const { vehicleTypes: reduxVehicleTypes, selectedVehicleType: reduxSelectedVehicleType, loading: vehicleLoading } = useAppSelector(state => state.vehicle);
  const { availability: driverAvailability, loading: driverLoading } = useAppSelector(state => state.driver);
  
  // Debug: reduxCurrentOrder değerini izle
  useEffect(() => {
    console.log('🔍 DEBUG - reduxCurrentOrder değişti:', {
      reduxCurrentOrder,
      status: reduxCurrentOrder?.status,
      id: reduxCurrentOrder?.id,
      orderLoading,
      orderError
    });
    
    // Aktif sipariş varsa ve koordinatları mevcutsa rota çiz
    if (reduxCurrentOrder && 
        reduxCurrentOrder.pickupLatitude && reduxCurrentOrder.pickupLongitude && 
        reduxCurrentOrder.destinationLatitude && reduxCurrentOrder.destinationLongitude) {
      
      const origin = {
        latitude: typeof reduxCurrentOrder.pickupLatitude === 'string' ? parseFloat(reduxCurrentOrder.pickupLatitude) : reduxCurrentOrder.pickupLatitude,
        longitude: typeof reduxCurrentOrder.pickupLongitude === 'string' ? parseFloat(reduxCurrentOrder.pickupLongitude) : reduxCurrentOrder.pickupLongitude
      };
      
      const destination = {
        latitude: typeof reduxCurrentOrder.destinationLatitude === 'string' ? parseFloat(reduxCurrentOrder.destinationLatitude) : reduxCurrentOrder.destinationLatitude,
        longitude: typeof reduxCurrentOrder.destinationLongitude === 'string' ? parseFloat(reduxCurrentOrder.destinationLongitude) : reduxCurrentOrder.destinationLongitude
      };
      
      // Aktif sipariş için gerçek yol rotası çiz
      getActiveOrderDirectionsRoute(origin, destination);
    } else {
      // Aktif sipariş yoksa rota koordinatlarını temizle
      setActiveOrderRouteCoordinates([]);
    }
  }, [reduxCurrentOrder, orderLoading, orderError]);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  
  // Aktif sipariş ve sürücü takibi için state'ler
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const currentOrderRef = useRef<any>(null);
  const [assignedDriver, setAssignedDriver] = useState<Driver | null>(null);
  const [isTrackingDriver, setIsTrackingDriver] = useState(false);
  const [driverRoute, setDriverRoute] = useState<{latitude: number, longitude: number}[]>([]);
  const [estimatedArrival, setEstimatedArrival] = useState<string | null>(null);
  
  // Drivers state'inin güvenli olduğundan emin olmak için
  const safeDrivers = useMemo(() => Array.isArray(drivers) ? drivers : [], [drivers]);

  // Debug: drivers state değişimini izle
  useEffect(() => {
    console.log('🗺️ Drivers state changed:', drivers);
    console.log('🗺️ Safe drivers for map:', safeDrivers);
  }, [drivers, safeDrivers]);
  
  // Yük bilgileri state'leri
  const [selectedVehicleType, setSelectedVehicleType] = useState<VehicleType | null>(null);
  // vehicleTypes artık Redux'tan geliyor, local state kaldırıldı
  const [pickupLocation, setPickupLocation] = useState('');
  const [destinationLocation, setDestinationLocation] = useState('');
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [pickupCoords, setPickupCoords] = useState<{latitude: number, longitude: number} | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{latitude: number, longitude: number} | null>(null);
  const [cargoImages, setCargoImages] = useState<string[]>([]);
  const [distance, setDistance] = useState<number | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<{latitude: number, longitude: number}[]>([]);
  const [activeOrderRouteCoordinates, setActiveOrderRouteCoordinates] = useState<{latitude: number, longitude: number}[]>([]);
  
  // Aktif sipariş rotası çizildikten sonra haritayı rotaya odakla
  useEffect(() => {
    if (activeOrderRouteCoordinates.length > 0 && reduxCurrentOrder && mapRef.current) {
      console.log('🗺️ Aktif sipariş rotası çizildi, haritayı rotaya odaklıyorum');
      
      const origin = {
        latitude: typeof reduxCurrentOrder.pickupLatitude === 'string' ? parseFloat(reduxCurrentOrder.pickupLatitude) : reduxCurrentOrder.pickupLatitude,
        longitude: typeof reduxCurrentOrder.pickupLongitude === 'string' ? parseFloat(reduxCurrentOrder.pickupLongitude) : reduxCurrentOrder.pickupLongitude
      };
      
      const destination = {
        latitude: typeof reduxCurrentOrder.destinationLatitude === 'string' ? parseFloat(reduxCurrentOrder.destinationLatitude) : reduxCurrentOrder.destinationLatitude,
        longitude: typeof reduxCurrentOrder.destinationLongitude === 'string' ? parseFloat(reduxCurrentOrder.destinationLongitude) : reduxCurrentOrder.destinationLongitude
      };
      
      // Haritayı rotaya odakla
      animateToShowBothPoints(mapRef, bottomSheetHeight, origin, destination);
    }
  }, [activeOrderRouteCoordinates, reduxCurrentOrder, animateToShowBothPoints]);
  const [routeDuration, setRouteDuration] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [activeInputIndex, setActiveInputIndex] = useState<number | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  
  // Seçilen konum bilgilerini göstermek için modal state'i
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [selectedLocationInfo, setSelectedLocationInfo] = useState<{
    address: string;
    coordinates: { latitude: number; longitude: number };
    type: 'pickup' | 'destination';
  } | null>(null);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const pickupLocationRef = useRef<YukKonumuInputRef>(null);
  const destinationLocationRef = useRef<VarisNoktasiInputRef>(null);
  const mapRef = useRef<any>(null);
  
  const { logout, showModal, user, token, refreshAuthToken } = useAuth();

  // currentOrder değiştiğinde ref'i güncelle
  useEffect(() => {
    currentOrderRef.current = currentOrder;
  }, [currentOrder]);

  // Sipariş durumu metni için yardımcı fonksiyon
  const getOrderStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Beklemede';
      case 'driver_accepted_awaiting_customer': return 'Sürücü Kabul Etti - Onayınızı Bekliyor';
      case 'confirmed': return 'Onaylandı';
      case 'driver_going_to_pickup': return 'Sürücü Yola Çıktı';
      case 'pickup_completed': return 'Yük Alındı';
      case 'in_transit': return 'Yolda';
      case 'delivered': return 'Teslim Edildi';
      case 'payment_completed': return 'Ödeme Tamamlandı';
      case 'accepted': return 'Kabul Edildi';
      case 'started': return 'Başladı';
      case 'completed': return 'Tamamlandı';
      case 'cancelled': return 'İptal Edildi';
      case 'inspecting': return 'Siparişiniz İnceleniyor';
      default: return status || 'Bilinmiyor';
    }
  };

  // Confirm code modal için state

  const [confirmCode, setConfirmCode] = useState('');
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [userConfirmCode, setUserConfirmCode] = useState('');
  
  // Free cancel modal için state
  const [freeCancelModalVisible, setFreeCancelModalVisible] = useState(false);
  const [freeCancelConfirmCode, setFreeCancelConfirmCode] = useState('');
  
  // Vehicle type modal için state
  const [showVehicleTypeModal, setShowVehicleTypeModal] = useState(false);
  
  // BottomSheet için state'ler
  const screenHeight = Dimensions.get('window').height;
  const minBottomSheetHeight = screenHeight * 0.3; // Minimum %30
  const maxBottomSheetHeight = screenHeight * 0.8; // Maximum %80
  const [bottomSheetHeight] = useState(new Animated.Value(screenHeight * 0.6)); // Başlangıç %60
  const [isDragging, setIsDragging] = useState(false);
  
  // Kullanıcının manuel harita etkileşimini takip etmek için
  const [userInteractedWithMap, setUserInteractedWithMap] = useState(false);
  const [lastRouteUpdate, setLastRouteUpdate] = useState<number>(0);
  
  // PanResponder for BottomSheet dragging
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dy) > 10;
    },
    onPanResponderGrant: () => {
      setIsDragging(true);
    },
    onPanResponderMove: (evt, gestureState) => {
      const newHeight = screenHeight * 0.6 - gestureState.dy;
      if (newHeight >= minBottomSheetHeight && newHeight <= maxBottomSheetHeight) {
        bottomSheetHeight.setValue(newHeight);
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      setIsDragging(false);
      const currentHeight = screenHeight * 0.6 - gestureState.dy;
      
      // Snap to nearest position
      if (currentHeight < screenHeight * 0.4) {
        // Snap to minimum
        Animated.spring(bottomSheetHeight, {
          toValue: minBottomSheetHeight,
          useNativeDriver: true,
        }).start();
      } else if (currentHeight > screenHeight * 0.7) {
        // Snap to maximum
        Animated.spring(bottomSheetHeight, {
          toValue: maxBottomSheetHeight,
          useNativeDriver: true,
        }).start();
      } else {
        // Snap to middle
        Animated.spring(bottomSheetHeight, {
          toValue: screenHeight * 0.6,
          useNativeDriver: true,
        }).start();
      }
    },
  });

  // Cancel order modal için state
  const [cancelOrderModalVisible, setCancelOrderModalVisible] = useState(false);

  // Modal state değişikliklerini takip et
  useEffect(() => {
    console.log('🔵 cancelOrderModalVisible değişti:', cancelOrderModalVisible);
    if (cancelOrderModalVisible) {
      // Modal açıldığında ilk input'a focus yap
      setTimeout(() => {
        confirmCodeInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [cancelOrderModalVisible]);
  const [cancelConfirmCode, setCancelConfirmCode] = useState('');
  const [userCancelCode, setUserCancelCode] = useState('');
  const [cancellationFee, setCancellationFee] = useState(0);
  const [cancelOrderId, setCancelOrderId] = useState<number | null>(null);
  
  // Confirm code inputları için state
  const [confirmCodeInputs, setConfirmCodeInputs] = useState(['', '', '', '']);
  const confirmCodeInputRefs = useRef<TextInput[]>([]);
  
  // Cancel confirmation modal için state


  // Devam eden sipariş modalı için state
  const [pendingOrderModalVisible, setPendingOrderModalVisible] = useState(false);

  // Fiyat hesaplama için state'ler
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  // Form görünürlüğünü kontrol eden state
  // showOrderForm state kaldırıldı - form her zaman görünür

  // Form alanlarının düzenlenebilirlik durumunu kontrol eden fonksiyon
  const isFormEditable = useCallback(() => {
    // Eğer aktif bir sipariş varsa (beklemede, kabul edilmiş, onaylanmış, başlamış, inceleniyor durumda)
    // form alanları düzenlenemez
    if (currentOrder) {
      const nonEditableStatuses = ['pending', 'accepted', 'confirmed', 'in_progress', 'started', 'inspecting'];
      return !nonEditableStatuses.includes(currentOrder.status);
    }
    // Aktif sipariş yoksa form düzenlenebilir
    return true;
  }, [currentOrder]);

  // Confirm code modal'ını göster
  const showConfirmCodeModal = useCallback((orderId: string, code: string) => {
    setCurrentOrderId(orderId);
    setConfirmCode(code);
    setCancelOrderModalVisible(true);
  }, []);

  // Doğrulama kodunu kontrol et
  const handleConfirmCode = useCallback(() => {
    if (!currentOrderId || !userConfirmCode) {
      showModal('Hata', 'Lütfen doğrulama kodunu girin.', 'error');
      return;
    }

    // Socket üzerinden confirm code doğrulama gönder
    const success = socketService.verifyConfirmCode(parseInt(currentOrderId), userConfirmCode);
    
    if (!success) {
      showModal('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
    }
  }, [userConfirmCode, currentOrderId, showModal]);

  // Sipariş iptal etme modalını göster
  const showCancelOrderModal = useCallback((orderId: number, code: string, fee: number) => {
    setCancelOrderId(orderId);
    setCancelConfirmCode(code);
    setCancellationFee(fee);
    setCancelOrderModalVisible(true);
  }, []);



  // Sipariş iptal etme işlemi
  const handleCancelOrder = useCallback(() => {
    if (!cancelOrderId || !userCancelCode) {
      showModal('Hata', 'Lütfen doğrulama kodunu girin.', 'error');
      return;
    }

    // Kullanıcının girdiği kod ile backend'den gelen kodu karşılaştır
    if (userCancelCode !== cancelConfirmCode) {
      showModal('Hata', 'Doğrulama kodu yanlış. Lütfen tekrar deneyin.', 'error');
      return;
    }

    // Socket üzerinden cancel order doğrulama gönder
    const success = socketService.cancelOrderWithCode(cancelOrderId, userCancelCode);
    
    if (!success) {
      showModal('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
    }
  }, [userCancelCode, cancelOrderId, cancelConfirmCode, showModal]);

  // Sipariş iptal etme başlatma - cezai şart kontrolü ile birlikte modal göster
  const initiateCancelOrder = useCallback(async () => {
    try {
      // Redux action ile aktif sipariş kontrolü yap
      const result = await dispatch(fetchActiveOrders()).unwrap();
      
      if (result.success && result.data.orders && result.data.orders.length > 0) {
        const activeOrder = result.data.orders[0];
        setCurrentOrder(activeOrder);
        
        // Redux action ile cezai şart kontrolü
        try {
          const feeResult = await dispatch(fetchCancellationFee()).unwrap();
          let cancellationFee = 0;
          if (feeResult.success && feeResult.data) {
            cancellationFee = feeResult.data.cancellationFee || 0;
          }
            
          if (cancellationFee > 0) {
            // Cezai şart varsa ödeme modalı göster
            showModal(
              '⚠️ Cezai Şart Var', 
              `Sipariş durumunuz nedeniyle ${cancellationFee} TL cezai şart uygulanacaktır.\n\nİptal etmek istediğinizden emin misiniz?`,
              'warning',
              [
                {
                  text: 'Vazgeç',
                  style: 'cancel'
                },
                {
                   text: 'Evet, İptal Et',
                   onPress: () => {
                     // Kullanıcı cezai şartı kabul etti, confirm code üret
                     console.log('🔴 Kullanıcı cezai şartı kabul etti, confirm code üretimi için cancelOrder çağrılıyor...');
                     console.log('🔗 Socket bağlantı durumu:', socketService.getConnectionStatus());
                     console.log('📋 Current Order ID:', activeOrder.id);
                     const success = socketService.cancelOrder(activeOrder.id);
                     console.log('✅ cancelOrder çağrısı sonucu:', success);
                     if (!success) {
                       showModal('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
                     }
                     // Backend'den cancel_order_confirmation_required eventi geldiğinde confirm code modalı açılacak
                   }
                 }
              ]
            );
          } else {
            // Cezai şart yoksa da modal göster
            showModal(
              '✅ Cezai Şart Yok', 
              'Sipariş durumunuz nedeniyle herhangi bir cezai şart uygulanmayacaktır.\n\nİptal etmek istediğinizden emin misiniz?',
              'warning',
              [
                {
                  text: 'Vazgeç',
                  style: 'cancel'
                },
                {
                   text: 'Evet, İptal Et',
                   onPress: () => {
                     // Cezai şart yok, backend'e cancel_order gönder (confirm code üretimi için)
                     console.log('🔴 Cezai şart yok, backend\'e cancel_order gönderiliyor...');
                     socketService.cancelOrder(activeOrder.id);
                   }
                 }
              ]
            );
          }
        } catch (feeError) {
          console.error('Fee check error:', feeError);
          // Hata durumunda da modal göster
          showModal(
            '❓ Cezai Şart Durumu Belirsiz', 
            'Cezai şart durumu kontrol edilemedi. Yine de iptal etmek istediğinizden emin misiniz?',
            'warning',
            [
              {
                text: 'Vazgeç',
                style: 'cancel'
              },
              {
                 text: 'Evet, İptal Et',
                 onPress: () => {
                   // Hata durumunda da confirm code üret
                   console.log('🔴 Fee check hatası, confirm code üretimi için cancelOrder çağrılıyor...');
                   const success = socketService.cancelOrder(activeOrder.id);
                   if (!success) {
                     showModal('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
                   }
                 }
               }
            ]
          );
        }
      } else {
        showModal('Hata', 'Aktif sipariş bulunamadı.', 'error');
      }
    } catch (error) {
      console.error('Cancel order error:', error);
      showModal('Hata', 'Sipariş iptal edilirken bir hata oluştu.', 'error');
    }
  }, [dispatch, showModal]);

  // Sipariş verilerini form alanlarına dolduran fonksiyon
   const fillOrderData = useCallback(async (order: any) => {
    try {
      console.log('=== fillOrderData BAŞLADI ===');
      console.log('Gelen order parametresi:', JSON.stringify(order, null, 2));
      
      console.log('pickup_address set ediliyor:', order.pickup_address);
      setPickupLocation(order.pickup_address);
      
      console.log('destination_address set ediliyor:', order.destination_address);
      setDestinationLocation(order.destination_address);
      
      // Araç tipi bilgisini ayarla (eğer varsa)
      if (order.vehicle_type_id && reduxVehicleTypes.length > 0) {
          const vehicleType = reduxVehicleTypes.find((type: any) => type.id === order.vehicle_type_id);
        setSelectedVehicleType(vehicleType || null);
      } else {
        setSelectedVehicleType(null);
      }
      
      console.log('customer_notes set ediliyor:', order.customer_notes);
      setNotes(order.customer_notes || '');
      
      // Yük fotoğrafını set et
      console.log('🖼️ Sipariş cargo_photo_urls:', order.cargo_photo_urls);
      if (order.cargo_photo_urls) {
        try {
          const parsedImages = JSON.parse(order.cargo_photo_urls);
          console.log('🖼️ Parse edilmiş cargo images:', parsedImages);
          // Array olup olmadığını kontrol et
          if (Array.isArray(parsedImages)) {
            // Base URL'i ekle
            const fullUrls = parsedImages.map(url => {
              if (url.startsWith('/uploads/')) {
                const fullUrl = `${API_CONFIG.BASE_URL}${url}`;
                console.log('🔗 Full URL oluşturuldu:', fullUrl);
                return fullUrl;
              }
              console.log('🔗 URL zaten tam:', url);
              return url;
            });
            console.log('🖼️ Final URLs with base:', fullUrls);
            setCargoImages(fullUrls);
          } else {
            console.log('❌ Parse edilmiş veri array değil:', typeof parsedImages);
            setCargoImages([]);
          }
        } catch (error) {
          console.log('❌ JSON parse hatası:', error);
          console.log('❌ Ham cargo_photo_urls verisi:', order.cargo_photo_urls);
          // Eğer JSON parse başarısız olursa, string olarak tek bir URL olabilir
          if (typeof order.cargo_photo_urls === 'string' && order.cargo_photo_urls.trim()) {
            const fullUrl = order.cargo_photo_urls.startsWith('/uploads/') 
              ? `${API_CONFIG.BASE_URL}${order.cargo_photo_urls}`
              : order.cargo_photo_urls;
            console.log('🔗 Tek URL için full URL:', fullUrl);
            setCargoImages([fullUrl]);
          } else {
            setCargoImages([]);
          }
        }
      } else {
        console.log('❌ cargo_photo_urls boş veya null');
        setCargoImages([]);
      }
      
      // Input componentlerine adres bilgilerini set et - bir sonraki render cycle'da
      setTimeout(() => {
        console.log('setTimeout içinde pickupLocationRef.current:', pickupLocationRef.current);
        if (pickupLocationRef.current && order.pickup_address) {
          console.log('pickupLocationRef setAddressText çağrılıyor:', order.pickup_address);
          pickupLocationRef.current.setAddressText(order.pickup_address);
        } else {
          console.log('pickupLocationRef set edilemedi - ref:', !!pickupLocationRef.current, 'address:', order.pickup_address);
        }
        
        console.log('setTimeout içinde destinationLocationRef.current:', destinationLocationRef.current);
        if (destinationLocationRef.current && order.destination_address) {
          console.log('destinationLocationRef setAddressText çağrılıyor:', order.destination_address);
          destinationLocationRef.current.setAddressText(order.destination_address);
        } else {
          console.log('destinationLocationRef set edilemedi - ref:', !!destinationLocationRef.current, 'address:', order.destination_address);
        }
      }, 100);
      
      // Koordinatları set et
      console.log('Pickup koordinatları kontrol ediliyor:', order.pickup_latitude, order.pickup_longitude);
      if (order.pickup_latitude && order.pickup_longitude) {
        console.log('Pickup koordinatları set ediliyor:', { latitude: order.pickup_latitude, longitude: order.pickup_longitude });
        setPickupCoords({
          latitude: order.pickup_latitude,
          longitude: order.pickup_longitude
        });
      } else {
        console.log('Pickup koordinatları eksik!');
      }
      
      console.log('Destination koordinatları kontrol ediliyor:', order.destination_latitude, order.destination_longitude);
      if (order.destination_latitude && order.destination_longitude) {
        console.log('Destination koordinatları set ediliyor:', { latitude: order.destination_latitude, longitude: order.destination_longitude });
        setDestinationCoords({
          latitude: order.destination_latitude,
          longitude: order.destination_longitude
        });
      } else {
        console.log('Destination koordinatları eksik!');
      }
      
      // Redux store'u güncelle - backend formatını Redux formatına çevir
      console.log('Redux store güncelleniyor - setCurrentOrder dispatch ediliyor');
      try {
        const cargoImages = order.cargo_photo_urls ? 
          (typeof order.cargo_photo_urls === 'string' ? JSON.parse(order.cargo_photo_urls) : order.cargo_photo_urls) 
          : [];
        
        const reduxOrder = {
          id: order.id?.toString(),
          pickupAddress: order.pickup_address || '',
          pickupLatitude: order.pickup_latitude || 0,
          pickupLongitude: order.pickup_longitude || 0,
          destinationAddress: order.destination_address || '',
          destinationLatitude: order.destination_latitude || 0,
          destinationLongitude: order.destination_longitude || 0,
          distance: order.distance_km || 0,
          estimatedTime: 0, // Backend'de yok, default değer
          notes: order.customer_notes || '',
          vehicleTypeId: order.vehicle_type_id?.toString(),
          laborRequired: (order.labor_count || 0) > 0,
          laborCount: order.labor_count || 0,
          weight_kg: order.weight_kg || 0,
          cargoImages: cargoImages,
          status: order.status,
          estimatedPrice: order.total_price || 0,
          createdAt: order.created_at,
          driver_id: order.driver?.id?.toString(),
          driver_name: order.driver?.name,
          driver_latitude: order.driver?.latitude,
          driver_longitude: order.driver?.longitude,
          driver_heading: order.driver?.heading,
        };
        
        console.log('Redux order created:', reduxOrder);
        dispatch(setReduxCurrentOrder(reduxOrder));
      } catch (parseError) {
        console.error('Redux order format dönüşüm hatası:', parseError);
        // Hata durumunda en azından temel bilgileri set et
        const basicOrder = {
          id: order.id?.toString(),
          pickupAddress: order.pickup_address || '',
          pickupLatitude: order.pickup_latitude || 0,
          pickupLongitude: order.pickup_longitude || 0,
          destinationAddress: order.destination_address || '',
          destinationLatitude: order.destination_latitude || 0,
          destinationLongitude: order.destination_longitude || 0,
          distance: order.distance_km || 0,
          estimatedTime: 0,
          notes: order.customer_notes || '',
          cargoImages: [],
          status: order.status,
          estimatedPrice: order.total_price || 0,
          createdAt: order.created_at,
        };
        dispatch(setReduxCurrentOrder(basicOrder));
      }
      
      console.log('=== fillOrderData TAMAMLANDI ===');
    } catch (error) {
      console.error('Sipariş verilerini doldurma hatası:', error);
      showModal('Hata', 'Sipariş verileri yüklenirken bir hata oluştu.', 'error');
    }
  }, [reduxVehicleTypes, setPickupLocation, setDestinationLocation, setNotes, setPickupCoords, setDestinationCoords, setCargoImages, setSelectedVehicleType, showModal, dispatch]);

  const checkExistingOrder = useCallback(async () => {
    try {
      // Redux action ile devam eden siparişleri kontrol et
      const result = await dispatch(fetchActiveOrders()).unwrap();
      
      if (result.success && result.data.orders && result.data.orders.length > 0) {
        const activeOrder = result.data.orders[0];
        
        // Devam eden sipariş varsa order'ı set et
        setCurrentOrder(activeOrder);
        
        // Eğer sipariş kabul edilmiş durumda ise sürücü takibini başlat
        if (activeOrder.status === 'accepted' || activeOrder.status === 'confirmed' || activeOrder.status === 'in_progress') {
          if (activeOrder.driver_id) {
            setAssignedDriver({
              id: activeOrder.driver_id,
              latitude: activeOrder.driver_latitude || 0,
              longitude: activeOrder.driver_longitude || 0,
              heading: activeOrder.driver_heading || 0,
              name: activeOrder.driver_name
            });
            setIsTrackingDriver(true);
            
            // ETA bilgisi varsa set et
            if (activeOrder.estimated_arrival) {
              setEstimatedArrival(activeOrder.estimated_arrival);
            }
          }
        }
        
        // Form alanlarını doldur
        await fillOrderData(activeOrder);
      } else {
        // Devam eden sipariş yok, AsyncStorage'ı temizle
        setCurrentOrder(null);
        setAssignedDriver(null);
        setIsTrackingDriver(false);
        setEstimatedArrival(null);
        await AsyncStorage.removeItem('currentOrder');
      }
    } catch (error) {
      console.error('Mevcut sipariş kontrol hatası:', error);
      // Hata durumunda da AsyncStorage'ı temizle
      await AsyncStorage.removeItem('currentOrder');
    }
  }, [dispatch, fillOrderData]);

  // Aktif input alanını scroll etmek için fonksiyon
  const scrollToInput = useCallback((inputIndex: number) => {
    if (scrollViewRef.current && keyboardVisible) {
      const screenHeight = Dimensions.get('window').height;
      const availableHeight = screenHeight - keyboardHeight - 150;
      const inputHeight = 48;
      const labelHeight = 22;
      const marginBottom = 20;
      const switchHeight = 56;
      const titleHeight = 62;
      
      let targetOffset = titleHeight;
      
      if (inputIndex === 0) {
        targetOffset += labelHeight + inputHeight;
      } else if (inputIndex === 1) {
        targetOffset += labelHeight + inputHeight + marginBottom;
        targetOffset += switchHeight + marginBottom;
        targetOffset += labelHeight + inputHeight;
      } else if (inputIndex === 2) {
        targetOffset += labelHeight + inputHeight + marginBottom;
        targetOffset += switchHeight + marginBottom;
        targetOffset += labelHeight + inputHeight + marginBottom;
        targetOffset += labelHeight + inputHeight;
      }
      
      let scrollPosition;
      if (inputIndex === 2) {
        scrollPosition = Math.max(0, targetOffset + 100);
      } else {
        scrollPosition = Math.max(0, targetOffset - (availableHeight * 0.4));
      }
      
      scrollViewRef.current.scrollTo({
        y: scrollPosition,
        animated: true,
      });
    }
  }, [keyboardVisible, keyboardHeight]);

  const getCurrentLocation = useCallback(async (forceUpdate = false) => {
    try {
      setIsLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showModal('Konum İzni', 'Konum izni verilmedi.', 'warning');
        setIsLocationLoading(false);
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      let shouldUpdateSocket = forceUpdate || !userLocation;
      if (userLocation && !shouldUpdateSocket) {
        const distance = calculateDistance(
          userLocation.coords.latitude,
          userLocation.coords.longitude,
          location.coords.latitude,
          location.coords.longitude
        );
        shouldUpdateSocket = distance > 0.05;
      }
      
      setUserLocation(location);
      
      if (shouldUpdateSocket && socketService.isSocketConnected()) {
        socketService.updateCustomerLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
      }
      
      if (useCurrentLocation) {
        const coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        };
        setPickupCoords(coords);
        
        // Reverse geocoding ile gerçek adresi al
        try {
          const reverseGeocode = await Location.reverseGeocodeAsync(coords);
          if (reverseGeocode && reverseGeocode.length > 0) {
            const address = reverseGeocode[0];
            const fullAddress = [
              address.name,
              address.street,
              address.district,
              address.city
            ].filter(Boolean).join(', ');
            
            const finalAddress = fullAddress || 'Mevcut Konumum';
            setPickupLocation(finalAddress);
            
            // Input componentine de adresi set et
            if (pickupLocationRef.current) {
              pickupLocationRef.current.setAddressText(finalAddress);
            }
          } else {
            setPickupLocation('Mevcut Konumum');
          }
        } catch (error) {
          console.error('Reverse geocoding hatası:', error);
          setPickupLocation('Mevcut Konumum');
        }
        
        // Haritayı mevcut konuma animasyon ile götür
        if (mapRef.current) {
          const screenHeight = Dimensions.get('window').height;
          const bottomSheetHeight = screenHeight * 0.6;
          const offsetRatio = (bottomSheetHeight / 2) / screenHeight;
          const latitudeOffset = 0.008 * offsetRatio * 0.8;
          
          mapRef.current.animateToRegion({
            latitude: coords.latitude - latitudeOffset,
            longitude: coords.longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.006,
          }, 1500);
        }
      }
      
      setIsLocationLoading(false);
    } catch (error) {
      console.error('Konum hatası:', error);
      showModal('Konum Hatası', 'Konum bilgisi alınamadı.', 'error');
      setIsLocationLoading(false);
    }
  }, [userLocation, useCurrentLocation, showModal]);

  // Socket bağlantısı için ayrı useEffect
  useEffect(() => {
    if (token) {
      socketService.connect(token);
    }
  }, []);

  // Token hazır olduğunda araç tiplerini yükle
  useEffect(() => {
    if (token) {
      console.log('🔑 Token hazır, araç tipleri yükleniyor...');
      dispatch(loadVehicleTypes());
    }
  }, [token, dispatch]);

  // Component mount ve initialization için useEffect
  useEffect(() => {
    const initializeApp = async () => {
      // Bekleyen kamera sonuçlarını kontrol et
      try {
        console.log('🔍 Bekleyen kamera sonuçları kontrol ediliyor...');
        const pendingResult = await ImagePicker.getPendingResultAsync();
        if (pendingResult && 'assets' in pendingResult && !pendingResult.canceled && pendingResult.assets && pendingResult.assets.length > 0) {
          console.log('📸 Bekleyen kamera sonucu bulundu:', pendingResult);
          const newImages = pendingResult.assets.map((asset: any) => asset.uri);
          setCargoImages(prev => {
            const updated = [...prev, ...newImages];
            console.log('✅ Bekleyen kamera sonucu işlendi:', updated);
            return updated;
          });
        } else {
          console.log('ℹ️ Bekleyen kamera sonucu bulunamadı');
        }
      } catch (error) {
        console.error('❌ Bekleyen kamera sonucu kontrol hatası:', error);
      }
      
      await getCurrentLocation();
    };
    
    initializeApp();
    checkExistingOrder();
    
    socketService.on('connection_error', (data: any) => {
      console.error('Socket bağlantı hatası:', data.error);
      showModal('Bağlantı Hatası', 'Sunucuya bağlanırken bir hata oluştu.', 'error');
    });

    socketService.on('max_reconnect_attempts_reached', () => {
      showModal('Bağlantı Sorunu', 'Sunucuya bağlanılamıyor. Lütfen uygulamayı yeniden başlatın.', 'warning');
    });

    socketService.on('driver_location_update', (data: any) => {
      if (data && data.driverId && data.latitude && data.longitude) {
        // Genel sürücü listesini güncelle
        setDrivers(prevDrivers => {
          const currentDrivers = Array.isArray(prevDrivers) ? prevDrivers : [];
          const updatedDrivers = [...currentDrivers];
          const driverIndex = updatedDrivers.findIndex(d => d && d.id === data.driverId);
          
          if (driverIndex !== -1) {
            updatedDrivers[driverIndex] = {
              ...updatedDrivers[driverIndex],
              latitude: data.latitude,
              longitude: data.longitude,
              heading: data.heading || updatedDrivers[driverIndex].heading || 0,
            };
          } else {
            updatedDrivers.push({
              id: data.driverId,
              latitude: data.latitude,
              longitude: data.longitude,
              heading: data.heading || 0,
            });
          }
          return updatedDrivers;
        });
        
        // Eğer bu bizim atanmış sürücümüzse, özel takip bilgilerini güncelle
        if (isTrackingDriver && assignedDriver && assignedDriver.id === data.driverId) {
          setAssignedDriver(prev => prev ? {
            ...prev,
            latitude: data.latitude,
            longitude: data.longitude,
            heading: data.heading || prev.heading || 0
          } : null);
          
          // ETA güncellemesi varsa kaydet
          if (data.estimatedArrival) {
            setEstimatedArrival(data.estimatedArrival);
          }
          
          // Aşamalı takip sistemi: Sipariş durumuna göre harita odaklaması
          if (!userInteractedWithMap && mapRef.current && currentOrder) {
            // Sipariş durumuna göre farklı takip davranışları
            if (currentOrder.status === 'confirmed' || currentOrder.status === 'in_progress') {
              // Sürücü yük alma noktasına gidiyor - sürücüyü takip et
              mapRef.current.animateToRegion({
                latitude: data.latitude,
                longitude: data.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }, 1000);
            } else if (currentOrder.status === 'started') {
              // Sürücü teslimat fazında - sürücüyü takip et ama daha geniş görüş
              mapRef.current.animateToRegion({
                latitude: data.latitude,
                longitude: data.longitude,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
              }, 1000);
            }
          }
          
          // Sürücü konumunu AsyncStorage'a kaydet (offline durumlar için)
          if (currentOrder) {
            AsyncStorage.setItem('driver_location', JSON.stringify({
              latitude: data.latitude,
              longitude: data.longitude,
              heading: data.heading || 0,
              timestamp: Date.now()
            }));
          }
        }
      }
    });
    
    socketService.on('nearbyDriversUpdate', (data: any) => {
      console.log('📍 nearbyDriversUpdate event received:', data);
      try {
        if (!data) {
          console.log('📍 No data received, setting empty drivers');
          setDrivers([]);
          return;
        }
        
        if (!data.drivers || !Array.isArray(data.drivers)) {
          setDrivers([]);
          return;
        }
        
        const validDrivers = data.drivers.filter((driver: any) => {
          return driver && 
                 typeof driver === 'object' && 
                 driver.id && 
                 typeof driver.latitude === 'number' && 
                 typeof driver.longitude === 'number';
        });
        
        console.log('📍 Setting drivers:', validDrivers);
        setDrivers(validDrivers);
      } catch (error) {
        console.error('nearbyDriversUpdate işleme hatası:', error);
        setDrivers([]);
      }
    });
    
    socketService.on('driver_disconnected', (data: any) => {
      if (data && data.driverId) {
        setDrivers(prevDrivers => {
          const currentDrivers = Array.isArray(prevDrivers) ? prevDrivers : [];
          return currentDrivers.filter(driver => driver && driver.id !== data.driverId);
        });
      }
    });
    
    socketService.on('order_accepted', (data: any) => {
      // Hammaliye bilgisi ile yeniden hesaplanmış sipariş bilgisini göster
      const { driver, estimatedArrival, updatedPrice, laborCost, orderId } = data;
      const message = `Siparişiniz ${driver.name} tarafından kabul edildi.\n\nSürücü Bilgileri:\n${driver.vehicle}\nTahmini Varış: ${estimatedArrival} dakika\n\nGüncellenmiş Fiyat:\nTaşıma Ücreti: ${updatedPrice - laborCost} TL\nHammaliye: ${laborCost} TL\nToplam: ${updatedPrice} TL\n\nOnaylıyor musunuz?`;
      
      showModal(
        'Sipariş Kabul Edildi',
        message,
        'warning',
        [
          {
            text: 'İptal',
            style: 'cancel',
            onPress: () => {
               // Sipariş iptal edildi socket event'i gönder
               socketService.rejectOrder(orderId);
             }
          },
          {
            text: 'Onayla',
            onPress: () => {
               // Müşteri onayladı, socket room oluştur ve sürücü takibini başlat
               socketService.confirmOrder(orderId);
               
               // Sipariş ve sürücü bilgilerini kaydet
               setCurrentOrder({ ...data, id: orderId });
               setAssignedDriver({
                 id: driver.id,
                 latitude: driver.latitude || 0,
                 longitude: driver.longitude || 0,
                 heading: driver.heading || 0,
                 name: driver.name
               });
               setIsTrackingDriver(true);
               setEstimatedArrival(estimatedArrival);
               
               // AsyncStorage'a kaydet
               AsyncStorage.setItem('currentOrder', JSON.stringify({ ...data, id: orderId }));
               
               showModal('Sipariş Onaylandı', 'Sürücünüz yola çıkıyor. Canlı takip başlatılıyor.', 'success');
             }
          }
        ]
      );
    });
    
    socketService.on('order_status_update', (data: any) => {
      console.log('📊 MÜŞTERI: Sipariş durumu güncellendi:', data);
      console.log('📊 MÜŞTERI: Mevcut sipariş:', currentOrderRef.current);
      console.log('📊 MÜŞTERI: Event alındı - Order ID:', data.orderId, 'Status:', data.status);
      console.log('📊 MÜŞTERI: Socket bağlantı durumu:', socketService.isSocketConnected());
      
      // Mevcut siparişi güncelle
      if (currentOrderRef.current && currentOrderRef.current.id === data.orderId) {
        console.log(`📊 MÜŞTERI: Sipariş durumu ${currentOrderRef.current.status} -> ${data.status}`);
        const updatedOrder = { ...currentOrderRef.current, status: data.status };
        setCurrentOrder(updatedOrder);
        currentOrderRef.current = updatedOrder;
        AsyncStorage.setItem('currentOrder', JSON.stringify(updatedOrder));
      } else {
        console.log('📊 MÜŞTERI: Sipariş ID eşleşmiyor veya mevcut sipariş yok');
      }
      
      let message = '';
      switch (data.status) {
        case 'inspecting':
          message = 'Siparişiniz bir sürücü tarafından inceleniyor.';
          showModal('Sipariş İnceleniyor', message, 'info');
          break;
        case 'started':
          message = 'Sürücü yükünüzü aldı ve varış noktasına doğru yola çıktı.';
          showModal('Yük Alındı', message, 'info');
          
          // Aşamalı takip: Sürücü artık teslimat fazında
          if (!userInteractedWithMap && mapRef.current && assignedDriver) {
            // Harita odaklamasını sürücü konumuna ayarla
            mapRef.current.animateToRegion({
              latitude: assignedDriver.latitude,
              longitude: assignedDriver.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }, 1000);
          }
          break;
        case 'completed':
          message = `Sipariş tamamlandı! Doğrulama kodu: ${data.confirmCode}`;
          showModal(
            'Sipariş Tamamlandı',
            message,
            'success',
            [
              {
                text: 'Doğrula',
                onPress: () => showConfirmCodeModal(data.orderId, data.confirmCode)
              }
            ]
          );
          break;
        case 'cancelled':
          message = 'Sipariş iptal edildi.';
          showModal('Sipariş Durumu', message, 'info');
          setCurrentOrder(null);
          setAssignedDriver(null);
          setIsTrackingDriver(false);
          AsyncStorage.removeItem('currentOrder');
          break;
        default:
          message = `Sipariş durumu güncellendi: ${data.status}`;
          showModal('Sipariş Durumu', message, 'info');
      }
    });
    


    // Confirm code doğrulama sonuçlarını dinle
    socketService.on('confirm_code_verified', (data: any) => {
      console.log('Confirm code verified:', data);
      setCancelOrderModalVisible(false);
      setUserConfirmCode('');
      AsyncStorage.removeItem('currentOrder');
      setCurrentOrder(null);
      showModal('Başarılı', data.message || 'Sipariş başarıyla doğrulandı!', 'success');
    });

    socketService.on('confirm_code_error', (data: any) => {
      console.log('Confirm code error:', data);
      showModal('Hata', data.message || 'Doğrulama kodu yanlış!', 'error');
    });

    // Socket bağlantı durumunu kontrol et ve gerekirse bağlan
    console.log('🔵 Socket bağlantı durumu:', socketService.isSocketConnected());
    console.log('🔵 Socket ID:', socketService.getSocketId());
    
    if (!socketService.isSocketConnected()) {
      console.log('🔵 Socket bağlı değil, bağlanmaya çalışıyor...');
      socketService.connect();
    }
    

    
    // Sipariş iptal etme event'lerini dinle
    socketService.on('cancel_order_confirmation_required', (data: any) => {
      console.log('🔴 Cancel order confirmation required:', data);
      console.log('🔴 Calling showCancelOrderModal with:', {
        orderId: data.orderId,
        confirmCode: data.confirmCode,
        cancellationFee: data.cancellationFee
      });
      showCancelOrderModal(data.orderId, data.confirmCode, data.cancellationFee);
    });
    
    // Socket bağlantı event'lerini dinle
    socketService.on('connected', (data: any) => {
      console.log('🟢 Socket bağlandı:', data);
    });
    
    socketService.on('disconnected', (data: any) => {
      console.log('🔴 Socket bağlantısı kesildi:', data);
    });
    
    socketService.on('connection_error', (data: any) => {
      console.log('🔴 Socket bağlantı hatası:', data);
    });

    socketService.on('order_cancelled_successfully', (data: any) => {
      console.log('🔴 Order cancelled successfully:', data);
      console.log('🔴 pickupLocationRef.current:', pickupLocationRef.current);
      console.log('🔴 destinationLocationRef.current:', destinationLocationRef.current);
      
      setCancelOrderModalVisible(false);
      setUserCancelCode('');
      setCurrentOrder(null);
      setCurrentOrderId(null);
      AsyncStorage.removeItem('currentOrder');
      
      // Form alanlarını sıfırla
      setPickupLocation('');
      setDestinationLocation('');
      setPickupCoords(null);
      setDestinationCoords(null);
      setNotes('');
      setCargoImages([]);
      setDistance(null);
      setRouteDuration(null);
      setRouteCoordinates([]);
      
      // Input referanslarını temizle
      if (pickupLocationRef.current) {
        console.log('🔴 Calling pickupLocationRef.current.clear()');
        pickupLocationRef.current.clear();
      } else {
        console.log('🔴 pickupLocationRef.current is null!');
      }
      if (destinationLocationRef.current) {
        console.log('🔴 Calling destinationLocationRef.current.clear()');
        destinationLocationRef.current.clear();
      } else {
        console.log('🔴 destinationLocationRef.current is null!');
      }
      
      showModal('Sipariş İptal Edildi', data.message || 'Sipariş başarıyla iptal edildi!', 'success');
    });

    socketService.on('cancel_order_error', (data: any) => {
      console.log('Cancel order error:', data);
      showModal('Hata', data.message || 'Sipariş iptal edilirken bir hata oluştu!', 'error');
    });

    // order_created eventi kaldırıldı - müşteri zaten kendi siparişini oluşturuyor

    socketService.on('order_taken', (data: any) => {
      console.log('📦 MÜŞTERI: Sipariş başka sürücü tarafından alındı:', data);
      showModal('Sipariş Alındı', 'Siparişiniz başka bir sürücü tarafından alındı.', 'info');
    });

    socketService.on('order_locked_for_inspection', (data: any) => {
      console.log('🔒 MÜŞTERI: Sipariş inceleme için kilitlendi:', data);
      showModal('Sipariş İnceleniyor', 'Siparişiniz bir sürücü tarafından inceleniyor.', 'info');
    });

    socketService.on('order_already_taken', (data: any) => {
      console.log('⚠️ MÜŞTERI: Sipariş zaten alınmış:', data);
      showModal('Sipariş Alınmış', 'Bu sipariş zaten başka bir sürücü tarafından alınmış.', 'warning');
    });

    socketService.on('order_acceptance_confirmed', (data: any) => {
      console.log('✅ MÜŞTERI: Sipariş kabulü onaylandı:', data);
      showModal('Sipariş Onaylandı', 'Siparişiniz sürücü tarafından onaylandı.', 'success');
    });

    socketService.on('order_phase_update', (data: any) => {
      console.log('🔄 MÜŞTERI: Sipariş faz güncellemesi:', data);
      if (data.currentPhase === 'pickup') {
        showModal('Sürücü Yolda', 'Sürücü yük alma noktasına doğru yola çıktı.', 'info');
      } else if (data.currentPhase === 'delivery') {
        showModal('Yük Alındı', 'Yük alındı, şimdi varış noktasına gidiliyor.', 'info');
      }
    });

    socketService.on('order_inspection_started', (data: any) => {
      console.log('🔍 MÜŞTERI: Sipariş incelemesi başladı:', data);
      showModal('İnceleme Başladı', 'Sürücü siparişinizi inceliyor.', 'info');
    });

    socketService.on('order_inspection_stopped', (data: any) => {
      console.log('🔍 MÜŞTERI: Sipariş incelemesi durdu:', data);
      showModal('İnceleme Tamamlandı', 'Sipariş incelemesi tamamlandı, tekrar beklemede.', 'info');
    });
    
    socketService.on('driver_offline', (data: any) => {
      if (data && data.driverId) {
        setDrivers(prevDrivers => {
          const currentDrivers = Array.isArray(prevDrivers) ? prevDrivers : [];
          return currentDrivers.filter(driver => driver && driver.id !== data.driverId);
        });
      }
    });

    socketService.on('driver_went_offline', (data: any) => {
      console.log('🔴 Driver went offline voluntarily:', data);
      if (data && data.driverId) {
        setDrivers(prevDrivers => {
          const currentDrivers = Array.isArray(prevDrivers) ? prevDrivers : [];
          return currentDrivers.filter(driver => driver && driver.id !== data.driverId);
        });
      }
    });
    

    
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates.height);
      
      if (activeInputIndex !== null) {
        setTimeout(() => {
          scrollToInput(activeInputIndex);
        }, 100);
      }
    });
    
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      setActiveInputIndex(null);
    });
    
    return () => {
      socketService.off('connection_error');
      socketService.off('max_reconnect_attempts_reached');
      socketService.off('driver_location_update');
      socketService.off('nearbyDriversUpdate');
      socketService.off('driver_disconnected');
      socketService.off('order_accepted');
      socketService.off('order_status_update');
      socketService.off('confirm_code_verified');
      socketService.off('confirm_code_error');
      socketService.off('cancel_order_confirmation_required');
      socketService.off('order_cancelled_successfully');
      socketService.off('cancel_order_error');
      socketService.off('driver_offline');
      socketService.off('driver_went_offline');
      socketService.off('order_being_inspected');
      socketService.off('order_created');
      socketService.off('order_taken');
      socketService.off('order_locked_for_inspection');
      socketService.off('order_inspection_started');
      socketService.off('order_inspection_stopped');
      socketService.off('order_already_taken');
      socketService.off('order_acceptance_confirmed');
      socketService.off('order_phase_update');
      socketService.off('order_inspection_started');
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []); // Component mount olduğunda socket event listener'ları kur
  
  // Progress bar animasyonu için useEffect
  useEffect(() => {
    let animationTimeout: any;
    
    const animateProgress = () => {
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 3000, // Animasyon süresini 3 saniyeye düşür
        useNativeDriver: true,
      }).start(() => {
        // Animasyon tamamlandığında küçük bir gecikme ile tekrar başlat
        animationTimeout = setTimeout(() => {
          animateProgress();
        }, 100);
      });
    };
    
    if (currentOrder && currentOrder.id) {
      animateProgress();
    }
    
    return () => {
      if (animationTimeout) {
        clearTimeout(animationTimeout);
      }
    };
  }, [currentOrder?.id]); // Sadece order ID değiştiğinde animasyonu yeniden başlat
  
  useEffect(() => {
    if (useCurrentLocation && userLocation) {
      const coords = {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude
      };
      setPickupCoords(coords);
      
      // Reverse geocoding ile gerçek adresi al
      const getAddressFromCoords = async () => {
        try {
          const reverseGeocode = await Location.reverseGeocodeAsync(coords);
          if (reverseGeocode && reverseGeocode.length > 0) {
            const address = reverseGeocode[0];
            const fullAddress = [
              address.name,
              address.street,
              address.district,
              address.city
            ].filter(Boolean).join(', ');
            
            const finalAddress = fullAddress || 'Mevcut Konumum';
            setPickupLocation(finalAddress);
            
            // Input alanını da güncelle
            pickupLocationRef.current?.setAddressText(finalAddress);
          } else {
            setPickupLocation('Mevcut Konumum');
            pickupLocationRef.current?.setAddressText('Mevcut Konumum');
          }
        } catch (error) {
          console.error('Reverse geocoding hatası:', error);
          setPickupLocation('Mevcut Konumum');
          pickupLocationRef.current?.setAddressText('Mevcut Konumum');
        }
      };
      
      getAddressFromCoords();
      
      // Haritayı mevcut konuma animasyon ile götür
      if (mapRef.current) {
        const screenHeight = Dimensions.get('window').height;
        const bottomSheetHeight = screenHeight * 0.6;
        const offsetRatio = (bottomSheetHeight / 2) / screenHeight;
        const latitudeOffset = 0.008 * offsetRatio * 0.8;
        
        mapRef.current.animateToRegion({
          latitude: coords.latitude - latitudeOffset,
          longitude: coords.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.006,
        }, 1500);
      }
    } else if (!useCurrentLocation) {
      setPickupCoords(null);
      setPickupLocation('');
      // Input alanını da temizle
      pickupLocationRef.current?.setAddressText('');
    }
  }, [useCurrentLocation, userLocation]);

  // Ekran her odaklandığında devam eden sipariş kontrolü yap
  useFocusEffect(
    useCallback(() => {
      if (token) {
        checkExistingOrder();
      }
    }, [token, checkExistingOrder])
  );

  // Form her zaman görünür


  
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // Google Directions API ile gerçek araç yolu rotası alma
  const getDirectionsRoute = useCallback(async (origin: {latitude: number, longitude: number}, destination: {latitude: number, longitude: number}) => {
    try {
      const GOOGLE_MAPS_API_KEY = API_CONFIG.GOOGLE_MAPS_API_KEY;
      
      const originStr = `${origin.latitude},${origin.longitude}`;
      const destinationStr = `${destination.latitude},${destination.longitude}`;
      
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destinationStr}&key=${GOOGLE_MAPS_API_KEY}&mode=driving&departure_time=now&traffic_model=best_guess`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        
        // Polyline decode etme fonksiyonu
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
              b = encoded.charCodeAt(index++) - 63;
              result |= (b & 0x1f) << shift;
              shift += 5;
            } while (b >= 0x20);
            const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
            lat += dlat;
            
            shift = 0;
            result = 0;
            do {
              b = encoded.charCodeAt(index++) - 63;
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
        
        const coordinates = decodePolyline(route.overview_polyline.points);
        setRouteCoordinates(coordinates);
        
        // Gerçek mesafe ve süre bilgilerini al
        const realDistance = leg.distance.value / 1000; // metre'den km'ye
        setDistance(realDistance);
        
        // Trafik durumunu da içeren süre bilgisi
        const duration = leg.duration_in_traffic ? leg.duration_in_traffic.text : leg.duration.text;
        setRouteDuration(duration);
        
        return {
          coordinates,
          distance: realDistance,
          duration: duration
        };
      } else {
        console.error('Directions API error:', data.status);
        // Hata durumunda kuş bakışı rotaya geri dön
        setRouteCoordinates([origin, destination]);
        const fallbackDistance = calculateDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
        setDistance(fallbackDistance);
        setRouteDuration(null);
      }
    } catch (error) {
      console.error('Directions API fetch error:', error);
      // Hata durumunda kuş bakışı rotaya geri dön
      setRouteCoordinates([origin, destination]);
      const fallbackDistance = calculateDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
      setDistance(fallbackDistance);
      setRouteDuration(null);
    }
  }, [calculateDistance]);

  // Aktif sipariş için Google Directions API ile gerçek araç yolu rotası alma
  const getActiveOrderDirectionsRoute = useCallback(async (origin: {latitude: number, longitude: number}, destination: {latitude: number, longitude: number}) => {
    try {
      const GOOGLE_MAPS_API_KEY = API_CONFIG.GOOGLE_MAPS_API_KEY;
      
      const originStr = `${origin.latitude},${origin.longitude}`;
      const destinationStr = `${destination.latitude},${destination.longitude}`;
      
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destinationStr}&key=${GOOGLE_MAPS_API_KEY}&mode=driving&departure_time=now&traffic_model=best_guess`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        
        // Polyline decode etme fonksiyonu
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
              b = encoded.charCodeAt(index++) - 63;
              result |= (b & 0x1f) << shift;
              shift += 5;
            } while (b >= 0x20);
            const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
            lat += dlat;
            
            shift = 0;
            result = 0;
            do {
              b = encoded.charCodeAt(index++) - 63;
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
        
        const coordinates = decodePolyline(route.overview_polyline.points);
        setActiveOrderRouteCoordinates(coordinates);
        
        return coordinates;
      } else {
        console.error('Active Order Directions API error:', data.status);
        // Hata durumunda kuş bakışı rotaya geri dön
        setActiveOrderRouteCoordinates([origin, destination]);
        return [origin, destination];
      }
    } catch (error) {
      console.error('Active Order Directions API fetch error:', error);
      // Hata durumunda kuş bakışı rotaya geri dön
      setActiveOrderRouteCoordinates([origin, destination]);
      return [origin, destination];
    }
  }, []);






  
  useEffect(() => {
    if (pickupCoords && destinationCoords && 
        pickupCoords.latitude && pickupCoords.longitude && 
        destinationCoords.latitude && destinationCoords.longitude) {
      const currentTime = Date.now();
      setLastRouteUpdate(currentTime);
      
      // Google Directions API ile gerçek araç yolu rotası al
      getDirectionsRoute(pickupCoords, destinationCoords);
      
      // Kullanıcı manuel olarak haritayı hareket ettirmediyse otomatik ortalama yap
      if (!userInteractedWithMap) {
        // Kısa bir gecikme ile animasyon yap ki kullanıcı etkileşimi algılanabilsin
        setTimeout(() => {
          if (Date.now() - currentTime < 500 && !userInteractedWithMap) {
            animateToShowBothPoints(mapRef, bottomSheetHeight, pickupCoords, destinationCoords);
          }
        }, 100);
      }
    } else {
      setDistance(null);
      setRouteCoordinates([]);
      setRouteDuration(null);
      setUserInteractedWithMap(false); // Reset user interaction when no route
    }
  }, [pickupCoords, destinationCoords, getDirectionsRoute, animateToShowBothPoints, userInteractedWithMap]);
  
  const handleCreateOrder = useCallback(async () => {
    if (!pickupCoords || !destinationCoords || cargoImages.length === 0) {
      showModal('Eksik Bilgi', 'Lütfen tüm alanları doldurun.', 'warning');
      return;
    }
    
    // Redux action ile sürücü müsaitliğini kontrol et
    try {
      const driverCheck = await dispatch(checkDriverAvailability({
        pickupLatitude: pickupCoords.latitude,
        pickupLongitude: pickupCoords.longitude,
        vehicleTypeId: selectedVehicleType?.id || 1
      })).unwrap();
      
      if (!driverCheck.available) {
        showModal(
          'Yakın Sürücü Bulunamadı', 
          `Şu anda yakınınızda müsait sürücü bulunmamaktadır. Tahmini bekleme süresi: ${driverCheck.estimatedWaitTime} dakika.`, 
          'warning'
        );
        return;
      }
    } catch (error) {
      console.error('Sürücü kontrolü hatası:', error);
      showModal('Hata', 'Sürücü kontrolü yapılamadı. Lütfen tekrar deneyiniz.', 'error');
      return;
    }
    
    try {
      const orderData = {
        pickupAddress: pickupLocation,
        pickupLatitude: pickupCoords.latitude,
        pickupLongitude: pickupCoords.longitude,
        destinationAddress: destinationLocation,
        destinationLatitude: destinationCoords.latitude,
        destinationLongitude: destinationCoords.longitude,
        distance: distance || 0,
        estimatedTime: Number(routeDuration) || 30,
        notes: notes || '',
        vehicleTypeId: selectedVehicleType?.id?.toString() || '',
        cargoImages: cargoImages,
      };
      
      console.log('=== FRONTEND REQUEST LOG ===');
      console.log('Order data:');
      console.log('- pickupAddress:', pickupLocation);
      console.log('- destinationAddress:', destinationLocation);
      console.log('- notes:', notes);
      console.log('- vehicleTypeId:', selectedVehicleType?.id);
      console.log('- distance:', distance);
      console.log('- estimatedTime:', routeDuration);
      console.log('- cargoImages array length:', cargoImages.length);
      console.log('- cargoImages array:', cargoImages);
      console.log('================================');
      
      // Redux action ile sipariş oluştur
      const result = await dispatch(createOrder({
        orderData,
        token: token!,
        refreshAuthToken
      })).unwrap();
      
      // Sipariş oluşturulduktan sonra aktif siparişleri yeniden yükle
      dispatch(fetchActiveOrders());
      
      showModal('Sipariş Oluşturuldu', 'Yük taşıma siparişiniz başarıyla oluşturuldu. Yakındaki sürücülere bildirim gönderildi.', 'success');
      
      // Form alanlarını temizle
      setNotes('');
      setCargoImages([]);
      setPickupLocation('');
      setDestinationLocation('');
      setPickupCoords(null);
      setDestinationCoords(null);
      setDistance(null);
      setRouteCoordinates([]);
      setRouteDuration(null);
      
    } catch (error) {
      console.error('Sipariş oluşturma hatası:', error);
      showModal('Hata', error instanceof Error ? error.message : 'Sipariş oluşturulurken bir hata oluştu.', 'error');
    }
  }, [pickupCoords, destinationCoords, cargoImages, pickupLocation, destinationLocation, distance, routeDuration, notes, showModal, selectedVehicleType, token, dispatch, refreshAuthToken]);

  const handleCurrentLocationToggle = useCallback((value: boolean) => {
    setUseCurrentLocation(value);
  }, []);

  const handlePickupCurrentLocation = useCallback(async () => {
    if (!userLocation) {
      await getCurrentLocation(true);
      return;
    }
    
    const coords = {
      latitude: userLocation.coords.latitude,
      longitude: userLocation.coords.longitude
    };
    
    setPickupCoords(coords);
    
    // Reverse geocoding ile gerçek adresi al
    try {
      const reverseGeocode = await Location.reverseGeocodeAsync(coords);
      if (reverseGeocode && reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        const fullAddress = [
          address.name,
          address.street,
          address.district,
          address.city
        ].filter(Boolean).join(', ');
        
        const finalAddress = fullAddress || 'Mevcut Konumum';
        setPickupLocation(finalAddress);
        pickupLocationRef.current?.setAddressText(finalAddress);
      } else {
        setPickupLocation('Mevcut Konumum');
        pickupLocationRef.current?.setAddressText('Mevcut Konumum');
      }
    } catch (error) {
      console.error('Reverse geocoding hatası:', error);
      setPickupLocation('Mevcut Konumum');
      pickupLocationRef.current?.setAddressText('Mevcut Konumum');
    }
    
    // Haritayı güncelle
    if (mapRef.current) {
      if (destinationCoords) {
        animateToShowBothPoints(mapRef, bottomSheetHeight, coords, destinationCoords);
      } else {
        animateToRegionWithOffset(mapRef, bottomSheetHeight, coords.latitude, coords.longitude, 0.008, 0.006);
      }
    }
  }, [userLocation, destinationCoords, getCurrentLocation, animateToShowBothPoints, animateToRegionWithOffset]);

  const handleDestinationCurrentLocation = useCallback(async () => {
    if (!userLocation) {
      await getCurrentLocation(true);
      return;
    }
    
    const coords = {
      latitude: userLocation.coords.latitude,
      longitude: userLocation.coords.longitude
    };
    
    setDestinationCoords(coords);
    
    // Reverse geocoding ile gerçek adresi al
    try {
      const reverseGeocode = await Location.reverseGeocodeAsync(coords);
      if (reverseGeocode && reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        const fullAddress = [
          address.name,
          address.street,
          address.district,
          address.city
        ].filter(Boolean).join(', ');
        
        const finalAddress = fullAddress || 'Mevcut Konumum';
        setDestinationLocation(finalAddress);
        destinationLocationRef.current?.setAddressText(finalAddress);
      } else {
        setDestinationLocation('Mevcut Konumum');
        destinationLocationRef.current?.setAddressText('Mevcut Konumum');
      }
    } catch (error) {
      console.error('Reverse geocoding hatası:', error);
      setDestinationLocation('Mevcut Konumum');
      destinationLocationRef.current?.setAddressText('Mevcut Konumum');
    }
    
    // Haritayı güncelle
    if (mapRef.current) {
      if (pickupCoords) {
        animateToShowBothPoints(mapRef, bottomSheetHeight, pickupCoords, coords);
      } else {
        animateToRegionWithOffset(mapRef, bottomSheetHeight, coords.latitude, coords.longitude, 0.008, 0.006);
      }
    }
  }, [userLocation, pickupCoords, getCurrentLocation, animateToShowBothPoints, animateToRegionWithOffset]);

  const handlePickupLocationSelect = useCallback((location: any) => {
    console.log('=== PICKUP LOCATION SELECT ===');
    console.log('handlePickupLocationSelect called with:', location);
    console.log('Coordinates:', location.coordinates);
    
    const coords = {
      latitude: location.coordinates.latitude,
      longitude: location.coordinates.longitude
    };
    
    console.log('Setting pickupCoords to:', coords);
    setPickupCoords(coords);
    
    console.log('Setting pickupLocation to:', location.address);
    setPickupLocation(location.address);
    
    setSelectedLocationInfo({
      address: location.address,
      coordinates: {
        latitude: location.coordinates.latitude,
        longitude: location.coordinates.longitude
      },
      type: 'pickup'
    });
    
    setLocationModalVisible(true);
    
    if (mapRef.current) {
      console.log('Animating map to pickup location');
      // Eğer destination da varsa, her iki noktayı göster
      if (destinationCoords) {
        animateToShowBothPoints(mapRef, bottomSheetHeight, coords, destinationCoords);
      } else {
        // Sadece pickup noktasını göster
        animateToRegionWithOffset(mapRef, bottomSheetHeight, location.coordinates.latitude, location.coordinates.longitude, 0.008, 0.006);
      }
    }
    console.log('=== END PICKUP LOCATION SELECT ===');
  }, [destinationCoords, animateToShowBothPoints, animateToRegionWithOffset]);

  const handleDestinationLocationSelect = useCallback((location: any) => {
    console.log('=== DESTINATION LOCATION SELECT ===');
    console.log('handleDestinationLocationSelect called with:', location);
    console.log('Coordinates:', location.coordinates);
    
    const coords = {
      latitude: location.coordinates.latitude,
      longitude: location.coordinates.longitude
    };
    
    console.log('Setting destinationCoords to:', coords);
    setDestinationCoords(coords);
    
    console.log('Setting destinationLocation to:', location.address);
    setDestinationLocation(location.address);
    
    setSelectedLocationInfo({
      address: location.address,
      coordinates: {
        latitude: location.coordinates.latitude,
        longitude: location.coordinates.longitude
      },
      type: 'destination'
    });
    
    setLocationModalVisible(true);
    
    if (mapRef.current) {
      console.log('Animating map to destination location');
      // Eğer pickup da varsa, her iki noktayı göster
      if (pickupCoords) {
        animateToShowBothPoints(mapRef, bottomSheetHeight, pickupCoords, coords);
      } else {
        // Sadece destination noktasını göster
        animateToRegionWithOffset(mapRef, bottomSheetHeight, location.coordinates.latitude, location.coordinates.longitude, 0.008, 0.006);
      }
    }
    console.log('=== END DESTINATION LOCATION SELECT ===');
  }, [pickupCoords, animateToShowBothPoints, animateToRegionWithOffset]);

  const [showImagePickerModal, setShowImagePickerModal] = useState(false);

  // Image picker hook'unu kullan
  const { handleImagePicker, pickImage } = useImagePicker(
    cameraPermission,
    requestCameraPermission,
    setCargoImages,
    showModal,
    setShowImagePickerModal
  );

  // Price calculation hook'unu kullan
  const { calculatePrice } = usePriceCalculation(setPriceLoading, setEstimatedPrice);

  // Fiyat hesaplama için useEffect
  useEffect(() => {
    if (distance && selectedVehicleType) {
      calculatePrice(distance, selectedVehicleType);
    }
  }, [distance, selectedVehicleType, calculatePrice]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.fullMapContainer}>
          {(() => {
             if (isLocationLoading) {
               return (
                 <View style={styles.loadingContainer}>
                   <ActivityIndicator size="large" color="#FFD700" />
                   <Text style={styles.loadingText}>Konum alınıyor...</Text>
                 </View>
               );
             } else {
               return (
                 <MapView
                    ref={mapRef}
                    provider={Platform.OS === 'ios' ? PROVIDER_DEFAULT : PROVIDER_GOOGLE}
                    style={[styles.fullMap, { marginBottom: screenHeight - (bottomSheetHeight as any)._value }]}
                   initialRegion={{
                     latitude: (userLocation?.coords.latitude || 41.0082) - 0.002,
                     longitude: userLocation?.coords.longitude || 28.9784,
                     latitudeDelta: 0.008,
                     longitudeDelta: 0.006,
                   }}
                 showsUserLocation={true}
                 showsMyLocationButton={true}
                 followsUserLocation={false}
                 userLocationPriority="high"
                 userLocationUpdateInterval={5000}
                 userLocationAnnotationTitle="Konumunuz"
                 showsTraffic={true}
                 zoomEnabled={true}
                 scrollEnabled={true}
                 pitchEnabled={true}
                 rotateEnabled={true}
                 onPress={() => {
                   if (keyboardVisible) {
                     Keyboard.dismiss();
                   }
                 }}
                 onMapReady={() => {
                     // Harita hazır
                   }}
                 onRegionChangeComplete={() => {
                   // Kullanıcı haritayı manuel olarak hareket ettirdi
                   const timeSinceLastUpdate = Date.now() - lastRouteUpdate;
                   if (timeSinceLastUpdate > 200) { // Otomatik animasyonlardan ayırt etmek için
                     setUserInteractedWithMap(true);
                   }
                 }}
               >
                 {safeDrivers.map((driver) => (
                   <DriverMarker key={driver.id} driver={driver} />
                 ))}
                 
                 {/* Aktif sipariş varsa onun marker'larını göster */}
                 {reduxCurrentOrder && reduxCurrentOrder.pickupLatitude && reduxCurrentOrder.pickupLongitude && (
                   <PickupMarker coords={{
                     latitude: typeof reduxCurrentOrder.pickupLatitude === 'string' ? parseFloat(reduxCurrentOrder.pickupLatitude) : reduxCurrentOrder.pickupLatitude,
                     longitude: typeof reduxCurrentOrder.pickupLongitude === 'string' ? parseFloat(reduxCurrentOrder.pickupLongitude) : reduxCurrentOrder.pickupLongitude
                   }} />
                 )}
                 
                 {reduxCurrentOrder && reduxCurrentOrder.destinationLatitude && reduxCurrentOrder.destinationLongitude && (
                   <DestinationMarker coords={{
                     latitude: typeof reduxCurrentOrder.destinationLatitude === 'string' ? parseFloat(reduxCurrentOrder.destinationLatitude) : reduxCurrentOrder.destinationLatitude,
                     longitude: typeof reduxCurrentOrder.destinationLongitude === 'string' ? parseFloat(reduxCurrentOrder.destinationLongitude) : reduxCurrentOrder.destinationLongitude
                   }} />
                 )}
                 
                 {/* Yeni sipariş oluştururken marker'lar */}
                 {!reduxCurrentOrder && pickupCoords && (
                   <>
                     {console.log('Rendering pickup marker with coords:', pickupCoords)}
                     <PickupMarker coords={pickupCoords} />
                   </>
                 )}
                 
                 {!reduxCurrentOrder && destinationCoords && (
                   <>
                     {console.log('Rendering destination marker with coords:', destinationCoords)}
                     <DestinationMarker coords={destinationCoords} />
                   </>
                 )}
                 
                 {/* Aktif sipariş rotası - Google Directions API ile gerçek yol rotası */}
                 {reduxCurrentOrder && activeOrderRouteCoordinates.length > 0 && (
                   <Polyline
                     coordinates={activeOrderRouteCoordinates}
                     strokeColor="#10B981"
                     strokeWidth={6}
                   />
                 )}
                 
                 {/* Yeni sipariş rotası */}
                 {!reduxCurrentOrder && routeCoordinates.length > 0 && (
                   <Polyline
                     coordinates={routeCoordinates}
                     strokeColor="#FFD700"
                     strokeWidth={8}
                   />
                 )}
               </MapView>
               );
             }
           })()
          }
      </View>

      <TouchableOpacity
        style={styles.floatingMenuButton}
        onPress={() => router.push('/customer-menu')}
      >
        <Ionicons name="menu" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Rota gösterme butonu - sadece rota varsa görünür */}
      {pickupCoords && destinationCoords && (
        <TouchableOpacity
          style={styles.floatingRouteButton}
          onPress={() => {
            setUserInteractedWithMap(false);
            animateToShowBothPoints(mapRef, bottomSheetHeight, pickupCoords, destinationCoords);
          }}
        >
          <MaterialIcons name="route" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <Animated.View style={[styles.bottomSheet, { height: bottomSheetHeight }]}>
        <View 
          style={styles.bottomSheetHandle} 
          {...panResponder.panHandlers}
        />
        
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.formContainer}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* <View style={styles.formTitleContainer}>
              <Text style={styles.formTitle}>Yük Taşıma Siparişi</Text>
              {keyboardVisible && (
                <TouchableOpacity
                  style={styles.keyboardDismissButton}
                  onPress={() => Keyboard.dismiss()}
                >
                  <Text style={styles.keyboardDismissText}>Klavyeyi Kapat</Text>
                </TouchableOpacity>
              )}
            </View> */}

            {/* Devam eden sipariş varsa güzel kart göster */}
            {(() => {
              console.log('🏠 Home Debug - Current Order Check:', {
                currentOrder: currentOrder,
                pickupCoords: pickupCoords,
                destinationCoords: destinationCoords,
                shouldShowOrderCard: currentOrder && currentOrder.status !== 'completed' && currentOrder.status !== 'cancelled'
              });
              return null;
            })()}
            {reduxCurrentOrder && reduxCurrentOrder.status !== 'completed' && reduxCurrentOrder.status !== 'cancelled' ? (
              <>
                {(() => {
                  console.log('Home Debug - Rendering OrderCard:', {
                    currentOrder: reduxCurrentOrder,
                    vehicleTypeId: reduxCurrentOrder?.vehicleTypeId,
                    reduxVehicleTypes: reduxVehicleTypes
                  });
                  return null;
                })()}
                <TouchableOpacity
                  onPress={() => {
                    console.log('ActiveOrderCard tıklandı - sipariş detay sayfasına yönlendiriliyor');
                    router.push('/order-detail');
                  }}
                >
                  <ActiveOrderCard
                    order={reduxCurrentOrder}
                    vehicleTypes={reduxVehicleTypes}
                  />
                </TouchableOpacity>
              </>
            ) : (
              <NewOrderForm
                onOrderCreated={() => {
                  // Sipariş oluşturulduktan sonra aktif siparişleri yeniden yükle
                  dispatch(fetchActiveOrders());
                }}
                userLocation={userLocation}
                distance={distance || undefined}
                estimatedPrice={estimatedPrice || undefined}
                priceLoading={priceLoading}
                token={token || undefined}
                refreshAuthToken={refreshAuthToken}
                onPickupLocationChange={(coords, address) => {
                  setPickupCoords(coords);
                  setPickupLocation(address);
                }}
                onDestinationLocationChange={(coords, address) => {
                  setDestinationCoords(coords);
                  setDestinationLocation(address);
                }}
                showModal={showModal}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
      <Modal
        visible={locationModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setLocationModalVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <View style={{
            backgroundColor: '#FFFFFF',
            margin: 20,
            borderRadius: 12,
            padding: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5
          }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#1F2937' }}>
              {selectedLocationInfo?.type === 'pickup' ? 'Yükün Konumu' : 'Varış Noktası'}
            </Text>
            <Text style={{ fontSize: 16, marginBottom: 20, color: '#6B7280' }}>
              {selectedLocationInfo?.address}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#F59E0B',
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 8
                }}
                onPress={() => setLocationModalVisible(false)}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Tamam</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Order Modal - Confirm Code */}
      <CancelOrderModal
        visible={cancelOrderModalVisible}
        onClose={() => setCancelOrderModalVisible(false)}
        cancelOrderId={cancelOrderId}
        userCancelCode={userCancelCode}
        setUserCancelCode={setUserCancelCode}
        confirmCodeInputs={confirmCodeInputs}
        setConfirmCodeInputs={setConfirmCodeInputs}
        confirmCodeInputRefs={confirmCodeInputRefs}
        showModal={showModal}
      />



      {/* Free Cancel Modal */}
      <FreeCancelModal
        visible={freeCancelModalVisible}
        onClose={() => setFreeCancelModalVisible(false)}
        freeCancelConfirmCode={freeCancelConfirmCode}
        setFreeCancelConfirmCode={setFreeCancelConfirmCode}
        currentOrder={currentOrder}
        showModal={showModal}
      />

      <PendingOrderModal
        visible={pendingOrderModalVisible}
        onClose={() => setPendingOrderModalVisible(false)}
        currentOrder={currentOrder}
        onConfirm={() => {
          if (currentOrder) {
            fillOrderData(currentOrder);
          }
          setPendingOrderModalVisible(false);
        }}
        getOrderStatusText={getOrderStatusText}
      />

      {/* Cancel Order Confirmation Modal */}
      <Modal
        visible={cancelOrderModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCancelOrderModalVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 20,
        }}>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 24,
            width: '100%',
            maxWidth: 400,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 8,
          }}>
            <View style={{
              alignItems: 'center',
              marginBottom: 20,
            }}>
              <View style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: '#FEF3C7',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}>
                <Ionicons name="warning" size={32} color="#F59E0B" />
              </View>
              <Text style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: '#1F2937',
                textAlign: 'center',
                marginBottom: 8,
              }}>
                Sipariş İptal Onayı
              </Text>
              <Text style={{
                fontSize: 14,
                color: '#6B7280',
                textAlign: 'center',
                lineHeight: 20,
              }}>
                Siparişinizi iptal etmek için aşağıdaki 4 haneli kodu girin
              </Text>
            </View>

            {cancelConfirmCode && (
              <View style={{
                backgroundColor: '#F3F4F6',
                borderRadius: 8,
                padding: 16,
                marginBottom: 20,
                alignItems: 'center',
              }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  color: '#1F2937',
                  marginBottom: 4,
                }}>
                  Onay Kodu
                </Text>
                <Text style={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  color: '#F59E0B',
                  letterSpacing: 4,
                }}>
                  {cancelConfirmCode}
                </Text>
              </View>
            )}

            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 20,
              paddingHorizontal: 8,
            }}>
              {confirmCodeInputs.map((value, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    if (ref) {
                      confirmCodeInputRefs.current[index] = ref;
                    }
                  }}
                  style={{
                    width: 48,
                    height: 56,
                    borderWidth: 2,
                    borderColor: value ? '#FCD34D' : '#E5E7EB',
                    borderRadius: 12,
                    textAlign: 'center',
                    fontSize: 24,
                    fontWeight: 'bold',
                    color: '#000000',
                    backgroundColor: value ? '#FEF3C7' : '#F9FAFB',
                  }}
                  value={value}
                  onChangeText={(text) => {
                    if (text.length <= 1 && /^[0-9]*$/.test(text)) {
                      const newInputs = [...confirmCodeInputs];
                      newInputs[index] = text;
                      setConfirmCodeInputs(newInputs);
                      
                      // Auto focus next input
                      if (text && index < 3) {
                        confirmCodeInputRefs.current[index + 1]?.focus();
                      }
                    }
                  }}
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === 'Backspace' && !confirmCodeInputs[index] && index > 0) {
                      confirmCodeInputRefs.current[index - 1]?.focus();
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>

            {cancellationFee > 0 && (
              <View style={{
                backgroundColor: '#FEF2F2',
                borderRadius: 8,
                padding: 16,
                marginBottom: 20,
                borderLeftWidth: 4,
                borderLeftColor: '#EF4444',
              }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#DC2626',
                  marginBottom: 4,
                }}>
                  İptal Ücreti
                </Text>
                <Text style={{
                  fontSize: 12,
                  color: '#7F1D1D',
                  lineHeight: 16,
                }}>
                  Bu siparişi iptal etmeniz durumunda {cancellationFee}₺ iptal ücreti tahsil edilecektir.
                </Text>
              </View>
            )}

            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: 12,
            }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#F3F4F6',
                  borderRadius: 8,
                  padding: 16,
                  alignItems: 'center',
                }}
                onPress={() => {
                  setCancelOrderModalVisible(false);
                  setConfirmCodeInputs(['', '', '', '']);
                  setUserCancelCode('');
                  // Reset focus to first input when modal is reopened
                  setTimeout(() => {
                    confirmCodeInputRefs.current[0]?.focus();
                  }, 100);
                }}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#6B7280',
                }}>
                  Vazgeç
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: confirmCodeInputs.every(input => input) ? '#EF4444' : '#D1D5DB',
                  borderRadius: 8,
                  padding: 16,
                  alignItems: 'center',
                }}
                disabled={!confirmCodeInputs.every(input => input)}
                onPress={() => {
                  const enteredCode = confirmCodeInputs.join('');
                  handleConfirmCode();
                }}
              >
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: confirmCodeInputs.every(input => input) ? '#FFFFFF' : '#9CA3AF',
                }}>
                  İptal Et
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      <ImagePickerModal
        visible={showImagePickerModal}
        onClose={() => setShowImagePickerModal(false)}
        onPickImage={pickImage}
      />

      <VehicleTypeModal
        visible={showVehicleTypeModal}
        onClose={() => setShowVehicleTypeModal(false)}
        vehicleTypes={reduxVehicleTypes}
        selectedVehicleType={selectedVehicleType}
        onSelectVehicleType={setSelectedVehicleType}
      />

      {/* Loading Splash Screen */}
      <LoadingSplash 
        visible={isLocationLoading && !userLocation} 
        message="Harita yükleniyor..."
      />
    </View>
  );
}



export default HomeScreen;