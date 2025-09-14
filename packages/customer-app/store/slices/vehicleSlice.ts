import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../../config/api';

// Types
export interface VehicleType {
  id: number;
  name: string;
  description: string;
  base_price: number;
  price_per_km: number;
  price_per_minute: number;
  capacity_kg: number;
  icon: string;
  image_url?: string;
  is_active: boolean;
}

export interface PricingData {
  distance: number;
  duration: number;
  estimatedPrice: number;
  vehicleTypeId: number;
}

export interface VehicleState {
  vehicleTypes: VehicleType[];
  selectedVehicleType: VehicleType | null;
  pricing: PricingData | null;
  loading: boolean;
  error: string | null;
}

const initialState: VehicleState = {
  vehicleTypes: [],
  selectedVehicleType: null,
  pricing: null,
  loading: false,
  error: null,
};

// Async Thunks
export const loadVehicleTypes = createAsyncThunk(
  'vehicle/loadVehicleTypes',
  async (_, { rejectWithValue }) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Token bulunamadı');
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/vehicle-types`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token yenileme işlemi
          const refreshToken = await AsyncStorage.getItem('refreshToken');
          if (refreshToken) {
            const refreshResponse = await fetch(`${API_CONFIG.BASE_URL}/api/auth/refresh`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ refreshToken }),
            });

            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json();
              await AsyncStorage.setItem('auth_token', refreshData.token);
              
              // Yeni token ile tekrar dene
              const retryResponse = await fetch(`${API_CONFIG.BASE_URL}/api/vehicle-types`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${refreshData.token}`,
                  'Content-Type': 'application/json',
                },
              });
              
              if (retryResponse.ok) {
                const data = await retryResponse.json();
                return data.data || [];
              }
            }
          }
          throw new Error('Oturum süresi dolmuş');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error: any) {
      console.error('Araç tipleri yüklenirken hata:', error);
      return rejectWithValue(error.message || 'Araç tipleri yüklenemedi');
    }
  }
);

// Fiyat hesaplama
export const calculatePrice = createAsyncThunk(
  'vehicle/calculatePrice',
  async (
    {
      distance,
      vehicleTypeId,
      laborCount = 1
    }: {
      distance: number;
      vehicleTypeId: number;
      laborCount?: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Token bulunamadı');
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/calculate-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          distance_km: distance,
          vehicle_type_id: vehicleTypeId,
          labor_count: laborCount
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Fiyat hesaplanamadı');
      }

      return data;
    } catch (error) {
      console.error('Fiyat hesaplama hatası:', error);
      return rejectWithValue(
        error instanceof Error ? error.message : 'Fiyat hesaplanamadı'
      );
    }
  }
);

export const loadPricing = createAsyncThunk(
  'vehicle/loadPricing',
  async (
    {
      pickupLatitude,
      pickupLongitude,
      destinationLatitude,
      destinationLongitude,
      vehicleTypeId,
    }: {
      pickupLatitude: number;
      pickupLongitude: number;
      destinationLatitude: number;
      destinationLongitude: number;
      vehicleTypeId: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Token bulunamadı');
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/pricing/calculate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickupLatitude,
          pickupLongitude,
          destinationLatitude,
          destinationLongitude,
          vehicleTypeId,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token yenileme işlemi
          const refreshToken = await AsyncStorage.getItem('refreshToken');
          if (refreshToken) {
            const refreshResponse = await fetch(`${API_CONFIG.BASE_URL}/api/auth/refresh`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ refreshToken }),
            });

            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json();
              await AsyncStorage.setItem('auth_token', refreshData.token);
              
              // Yeni token ile tekrar dene
              const retryResponse = await fetch(`${API_CONFIG.BASE_URL}/api/pricing/calculate`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${refreshData.token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  pickupLatitude,
                  pickupLongitude,
                  destinationLatitude,
                  destinationLongitude,
                  vehicleTypeId,
                }),
              });
              
              if (retryResponse.ok) {
                const data = await retryResponse.json();
                return {
                  distance: data.distance,
                  duration: data.duration,
                  estimatedPrice: data.estimatedPrice,
                  vehicleTypeId,
                };
              }
            }
          }
          throw new Error('Oturum süresi dolmuş');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        distance: data.distance,
        duration: data.duration,
        estimatedPrice: data.estimatedPrice,
        vehicleTypeId,
      };
    } catch (error: any) {
      console.error('Fiyat hesaplanırken hata:', error);
      return rejectWithValue(error.message || 'Fiyat hesaplanamadı');
    }
  }
);

// Slice
const vehicleSlice = createSlice({
  name: 'vehicle',
  initialState,
  reducers: {
    setSelectedVehicleType: (state, action: PayloadAction<VehicleType>) => {
      state.selectedVehicleType = action.payload;
    },
    clearPricing: (state) => {
      state.pricing = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Load Vehicle Types
      .addCase(loadVehicleTypes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadVehicleTypes.fulfilled, (state, action) => {
        state.loading = false;
        state.vehicleTypes = action.payload;
        state.error = null;
      })
      .addCase(loadVehicleTypes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Load Pricing
      .addCase(loadPricing.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadPricing.fulfilled, (state, action) => {
        state.loading = false;
        state.pricing = action.payload;
        state.error = null;
      })
      .addCase(loadPricing.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedVehicleType, clearPricing, clearError } = vehicleSlice.actions;
export default vehicleSlice.reducer;