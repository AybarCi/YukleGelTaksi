import React, { memo } from 'react';
import { View } from 'react-native';
import { Marker } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import { styles } from '../styles';

interface Driver {
  id: string;
  latitude: number;
  longitude: number;
  heading: number;
  name?: string;
}

// Optimized marker components with React.memo
export const DriverMarker = memo(({ driver }: { driver: Driver }) => {
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

export const PickupMarker = memo(({ coords }: { coords: { latitude: number; longitude: number } }) => {
  return (
    <Marker
      key={`pickup-${coords.latitude}-${coords.longitude}`}
      coordinate={coords}
      title="Yükün Konumu"
      description="Yükün alınacağı adres"
      tracksViewChanges={false}
    >
      <View style={styles.pickupMarker}>
        <MaterialIcons name="location-on" size={20} color="#FFFFFF" />
      </View>
    </Marker>
  );
});

export const DestinationMarker = memo(({ coords }: { coords: { latitude: number; longitude: number } }) => {
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