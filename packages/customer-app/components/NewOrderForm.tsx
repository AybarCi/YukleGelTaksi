import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAppDispatch, useAppSelector } from '../store';
import { createOrder } from '../store/slices/orderSlice';
import { checkDriverAvailability } from '../store/slices/driverSlice';
import YukKonumuInput, { YukKonumuInputRef } from './YukKonumuInput';
import VarisNoktasiInput, { VarisNoktasiInputRef } from './VarisNoktasiInput';
import VehicleTypeModal from './VehicleTypeModal';
import ImagePickerModal from './ImagePickerModal';
import PhotoSuccessModal from './PhotoSuccessModal';
import DriverNotFoundModal from './DriverNotFoundModal';
import NewOrderCreatedModal from './NewOrderCreatedModal';
import { usePriceCalculation } from '../app/utils/priceUtils';

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface VehicleType {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  image_url?: string;
  base_price?: number;
}

interface NewOrderFormProps {
  onOrderCreated?: () => void;
  userLocation?: any;
  distance?: number;
  estimatedPrice?: number;
  priceLoading?: boolean;
  token?: string;
  refreshAuthToken?: () => Promise<boolean>;
  onPickupLocationChange?: (coords: LocationCoords | null, address: string) => void;
  onDestinationLocationChange?: (coords: LocationCoords | null, address: string) => void;
}

const NewOrderForm: React.FC<NewOrderFormProps> = ({
  onOrderCreated,
  userLocation,
  distance,
  estimatedPrice,
  priceLoading,
  token,
  refreshAuthToken,
  onPickupLocationChange,
  onDestinationLocationChange,
}) => {
  const dispatch = useAppDispatch();
  const { vehicleTypes: reduxVehicleTypes, selectedVehicleType: reduxSelectedVehicleType } = useAppSelector(state => state.vehicle);
  const { loading: orderLoading } = useAppSelector(state => state.order);

  // Form state
  const [selectedVehicleType, setSelectedVehicleType] = useState<VehicleType | null>(reduxSelectedVehicleType);
  const [pickupCoords, setPickupCoords] = useState<LocationCoords | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<LocationCoords | null>(null);
  const [pickupAddress, setPickupAddress] = useState<string>('');
  const [destinationAddress, setDestinationAddress] = useState<string>('');
  const [cargoImages, setCargoImages] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [activeInputIndex, setActiveInputIndex] = useState<number>(0);
  const [keyboardVisible, setKeyboardVisible] = useState<boolean>(false);

  // Yerel error handling için state
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Local price calculation states
  const [localEstimatedPrice, setLocalEstimatedPrice] = useState<number | null>(estimatedPrice || null);
  const [localPriceLoading, setLocalPriceLoading] = useState<boolean>(priceLoading || false);
  const [localDistance, setLocalDistance] = useState<number | null>(distance || null);

  // Price calculation hook
  const { calculatePrice } = usePriceCalculation(setLocalPriceLoading, setLocalEstimatedPrice);

  // Modal states
  const [showVehicleTypeModal, setShowVehicleTypeModal] = useState<boolean>(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState<boolean>(false);
  const [photoSuccessModalVisible, setPhotoSuccessModalVisible] = useState(false);
  const [addedPhotoCount, setAddedPhotoCount] = useState(0);
  const [driverNotFoundModalVisible, setDriverNotFoundModalVisible] = useState(false);
  const [driverNotFoundMessage, setDriverNotFoundMessage] = useState('');
  const [newOrderCreatedModalVisible, setNewOrderCreatedModalVisible] = useState(false);
  const [createdOrderData, setCreatedOrderData] = useState<any>(null);

  // Refs
  const pickupLocationRef = useRef<YukKonumuInputRef>(null);
  const destinationLocationRef = useRef<VarisNoktasiInputRef>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Keyboard listeners
  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Location handlers
  const handlePickupLocationSelect = useCallback((location: any) => {
    // Pickup location selected
    
    const coords = {
      latitude: location.coordinates.latitude,
      longitude: location.coordinates.longitude,
    };
    
    // Pickup coordinates created
    
    setPickupCoords(coords);
    setPickupAddress(location.address);
    
    // Pickup state updated
    
    // Input'u güncelle
    if (pickupLocationRef.current) {
      // Setting pickup address text
      pickupLocationRef.current.setAddressText(location.address);
    } else {
      // Error: pickupLocationRef.current is null
    }
    
    // Harita koordinatlarını güncelle
    if (onPickupLocationChange) {
      // Calling onPickupLocationChange callback
      onPickupLocationChange(coords, location.address);
    } else {
      // Error: onPickupLocationChange callback not available
    }
  }, [onPickupLocationChange]);

  const handleDestinationLocationSelect = useCallback((location: any) => {
    // Destination location selected
    
    const coords = {
      latitude: location.coordinates.latitude,
      longitude: location.coordinates.longitude,
    };
    
    // Destination coordinates created
    
    setDestinationCoords(coords);
    setDestinationAddress(location.address);
    
    // Destination state updated
    
    // Input'u güncelle
    if (destinationLocationRef.current) {
      // Setting destination address text
      destinationLocationRef.current.setAddressText(location.address);
    } else {
      // Error: destinationLocationRef.current is null
    }
    
    // Harita koordinatlarını güncelle
    if (onDestinationLocationChange) {
      // Calling onDestinationLocationChange callback
      onDestinationLocationChange(coords, location.address);
    } else {
      // Error: onDestinationLocationChange callback not available
    }
  }, [onDestinationLocationChange]);

  const handlePickupCurrentLocation = useCallback(async () => {
    // Pickup current location selected
    
    if (userLocation && userLocation.coords) {
      const coords = {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
      };
      
      // Pickup current location coordinates
      
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
          setPickupAddress(finalAddress);
          
          // Reverse geocoding successful
          
          // Input'u güncelle
          if (pickupLocationRef.current) {
            // Setting pickup address text
        pickupLocationRef.current.setAddressText(finalAddress);
      } else {
        // Error: pickupLocationRef.current is null
          }
          
          // Harita koordinatlarını güncelle
          if (onPickupLocationChange) {
            // Calling onPickupLocationChange callback
        onPickupLocationChange(coords, finalAddress);
      } else {
        // Error: onPickupLocationChange callback not available
          }
        } else {
          setPickupAddress('Mevcut Konumum');
          if (pickupLocationRef.current) {
            pickupLocationRef.current.setAddressText('Mevcut Konumum');
          }
          if (onPickupLocationChange) {
            onPickupLocationChange(coords, 'Mevcut Konumum');
          }
        }
      } catch (error) {
        console.error('🔥 YÜKÜN KONUMU - Reverse geocoding hatası:', error);
        setPickupAddress('Mevcut Konumum');
        if (pickupLocationRef.current) {
          pickupLocationRef.current.setAddressText('Mevcut Konumum');
        }
        if (onPickupLocationChange) {
          onPickupLocationChange(coords, 'Mevcut Konumum');
        }
      }
    } else {
      // Error: userLocation or userLocation.coords is null/undefined
    }
  }, [userLocation, onPickupLocationChange]);

  const handleDestinationCurrentLocation = useCallback(async () => {
    // Destination current location selected
    
    if (userLocation && userLocation.coords) {
      const coords = {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
      };
      
      // Destination current location coordinates
      
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
          setDestinationAddress(finalAddress);
          
          // Reverse geocoding successful
          
          // Input'u güncelle
          if (destinationLocationRef.current) {
            // Setting destination address text
        destinationLocationRef.current.setAddressText(finalAddress);
      } else {
        // Error: destinationLocationRef.current is null
          }
          
          // Harita koordinatlarını güncelle
          if (onDestinationLocationChange) {
            // Calling onDestinationLocationChange callback
        onDestinationLocationChange(coords, finalAddress);
      } else {
        // Error: onDestinationLocationChange callback not available
          }
        } else {
          setDestinationAddress('Mevcut Konumum');
          if (destinationLocationRef.current) {
            destinationLocationRef.current.setAddressText('Mevcut Konumum');
          }
          if (onDestinationLocationChange) {
            onDestinationLocationChange(coords, 'Mevcut Konumum');
          }
        }
      } catch (error) {
        console.error('🟢 VARIŞ NOKTASI - Reverse geocoding hatası:', error);
        setDestinationAddress('Mevcut Konumum');
        if (destinationLocationRef.current) {
          destinationLocationRef.current.setAddressText('Mevcut Konumum');
        }
        if (onDestinationLocationChange) {
          onDestinationLocationChange(coords, 'Mevcut Konumum');
        }
      }
    } else {
      // Error: userLocation or userLocation.coords is null/undefined
    }
  }, [userLocation, onDestinationLocationChange]);

  // Vehicle type handler
  const handleVehicleTypeSelect = (vehicleType: VehicleType) => {
    setSelectedVehicleType(vehicleType);
    setShowVehicleTypeModal(false);
  };

  // Distance calculation function
  const calculateDistance = useCallback((pickup: LocationCoords, destination: LocationCoords): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (destination.latitude - pickup.latitude) * Math.PI / 180;
    const dLon = (destination.longitude - pickup.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(pickup.latitude * Math.PI / 180) * Math.cos(destination.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // Effect to calculate distance and price when coordinates change
  useEffect(() => {
    if (pickupCoords && destinationCoords) {
      const calculatedDistance = calculateDistance(pickupCoords, destinationCoords);
      setLocalDistance(calculatedDistance);
      
      // Distance calculated
      
      // If we have a selected vehicle type, calculate price
      if (selectedVehicleType) {
        // Vehicle type available, calculating price
        calculatePrice(calculatedDistance, selectedVehicleType);
      }
    } else {
      setLocalDistance(null);
      setLocalEstimatedPrice(null);
    }
  }, [pickupCoords, destinationCoords, selectedVehicleType, calculateDistance, calculatePrice]);

  // Effect to calculate price when vehicle type changes
  useEffect(() => {
    if (localDistance && selectedVehicleType) {
      // Vehicle type changed, recalculating price
      calculatePrice(localDistance, selectedVehicleType);
    }
  }, [selectedVehicleType, localDistance, calculatePrice]);

  // Image picker handlers
  const handleImagePicker = () => {
    setShowImagePickerModal(true);
  };

  const handleImageSelected = async (source: 'camera' | 'gallery') => {
    try {
      let result;
      if (source === 'camera') {
        // Kamera izni kontrolü
        const cameraPermission = await ImagePicker.getCameraPermissionsAsync();
        if (cameraPermission.status !== 'granted') {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            showLocalErrorModal(
              'Kamera İzni Gerekli',
              'Fotoğraf çekebilmek için kamera izni gereklidir.'
            );
            return;
          }
        }
        
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      } else {
        // Galeri izni kontrolü
        const mediaPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (mediaPermission.status !== 'granted') {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            showLocalErrorModal(
              'Galeri İzni Gerekli',
              'Fotoğraf seçebilmek için galeri izni gereklidir.'
            );
            return;
          }
        }
        
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          aspect: [4, 3],
          quality: 0.8,
          allowsMultipleSelection: true,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImages = result.assets.map(asset => asset.uri);
        setCargoImages(prev => [...prev, ...newImages]);
        
        // Success modalı göstermeden ÖNCE koordinat bilgilerini Home bileşenine tekrar ilet
        // Bu sayede haritadaki markerlar ve rota korunur
        if (pickupCoords && onPickupLocationChange) {
          onPickupLocationChange(pickupCoords, pickupAddress);
        }
        if (destinationCoords && onDestinationLocationChange) {
          onDestinationLocationChange(destinationCoords, destinationAddress);
        }
        
        // PhotoSuccessModal'ı göster
        setAddedPhotoCount(newImages.length);
        setPhotoSuccessModalVisible(true);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      showLocalErrorModal('Hata', 'Fotoğraf seçilirken bir hata oluştu.');
    }
  };

  const removeImage = (index: number) => {
    setCargoImages(prev => prev.filter((_, i) => i !== index));
  };

  // Form validation
  const isFormValid = () => {
    return (
      selectedVehicleType &&
      pickupCoords &&
      destinationCoords &&
      cargoImages.length > 0
    );
  };

  // Yerel error modal handler
  const showLocalErrorModal = (title: string, message: string) => {
    setErrorTitle(title);
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  // Create order handler
  const handleCreateOrder = useCallback(async () => {
    // Önce tüm modalları kapat
    setErrorModalVisible(false);
    setDriverNotFoundModalVisible(false);
    setNewOrderCreatedModalVisible(false);
    
    if (!isFormValid()) {
      showLocalErrorModal('Eksik Bilgi', 'Lütfen tüm gerekli alanları doldurun.');
      return;
    }

    try {
      // Check driver availability before creating order
      const availabilityResult = await dispatch(checkDriverAvailability({
        pickupLatitude: pickupCoords!.latitude,
        pickupLongitude: pickupCoords!.longitude,
        vehicleTypeId: selectedVehicleType!.id,
      })).unwrap();

      if (!availabilityResult.available) {
        setDriverNotFoundMessage('Konumunuz ve seçtiğiniz araç tipine uygun sürücü bulunamamıştır. Lütfen daha sonra tekrar deneyin.');
        setDriverNotFoundModalVisible(true);
        return;
      }

      const orderData = {
        pickupAddress: pickupAddress,
        pickupLatitude: pickupCoords!.latitude,
        pickupLongitude: pickupCoords!.longitude,
        destinationAddress: destinationAddress,
        destinationLatitude: destinationCoords!.latitude,
        destinationLongitude: destinationCoords!.longitude,
        distance: localDistance || distance || 0,
        estimatedTime: 30,
        notes: notes.trim(),
        vehicleTypeId: selectedVehicleType!.id.toString(),
        cargoImages: cargoImages,
      };

      const result = await dispatch(createOrder({
        orderData,
        token: token!,
        refreshAuthToken: refreshAuthToken!
      })).unwrap();
      
      // Order creation result received
      
      // Success - Show NewOrderCreatedModal
      // API'den gelen response yapısını kontrol et
      if (result) {
        const orderId = result.id || result.order_id || result.orderId;
        // Order ID extracted
        
        const orderData = {
          id: orderId || Date.now(), // Fallback ID
          pickupAddress: pickupAddress,
          destinationAddress: destinationAddress,
          estimatedPrice: localEstimatedPrice || estimatedPrice || 0,
          distance: localDistance || distance || 0
        };
        
        // Setting order data
        setCreatedOrderData(orderData);
        
        // Önce tüm diğer modalları kapat
        setShowVehicleTypeModal(false);
        setShowImagePickerModal(false);
        setPhotoSuccessModalVisible(false);
        setDriverNotFoundModalVisible(false);
        setErrorModalVisible(false);
        
        // All other modals closed, showing success modal
        
        // Modal state'ini hemen güncelle - DISABLED to prevent modal conflict
        // setNewOrderCreatedModalVisible(true);
        // NewOrderCreatedModal visibility set to true - DISABLED
        
        // Callback'i çağır
        onOrderCreated?.();
        // onOrderCreated callback called
        
      } else {
        console.error('❌ Invalid order creation result:', result);
        showLocalErrorModal('Hata', 'Sipariş oluşturuldu ancak detaylar alınamadı.');
      }
      
      // Don't reset form here - let the modal handle it
    } catch (error: any) {
      console.error('Order creation error:', error);
      showLocalErrorModal('Hata', error.message || 'Sipariş oluşturulurken bir hata oluştu.');
    }
  }, [isFormValid, pickupCoords, destinationCoords, pickupAddress, destinationAddress, selectedVehicleType, cargoImages, notes, estimatedPrice, distance, dispatch, onOrderCreated]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Form Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Yük Taşıma Siparişi</Text>
          {keyboardVisible && (
            <TouchableOpacity
              style={styles.keyboardDismissButton}
              onPress={() => Keyboard.dismiss()}
            >
              <Text style={styles.keyboardDismissText}>Klavyeyi Kapat</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Vehicle Type Selection */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Araç Tipi</Text>
          <TouchableOpacity
            style={styles.vehicleTypeButton}
            onPress={() => setShowVehicleTypeModal(true)}
          >
            <Text style={[
              styles.vehicleTypeText,
              selectedVehicleType ? styles.selectedText : styles.placeholderText
            ]}>
              {selectedVehicleType ? selectedVehicleType.name : 'Araç tipi seçin'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Pickup Location */}
        <View style={styles.fieldContainer}>
          <YukKonumuInput
            ref={pickupLocationRef}
            onLocationSelect={handlePickupLocationSelect}
            onFocus={() => setActiveInputIndex(1)}
            onCurrentLocationPress={handlePickupCurrentLocation}
            editable={true}
          />
        </View>

        {/* Destination Location */}
        <View style={styles.fieldContainer}>
          <VarisNoktasiInput
            ref={destinationLocationRef}
            onLocationSelect={handleDestinationLocationSelect}
            onFocus={() => setActiveInputIndex(2)}
            onCurrentLocationPress={handleDestinationCurrentLocation}
            editable={true}
          />
        </View>

        {/* Distance and Price Info */}
        {(localDistance || distance) && (
          <View style={styles.distanceInfo}>
            <Ionicons name="location-outline" size={20} color="#FFD700" />
            <Text style={styles.distanceText}>
              Mesafe: {(localDistance || distance)?.toFixed(1)} km
            </Text>
            <Text style={styles.priceText}>
              {(localPriceLoading || priceLoading) ? (
                '(Ücret hesaplanıyor...)'
              ) : (localEstimatedPrice || estimatedPrice) ? (
                `(Tahmini Ücret: ₺${(localEstimatedPrice || estimatedPrice)?.toFixed(2)})`
              ) : (
                '(Ücret hesaplanamadı)'
              )}
            </Text>
          </View>
        )}

        {/* Cargo Images */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Yük Fotoğrafı *</Text>
          {cargoImages.length > 0 ? (
            <View style={styles.imageContainer}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={true}
                style={styles.imageScrollView}
                contentContainerStyle={styles.imageScrollContent}
              >
                {cargoImages.map((imageUri, index) => (
                  <View key={index} style={styles.imageWrapper}>
                    <Image source={{ uri: imageUri }} style={styles.cargoImage} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addImageButton}
                  onPress={handleImagePicker}
                >
                  <Ionicons name="add" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              </ScrollView>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.imagePickerButton}
              onPress={handleImagePicker}
            >
              <Ionicons name="camera" size={32} color="#9CA3AF" />
              <Text style={styles.imagePickerText}>Yük fotoğrafı ekle</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Notes */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Notlar (Opsiyonel)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Yük hakkında özel notlarınız..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Create Order Button */}
        <TouchableOpacity
          style={[
            styles.createOrderButton,
            !isFormValid() && styles.disabledButton
          ]}
          onPress={handleCreateOrder}
          disabled={!isFormValid() || orderLoading}
        >
          {orderLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.createOrderButtonText}>Sipariş Oluştur</Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Modals */}
      <VehicleTypeModal
        visible={showVehicleTypeModal}
        onClose={() => setShowVehicleTypeModal(false)}
        vehicleTypes={reduxVehicleTypes}
        selectedVehicleType={selectedVehicleType}
        onSelectVehicleType={handleVehicleTypeSelect}
      />

      <ImagePickerModal
        visible={showImagePickerModal}
        onClose={() => setShowImagePickerModal(false)}
        onPickImage={handleImageSelected}
      />

      <PhotoSuccessModal
        visible={photoSuccessModalVisible}
        onClose={() => setPhotoSuccessModalVisible(false)}
        photoCount={addedPhotoCount}
      />

      <DriverNotFoundModal
        visible={driverNotFoundModalVisible}
        onClose={() => setDriverNotFoundModalVisible(false)}
        message={driverNotFoundMessage}
      />

      <NewOrderCreatedModal
        visible={newOrderCreatedModalVisible}
        onClose={() => {
          // NewOrderCreatedModal closing
          setNewOrderCreatedModalVisible(false);
          setCreatedOrderData(null);
          
          // Reset form after modal is closed - setTimeout ile async yap
          setTimeout(() => {
            setSelectedVehicleType(null);
            setPickupCoords(null);
            setDestinationCoords(null);
            setPickupAddress('');
            setDestinationAddress('');
            setCargoImages([]);
            setNotes('');
            
            // Clear inputs
            pickupLocationRef.current?.clear();
            destinationLocationRef.current?.clear();
            
            // Form reset completed
          }, 100);
        }}
        orderData={createdOrderData}
      />

      {/* Yerel Error Modal */}
      <Modal
        visible={errorModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.errorModalContainer}>
            <View style={styles.errorModalHeader}>
              <Ionicons name="alert-circle" size={24} color="#EF4444" />
              <Text style={styles.errorModalTitle}>{errorTitle}</Text>
            </View>
            <Text style={styles.errorModalMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.errorModalButton}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.errorModalButtonText}>Tamam</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingBottom: 20,
    width: '100%',
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  keyboardDismissButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  keyboardDismissText: {
    fontSize: 12,
    color: '#6B7280',
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1F2937',
  },
  vehicleTypeButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleTypeText: {
    fontSize: 16,
  },
  selectedText: {
    color: '#1F2937',
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  distanceText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  priceText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  imageContainer: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    minHeight: 130,
    maxHeight: 130,
  },
  imageScrollView: {
    flex: 1,
  },
  imageScrollContent: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 15,
  },
  imageWrapper: {
    marginRight: 8,
    position: 'relative',
  },
  cargoImage: {
    width: 90,
    height: 90,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageButton: {
    width: 90,
    height: 90,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginLeft: 8,
  },
  imagePickerButton: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    minHeight: 80,
  },
  imagePickerText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    height: 80,
    textAlignVertical: 'top',
    color: '#1F2937',
  },
  createOrderButton: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  disabledButton: {
    opacity: 0.5,
  },
  createOrderButtonText: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomSpacer: {
    height: 100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    maxWidth: 300,
    width: '100%',
  },
  errorModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  errorModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  errorModalMessage: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 22,
  },
  errorModalButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  errorModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
});

export default NewOrderForm;