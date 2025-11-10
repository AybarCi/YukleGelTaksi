import { API_CONFIG } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CargoType {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  labor_count: number;
  created_at: string;
  updated_at: string;
}

export const cargoTypesService = {
  // Cache kontrollü yük tiplerini getir
  async getCargoTypes(): Promise<CargoType[]> {
    try {
      // Cache kontrolü
      const lastFetch = await AsyncStorage.getItem('cargo_types_last_fetch');
      const cachedTypes = await AsyncStorage.getItem('cargo_types_cache');
      
      if (lastFetch && cachedTypes) {
        const lastFetchTime = parseInt(lastFetch);
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        
        if (now - lastFetchTime < fiveMinutes) {
          // Cache geçerli
          console.log('Cargo types loaded from cache');
          return JSON.parse(cachedTypes);
        }
      }
      
      // Cache yoksa veya süresi geçmişse API'den yükle (public endpoint)
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/cargo-types`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        // Cache'e kaydet
        await AsyncStorage.setItem('cargo_types_cache', JSON.stringify(data.data));
        await AsyncStorage.setItem('cargo_types_last_fetch', Date.now().toString());
        
        console.log('Cargo types loaded from API and cached');
        return data.data;
      } else {
        console.error('Cargo types fetch failed:', data.message || 'Unknown error');
        throw new Error(data.message || 'Failed to fetch cargo types');
      }
    } catch (error) {
      console.error('Cargo types service error:', error);
      throw error;
    }
  },
  
  // Cache'i temizle
  async clearCache(): Promise<void> {
    await AsyncStorage.removeItem('cargo_types_cache');
    await AsyncStorage.removeItem('cargo_types_last_fetch');
    console.log('Cargo types cache cleared');
  }
};