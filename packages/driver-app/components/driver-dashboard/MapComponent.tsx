import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { LocationCoords, MapRegion, OrderData } from '../../types/dashboard';

interface MapComponentProps {
  region: MapRegion;
  driverLocation: LocationCoords | null;
  routeCoordinates: LocationCoords[];
  activeOrder: OrderData | null;
  currentPhase: 'pickup' | 'delivery' | null;
  isNavigating: boolean;
  onStartNavigation: () => void;
  onRegionChange?: (region: MapRegion) => void;
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
}) => {
  const mapRef = useRef<MapView>(null);

  // Haritayı rotaya odakla - sadece rota değiştiğinde
  useEffect(() => {
    if (mapRef.current && routeCoordinates.length > 0) {
      mapRef.current.fitToCoordinates(routeCoordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [routeCoordinates]);

  // Sürücü konumu değiştiğinde haritayı güncelle ama marker'ı koru
  useEffect(() => {
    if (mapRef.current && driverLocation && !isNavigating) {
      // Sadece navigasyon aktif değilse haritayı sürücü konumuna odakla
      const newRegion = {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      };
      
      mapRef.current.animateToRegion(newRegion, 1000);
    }
  }, [driverLocation, isNavigating, region.latitudeDelta, region.longitudeDelta]);

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

  const renderDestinationMarker = () => {
    if (!activeOrder || !currentPhase) return null;

    let destination;
    let title;
    let description;
    let markerId;

    if (currentPhase === 'pickup') {
      destination = {
        latitude: activeOrder.pickup_latitude,
        longitude: activeOrder.pickup_longitude,
      };
      title = 'Yük Alma Noktası';
      description = activeOrder.pickupAddress;
      markerId = `pickup-${activeOrder.id}`;
    } else {
      destination = {
        latitude: activeOrder.delivery_latitude,
        longitude: activeOrder.delivery_longitude,
      };
      title = 'Teslimat Noktası';
      description = activeOrder.destinationAddress;
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
          <Marker
            key="driver-marker"
            coordinate={driverLocation || region}
            title="Konumunuz"
            description="Mevcut konum"
          >
            <View style={styles.driverMarker}>
              <View style={styles.driverMarkerInner}>
                <Ionicons name="car" size={16} color="#FFFFFF" />
              </View>
            </View>
          </Marker>

          {/* Hedef konum */}
          {renderDestinationMarker()}

          {/* Rota çizgisi */}
          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={getPhaseColor()}
              strokeWidth={4}
            />
          )}
        </MapView>

      {/* Navigasyon butonu */}
      {activeOrder && currentPhase && (
        <TouchableOpacity
          style={[
            styles.navigationButton,
            { backgroundColor: getPhaseColor() }
          ]}
          onPress={onStartNavigation}
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