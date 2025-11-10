import React, { memo } from 'react';
import { View, ActivityIndicator, Text, Keyboard } from 'react-native';
import MapView, { PROVIDER_GOOGLE, PROVIDER_DEFAULT, Polyline, Marker } from 'react-native-maps';
import { Platform, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { styles } from '../app/styles';

// Memoize edilmiş driver marker bileşeni
 const DriverMarker = memo(({ driver }: { driver: any }) => (
   <Marker
     key={driver.id}
     coordinate={{
       latitude: parseFloat(driver.latitude),
       longitude: parseFloat(driver.longitude),
     }}
     title={driver.name || 'Sürücü'}
     description={`${driver.name} - ${driver.vehicle_type}`}
     anchor={{ x: 0.5, y: 0.5 }}
   >
     <View style={{ 
       backgroundColor: '#3B82F6', 
       borderRadius: 20, 
       padding: 8,
       shadowColor: '#000',
       shadowOffset: { width: 0, height: 2 },
       shadowOpacity: 0.3,
       shadowRadius: 3,
       elevation: 5
     }}>
       <MaterialIcons name="directions-car" size={24} color="#FFFFFF" />
     </View>
   </Marker>
 ));

 // Memoize edilmiş pickup marker bileşeni - PAKET/KUTU İKONU (SARI BEYAZ)
const PickupMarker = memo(({ coordinate }: { coordinate: { latitude: number; longitude: number } }) => (
  <Marker
    coordinate={coordinate}
    title="Yükün Konumu"
    anchor={{ x: 0.5, y: 0.5 }}
  >
    <View style={{ 
      backgroundColor: '#F59E0B', 
      borderRadius: 20, 
      padding: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 5
    }}>
      <MaterialIcons name="inventory" size={24} color="#FFFFFF" />
    </View>
  </Marker>
));

 // Memoize edilmiş destination marker bileşeni - BAYRAK/BİTİŞ İKONU (SİYAH BEYAZ)
const DestinationMarker = memo(({ coordinate }: { coordinate: { latitude: number; longitude: number } }) => (
  <Marker
    coordinate={coordinate}
    title="Varış Noktası"
    anchor={{ x: 0.5, y: 0.5 }}
  >
    <View style={{ 
      backgroundColor: '#000000', 
      borderRadius: 20, 
      padding: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 5
    }}>
      <MaterialIcons name="flag" size={24} color="#FFFFFF" />
    </View>
  </Marker>
));

interface MapViewComponentProps {
  mapRef: any;
  isLocationLoading: boolean;
  userLocation: any;
  bottomSheetHeight: any;
  screenHeight: number;
  safeDrivers: any[];
  reduxCurrentOrder: any;
  activeOrderPickupCoords: { latitude: number; longitude: number } | null;
  activeOrderDestinationCoords: { latitude: number; longitude: number } | null;
  pickupCoords: { latitude: number; longitude: number } | null;
  destinationCoords: { latitude: number; longitude: number } | null;
  activeOrderRouteCoordinates: any[];
  routeCoordinates: any[];
  estimatedPrice?: number;
  distance?: number;
  keyboardVisible: boolean;
  lastRouteUpdate: number;
  setUserInteractedWithMap: (value: boolean) => void;
}

export const MapViewComponent = memo(({
  mapRef,
  isLocationLoading,
  userLocation,
  bottomSheetHeight,
  screenHeight,
  safeDrivers,
  reduxCurrentOrder,
  activeOrderPickupCoords,
  activeOrderDestinationCoords,
  pickupCoords,
  destinationCoords,
  activeOrderRouteCoordinates,
  routeCoordinates,
  estimatedPrice,
  distance,
  keyboardVisible,
  lastRouteUpdate,
  setUserInteractedWithMap
}: MapViewComponentProps) => {
  if (isLocationLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Konum alınıyor...</Text>
      </View>
    );
  }

  return (
    <MapView
      key="main-map-view"
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
      
      {/* Aktif sipariş marker'ları - inspecting durumunda da göster */}
      {reduxCurrentOrder && (
        <>
          {/* Pickup marker - reduxCurrentOrder veya pickupCoords'dan al */}
          {((activeOrderPickupCoords) || 
            (reduxCurrentOrder.status && ['pending', 'inspecting'].includes(reduxCurrentOrder.status) && pickupCoords)) && (
            <PickupMarker coordinate={activeOrderPickupCoords || pickupCoords!} />
          )}
          
          {/* Destination marker - reduxCurrentOrder veya destinationCoords'dan al */}
          {((activeOrderDestinationCoords) || 
            (reduxCurrentOrder.status && ['pending', 'inspecting'].includes(reduxCurrentOrder.status) && destinationCoords)) && (
            <DestinationMarker coordinate={activeOrderDestinationCoords || destinationCoords!} />
          )}
        </>
      )}
      
      {/* Yeni sipariş oluştururken marker'lar - sadece aktif sipariş yoksa göster */}
      {!reduxCurrentOrder && pickupCoords && (
        <PickupMarker coordinate={pickupCoords} />
      )}
      
      {!reduxCurrentOrder && destinationCoords && (
        <DestinationMarker coordinate={destinationCoords} />
      )}
      
      {/* Aktif sipariş rotası - Google Directions API ile gerçek yol rotası */}
      {reduxCurrentOrder && activeOrderRouteCoordinates.length > 0 && (
        <Polyline
          coordinates={activeOrderRouteCoordinates}
          strokeColor="#10B981"
          strokeWidth={6}
        />
      )}
      
      {/* Yeni sipariş rotası veya inspecting durumunda rota */}
      {((reduxCurrentOrder && reduxCurrentOrder.status && ['pending', 'inspecting'].includes(reduxCurrentOrder.status) && routeCoordinates.length > 0) || 
        (!reduxCurrentOrder && routeCoordinates.length > 0)) && (
        <Polyline
          coordinates={routeCoordinates}
          strokeColor="#FFD700"
          strokeWidth={8}
        />
      )}
    </MapView>
  );
}, (prevProps, nextProps) => {
  // Performans için optimize edilmiş karşılaştırma
  
  // Basit değerlerin karşılaştırılması
  if (prevProps.isLocationLoading !== nextProps.isLocationLoading) return false;
  if (prevProps.keyboardVisible !== nextProps.keyboardVisible) return false;
  if (prevProps.lastRouteUpdate !== nextProps.lastRouteUpdate) return false;
  if (prevProps.estimatedPrice !== nextProps.estimatedPrice) return false;
  if (prevProps.distance !== nextProps.distance) return false;
  
  // Koordinat karşılaştırması
  const coordsEqual = (a: any, b: any) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return Math.abs(a.latitude - b.latitude) < 0.000001 && Math.abs(a.longitude - b.longitude) < 0.000001;
  };
  
  if (!coordsEqual(prevProps.activeOrderPickupCoords, nextProps.activeOrderPickupCoords)) return false;
  if (!coordsEqual(prevProps.activeOrderDestinationCoords, nextProps.activeOrderDestinationCoords)) return false;
  if (!coordsEqual(prevProps.pickupCoords, nextProps.pickupCoords)) return false;
  if (!coordsEqual(prevProps.destinationCoords, nextProps.destinationCoords)) return false;
  
  // Array uzunluk kontrolü
  if (prevProps.safeDrivers.length !== nextProps.safeDrivers.length) return false;
  if (prevProps.activeOrderRouteCoordinates.length !== nextProps.activeOrderRouteCoordinates.length) return false;
  if (prevProps.routeCoordinates.length !== nextProps.routeCoordinates.length) return false;
  
  // SafeDrivers karşılaştırması - ID'ler değişmediyse yeterli
  if (prevProps.safeDrivers.length > 0 || nextProps.safeDrivers.length > 0) {
    const prevIds = prevProps.safeDrivers.map(d => d.id).sort();
    const nextIds = nextProps.safeDrivers.map(d => d.id).sort();
    if (prevIds.length !== nextIds.length) return false;
    for (let i = 0; i < prevIds.length; i++) {
      if (prevIds[i] !== nextIds[i]) return false;
    }
  }
  
  // reduxCurrentOrder sadece gerekli alanlar karşılaştır
  if (prevProps.reduxCurrentOrder?.id !== nextProps.reduxCurrentOrder?.id ||
      prevProps.reduxCurrentOrder?.status !== nextProps.reduxCurrentOrder?.status) {
    return false;
  }
  
  // userLocation karşılaştırması
  if (prevProps.userLocation?.coords?.latitude !== nextProps.userLocation?.coords?.latitude ||
      prevProps.userLocation?.coords?.longitude !== nextProps.userLocation?.coords?.longitude) {
    return false;
  }
  
  return true;
});