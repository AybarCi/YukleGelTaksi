import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { Marker, Callout } from 'react-native-maps';
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

export const PickupMarker = memo(({ coords, estimatedPrice, distance }: { 
  coords: { latitude: number; longitude: number };
  estimatedPrice?: number;
  distance?: number;
}) => {
  console.log('Rendering pickup marker with coords:', coords);
  
  // Koordinatların geçerli olup olmadığını kontrol et
  if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number' ||
      isNaN(coords.latitude) || isNaN(coords.longitude)) {
    console.log('Invalid pickup coordinates, not rendering marker');
    return null;
  }
  
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
      {(estimatedPrice || distance) && (
        <Callout>
          <View style={styles.calloutContainer}>
            <Text style={styles.calloutTitle}>Yük Bilgileri</Text>
            {distance && (
              <Text style={styles.calloutText}>Mesafe: {distance.toFixed(1)} km</Text>
            )}
            {estimatedPrice && (
              <Text style={styles.calloutPrice}>Tahmini Ücret: ₺{estimatedPrice.toFixed(2)}</Text>
            )}
          </View>
        </Callout>
      )}
    </Marker>
  );
});

export const DestinationMarker = memo(({ coords, estimatedPrice, distance }: { 
  coords: { latitude: number; longitude: number };
  estimatedPrice?: number;
  distance?: number;
}) => {
  console.log('Rendering destination marker with coords:', coords);
  
  // Koordinatların geçerli olup olmadığını kontrol et
  if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number' ||
      isNaN(coords.latitude) || isNaN(coords.longitude)) {
    console.log('Invalid destination coordinates, not rendering marker');
    return null;
  }
  
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
      {(estimatedPrice || distance) && (
        <Callout>
          <View style={styles.calloutContainer}>
            <Text style={styles.calloutTitle}>Teslimat Bilgileri</Text>
            {distance && (
              <Text style={styles.calloutText}>Toplam Mesafe: {distance.toFixed(1)} km</Text>
            )}
            {estimatedPrice && (
              <Text style={styles.calloutPrice}>Tahmini Ücret: ₺{estimatedPrice.toFixed(2)}</Text>
            )}
          </View>
        </Callout>
      )}
    </Marker>
  );
});