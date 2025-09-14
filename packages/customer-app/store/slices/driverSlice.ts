import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../../config/api';

// Types
export interface Driver {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  vehicle_plate: string;
  vehicle_model: string;
  vehicle_color: string;
  rating: number;
  current_latitude: number;
  current_longitude: number;
  distance?: number;
  eta?: number;
}

export interface DriverAvailability {
  available: boolean;
  nearbyDriversCount: number;
  estimatedWaitTime: number;
}

export interface DriverState {
  nearbyDrivers: Driver[];
  availability: DriverAvailability | null;
  selectedDriver: Driver | null;
  loading: boolean;
  error: string | null;
}

const initialState: DriverState = {
  nearbyDrivers: [],
  availability: null,
  selectedDriver: null,
  loading: false,
  error: null,
};

// Async Thunks
export const checkDriverAvailability = createAsyncThunk(
  'driver/checkAvailability',
  async (
    {
      pickupLatitude,
      pickupLongitude,
      vehicleTypeId,
    }: {
      pickupLatitude: number;
      pickupLongitude: number;
      vehicleTypeId: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Token bulunamadı');
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/drivers/availability`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickupLatitude,
          pickupLongitude,
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
              const retryResponse = await fetch(`${API_CONFIG.BASE_URL}/api/drivers/availability`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${refreshData.token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  pickupLatitude,
                  pickupLongitude,
                  vehicleTypeId,
                }),
              });
              
              if (retryResponse.ok) {
                const data = await retryResponse.json();
                return {
                  available: data.available,
                  nearbyDriversCount: data.nearbyDriversCount,
                  estimatedWaitTime: data.estimatedWaitTime,
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
        available: data.available,
        nearbyDriversCount: data.nearbyDriversCount,
        estimatedWaitTime: data.estimatedWaitTime,
      };
    } catch (error: any) {
      console.error('Sürücü müsaitlik kontrolü hatası:', error);
      return rejectWithValue(error.message || 'Sürücü müsaitliği kontrol edilemedi');
    }
  }
);

export const loadNearbyDrivers = createAsyncThunk(
  'driver/loadNearbyDrivers',
  async (
    {
      latitude,
      longitude,
      radius = 5000,
      vehicleTypeId,
    }: {
      latitude: number;
      longitude: number;
      radius?: number;
      vehicleTypeId?: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Token bulunamadı');
      }

      const queryParams = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        radius: radius.toString(),
        ...(vehicleTypeId && { vehicleTypeId: vehicleTypeId.toString() }),
      });

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/drivers/nearby?${queryParams}`, {
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
              const retryResponse = await fetch(`${API_CONFIG.BASE_URL}/api/drivers/nearby?${queryParams}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${refreshData.token}`,
                  'Content-Type': 'application/json',
                },
              });
              
              if (retryResponse.ok) {
                const data = await retryResponse.json();
                return data.drivers || [];
              }
            }
          }
          throw new Error('Oturum süresi dolmuş');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.drivers || [];
    } catch (error: any) {
      console.error('Yakındaki sürücüler yüklenirken hata:', error);
      return rejectWithValue(error.message || 'Yakındaki sürücüler yüklenemedi');
    }
  }
);

// Slice
const driverSlice = createSlice({
  name: 'driver',
  initialState,
  reducers: {
    setSelectedDriver: (state, action: PayloadAction<Driver>) => {
      state.selectedDriver = action.payload;
    },
    clearSelectedDriver: (state) => {
      state.selectedDriver = null;
    },
    clearNearbyDrivers: (state) => {
      state.nearbyDrivers = [];
    },
    clearAvailability: (state) => {
      state.availability = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Check Driver Availability
      .addCase(checkDriverAvailability.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(checkDriverAvailability.fulfilled, (state, action) => {
        state.loading = false;
        state.availability = action.payload;
        state.error = null;
      })
      .addCase(checkDriverAvailability.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Load Nearby Drivers
      .addCase(loadNearbyDrivers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadNearbyDrivers.fulfilled, (state, action) => {
        state.loading = false;
        state.nearbyDrivers = action.payload;
        state.error = null;
      })
      .addCase(loadNearbyDrivers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setSelectedDriver,
  clearSelectedDriver,
  clearNearbyDrivers,
  clearAvailability,
  clearError,
} = driverSlice.actions;

export default driverSlice.reducer;