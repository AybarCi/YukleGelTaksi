import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../../config/api';

interface VehicleType {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  image_url?: string;
  base_price?: number;
}

export const usePriceCalculation = (
  setPriceLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setEstimatedPrice: React.Dispatch<React.SetStateAction<number | null>>
) => {
  // Fiyat hesaplama fonksiyonu
  const calculatePrice = useCallback(async (distance: number | null, selectedVehicleType: VehicleType | null, laborCount: number = 0) => {
    if (!distance || !selectedVehicleType) {
      setEstimatedPrice(null);
      return;
    }

    try {
      setPriceLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      
      console.log('Token for price calculation:', token ? 'Token exists' : 'Token is null');
      
      if (!token) {
        console.error('No token found for price calculation');
        setEstimatedPrice(null);
        return;
      }
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/calculate-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          distance_km: distance,
          vehicle_type_id: selectedVehicleType.id,
          labor_count: laborCount // Dinamik hammal sayısı
        })
      });

      const data = await response.json();
      
      console.log('Price calculation response:', {
        status: response.status,
        ok: response.ok,
        data: data
      });
      
      if (response.ok && data.success) {
        console.log('Setting estimated price:', data.data.total_price);
        setEstimatedPrice(data.data.total_price);
      } else {
        console.error('Price calculation failed:', data.message || 'Unknown error');
        setEstimatedPrice(null);
      }
    } catch (error) {
      console.error('Price calculation error:', error);
      setEstimatedPrice(null);
    } finally {
      setPriceLoading(false);
    }
  }, [setPriceLoading, setEstimatedPrice]);

  return { calculatePrice };
};