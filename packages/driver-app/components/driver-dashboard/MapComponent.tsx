import React, { useRef, useEffect, useState, memo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { LocationCoords, MapRegion, OrderData } from '../../types/dashboard';
import { navigationService, NavigationRoute, NavigationUpdate } from '../../services/navigationService';
import NavigationInstructions from '../NavigationInstructions';

interface MapComponentProps {
  region: MapRegion;
  driverLocation: LocationCoords | null;
  routeCoordinates: LocationCoords[];
  activeOrder: OrderData | null;
  currentPhase: 'pickup' | 'delivery' | null;
  isNavigating: boolean;
  onStartNavigation: () => void;
  onRegionChange?: (region: MapRegion) => void;
  onNavigationUpdate?: (update: NavigationUpdate) => void;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  region,
  driverLocation,
  routeCoordinates,
  activeOrder,
  currentPhase,
  isNavigating,
  onStartNavigation,
  onRegionChange,
  onNavigationUpdate,
}) => {
  const mapRef = useRef<MapView>(null);
  const [navigationRoute, setNavigationRoute] = useState<NavigationRoute | null>(null);
  const [currentNavigationUpdate, setCurrentNavigationUpdate] = useState<NavigationUpdate | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Haritayı rotaya odakla - sadece rota değiştiğinde
  useEffect(() => {
    if (mapRef.current && routeCoordinates.length > 0) {
      mapRef.current.fitToCoordinates(routeCoordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [routeCoordinates]);

  // Navigasyon durumu değiştiğinde
  useEffect(() => {
    if (isNavigating && navigationRoute && driverLocation) {
      const handleNavigationUpdate = (update: NavigationUpdate) => {
        setCurrentNavigationUpdate(update);
        
        // Haritayı güncel konuma odakla
        if (mapRef.current && update.currentLocation) {
          mapRef.current.animateToRegion({
            latitude: update.currentLocation.latitude,
            longitude: update.currentLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1000);
        }

        // Sesli komut
        if (voiceEnabled && update.currentStep) {
          playVoiceCommand(update.currentStep);
        }

        // Rota dışına çıkma uyarısı
        if (update.offRoute) {
          Alert.alert('Uyarı', 'Rotadan çıktınız. Yeniden rota hesaplanıyor...');
        }

        // Parent component'e güncelleme gönder
        if (onNavigationUpdate) {
          onNavigationUpdate(update);
        }
      };

      // Navigasyon zaten aktifse tekrar başlatma
      if (!navigationService.isNavigating()) {
        console.log('MapComponent: Navigasyon başlatılıyor...');
        navigationService.startNavigation(driverLocation, handleNavigationUpdate);
      } else {
        console.log('MapComponent: Navigasyon zaten aktif, tekrar başlatılmıyor');
      }
      setShowInstructions(true);

      return () => {
        // Component unmount olduğunda sadece kendi state'ini temizle
        // Navigasyonun durdurulması parent component'in sorumluluğundadır
        console.log('MapComponent: Cleanup, navigasyon durdurulmuyor (parent sorumlu)');
        setShowInstructions(false);
      };
    } else {
      console.log('MapComponent: Navigasyon koşulları sağlanmadı, navigasyon durduruluyor');
      navigationService.stopNavigation();
      setShowInstructions(false);
    }
  }, [isNavigating, navigationRoute, driverLocation, voiceEnabled]);

  // Sürücü konumu değiştiğinde navigasyon servisini güncelle
  useEffect(() => {
    if (driverLocation && isNavigating) {
      navigationService.updateLocation(driverLocation);
    }
  }, [driverLocation, isNavigating]);

  const getPhaseColor = () => {
    switch (currentPhase) {
      case 'pickup':
        return '#FFD700'; // Sarı - Yük alma
      case 'delivery':
        return '#EF4444'; // Kırmızı - Teslimat
      default:
        return '#2196F3'; // Mavi - Varsayılan
    }
  };

  const getPhaseText = () => {
    switch (currentPhase) {
      case 'pickup':
        return 'Yük Alma';
      case 'delivery':
        return 'Teslimat';
      default:
        return 'Navigasyon';
    }
  };

  // Sesli navigasyon komutu
  const playVoiceCommand = (step: any) => {
    // Expo Speech API kullanılabilirse burada implemente edilecek
    // Şimdilik sadece console.log ile göster
    console.log('🔊 Sesli Komut:', step.instruction);
  };

  // Navigasyon butonu tıklama - Sadece rota hesapla, navigasyonu parent başlatsın
  const handleNavigationPress = async () => {
    if (!activeOrder || !currentPhase || !driverLocation) {
      Alert.alert('Hata', 'Navigasyon başlatılamadı. Konum veya sipariş bilgisi eksik.');
      return;
    }

    try {
      let destination;
      if (currentPhase === 'pickup') {
        destination = {
          latitude: activeOrder.pickupLatitude,
          longitude: activeOrder.pickupLongitude
        };
      } else {
        destination = {
          latitude: activeOrder.destinationLatitude,
          longitude: activeOrder.destinationLongitude
        };
      }

      // Sadece rota hesapla, navigasyonu parent başlatsın
      console.log('MapComponent: Rota hesaplanıyor...');
      const route = await navigationService.calculateRoute(driverLocation, destination);
      setNavigationRoute(route);
      console.log('MapComponent: Rota hesaplandı, parent navigasyon başlatacak');
      
      // Parent component'e navigasyon başlatma sinyali gönder
      onStartNavigation();
      
    } catch (error) {
      console.error('MapComponent: Rota hesaplama hatası:', error);
      Alert.alert('Hata', 'Navigasyon rotası hesaplanamadı.');
    }
  };

  const renderDestinationMarker = () => {
    if (!activeOrder || !currentPhase) return null;

    let destination;
    let title;
    let description;
    let markerId;

    if (currentPhase === 'pickup') {
      // Koordinat kontrolü - geçerli sayılar mı?
      const pickupLat = activeOrder.pickupLatitude;
      const pickupLng = activeOrder.pickupLongitude;
      
      // Null/undefined kontrolü
      if (pickupLat == null || pickupLng == null) {
        return null;
      }
      
      // Tip kontrolü ve değer aralığı kontrolü
      const latNum = Number(pickupLat);
      const lngNum = Number(pickupLng);
      
      if (isNaN(latNum) || isNaN(lngNum) || 
          latNum < -90 || latNum > 90 || 
          lngNum < -180 || lngNum > 180) {
        return null;
      }
      
      destination = {
        latitude: latNum,
        longitude: lngNum,
      };
      title = 'Yük Alma Noktası';
      description = activeOrder.pickupAddress || 'Yük alma noktası';
      markerId = `pickup-${activeOrder.id}`;
    } else {
      // Koordinat kontrolü - geçerli sayılar mı?
      const deliveryLat = activeOrder.destinationLatitude;
      const deliveryLng = activeOrder.destinationLongitude;
      
      // Null/undefined kontrolü
      if (deliveryLat == null || deliveryLng == null) {
        return null;
      }
      
      // Tip kontrolü ve değer aralığı kontrolü
      const latNum = Number(deliveryLat);
      const lngNum = Number(deliveryLng);
      
      if (isNaN(latNum) || isNaN(lngNum) || 
          latNum < -90 || latNum > 90 || 
          lngNum < -180 || lngNum > 180) {
        return null;
      }
      
      destination = {
        latitude: latNum,
        longitude: lngNum,
      };
      title = 'Teslimat Noktası';
      description = activeOrder.destinationAddress || 'Teslimat noktası';
      markerId = `delivery-${activeOrder.id}`;
    }

    return (
      <Marker
        key={markerId}
        coordinate={destination}
        title={title}
        description={description}
        pinColor={getPhaseColor()}
      />
    );
  };

  return (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={region}
        onRegionChangeComplete={onRegionChange}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={true}
          showsScale={true}
          showsBuildings={true}
          showsTraffic={true}
          mapType="standard"
          moveOnMarkerPress={false}
        >
          {/* Sürücü konumu - Her zaman görünür */}
          {driverLocation && driverLocation.latitude && driverLocation.longitude && (
            <Marker
              key="driver-marker"
              coordinate={{
                latitude: parseFloat(driverLocation.latitude.toString()),
                longitude: parseFloat(driverLocation.longitude.toString())
              }}
              title="Konumunuz"
              description="Mevcut konum"
            >
              <View style={styles.driverMarker}>
                <View style={styles.driverMarkerInner}>
                  <Ionicons name="car" size={16} color="#FFFFFF" />
                </View>
              </View>
            </Marker>
          )}

          {/* Hedef konum */}
          {renderDestinationMarker()}

          {/* Rota çizgisi */}
          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates.filter(coord => 
                coord && 
                typeof coord.latitude === 'number' && 
                typeof coord.longitude === 'number' &&
                !isNaN(coord.latitude) && 
                !isNaN(coord.longitude) &&
                coord.latitude >= -90 && coord.latitude <= 90 &&
                coord.longitude >= -180 && coord.longitude <= 180
              )}
              strokeColor={getPhaseColor()}
              strokeWidth={4}
            />
          )}
        </MapView>

      {/* Navigasyon talimatları */}
      <NavigationInstructions
        isVisible={showInstructions}
        currentStep={currentNavigationUpdate?.currentStep || null}
        nextStep={currentNavigationUpdate?.nextStep || null}
        distanceToDestination={currentNavigationUpdate?.distanceToDestination || 0}
        timeToDestination={currentNavigationUpdate?.timeToDestination || 0}
        isNavigating={isNavigating}
        onCloseNavigation={() => {
          navigationService.stopNavigation();
          setShowInstructions(false);
        }}
        onVoiceToggle={() => setVoiceEnabled(!voiceEnabled)}
        voiceEnabled={voiceEnabled}
      />

      {/* Navigasyon butonu */}
      {activeOrder && currentPhase && (
        <TouchableOpacity
          style={[
            styles.navigationButton,
            { backgroundColor: getPhaseColor() }
          ]}
          onPress={handleNavigationPress}
          disabled={isNavigating}
        >
          <Ionicons 
            name={isNavigating ? "navigate" : "navigate-outline"} 
            size={20} 
            color="#FFFFFF" 
          />
          <Text style={styles.navigationButtonText}>
            {isNavigating ? 'Navigasyon Aktif' : getPhaseText()}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  driverMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  driverMarkerInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navigationButton: {
    position: 'absolute',
    top: 16,
    right: 16,
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
});

// Memoization ile gereksiz re-render'ları önle
export default memo(MapComponent, (prevProps, nextProps) => {
  // Sadece gerçekten değişen prop'ları kontrol et
  return (
    prevProps.region === nextProps.region &&
    prevProps.driverLocation?.latitude === nextProps.driverLocation?.latitude &&
    prevProps.driverLocation?.longitude === nextProps.driverLocation?.longitude &&
    prevProps.routeCoordinates === nextProps.routeCoordinates &&
    prevProps.activeOrder?.id === nextProps.activeOrder?.id &&
    prevProps.currentPhase === nextProps.currentPhase &&
    prevProps.isNavigating === nextProps.isNavigating
  );
});