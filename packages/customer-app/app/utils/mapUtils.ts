import { Dimensions } from 'react-native';

// Mesafeye göre zoom seviyesi hesaplama
export const calculateZoomLevel = (distance: number | null) => {
  if (!distance) return { latitudeDelta: 0.008, longitudeDelta: 0.006 };
  
  if (distance <= 1) {
    return { latitudeDelta: 0.008, longitudeDelta: 0.006 };
  } else if (distance <= 5) {
    return { latitudeDelta: 0.025, longitudeDelta: 0.02 };
  } else if (distance <= 15) {
    return { latitudeDelta: 0.08, longitudeDelta: 0.06 };
  } else if (distance <= 50) {
    return { latitudeDelta: 0.6, longitudeDelta: 0.48 };
  } else if (distance <= 100) {
    return { latitudeDelta: 1.2, longitudeDelta: 0.96 };
  } else if (distance <= 200) {
    return { latitudeDelta: 2.0, longitudeDelta: 1.6 };
  } else {
    return { latitudeDelta: 3.0, longitudeDelta: 2.4 };
  }
};

// BottomSheet yüksekliğini hesaba katarak harita ortalama
export const animateToRegionWithOffset = (
  mapRef: any,
  bottomSheetHeight: any,
  latitude: number,
  longitude: number,
  latitudeDelta: number,
  longitudeDelta: number
) => {
  if (!mapRef.current) return;
  
  const currentBottomSheetHeight = (bottomSheetHeight as any)._value;
  const screenHeight = Dimensions.get('window').height;
  const offsetRatio = (currentBottomSheetHeight / 2) / screenHeight;
  const latitudeOffset = latitudeDelta * offsetRatio * 0.8;
  
  mapRef.current.animateToRegion({
    latitude: latitude - latitudeOffset,
    longitude: longitude,
    latitudeDelta,
    longitudeDelta,
  }, 1500);
};

// İki nokta arasındaki mesafeyi gösterecek şekilde haritayı ayarlama
export const animateToShowBothPoints = (
  mapRef: any,
  bottomSheetHeight: any,
  pickupCoords: { latitude: number; longitude: number },
  destinationCoords: { latitude: number; longitude: number }
) => {
  if (!mapRef.current) return;
  
  const minLat = Math.min(pickupCoords.latitude, destinationCoords.latitude);
  const maxLat = Math.max(pickupCoords.latitude, destinationCoords.latitude);
  const minLng = Math.min(pickupCoords.longitude, destinationCoords.longitude);
  const maxLng = Math.max(pickupCoords.longitude, destinationCoords.longitude);
  
  const latDelta = (maxLat - minLat) * 1.8;
  const lngDelta = (maxLng - minLng) * 1.8;
  
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  
  const currentBottomSheetHeight = (bottomSheetHeight as any)._value;
  const screenHeight = Dimensions.get('window').height;
  const offsetRatio = (currentBottomSheetHeight / 2) / screenHeight;
  const latitudeOffset = latDelta * offsetRatio * 0.4;
  
  mapRef.current.animateToRegion({
    latitude: centerLat - latitudeOffset,
    longitude: centerLng,
    latitudeDelta: Math.max(latDelta, 0.01),
    longitudeDelta: Math.max(lngDelta, 0.01),
  }, 1500);
};