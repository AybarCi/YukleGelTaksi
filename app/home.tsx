import * as React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  Dimensions,
  ActivityIndicator,
  Animated,
  PanResponder,
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
import { useAuth } from '../contexts/AuthContext';
import socketService from '../services/socketService';
import { API_CONFIG } from '../config/api';
import YukKonumuInput, { YukKonumuInputRef } from '../components/YukKonumuInput';
import VarisNoktasiInput, { VarisNoktasiInputRef } from '../components/VarisNoktasiInput';
import LoadingSplash from '../components/LoadingSplash';


interface Driver {
  id: string;
  latitude: number;
  longitude: number;
  heading: number;
  name?: string;
}

// Optimized marker components with React.memo
const DriverMarker = memo(({ driver }: { driver: Driver }) => {
  if (!driver || typeof driver !== 'object' || !driver.id || 
      typeof driver.latitude !== 'number' || typeof driver.longitude !== 'number') {
    return null;
  }
  return (
    <Marker
      key={driver.id}
      coordinate={{
        latitude: driver.latitude,
        longitude: driver.longitude,
      }}
      title={driver.name || `Sürücü ${driver.id}`}
      description="Müsait sürücü"
      tracksViewChanges={false}
    >
      <View style={styles.driverMarker}>
        <MaterialIcons name="local-shipping" size={20} color="#FFFFFF" />
      </View>
    </Marker>
  );
});

const PickupMarker = memo(({ coords }: { coords: { latitude: number; longitude: number } }) => {
  return (
    <Marker
      key={`pickup-${coords.latitude}-${coords.longitude}`}
      coordinate={coords}
      title="Yükün Konumu"
      description="Yükün alınacağı adres"
      tracksViewChanges={false}
    >
      <View style={styles.pickupMarker}>
        <MaterialIcons name="inventory" size={20} color="#FFFFFF" />
      </View>
    </Marker>
  );
});

const DestinationMarker = memo(({ coords }: { coords: { latitude: number; longitude: number } }) => {
  return (
    <Marker
      key={`destination-${coords.latitude}-${coords.longitude}`}
      coordinate={coords}
      title="Varış Noktası"
      description="Yükün teslim edileceği adres"
      tracksViewChanges={false}
    >
      <View style={styles.destinationMarker}>
        <MaterialIcons name="flag" size={20} color="#FFFFFF" />
      </View>
    </Marker>
  );
});

function HomeScreen() {
  const progressAnim = useRef(new Animated.Value(0)).current;

  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  
  // Drivers state'inin güvenli olduğundan emin olmak için
  const safeDrivers = useMemo(() => Array.isArray(drivers) ? drivers : [], [drivers]);
  
  // Yük bilgileri state'leri
  const [weight, setWeight] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [destinationLocation, setDestinationLocation] = useState('');
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [pickupCoords, setPickupCoords] = useState<{latitude: number, longitude: number} | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{latitude: number, longitude: number} | null>(null);
  const [cargoImage, setCargoImage] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<{latitude: number, longitude: number}[]>([]);
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
      default: return status || 'Bilinmiyor';
    }
  };

  // Confirm code modal için state
  const [confirmCodeModalVisible, setConfirmCodeModalVisible] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [userConfirmCode, setUserConfirmCode] = useState('');
  
  // Free cancel modal için state
  const [freeCancelModalVisible, setFreeCancelModalVisible] = useState(false);
  const [freeCancelConfirmCode, setFreeCancelConfirmCode] = useState('');
  
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
          useNativeDriver: false,
        }).start();
      } else if (currentHeight > screenHeight * 0.7) {
        // Snap to maximum
        Animated.spring(bottomSheetHeight, {
          toValue: maxBottomSheetHeight,
          useNativeDriver: false,
        }).start();
      } else {
        // Snap to middle
        Animated.spring(bottomSheetHeight, {
          toValue: screenHeight * 0.6,
          useNativeDriver: false,
        }).start();
      }
    },
  });

  // Cancel order modal için state
  const [cancelOrderModalVisible, setCancelOrderModalVisible] = useState(false);
  const [cancelConfirmCode, setCancelConfirmCode] = useState('');
  const [userCancelCode, setUserCancelCode] = useState('');
  const [cancellationFee, setCancellationFee] = useState(0);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  
  // Cancel confirmation modal için state
  const [cancelConfirmationModalVisible, setCancelConfirmationModalVisible] = useState(false);

  // Mevcut sipariş durumu
  const [currentOrder, setCurrentOrder] = useState<any>(null);

  // Devam eden sipariş modalı için state
  const [pendingOrderModalVisible, setPendingOrderModalVisible] = useState(false);

  // Form görünürlüğünü kontrol eden state
  // showOrderForm state kaldırıldı - form her zaman görünür

  // Form alanlarının düzenlenebilirlik durumunu kontrol eden fonksiyon
  const isFormEditable = useCallback(() => {
    // Eğer aktif bir sipariş varsa (beklemede, kabul edilmiş, onaylanmış, başlamış durumda)
    // form alanları düzenlenemez
    if (currentOrder) {
      const nonEditableStatuses = ['pending', 'accepted', 'confirmed', 'in_progress', 'started'];
      return !nonEditableStatuses.includes(currentOrder.status);
    }
    // Aktif sipariş yoksa form düzenlenebilir
    return true;
  }, [currentOrder]);

  // Confirm code modal'ını göster
  const showConfirmCodeModal = useCallback((orderId: string, code: string) => {
    setCurrentOrderId(orderId);
    setConfirmCode(code);
    setConfirmCodeModalVisible(true);
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
  const showCancelOrderModal = useCallback((orderId: string, code: string, fee: number) => {
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

    // Socket üzerinden cancel order doğrulama gönder
    const success = socketService.cancelOrderWithCode(parseInt(cancelOrderId), userCancelCode);
    
    if (!success) {
      showModal('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
    }
  }, [userCancelCode, cancelOrderId, showModal]);

  // Sipariş iptal etme başlatma - önce onay modalını göster
  const initiateCancelOrder = useCallback(async () => {
    try {
      // Önce API'den aktif sipariş kontrolü yap
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/users/orders?status=pending,accepted,confirmed,in_progress,started&limit=1`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.orders && result.data.orders.length > 0) {
          const activeOrder = result.data.orders[0];
          setCurrentOrder(activeOrder);
          // Aktif sipariş varsa onay modalını göster
          setCancelConfirmationModalVisible(true);
        } else {
          showModal('Hata', 'Aktif sipariş bulunamadı.', 'error');
        }
      } else {
        showModal('Hata', 'Sipariş bilgileri alınamadı.', 'error');
      }
    } catch (error) {
      console.error('Cancel order error:', error);
      showModal('Hata', 'Sipariş iptal edilirken bir hata oluştu.', 'error');
    }
  }, [showModal, token]);
  
  // Onay modalından sonra gerçek iptal işlemini başlat
  const confirmCancelOrder = useCallback(async () => {
    setCancelConfirmationModalVisible(false);
    
    try {
      if (currentOrder) {
        // Cezai şart kontrolü için backend'e istek gönder
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/orders/${currentOrder.id}/cancellation-fee`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          const cancellationFee = result.data?.cancellationFee || 0;
          
          if (cancellationFee > 0) {
            // Cezai şart varsa ödeme modalı göster
            showModal(
              'Cezai Şart Uygulanacak', 
              `Sipariş iptal edilecek ancak ${cancellationFee} TL cezai şart uygulanacaktır. Ödeme yapmak için devam edin.`,
              'warning',
              [
                {
                  text: 'Vazgeç',
                  style: 'cancel'
                },
                {
                   text: 'Ödeme Yap',
                   onPress: () => {
                     // TODO: Ödeme sayfası oluşturulacak
                     showModal(
                       'Ödeme Gerekli', 
                       `${cancellationFee} TL cezai şart ödemesi gerekiyor. Ödeme sistemi yakında aktif olacak.`,
                       'info'
                     );
                   }
                 }
              ]
            );
          } else {
            // Cezai şart yoksa ücretsiz iptal modalını göster
            setFreeCancelModalVisible(true);
            // Socket üzerinden onay kodu isteme işlemini başlat
            const success = socketService.cancelOrder(currentOrder.id);
            if (!success) {
              showModal('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
            }
          }
        } else {
          // API hatası durumunda fallback olarak onay kodu isteme işlemini başlat
          const success = socketService.cancelOrder(currentOrder.id);
          if (!success) {
            showModal('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
          }
        }
      } else {
        showModal('Hata', 'Aktif sipariş bulunamadı.', 'error');
      }
    } catch (error) {
      console.error('Cancel order error:', error);
      // Hata durumunda fallback olarak onay kodu isteme işlemini başlat
      if (currentOrder) {
        const success = socketService.cancelOrder(currentOrder.id);
        if (!success) {
          showModal('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
        }
      } else {
        showModal('Hata', 'Sipariş iptal edilirken bir hata oluştu.', 'error');
      }
    }
  }, [showModal, currentOrder, token]);

  // AsyncStorage'dan mevcut sipariş bilgilerini kontrol et
  // Sipariş verilerini form alanlarına dolduran fonksiyon
   const fillOrderData = useCallback(async (order: any) => {
    try {
      console.log('=== fillOrderData BAŞLADI ===');
      console.log('Gelen order parametresi:', JSON.stringify(order, null, 2));
      
      console.log('pickup_address set ediliyor:', order.pickup_address);
      setPickupLocation(order.pickup_address);
      
      console.log('destination_address set ediliyor:', order.destination_address);
      setDestinationLocation(order.destination_address);
      
      console.log('weight_kg set ediliyor:', order.weight_kg);
      setWeight(order.weight_kg ? order.weight_kg.toString() : '1');
      
      console.log('customer_notes set ediliyor:', order.customer_notes);
      setNotes(order.customer_notes || '');
      
      // Yük fotoğrafını set et
      if (order.cargo_photo_url) {
        setCargoImage(order.cargo_photo_url);
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
      
      console.log('=== fillOrderData TAMAMLANDI ===');
    } catch (error) {
      console.error('Sipariş verilerini doldurma hatası:', error);
      showModal('Hata', 'Sipariş verileri yüklenirken bir hata oluştu.', 'error');
    }
  }, [setPickupLocation, setDestinationLocation, setWeight, setNotes, setPickupCoords, setDestinationCoords, showModal]);

  const checkExistingOrder = useCallback(async () => {
    try {
      // Yeni API endpoint'ini kullanarak devam eden siparişleri kontrol et
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/users/orders?status=pending,accepted,confirmed,in_progress&limit=1`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.orders && result.data.orders.length > 0) {
          const activeOrder = result.data.orders[0];
          
          // Devam eden sipariş varsa order'ı set et
          setCurrentOrder(activeOrder);
        } else {
          // Devam eden sipariş yok, AsyncStorage'ı temizle
          setCurrentOrder(null);
          await AsyncStorage.removeItem('currentOrder');
        }
      } else {
        // API'den sipariş bulunamadıysa AsyncStorage'ı temizle
        await AsyncStorage.removeItem('currentOrder');
      }
    } catch (error) {
      console.error('Mevcut sipariş kontrol hatası:', error);
    }
  }, [token, isLocationLoading, userLocation, fillOrderData]);

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

  useEffect(() => {
    const initializeApp = async () => {
      await getCurrentLocation();
    };
    
    initializeApp();
    checkExistingOrder();
    
    if (token) {
      socketService.connect(token);
    }
    
    socketService.on('connection_error', (data: any) => {
      console.error('Socket bağlantı hatası:', data.error);
      showModal('Bağlantı Hatası', 'Sunucuya bağlanırken bir hata oluştu.', 'error');
    });

    socketService.on('max_reconnect_attempts_reached', () => {
      showModal('Bağlantı Sorunu', 'Sunucuya bağlanılamıyor. Lütfen uygulamayı yeniden başlatın.', 'warning');
    });

    socketService.on('driver_location_update', (data: any) => {
      if (data && data.driverId && data.latitude && data.longitude) {
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
      }
    });
    
    socketService.on('nearbyDriversUpdate', (data: any) => {
      try {
        if (!data) {
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
      const { driver, estimatedArrival, updatedPrice, laborCost } = data;
      const message = `Siparişiniz ${driver.name} tarafından kabul edildi.\n\nSürücü Bilgileri:\n${driver.vehicle}\nTahmini Varış: ${estimatedArrival} dakika\n\nGüncellenmiş Fiyat:\nTaşıma Ücreti: ${updatedPrice - laborCost} TL\nHammaliye: ${laborCost} TL\nToplam: ${updatedPrice} TL\n\nOnaylıyor musunuz?`;
      
      Alert.alert(
        'Sipariş Kabul Edildi',
        message,
        [
          {
            text: 'İptal',
            style: 'cancel',
            onPress: () => {
               // Sipariş iptal edildi socket event'i gönder
               socketService.rejectOrder(data.orderId);
             }
          },
          {
            text: 'Onayla',
            onPress: () => {
               // Müşteri onayladı, socket room oluştur
               socketService.confirmOrder(data.orderId);
               showModal('Sipariş Onaylandı', 'Sürücünüz yola çıkıyor. Canlı takip başlatılıyor.', 'success');
             }
          }
        ]
      );
    });
    
    socketService.on('order_status_update', (data: any) => {
      console.log('Order status updated:', data);
      
      let message = '';
      switch (data.status) {
        case 'started':
          message = 'Sürücü yükünüzü aldı ve yola çıktı.';
          Alert.alert('Sipariş Durumu', message);
          break;
        case 'completed':
          message = `Sipariş tamamlandı! Doğrulama kodu: ${data.confirmCode}`;
          Alert.alert(
            'Sipariş Tamamlandı',
            message,
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
          Alert.alert('Sipariş Durumu', message);
          AsyncStorage.removeItem('currentOrder');
          break;
        default:
          message = `Sipariş durumu güncellendi: ${data.status}`;
          Alert.alert('Sipariş Durumu', message);
      }
    });
    
    socketService.on('orderStatusUpdate', (data: any) => {
      showModal('Sipariş Güncellendi', `Sipariş durumu güncellendi: ${data.status}`, 'info');
    });

    // Confirm code doğrulama sonuçlarını dinle
    socketService.on('confirm_code_verified', (data: any) => {
      console.log('Confirm code verified:', data);
      setConfirmCodeModalVisible(false);
      setUserConfirmCode('');
      AsyncStorage.removeItem('currentOrder');
      setCurrentOrder(null);
      showModal('Başarılı', data.message || 'Sipariş başarıyla doğrulandı!', 'success');
    });

    socketService.on('confirm_code_error', (data: any) => {
      console.log('Confirm code error:', data);
      showModal('Hata', data.message || 'Doğrulama kodu yanlış!', 'error');
    });

    // Sipariş iptal etme event'lerini dinle
    socketService.on('cancel_order_confirmation_required', (data: any) => {
      console.log('Cancel order confirmation required:', data);
      showCancelOrderModal(data.orderId.toString(), data.confirmCode, data.cancellationFee);
    });

    socketService.on('order_cancelled_successfully', (data: any) => {
      console.log('Order cancelled successfully:', data);
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
      setWeight('');
      setNotes('');
      setCargoImage(null);
      setDistance(null);
      setRouteDuration(null);
      setRouteCoordinates([]);
      
      // Input referanslarını temizle
      if (pickupLocationRef.current) {
        pickupLocationRef.current.clear();
      }
      if (destinationLocationRef.current) {
        destinationLocationRef.current.clear();
      }
      
      showModal('Sipariş İptal Edildi', data.message || 'Sipariş başarıyla iptal edildi!', 'success');
    });

    socketService.on('cancel_order_error', (data: any) => {
      console.log('Cancel order error:', data);
      showModal('Hata', data.message || 'Sipariş iptal edilirken bir hata oluştu!', 'error');
    });
    
    socketService.on('driver_offline', (data: any) => {
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
      socketService.off('orderStatusUpdate');
      socketService.off('confirm_code_verified');
      socketService.off('confirm_code_error');
      socketService.off('cancel_order_confirmation_required');
      socketService.off('order_cancelled_successfully');
      socketService.off('cancel_order_error');
      socketService.off('driver_offline');
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [user?.id]);
  
  // Progress bar animasyonu için useEffect
  useEffect(() => {
    let animationTimeout: any;
    
    const animateProgress = () => {
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 3000, // Animasyon süresini 3 saniyeye düşür
        useNativeDriver: false,
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
      const GOOGLE_MAPS_API_KEY = 'AIzaSyBh078SvpaOnhvq5QGkGJ4hQV-Z0mpI81M';
      
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

  const calculateZoomLevel = useCallback((distance: number) => {
    // Mesafeye göre zoom seviyesi hesapla - optimize edilmiş değerler (daha geniş görüş alanı)
    if (distance <= 1) {
      return { latitudeDelta: 0.008, longitudeDelta: 0.006 }; // Çok yakın mesafe
    } else if (distance <= 5) {
      return { latitudeDelta: 0.025, longitudeDelta: 0.02 }; // Yakın mesafe
    } else if (distance <= 15) {
      return { latitudeDelta: 0.08, longitudeDelta: 0.06 }; // Orta mesafe
    } else if (distance <= 50) {
      return { latitudeDelta: 0.6, longitudeDelta: 0.48 }; // Uzak mesafe - daha da artırıldı
    } else if (distance <= 100) {
      return { latitudeDelta: 1.2, longitudeDelta: 0.96 }; // Çok uzak mesafe - daha da artırıldı
    } else if (distance <= 200) {
      return { latitudeDelta: 2.0, longitudeDelta: 1.6 }; // Aşırı uzak mesafe - daha da artırıldı
    } else {
      return { latitudeDelta: 3.0, longitudeDelta: 2.4 }; // Çok aşırı uzak mesafe - daha da artırıldı
    }
  }, []);

  // BottomSheet yüksekliğini hesaba katarak harita ortalama fonksiyonu
  const animateToRegionWithOffset = useCallback((latitude: number, longitude: number, latitudeDelta: number, longitudeDelta: number) => {
    if (!mapRef.current) return;
    
    const currentBottomSheetHeight = (bottomSheetHeight as any)._value;
    
    // Görünür harita alanının ortasına konumlandırmak için offset hesapla
    // BottomSheet'in yarısı kadar yukarı kaydır ki rota görünür alanda ortalansın
    const offsetRatio = (currentBottomSheetHeight * 0.3) / screenHeight;
    const latitudeOffset = latitudeDelta * offsetRatio;
    
    mapRef.current.animateToRegion({
      latitude: latitude - latitudeOffset,
      longitude: longitude,
      latitudeDelta: latitudeDelta,
      longitudeDelta: longitudeDelta,
    }, 1000); // Animasyon süresini kısalttım
  }, [bottomSheetHeight, screenHeight]);

  const animateToShowBothPoints = useCallback((pickup: any, destination: any) => {
    if (!mapRef.current || !pickup || !destination) return;

    const distance = calculateDistance(
      pickup.latitude,
      pickup.longitude,
      destination.latitude,
      destination.longitude
    );

    // Rotanın tamamını göstermek için daha geniş zoom seviyesi hesapla
    const latDiff = Math.abs(pickup.latitude - destination.latitude);
    const lngDiff = Math.abs(pickup.longitude - destination.longitude);
    
    // Padding ekleyerek rotanın kenarlarının görünmesini sağla
    const paddingFactor = 1.8; // Daha geniş görüş alanı için artırıldı
    const latitudeDelta = Math.max(latDiff * paddingFactor, 0.01);
    const longitudeDelta = Math.max(lngDiff * paddingFactor, 0.01);
    
    // İki nokta arasındaki orta noktayı hesapla
    const centerLat = (pickup.latitude + destination.latitude) / 2;
    const centerLng = (pickup.longitude + destination.longitude) / 2;

    // BottomSheet offset'i ile animasyon yap
    animateToRegionWithOffset(centerLat, centerLng, latitudeDelta, longitudeDelta);
  }, [calculateDistance, animateToRegionWithOffset]);
  
  useEffect(() => {
    if (pickupCoords && destinationCoords) {
      const currentTime = Date.now();
      setLastRouteUpdate(currentTime);
      
      // Google Directions API ile gerçek araç yolu rotası al
      getDirectionsRoute(pickupCoords, destinationCoords);
      
      // Kullanıcı manuel olarak haritayı hareket ettirmediyse otomatik ortalama yap
      if (!userInteractedWithMap) {
        // Kısa bir gecikme ile animasyon yap ki kullanıcı etkileşimi algılanabilsin
        setTimeout(() => {
          if (Date.now() - currentTime < 500 && !userInteractedWithMap) {
            animateToShowBothPoints(pickupCoords, destinationCoords);
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
  
  const checkDriverAvailability = useCallback(async () => {
    if (!pickupCoords) {
      return { hasAvailableDrivers: false, error: 'Konum bilgisi bulunamadı' };
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/drivers/check-availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          pickupLatitude: pickupCoords.latitude,
          pickupLongitude: pickupCoords.longitude
        })
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Sürücü kontrolü hatası:', error);
      return { hasAvailableDrivers: false, error: 'Sürücü kontrolü yapılamadı' };
    }
  }, [pickupCoords, token]);

  const handleCreateOrder = useCallback(async () => {
    if (!weight || !pickupCoords || !destinationCoords || !cargoImage) {
      showModal('Eksik Bilgi', 'Lütfen tüm alanları doldurun.', 'warning');
      return;
    }
    
    // Önce yakında sürücü olup olmadığını kontrol et
    const driverCheck = await checkDriverAvailability();
    if (!driverCheck.hasAvailableDrivers) {
      showModal(
        'Yakın Sürücü Bulunamadı', 
        `Şu anda yakınınızda müsait sürücü bulunmamaktadır. ${driverCheck.message || 'Lütfen daha sonra tekrar deneyiniz.'}`, 
        'warning'
      );
      return;
    }
    
    try {
      // FormData oluştur
      const formData = new FormData();
      formData.append('pickupAddress', pickupLocation);
      formData.append('pickupLatitude', pickupCoords.latitude.toString());
      formData.append('pickupLongitude', pickupCoords.longitude.toString());
      formData.append('destinationAddress', destinationLocation);
      formData.append('destinationLatitude', destinationCoords.latitude.toString());
      formData.append('destinationLongitude', destinationCoords.longitude.toString());
      formData.append('distance', (distance || 0).toString());
      formData.append('estimatedTime', (routeDuration || 30).toString());
      formData.append('notes', notes || '');
      formData.append('weightKg', parseFloat(weight).toString());
      formData.append('laborRequired', 'true');
      formData.append('laborCount', '1');
      
      // Cargo image'ı FormData'ya ekle
      if (cargoImage) {
        const response = await fetch(cargoImage);
        const blob = await response.blob();
        formData.append('cargoPhoto', blob, 'cargo.jpg');
      }
      
      // API'ye sipariş gönder
      let response = await fetch(`${API_CONFIG.BASE_URL}/api/orders/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      // Token süresi dolmuşsa yenile ve tekrar dene
      if (response.status === 401) {
        const refreshSuccess = await refreshAuthToken();
        if (refreshSuccess) {
          response = await fetch(`${API_CONFIG.BASE_URL}/api/orders/create`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });
        } else {
          showModal('Oturum Süresi Doldu', 'Lütfen tekrar giriş yapın.', 'error');
          return;
        }
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Sipariş bilgilerini AsyncStorage'a kaydet
        const orderInfo = {
          orderId: result.order.id,
          status: 'pending',
          pickupAddress: pickupLocation,
          destinationAddress: destinationLocation,
          weight: parseFloat(weight),
          distance: distance,
          estimatedPrice: result.order.estimatedPrice,
          createdAt: new Date().toISOString(),
          cargoImage: cargoImage,
          notes: notes
        };
        
        await AsyncStorage.setItem('currentOrder', JSON.stringify(orderInfo));
        setCurrentOrder(result.order);
        
        showModal('Sipariş Oluşturuldu', 'Yük taşıma siparişiniz başarıyla oluşturuldu. Yakındaki sürücülere bildirim gönderildi.', 'success');
        
        // Form alanlarını temizle
        setWeight('');
        setNotes('');
        setCargoImage(null);
        setPickupLocation('');
        setDestinationLocation('');
        setPickupCoords(null);
        setDestinationCoords(null);
        setDistance(null);
        setRouteCoordinates([]);
        setRouteDuration(null);
      } else {
        showModal('Hata', result.error || 'Sipariş oluşturulurken bir hata oluştu.', 'error');
      }
      
    } catch (error) {
      console.error('Sipariş oluşturma hatası:', error);
      showModal('Hata', 'Sipariş oluşturulurken bir hata oluştu.', 'error');
    }
  }, [weight, pickupCoords, destinationCoords, cargoImage, pickupLocation, destinationLocation, distance, routeDuration, notes, showModal, checkDriverAvailability]);

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
        animateToShowBothPoints(coords, destinationCoords);
      } else {
        animateToRegionWithOffset(coords.latitude, coords.longitude, 0.008, 0.006);
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
        animateToShowBothPoints(pickupCoords, coords);
      } else {
        animateToRegionWithOffset(coords.latitude, coords.longitude, 0.008, 0.006);
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
        animateToShowBothPoints(coords, destinationCoords);
      } else {
        // Sadece pickup noktasını göster
        animateToRegionWithOffset(location.coordinates.latitude, location.coordinates.longitude, 0.008, 0.006);
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
        animateToShowBothPoints(pickupCoords, coords);
      } else {
        // Sadece destination noktasını göster
        animateToRegionWithOffset(location.coordinates.latitude, location.coordinates.longitude, 0.008, 0.006);
      }
    }
    console.log('=== END DESTINATION LOCATION SELECT ===');
  }, [pickupCoords, animateToShowBothPoints, animateToRegionWithOffset]);

  const handleImagePicker = useCallback(() => {
    Alert.alert(
      'Fotoğraf Ekle',
      'Yük fotoğrafını nasıl eklemek istiyorsunuz?',
      [
        {
          text: 'İptal',
          style: 'cancel',
        },
        {
          text: 'Kameradan Çek',
          onPress: () => pickImage('camera'),
        },
        {
          text: 'Galeriden Seç',
          onPress: () => pickImage('gallery'),
        },
      ]
    );
  }, []);

  const pickImage = useCallback(async (source: 'camera' | 'gallery') => {
    try {
      let result;
      
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          showModal('İzin Gerekli', 'Kamera kullanımı için izin gerekli.', 'warning');
          return;
        }
        
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showModal('İzin Gerekli', 'Galeri erişimi için izin gerekli.', 'warning');
          return;
        }
        
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      }
      
      if (!result.canceled && result.assets && result.assets[0]) {
        setCargoImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Resim seçme hatası:', error);
      showModal('Hata', 'Resim seçilirken bir hata oluştu.', 'error');
    }
  }, [showModal]);



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
                 
                 {pickupCoords && (
                   <>
                     {console.log('Rendering pickup marker with coords:', pickupCoords)}
                     <PickupMarker coords={pickupCoords} />
                   </>
                 )}
                 
                 {destinationCoords && (
                   <>
                     {console.log('Rendering destination marker with coords:', destinationCoords)}
                     <DestinationMarker coords={destinationCoords} />
                   </>
                 )}
                 
                 {routeCoordinates.length > 0 && (
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
            animateToShowBothPoints(pickupCoords, destinationCoords);
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
            <View style={styles.formTitleContainer}>
              <Text style={styles.formTitle}>Yük Taşıma Siparişi</Text>
              {keyboardVisible && (
                <TouchableOpacity
                  style={styles.keyboardDismissButton}
                  onPress={() => Keyboard.dismiss()}
                >
                  <Text style={styles.keyboardDismissText}>Klavyeyi Kapat</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Devam eden sipariş varsa güzel kart göster - sadece ilk yüklemede */}
            {currentOrder && !pickupCoords && !destinationCoords ? (
              <View style={{ paddingVertical: 8 }}>
                <TouchableOpacity
                  style={styles.ongoingOrderCard}
                  onPress={() => {
                    if (currentOrder) {
                      // fillOrderData fonksiyonunu kullanarak form alanlarını doldur
                      fillOrderData(currentOrder);
                      
                      // Harita üzerinde rota çiz
                      if (currentOrder.pickup_latitude && currentOrder.pickup_longitude && 
                          currentOrder.destination_latitude && currentOrder.destination_longitude) {
                        getDirectionsRoute(
                          {
                            latitude: parseFloat(currentOrder.pickup_latitude),
                            longitude: parseFloat(currentOrder.pickup_longitude)
                          },
                          {
                            latitude: parseFloat(currentOrder.destination_latitude),
                            longitude: parseFloat(currentOrder.destination_longitude)
                          }
                        );
                      }
                    }
                  }}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.statusBadge}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusText}>Devam Ediyor</Text>
                    </View>
                    <MaterialIcons name="arrow-forward-ios" size={16} color="#6B7280" />
                  </View>
                  
                  <View style={styles.cardContent}>
                    <View style={styles.orderInfo}>
                      <MaterialIcons name="local-shipping" size={24} color="#F59E0B" />
                      <View style={styles.orderDetails}>
                        <Text style={styles.orderTitle}>Aktif Siparişiniz</Text>
                        <Text style={styles.orderSubtitle}>
                          {currentOrder?.pickup_address ? 
                            `${currentOrder.pickup_address.substring(0, 30)}...` : 
                            'Yük taşıma siparişi'
                          }
                        </Text>
                        <Text style={styles.orderStatus}>
                          Sipariş #{currentOrder?.id} • {getOrderStatusText(currentOrder?.status)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.cardFooter}>
                    <View style={styles.progressBarContainer}>
                      <Animated.View style={[
                        styles.progressBar, 
                        { 
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                            extrapolate: 'clamp'
                          })
                        }
                      ]} />
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              // Form alanları
            (
                <>
                  <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#1F2937' }}>Yük Ağırlığı (kg)</Text>
              <TextInput
                ref={(ref) => { inputRefs.current[0] = ref; }}
                style={[
                  {
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 16,
                    backgroundColor: isFormEditable() ? '#FFFFFF' : '#F3F4F6',
                  },
                  activeInputIndex === 0 && { borderColor: '#FFD700', borderWidth: 2 },
                  !isFormEditable() && { borderColor: '#E5E7EB', color: '#9CA3AF' }
                ]}
                placeholder="Örn: 25"
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                editable={isFormEditable()}
                onFocus={() => setActiveInputIndex(0)}
                onBlur={() => setActiveInputIndex(null)}
              />
            </View>

            <View style={{ marginBottom: 20 }}>
              <YukKonumuInput
                  ref={pickupLocationRef}
                  onLocationSelect={handlePickupLocationSelect}
                  onFocus={() => setActiveInputIndex(1)}
                  onCurrentLocationPress={handlePickupCurrentLocation}
                  editable={isFormEditable()}
               />
            </View>

            <View style={{ marginBottom: 20 }}>
              <VarisNoktasiInput
                  ref={destinationLocationRef}
                  onLocationSelect={handleDestinationLocationSelect}
                  onFocus={() => setActiveInputIndex(2)}
                  onCurrentLocationPress={handleDestinationCurrentLocation}
                  editable={isFormEditable()}
               />
            </View>

            {distance && (
              <View style={styles.distanceInfo}>
                <Ionicons name="location-outline" size={20} color="#FFD700" />
                <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '600', color: '#1F2937' }}>
                  Mesafe: {distance.toFixed(1)} km
                </Text>
                <Text style={{ marginLeft: 8, fontSize: 14, color: '#6B7280' }}>
                  (Tahmini Ücret: ₺{distance ? Math.round(distance * 15) : 0})
                </Text>
              </View>
            )}

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#1F2937' }}>Yük Fotoğrafı *</Text>
              <TouchableOpacity
                style={{
                  borderWidth: 2,
                  borderColor: isFormEditable() ? '#D1D5DB' : '#E5E7EB',
                  borderStyle: 'dashed',
                  borderRadius: 8,
                  padding: 20,
                  alignItems: 'center',
                  backgroundColor: isFormEditable() ? '#F9FAFB' : '#F3F4F6',
                  opacity: isFormEditable() ? 1 : 0.6
                }}
                onPress={isFormEditable() ? handleImagePicker : undefined}
                disabled={!isFormEditable()}
              >
                {cargoImage ? (
                  <View style={styles.imageContainer}>
                    <Image source={{ uri: cargoImage }} style={{ width: 100, height: 100, borderRadius: 8 }} />
                    <TouchableOpacity
                      style={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        backgroundColor: '#EF4444',
                        borderRadius: 12,
                        width: 24,
                        height: 24,
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onPress={() => setCargoImage(null)}
                    >
                      <Ionicons name="close" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Ionicons name="camera" size={32} color="#9CA3AF" />
                    <Text style={{ marginTop: 8, fontSize: 14, color: '#6B7280' }}>Yük fotoğrafı ekle</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#1F2937' }}>Notlar (Opsiyonel)</Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: isFormEditable() ? '#D1D5DB' : '#E5E7EB',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  backgroundColor: isFormEditable() ? '#FFFFFF' : '#F3F4F6',
                  height: 80,
                  textAlignVertical: 'top',
                  color: isFormEditable() ? '#1F2937' : '#9CA3AF'
                }}
                placeholder="Yük hakkında özel notlarınız..."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                editable={isFormEditable()}
              />
            </View>



            {/* Sipariş Oluştur Butonu - Sadece aktif sipariş yoksa göster */}
            {!currentOrder && (
              <TouchableOpacity
                style={[
                  styles.createOrderButton,
                  (!weight || !pickupCoords || !destinationCoords || !cargoImage) && { opacity: 0.5 }
                ]}
                onPress={handleCreateOrder}
                disabled={!weight || !pickupCoords || !destinationCoords || !cargoImage}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>Sipariş Oluştur</Text>
              </TouchableOpacity>
            )}



            {/* Sipariş İptal Butonu - Sadece aktif sipariş varsa göster */}
            {currentOrder && ['pending', 'accepted', 'started'].includes(currentOrder.status) && (
              <TouchableOpacity
                style={{
                  backgroundColor: '#F97316',
                  borderRadius: 12,
                  padding: 16,
                  alignItems: 'center',
                  marginTop: 12,
                  borderWidth: 1,
                  borderColor: '#EA580C',
                  shadowColor: '#F97316',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 3
                }}
                onPress={initiateCancelOrder}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="close-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Siparişi İptal Et</Text>
                </View>
              </TouchableOpacity>
            )}  
                </>  
              )
            )}
            
            <View style={{ height: 100 }} />
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

      {/* Confirm Code Modal */}
      <Modal
        visible={confirmCodeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setConfirmCodeModalVisible(false)}
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
            width: '80%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5
          }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#1F2937', textAlign: 'center' }}>
              Sipariş Doğrulama
            </Text>
            <Text style={{ fontSize: 16, marginBottom: 20, color: '#6B7280', textAlign: 'center' }}>
              Sürücünün size verdiği 4 haneli doğrulama kodunu girin:
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: '#D1D5DB',
                borderRadius: 8,
                padding: 12,
                fontSize: 18,
                textAlign: 'center',
                marginBottom: 20,
                letterSpacing: 4
              }}
              placeholder="0000"
              value={userConfirmCode}
              onChangeText={setUserConfirmCode}
              keyboardType="numeric"
              maxLength={4}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#6B7280',
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 8,
                  flex: 1,
                  marginRight: 10
                }}
                onPress={() => {
                  setConfirmCodeModalVisible(false);
                  setUserConfirmCode('');
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600', textAlign: 'center' }}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: '#10B981',
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 8,
                  flex: 1,
                  marginLeft: 10
                }}
                onPress={handleConfirmCode}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600', textAlign: 'center' }}>Doğrula</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Order Modal */}
      <Modal
        visible={cancelOrderModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCancelOrderModalVisible(false)}
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
            width: '80%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5
          }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#DC2626', textAlign: 'center' }}>
              Sipariş İptal Et
            </Text>
            <Text style={{ fontSize: 16, marginBottom: 12, color: '#6B7280', textAlign: 'center' }}>
              Siparişinizi iptal etmek istediğinizden emin misiniz?
            </Text>
            <Text style={{ fontSize: 14, marginBottom: 20, color: '#DC2626', textAlign: 'center', fontWeight: '600' }}>
              Cezai Tutar: ₺{cancellationFee}
            </Text>
            <Text style={{ fontSize: 16, marginBottom: 20, color: '#6B7280', textAlign: 'center' }}>
              İptal işlemini onaylamak için 4 haneli kodu girin:
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: '#D1D5DB',
                borderRadius: 8,
                padding: 12,
                fontSize: 18,
                textAlign: 'center',
                marginBottom: 20,
                letterSpacing: 4
              }}
              placeholder="0000"
              value={userCancelCode}
              onChangeText={setUserCancelCode}
              keyboardType="numeric"
              maxLength={4}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#6B7280',
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 8,
                  flex: 1,
                  marginRight: 10
                }}
                onPress={() => {
                  setCancelOrderModalVisible(false);
                  setUserCancelCode('');
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600', textAlign: 'center' }}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: '#DC2626',
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 8,
                  flex: 1,
                  marginLeft: 10
                }}
                onPress={handleCancelOrder}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600', textAlign: 'center' }}>İptal Et</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        visible={cancelConfirmationModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setCancelConfirmationModalVisible(false)}
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
            width: '80%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5
          }}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Ionicons name="warning" size={48} color="#F59E0B" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#1F2937', textAlign: 'center' }}>
              Sipariş İptal Et
            </Text>
            <Text style={{ fontSize: 16, marginBottom: 20, color: '#6B7280', textAlign: 'center', lineHeight: 22 }}>
              Siparişinizi iptal etmek istediğinizden emin misiniz?
            </Text>
            <Text style={{ fontSize: 14, marginBottom: 24, color: '#DC2626', textAlign: 'center', fontStyle: 'italic' }}>
              İptal işlemi sonrasında sipariş durumuna göre cezai şart uygulanabilir.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#6B7280',
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 8,
                  flex: 1,
                  marginRight: 10
                }}
                onPress={() => setCancelConfirmationModalVisible(false)}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600', textAlign: 'center' }}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: '#DC2626',
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 8,
                  flex: 1,
                  marginLeft: 10
                }}
                onPress={confirmCancelOrder}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600', textAlign: 'center' }}>Evet, İptal Et</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Free Cancel Modal */}
      <Modal
        visible={freeCancelModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setFreeCancelModalVisible(false)}
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
            width: '80%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5
          }}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#1F2937', textAlign: 'center' }}>
              Ücretsiz İptal
            </Text>
            <Text style={{ fontSize: 16, marginBottom: 20, color: '#6B7280', textAlign: 'center', lineHeight: 22 }}>
              Siparişinizi ücretsiz olarak iptal edebilirsiniz. Lütfen onay kodunu girin:
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: '#D1D5DB',
                borderRadius: 8,
                padding: 12,
                fontSize: 18,
                textAlign: 'center',
                marginBottom: 20,
                letterSpacing: 4
              }}
              placeholder="0000"
              value={freeCancelConfirmCode}
              onChangeText={setFreeCancelConfirmCode}
              keyboardType="numeric"
              maxLength={4}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#6B7280',
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 8,
                  flex: 1,
                  marginRight: 10
                }}
                onPress={() => {
                  setFreeCancelModalVisible(false);
                  setFreeCancelConfirmCode('');
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600', textAlign: 'center' }}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: '#10B981',
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 8,
                  flex: 1,
                  marginLeft: 10
                }}
                onPress={() => {
                  if (freeCancelConfirmCode.length === 4) {
                     socketService.verifyCancelCode(currentOrder.id, freeCancelConfirmCode);
                     setFreeCancelModalVisible(false);
                     setFreeCancelConfirmCode('');
                   } else {
                     showModal('Hata', 'Lütfen 4 haneli onay kodunu girin.', 'error');
                   }
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600', textAlign: 'center' }}>İptal Et</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pending Order Modal */}
      <Modal
        visible={pendingOrderModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPendingOrderModalVisible(false)}
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
            width: '85%',
            maxHeight: '70%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="information-circle" size={24} color="#F59E0B" />
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginLeft: 8, color: '#1F2937' }}>
                Devam Eden Sipariş
              </Text>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 16, marginBottom: 16, color: '#6B7280', lineHeight: 22 }}>
                Devam eden bir siparişiniz bulundu. Sipariş detaylarını aşağıda görebilirsiniz:
              </Text>
              
              {currentOrder && (
                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Durum</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: currentOrder.status === 'pending' ? '#F59E0B' : 
                                       currentOrder.status === 'accepted' ? '#10B981' : '#3B82F6',
                        marginRight: 8
                      }} />
                      <Text style={{ fontSize: 14, color: '#1F2937', fontWeight: '500' }}>
                        {getOrderStatusText(currentOrder.status)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Alış Noktası</Text>
                    <Text style={{ fontSize: 14, color: '#1F2937' }}>{currentOrder.pickup_address}</Text>
                  </View>
                  
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Varış Noktası</Text>
                    <Text style={{ fontSize: 14, color: '#1F2937' }}>{currentOrder.destination_address}</Text>
                  </View>
                  
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Yük Ağırlığı</Text>
                    <Text style={{ fontSize: 14, color: '#1F2937' }}>{currentOrder.weight || 'Belirtilmemiş'} kg</Text>
                  </View>
                  
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 }}>Toplam Tutar</Text>
                    <Text style={{ fontSize: 16, color: '#059669', fontWeight: 'bold' }}>
                      ₺{currentOrder.total_price ? currentOrder.total_price.toFixed(2) : 'Hesaplanıyor'}
                    </Text>
                  </View>
                </View>
              )}
              
              <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 20, lineHeight: 20 }}>
                Sipariş bilgileriniz form alanlarına getirilecektir.
              </Text>
            </ScrollView>
            
            <View style={{ marginTop: 16 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: '#F59E0B',
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 8,
                  width: '100%'
                }}
                onPress={() => {
                  if (currentOrder) {
                    fillOrderData(currentOrder);
                  }
                  setPendingOrderModalVisible(false);
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600', textAlign: 'center' }}>Tamam</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Loading Splash Screen */}
      <LoadingSplash 
        visible={isLocationLoading && !userLocation} 
        message="Harita yükleniyor..."
      />
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
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  menuButton: {
    padding: 8,
  },
  fullMapContainer: {
    flex: 1,
    position: 'relative',
  },
  fullMap: {
    flex: 1,
  },
  floatingMenuButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: '#FFD700',
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  floatingRouteButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: '#10B981',
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driversInfo: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 12,
  },
  driverInfo: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 4,
  },
  driverMarker: {
    backgroundColor: '#10B981',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  pickupMarker: {
    backgroundColor: '#F59E0B',
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  destinationMarker: {
    backgroundColor: '#10B981',
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  formContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  keyboardDismissButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  keyboardDismissText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  createOrderButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  imageContainer: {
    position: 'relative',
  },
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  ongoingOrderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  cardContent: {
    marginBottom: 16,
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderDetails: {
    flex: 1,
    marginLeft: 12,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  orderSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  orderStatus: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    flex: 1,
    marginRight: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 4,
  },
  compactOrderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  compactCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactOrderInfo: {
    flex: 1,
  },
  compactIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  compactOrderDetails: {
    flex: 1,
  },
  compactOrderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  compactOrderStatus: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
});

export default HomeScreen;