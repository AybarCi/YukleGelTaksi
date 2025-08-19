import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
// import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';

interface Driver {
  id: string;
  latitude: number;
  longitude: number;
  heading: number;
}

export default function HomeScreen() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([
    { id: '1', latitude: 41.0082, longitude: 28.9784, heading: 45 },
    { id: '2', latitude: 41.0122, longitude: 28.9824, heading: 120 },
    { id: '3', latitude: 41.0062, longitude: 28.9744, heading: 270 },
  ]);
  
  // Yük bilgileri state'leri
  const [weight, setWeight] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [destinationLocation, setDestinationLocation] = useState('');
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [pickupCoords, setPickupCoords] = useState<{latitude: number, longitude: number} | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{latitude: number, longitude: number} | null>(null);
  const [cargoImage, setCargoImage] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [activeInputIndex, setActiveInputIndex] = useState<number | null>(null);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  
  const { logout, showModal, user } = useAuth();

  // Aktif input alanını scroll etmek için fonksiyon
  const scrollToInput = (inputIndex: number) => {
    if (scrollViewRef.current && keyboardVisible) {
      const screenHeight = Dimensions.get('window').height;
      const availableHeight = screenHeight - keyboardHeight - 150; // More padding
      const inputHeight = 48;
      const labelHeight = 22;
      const marginBottom = 20;
      const switchHeight = 56; // Switch container height
      const titleHeight = 62;
      
      let targetOffset = titleHeight;
      
      // Her input için offset hesapla
      if (inputIndex === 0) {
        // Ağırlık input'u - en üstte
        targetOffset += labelHeight + inputHeight;
      } else if (inputIndex === 1) {
        // Yükün konumu input'u
        targetOffset += labelHeight + inputHeight + marginBottom; // Ağırlık
        targetOffset += switchHeight + marginBottom; // Switch
        targetOffset += labelHeight + inputHeight; // Pickup location
      } else if (inputIndex === 2) {
        // Varış noktası input'u
        targetOffset += labelHeight + inputHeight + marginBottom; // Ağırlık
        targetOffset += switchHeight + marginBottom; // Switch
        targetOffset += labelHeight + inputHeight + marginBottom; // Pickup location
        targetOffset += labelHeight + inputHeight; // Destination
      }
      
      // Varış noktası için çok daha agresif scroll
      let scrollPosition;
      if (inputIndex === 2) {
        // Varış noktası için özel hesaplama - klavyenin çok üstünde göster
        scrollPosition = Math.max(0, targetOffset + 100); // Sabit offset ekle
      } else {
        scrollPosition = Math.max(0, targetOffset - (availableHeight * 0.4));
      }
      
      scrollViewRef.current.scrollTo({
        y: scrollPosition,
        animated: true,
      });
    }
  };

  useEffect(() => {
    getCurrentLocation();
    // Sürücü konumlarını güncellemek için interval
    const interval = setInterval(() => {
      updateDriverLocations();
    }, 5000);

    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates.height);
      // Aktif input alanını scroll et
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
      clearInterval(interval);
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);
  
  useEffect(() => {
    if (useCurrentLocation) {
      getCurrentLocation();
    } else {
      setPickupCoords(null);
      setPickupLocation('');
    }
  }, [useCurrentLocation]);
  
  const handleCurrentLocationToggle = (value: boolean) => {
    setUseCurrentLocation(value);
  };
  
  const handlePickupLocationSelect = (data: any, details: any) => {
    if (details?.geometry?.location) {
      setPickupCoords({
        latitude: details.geometry.location.lat,
        longitude: details.geometry.location.lng
      });
      setPickupLocation(data.description);
    }
  };
  
  const handleDestinationLocationSelect = (data: any, details: any) => {
    if (details?.geometry?.location) {
      setDestinationCoords({
        latitude: details.geometry.location.lat,
        longitude: details.geometry.location.lng
      });
      setDestinationLocation(data.description);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri erişim izni gereklidir.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setCargoImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Fotoğraf çekmek için kamera erişim izni gereklidir.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setCargoImage(result.assets[0].uri);
    }
  };

  const showImagePicker = () => {
    Alert.alert(
      'Yük Fotoğrafı',
      'Yükünüzün fotoğrafını nasıl eklemek istiyorsunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Galeriden Seç', onPress: pickImage },
        { text: 'Fotoğraf Çek', onPress: takePhoto },
      ]
    );
  };

  const removeImage = () => {
    setCargoImage(null);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Dünya'nın yarıçapı (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return Math.round(distance * 10) / 10; // 1 ondalık basamağa yuvarla
  };

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
  
  const handleCreateOrder = () => {
     if (!weight || !pickupCoords || !destinationCoords) {
       showModal('Eksik Bilgi', 'Lütfen tüm alanları doldurun.', 'warning');
       return;
     }
     
     showModal('Sipariş Oluşturuldu', 'Yük taşıma siparişiniz başarıyla oluşturuldu.', 'success');
   };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showModal('Konum İzni', 'Konum izni verilmedi.', 'warning');
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setUserLocation(location);
      
      // Eğer mevcut konum kullanılacaksa pickup koordinatlarını ayarla
      if (useCurrentLocation) {
        setPickupCoords({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
        setPickupLocation('Mevcut Konumum');
      }
    } catch (error) {
      showModal('Konum Hatası', 'Konum bilgisi alınamadı.', 'error');
    }
  };

  const updateDriverLocations = () => {
    // Sürücü konumlarını simüle et (gerçek uygulamada socket ile gelecek)
    setDrivers(prevDrivers => 
      prevDrivers.map(driver => ({
        ...driver,
        latitude: driver.latitude + (Math.random() - 0.5) * 0.001,
        longitude: driver.longitude + (Math.random() - 0.5) * 0.001,
        heading: (driver.heading + Math.random() * 20 - 10) % 360,
      }))
    );
  };

  const menuItems = [
    {
      title: 'Destek',
      icon: 'headset',
      iconType: 'Ionicons',
      onPress: () => {
        setMenuVisible(false);
        showModal('Destek', 'Destek sayfası yakında eklenecek.', 'info');
      }
    },
    {
      title: 'Ödeme',
      icon: 'credit-card',
      iconType: 'MaterialIcons',
      onPress: () => {
        setMenuVisible(false);
        showModal('Ödeme', 'Ödeme sayfası yakında eklenecek.', 'info');
      }
    },
    {
      title: 'Taşımalar',
      icon: 'local-shipping',
      iconType: 'MaterialIcons',
      onPress: () => {
        setMenuVisible(false);
        router.push('/shipments');
      }
    },
  ];

  const bottomMenuItems = [
    {
      title: 'YükleGel Taksi Kampanyalar',
      icon: 'card-giftcard',
      iconType: 'MaterialIcons',
      onPress: () => {
        setMenuVisible(false);
        showModal('Kampanyalar', 'Kampanyalar sayfası yakında eklenecek.', 'info');
      }
    },
    {
      title: 'Kampanyalar',
      icon: 'card-giftcard',
      iconType: 'MaterialIcons',
      onPress: () => {
        setMenuVisible(false);
        showModal('Kampanyalar', 'Kampanyalar sayfası yakında eklenecek.', 'info');
      }
    },
    {
      title: 'Aracımı Paylaşmak İstiyorum',
      icon: 'car',
      iconType: 'Ionicons',
      onPress: () => {
        setMenuVisible(false);
        showModal('Araç Paylaşımı', 'Araç paylaşımı sayfası yakında eklenecek.', 'info');
      }
    },
    {
      title: 'Ayarlar',
      icon: 'settings',
      iconType: 'Ionicons',
      onPress: () => {
        setMenuVisible(false);
        router.push('/settings');
      }
    },
    {
      title: 'Çıkış Yap',
      icon: 'logout',
      iconType: 'MaterialIcons',
      onPress: () => {
        setMenuVisible(false);
        showModal(
          'Çıkış Yap',
          'Hesabınızdan çıkış yapmak istediğinizden emin misiniz?',
          'warning',
          [
            {
              text: 'İptal',
              style: 'cancel',
              onPress: () => {}
            },
            {
              text: 'Çıkış Yap',
              style: 'destructive',
              onPress: async () => {
                await logout();
                router.replace('/splash');
              }
            }
          ]
        );
      }
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Full Screen Map */}
      <View style={styles.fullMapContainer}>
        <MapView
          style={styles.fullMap}
          initialRegion={{
            latitude: userLocation?.coords.latitude || 41.0082,
            longitude: userLocation?.coords.longitude || 28.9784,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
          onPress={() => {
            if (keyboardVisible) {
              Keyboard.dismiss();
            }
          }}
        >
          {/* Driver markers */}
          {drivers.map((driver) => (
            <Marker
              key={driver.id}
              coordinate={{
                latitude: driver.latitude,
                longitude: driver.longitude,
              }}
              title={`Sürücü ${driver.id}`}
              description="Müsait sürücü"
            >
              <View style={styles.driverMarker}>
                <Ionicons name="car" size={16} color="#FFFFFF" />
              </View>
            </Marker>
          ))}
          
          {/* Pickup location marker */}
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
          
          {/* Destination location marker */}
          {destinationCoords && (
            <Marker
              coordinate={destinationCoords}
              title="Varış Noktası"
              description="Yükün teslim edileceği adres"
            >
              <View style={styles.destinationMarker}>
                <Ionicons name="navigate" size={16} color="#FFFFFF" />
              </View>
            </Marker>
          )}
        </MapView>
        
        {/* Floating Menu Button */}
        <TouchableOpacity 
          style={styles.floatingMenuButton}
          onPress={() => setMenuVisible(true)}
        >
          <Ionicons name="menu" size={24} color="#000000" />
        </TouchableOpacity>
      </View>
      
      {/* Bottom Form Sheet */}
      <View 
        style={[
          styles.bottomSheet,
          keyboardVisible && {
            maxHeight: Dimensions.get('window').height - keyboardHeight,
            paddingBottom: 0,
          }
        ]}
      >
        <View style={styles.bottomSheetHandle} />
        <ScrollView 
          ref={scrollViewRef}
          style={[
            styles.formContainer,
            keyboardVisible && { 
              maxHeight: Dimensions.get('window').height - keyboardHeight - 50,
              flex: 1 
            }
          ]} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            keyboardVisible && { paddingBottom: 10 }
          ]}
          bounces={true}
          scrollEventThrottle={16}
          nestedScrollEnabled={true}
          automaticallyAdjustKeyboardInsets={true}
          contentInsetAdjustmentBehavior="automatic"
        >
        <View style={styles.formTitleContainer}>
          <Text style={styles.formTitle}>Yük Bilgileri</Text>
        </View>
        
        {/* Ağırlık */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Ağırlık (kg)</Text>
          <View style={styles.inputWithIcon}>
            <MaterialIcons name="fitness-center" size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              ref={(ref) => { inputRefs.current[0] = ref; }}
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              placeholder="Örn: 25"
              keyboardType="numeric"
              returnKeyType="send"
              returnKeyLabel="Bitti"
              autoComplete="off"
              autoCorrect={false}
              onFocus={() => {
                setActiveInputIndex(0);
                setTimeout(() => scrollToInput(0), 100);
              }}
              onSubmitEditing={() => Keyboard.dismiss()}
              blurOnSubmit={true}
            />
          </View>
        </View>
        
        {/* Mevcut Konum Switch */}
        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Yük mevcut konumumda</Text>
          <Switch
            value={useCurrentLocation}
            onValueChange={handleCurrentLocationToggle}
            trackColor={{ false: '#E5E7EB', true: '#FCD34D' }}
            thumbColor={useCurrentLocation ? '#F59E0B' : '#9CA3AF'}
          />
        </View>
        
        {/* Yükün Konumu */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Yükün Konumu</Text>
          {!useCurrentLocation ? (
            <View style={styles.inputWithIcon}>
              <Ionicons name="location" size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput
                ref={(ref) => { inputRefs.current[1] = ref; }}
                style={styles.input}
                value={pickupLocation}
                onChangeText={setPickupLocation}
                placeholder="Yükün alınacağı adresi girin"
                returnKeyType="done"
                returnKeyLabel="Bitti"
                autoComplete="off"
                autoCorrect={false}
                onFocus={() => {
                   setActiveInputIndex(1);
                   setTimeout(() => scrollToInput(1), 100);
                 }}
                onSubmitEditing={() => Keyboard.dismiss()}
                blurOnSubmit={true}
              />
            </View>
          ) : (
            <View style={styles.disabledInput}>
              <Ionicons name="location" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <Text style={styles.disabledInputText}>Mevcut Konumum</Text>
            </View>
          )}
        </View>
        
        {/* Varış Noktası */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Varış Noktası</Text>
          <View style={styles.inputWithIcon}>
            <Ionicons name="navigate" size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              ref={(ref) => { inputRefs.current[2] = ref; }}
              style={styles.input}
              value={destinationLocation}
              onChangeText={setDestinationLocation}
              placeholder="Yükün teslim edileceği adresi girin"
              returnKeyType="done"
              returnKeyLabel="Bitti"
              autoComplete="off"
              autoCorrect={false}
              onFocus={() => {
                 setActiveInputIndex(2);
                 setTimeout(() => scrollToInput(2), 300);
               }}
              onSubmitEditing={() => Keyboard.dismiss()}
              blurOnSubmit={true}
            />
          </View>
          {distance && (
            <View style={styles.distanceInfo}>
              <Ionicons name="location" size={16} color="#10B981" />
              <Text style={styles.distanceText}>Mesafe: {distance} km</Text>
            </View>
          )}
        </View>
        
        {/* Yük Fotoğrafı */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Yük Fotoğrafı</Text>
          {cargoImage ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: cargoImage }} style={styles.cargoImage} />
              <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
                <Ionicons name="close-circle" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addImageButton} onPress={showImagePicker}>
              <Ionicons name="camera" size={24} color="#6B7280" />
              <Text style={styles.addImageText}>Yük fotoğrafı ekle</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Sipariş Oluştur Butonu */}
        <TouchableOpacity style={styles.createOrderButton} onPress={handleCreateOrder}>
          <Text style={styles.createOrderButtonText}>Sipariş Oluştur</Text>
        </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Menu Modal */}
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
                  <Ionicons name="person" size={32} color="#FCD34D" />
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.userName}>{user?.full_name || 'Kullanıcı'}</Text>
                  <TouchableOpacity 
                    style={styles.accountButton}
                    onPress={() => {
                      setMenuVisible(false);
                      router.push('/account-details');
                    }}
                  >
                    <Text style={styles.accountButtonText}>Hesap Detayları</Text>
                  </TouchableOpacity>
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
              {/* Top Menu Items */}
              <View style={styles.topMenuItems}>
                {menuItems.map((item, index) => (
                  <TouchableOpacity 
                    key={index}
                    style={styles.topMenuItem}
                    onPress={item.onPress}
                  >
                    <View style={styles.topMenuIcon}>
                      {item.iconType === 'Ionicons' ? (
                        <Ionicons name={item.icon as any} size={24} color="#000000" />
                      ) : (
                        <MaterialIcons name={item.icon as any} size={24} color="#000000" />
                      )}
                    </View>
                    <Text style={styles.topMenuText}>{item.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Bottom Menu Items */}
              <View style={styles.bottomMenuItems}>
                {bottomMenuItems.map((item, index) => (
                  <TouchableOpacity 
                    key={index}
                    style={styles.bottomMenuItem}
                    onPress={item.onPress}
                  >
                    <View style={styles.bottomMenuIcon}>
                      {item.iconType === 'Ionicons' ? (
                        <Ionicons name={item.icon as any} size={20} color="#6B7280" />
                      ) : (
                        <MaterialIcons name={item.icon as any} size={20} color="#6B7280" />
                      )}
                    </View>
                    <Text style={styles.bottomMenuText}>{item.title}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
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
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    zIndex: 1,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    maxHeight: '50%',
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  mapPlaceholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  mapPlaceholderText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  driversInfo: {
    alignItems: 'center',
  },
  driversInfoText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  driverText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FCD34D',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  pickupMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  destinationMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  formTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  keyboardDismissButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
  },
  keyboardDismissText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#000000',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  placesContainer: {
    flex: 0,
  },
  placesInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  placesList: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginTop: 4,
  },
  disabledInput: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  disabledInputText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  createOrderButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  createOrderButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  imageContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  cargoImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 2,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  addImageText: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 8,
    fontWeight: '500',
  },
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  distanceText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
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
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  accountButton: {
    alignSelf: 'flex-start',
  },
  accountButtonText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
  },
  topMenuItems: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  topMenuItem: {
    alignItems: 'center',
    flex: 1,
  },
  topMenuIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  topMenuText: {
    fontSize: 12,
    color: '#374151',
    textAlign: 'center',
    fontWeight: '500',
  },
  bottomMenuItems: {
    paddingVertical: 16,
  },
  bottomMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  bottomMenuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  bottomMenuText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
});