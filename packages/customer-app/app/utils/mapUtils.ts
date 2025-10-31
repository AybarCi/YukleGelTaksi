import { Dimensions } from 'react-native';

// Mesafeye göre zoom seviyesi hesaplama - iPhone 15 Pro için optimize edildi
export const calculateZoomLevel = (distance: number | null) => {
  if (!distance) return { latitudeDelta: 0.01, longitudeDelta: 0.008 };
  
  // Kısa mesafeler için daha konservatif zoom seviyeleri
  if (distance <= 0.5) {
    return { latitudeDelta: 0.01, longitudeDelta: 0.008 };
  } else if (distance <= 1) {
    return { latitudeDelta: 0.012, longitudeDelta: 0.01 };
  } else if (distance <= 2) {
    return { latitudeDelta: 0.018, longitudeDelta: 0.014 };
  } else if (distance <= 5) {
    return { latitudeDelta: 0.03, longitudeDelta: 0.024 };
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
  console.log('🔍 DEBUG: animateToRegionWithOffset called with:', {
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta,
    mapRefExists: !!mapRef.current,
    bottomSheetHeight: (bottomSheetHeight as any)._value
  });
  
  if (!mapRef.current) {
    console.error('🚨 ERROR: mapRef.current is null in animateToRegionWithOffset');
    return;
  }
  
  const currentBottomSheetHeight = (bottomSheetHeight as any)._value;
  const screenHeight = Dimensions.get('window').height;
  const offsetRatio = (currentBottomSheetHeight / 2) / screenHeight;
  const latitudeOffset = latitudeDelta * offsetRatio * 0.8;
  
  const targetRegion = {
    latitude: latitude - latitudeOffset,
    longitude: longitude,
    latitudeDelta,
    longitudeDelta,
  };
  
  console.log('🔍 DEBUG: Animating to region:', targetRegion);
  
  mapRef.current.animateToRegion(targetRegion, 1500);
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
  
  // Mesafe hesaplama (yaklaşık km cinsinden)
  const latDistance = maxLat - minLat;
  const lngDistance = maxLng - minLng;
  const approximateDistance = Math.sqrt(latDistance * latDistance + lngDistance * lngDistance) * 111; // Yaklaşık km
  
  // Mesafeye göre zoom faktörü ayarlama - iPhone 15 Pro için optimize edildi
  let zoomFactor;
  if (approximateDistance < 0.5) {
    zoomFactor = 4.0; // Çok kısa mesafeler için (500m altı) daha geniş görünüm
  } else if (approximateDistance < 1) {
    zoomFactor = 3.5; // 500m-1km arası için
  } else if (approximateDistance < 2) {
    zoomFactor = 3.0; // 1-2km arası için
  } else if (approximateDistance < 5) {
    zoomFactor = 2.5; // 2-5km arası için
  } else if (approximateDistance < 10) {
    zoomFactor = 2.0; // 5-10km arası için
  } else if (approximateDistance < 20) {
    zoomFactor = 1.8; // 10-20km arası için
  } else {
    zoomFactor = 1.5; // 20km üzeri için daha sıkı zoom
  }
  
  const latDelta = Math.max(latDistance * zoomFactor, 0.008); // Minimum zoom seviyesini artırdık
  const lngDelta = Math.max(lngDistance * zoomFactor, 0.008);
  
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  
  const currentBottomSheetHeight = (bottomSheetHeight as any)._value;
  const screenHeight = Dimensions.get('window').height;
  const offsetRatio = (currentBottomSheetHeight / 2) / screenHeight;
  
  // iPhone 15 Pro için optimize edilmiş offset hesaplama
  // Ekran boyutu: 2556x1179 (6.1 inch), viewport: 393x852
  // BottomSheet yüksekliğini daha iyi hesaba katarak marker'ların görünür kalmasını sağlıyoruz
  let latitudeOffset;
  if (approximateDistance < 1) {
    // Kısa mesafeler için daha fazla offset uygulayarak marker'ları ekranda tutuyoruz
    latitudeOffset = latDelta * offsetRatio * 1.2;
  } else {
    // Uzun mesafeler için normal offset
    latitudeOffset = latDelta * offsetRatio * 0.9;
  }
  
  mapRef.current.animateToRegion({
    latitude: centerLat - latitudeOffset,
    longitude: centerLng,
    latitudeDelta: Math.max(latDelta, 0.005), // Minimum delta değeri artırıldı
    longitudeDelta: Math.max(lngDelta, 0.005),
  }, 1500);
};