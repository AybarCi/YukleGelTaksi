import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { LocationCoords } from '../types/dashboard';

interface UseDriverLocationReturn {
  driverLocation: LocationCoords | null;
  isLocationLoading: boolean;
  locationError: string | null;
  requestLocationPermission: () => Promise<boolean>;
  startLocationTracking: () => void;
  stopLocationTracking: () => void;
}

export const useDriverLocation = (): UseDriverLocationReturn => {
  const [driverLocation, setDriverLocation] = useState<LocationCoords | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Konum izni reddedildi');
        return false;
      }
      return true;
    } catch (error) {
      setLocationError('Konum izni alınamadı');
      return false;
    }
  };

  const startLocationTracking = async () => {
    setIsLocationLoading(true);
    setLocationError(null);

    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        setIsLocationLoading(false);
        return;
      }

      // İlk konum bilgisini al
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setDriverLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });

      // Konum takibini başlat
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // 5 saniyede bir güncelle
          distanceInterval: 10, // 10 metre hareket ettiğinde güncelle
        },
        (location) => {
          setDriverLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      );

      setIsLocationLoading(false);
    } catch (error) {
      console.error('Konum alınamadı:', error);
      setLocationError('Konum bilgisi alınamadı');
      setIsLocationLoading(false);
    }
  };

  const stopLocationTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopLocationTracking();
    };
  }, []);

  return {
    driverLocation,
    isLocationLoading,
    locationError,
    requestLocationPermission,
    startLocationTracking,
    stopLocationTracking,
  };
};