import * as React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import socketService from '../services/socketService';
import { API_CONFIG } from '../config/api';
import LocationInput, { LocationInputRef } from '../components/LocationInput';


interface Driver {
  id: string;
  latitude: number;
  longitude: number;
  heading: number;
  name?: string;
}

function HomeScreen() {

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
  const pickupLocationRef = useRef<LocationInputRef>(null);
  const destinationLocationRef = useRef<LocationInputRef>(null);
  const mapRef = useRef<any>(null);
  
  const { logout, showModal, user, token } = useAuth();



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
        setPickupCoords({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
        setPickupLocation('Mevcut Konumum');
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
      showModal('Sipariş Kabul Edildi', `Siparişiniz ${data.driverName} tarafından kabul edildi.`, 'success');
    });
    
    socketService.on('order_status_update', (data: any) => {
      showModal('Sipariş Durumu', `Sipariş durumu: ${data.status}`, 'info');
    });
    
    socketService.on('orderStatusUpdate', (data: any) => {
      showModal('Sipariş Güncellendi', `Sipariş durumu güncellendi: ${data.status}`, 'info');
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
      socketService.off('driver_offline');
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [user?.id]);
  
  useEffect(() => {
    if (useCurrentLocation && userLocation) {
      setPickupCoords({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude
      });
      setPickupLocation('Mevcut Konumum');
    } else if (!useCurrentLocation) {
      setPickupCoords(null);
      setPickupLocation('');
    }
  }, [useCurrentLocation, userLocation]);
  
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
  
  useEffect(() => {
    if (pickupCoords && destinationCoords) {
      const dist = calculateDistance(
        pickupCoords.latitude,
        pickupCoords.longitude,
        destinationCoords.latitude,
        destinationCoords.longitude
      );
      setDistance(dist);
    } else {
      setDistance(null);
    }
  }, [pickupCoords, destinationCoords]);
  
  const handleCreateOrder = useCallback(async () => {
    if (!weight || !pickupCoords || !destinationCoords) {
      showModal('Eksik Bilgi', 'Lütfen tüm alanları doldurun.', 'warning');
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
         weight: parseFloat(weight),
         laborCount: 1,
         estimatedPrice: distance ? Math.round(distance * 15) : 50
       };
      
      await socketService.createOrder(orderData);
      showModal('Sipariş Oluşturuldu', 'Yük taşıma siparişiniz başarıyla oluşturuldu.', 'success');
      
      setWeight('');
      setNotes('');
      setCargoImage(null);
      setPickupLocation('');
      setDestinationLocation('');
      setPickupCoords(null);
      setDestinationCoords(null);
      setDistance(null);
      
    } catch (error) {
      console.error('Sipariş oluşturma hatası:', error);
      showModal('Hata', 'Sipariş oluşturulurken bir hata oluştu.', 'error');
    }
  }, [weight, pickupCoords, destinationCoords, pickupLocation, destinationLocation, distance, showModal]);

  const handleCurrentLocationToggle = useCallback((value: boolean) => {
    setUseCurrentLocation(value);
  }, []);

  const handlePickupLocationSelect = useCallback((location: any) => {
    setPickupCoords({
      latitude: location.geometry.location.lat,
      longitude: location.geometry.location.lng
    });
    
    setPickupLocation(location.description);
    
    setSelectedLocationInfo({
      address: location.description,
      coordinates: {
        latitude: location.geometry.location.lat,
        longitude: location.geometry.location.lng
      },
      type: 'pickup'
    });
    
    setLocationModalVisible(true);
    
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.geometry.location.lat,
        longitude: location.geometry.location.lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    }
  }, []);

  const handleDestinationLocationSelect = useCallback((location: any) => {
    setDestinationCoords({
      latitude: location.geometry.location.lat,
      longitude: location.geometry.location.lng
    });
    
    setDestinationLocation(location.description);
    
    setSelectedLocationInfo({
      address: location.description,
      coordinates: {
        latitude: location.geometry.location.lat,
        longitude: location.geometry.location.lng
      },
      type: 'destination'
    });
    
    setLocationModalVisible(true);
    
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.geometry.location.lat,
        longitude: location.geometry.location.lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    }
  }, []);

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
                     provider={PROVIDER_GOOGLE}
                     style={styles.fullMap}
                     initialRegion={{
                       latitude: (userLocation?.coords.latitude || 41.0082) - 0.002,
                       longitude: userLocation?.coords.longitude || 28.9784,
                       latitudeDelta: 0.008,
                       longitudeDelta: 0.006,
                     }}
                   showsUserLocation={true}
                   showsMyLocationButton={true}
                   followsUserLocation={true}
                   userLocationPriority="high"
                   userLocationUpdateInterval={3000}
                   userLocationAnnotationTitle="Konumunuz"
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
                 >
                   {safeDrivers.length === 0 ? null : safeDrivers.map((driver) => {
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
                       >
                         <View style={styles.driverMarker}>
                           <MaterialIcons name="local-shipping" size={20} color="#FFFFFF" />
                         </View>
                       </Marker>
                     );
                   })}
                   
                   {pickupCoords && (
                     <Marker
                       coordinate={pickupCoords}
                       title="Yükün Konumu"
                       description="Yükün alınacağı adres"
                     >
                       <View style={styles.pickupMarker}>
                         <Ionicons name="location" size={16} color="#FFFFFF" />
                       </View>
                     </Marker>
                   )}
                   
                   {destinationCoords && (
                     <Marker
                       coordinate={destinationCoords}
                       title="Varış Noktası"
                       description="Yükün teslim edileceği adres"
                     >
                       <View style={styles.destinationMarker}>
                         <Ionicons name="flag" size={16} color="#FFFFFF" />
                       </View>
                     </Marker>
                   )}
                   
                   {pickupCoords && destinationCoords && (
                     <Polyline
                       coordinates={[pickupCoords, destinationCoords]}
                       strokeColor="#FFD700"
                       strokeWidth={3}
                       lineDashPattern={[5, 5]}
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

      <View style={styles.bottomSheet}>
        <View style={styles.bottomSheetHandle} />
        
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
                    backgroundColor: '#FFFFFF',
                  },
                  activeInputIndex === 0 && { borderColor: '#FFD700', borderWidth: 2 }
                ]}
                placeholder="Örn: 25"
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                onFocus={() => setActiveInputIndex(0)}
                onBlur={() => setActiveInputIndex(null)}
              />
            </View>

            <View style={{ marginBottom: 20 }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#F3F4F6',
                padding: 16,
                borderRadius: 8,
                marginBottom: 16
              }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937' }}>Mevcut Konumumu Kullan</Text>
                <Switch
                  value={useCurrentLocation}
                  onValueChange={handleCurrentLocationToggle}
                  trackColor={{ false: '#D1D5DB', true: '#FCD34D' }}
                  thumbColor={useCurrentLocation ? '#FFD700' : '#9CA3AF'}
                />
              </View>
            </View>

            {!useCurrentLocation && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#1F2937' }}>Yükün Konumu</Text>
                <LocationInput
                   ref={pickupLocationRef}
                   placeholder="Yükün alınacağı adresi girin"
                   onLocationSelect={handlePickupLocationSelect}
                   onFocus={() => setActiveInputIndex(1)}
                 />
              </View>
            )}

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#1F2937' }}>Varış Noktası</Text>
              <LocationInput
                 ref={destinationLocationRef}
                 placeholder="Yükün teslim edileceği adresi girin"
                 onLocationSelect={handleDestinationLocationSelect}
                 onFocus={() => setActiveInputIndex(2)}
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
              <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#1F2937' }}>Yük Fotoğrafı (Opsiyonel)</Text>
              <TouchableOpacity
                style={{
                  borderWidth: 2,
                  borderColor: '#D1D5DB',
                  borderStyle: 'dashed',
                  borderRadius: 8,
                  padding: 20,
                  alignItems: 'center',
                  backgroundColor: '#F9FAFB'
                }}
                onPress={handleImagePicker}
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
                  borderColor: '#D1D5DB',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  backgroundColor: '#FFFFFF',
                  height: 80,
                  textAlignVertical: 'top'
                }}
                placeholder="Yük hakkında özel notlarınız..."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.createOrderButton,
                (!weight || !pickupCoords || !destinationCoords) && { opacity: 0.5 }
              ]}
              onPress={handleCreateOrder}
              disabled={!weight || !pickupCoords || !destinationCoords}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>Sipariş Oluştur</Text>
            </TouchableOpacity>

            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>



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
    backgroundColor: '#3B82F6',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  destinationMarker: {
    backgroundColor: '#EF4444',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
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
    marginBottom: 24,
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
});

export default HomeScreen;