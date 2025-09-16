import React, { useState, useRef, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAppDispatch, useAppSelector } from '../store';
import { createOrder } from '../store/slices/orderSlice';
import { checkDriverAvailability } from '../store/slices/driverSlice';
import YukKonumuInput, { YukKonumuInputRef } from './YukKonumuInput';
import VarisNoktasiInput, { VarisNoktasiInputRef } from './VarisNoktasiInput';
import VehicleTypeModal from './VehicleTypeModal';
import ImagePickerModal from './ImagePickerModal';

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
}

const NewOrderForm: React.FC<NewOrderFormProps> = ({
  onOrderCreated,
  userLocation,
  distance,
  estimatedPrice,
  priceLoading,
  token,
  refreshAuthToken
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

  // Modal states
  const [showVehicleTypeModal, setShowVehicleTypeModal] = useState<boolean>(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState<boolean>(false);

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
    setPickupCoords({
      latitude: location.latitude,
      longitude: location.longitude,
    });
    setPickupAddress(location.address);
  }, []);

  const handleDestinationLocationSelect = useCallback((location: any) => {
    setDestinationCoords({
      latitude: location.latitude,
      longitude: location.longitude,
    });
    setDestinationAddress(location.address);
  }, []);

  const handlePickupCurrentLocation = useCallback(() => {
    if (userLocation?.coords) {
      setPickupCoords({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
      });
      setPickupAddress('Mevcut konumunuz');
    }
  }, [userLocation]);

  const handleDestinationCurrentLocation = useCallback(() => {
    if (userLocation?.coords) {
      setDestinationCoords({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
      });
      setDestinationAddress('Mevcut konumunuz');
    }
  }, [userLocation]);

  // Vehicle type handler
  const handleVehicleTypeSelect = (vehicleType: VehicleType) => {
    setSelectedVehicleType(vehicleType);
    setShowVehicleTypeModal(false);
  };

  // Image picker handlers
  const handleImagePicker = () => {
    setShowImagePickerModal(true);
  };

  const handleImageSelected = (imageUri: string) => {
    setCargoImages(prev => [...prev, imageUri]);
    setShowImagePickerModal(false);
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

  // Create order handler
  const handleCreateOrder = useCallback(async () => {
    if (!isFormValid()) {
      Alert.alert('Eksik Bilgi', 'Lütfen tüm gerekli alanları doldurun.');
      return;
    }

    try {
      const orderData = {
        pickupAddress: pickupAddress,
        pickupLatitude: pickupCoords!.latitude,
        pickupLongitude: pickupCoords!.longitude,
        destinationAddress: destinationAddress,
        destinationLatitude: destinationCoords!.latitude,
        destinationLongitude: destinationCoords!.longitude,
        distance: distance || 0,
        estimatedTime: 30,
        notes: notes.trim(),
        vehicleTypeId: selectedVehicleType!.id.toString(),
        cargoImages: cargoImages,
      };

      await dispatch(createOrder({
        orderData,
        token: token!,
        refreshAuthToken: refreshAuthToken!
      })).unwrap();
      
      // Reset form
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

      onOrderCreated?.();
      
      Alert.alert('Başarılı', 'Siparişiniz başarıyla oluşturuldu!');
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Sipariş oluşturulurken bir hata oluştu.');
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
        {distance && (
          <View style={styles.distanceInfo}>
            <Ionicons name="location-outline" size={20} color="#FFD700" />
            <Text style={styles.distanceText}>
              Mesafe: {distance.toFixed(1)} km
            </Text>
            <Text style={styles.priceText}>
              {priceLoading ? (
                '(Ücret hesaplanıyor...)'
              ) : estimatedPrice ? (
                `(Tahmini Ücret: ₺${estimatedPrice.toFixed(2)})`
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
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 16,
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
});

export default NewOrderForm;