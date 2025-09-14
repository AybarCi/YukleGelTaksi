import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { API_CONFIG } from '../../config/api';

interface ApiState {
  loading: { [key: string]: boolean };
  errors: { [key: string]: string | null };
  cache: { [key: string]: any };
}

const initialState: ApiState = {
  loading: {},
  errors: {},
  cache: {},
};

const API_BASE_URL = API_CONFIG.BASE_URL;

// Generic API call thunk
export const makeApiCall = createAsyncThunk(
  'api/makeApiCall',
  async (
    {
      endpoint,
      method = 'GET',
      body,
      token,
      cacheKey,
    }: {
      endpoint: string;
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      body?: any;
      token?: string;
      cacheKey?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const config: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (body && method !== 'GET') {
        config.body = JSON.stringify(body);
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return {
        data: data.data || data,
        cacheKey,
        endpoint,
      };
    } catch (error) {
      return rejectWithValue({
        message: error instanceof Error ? error.message : 'API call failed',
        endpoint,
      });
    }
  }
);

// Driver specific API calls
export const getDriverRides = createAsyncThunk(
  'api/getDriverRides',
  async ({ token, status }: { token: string; status?: string }, { rejectWithValue }) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const queryParams = status ? `?status=${status}` : '';
      const response = await fetch(`${API_BASE_URL}/api/driver/rides${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to fetch rides');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch rides');
    }
  }
);

export const acceptRide = createAsyncThunk(
  'api/acceptRide',
  async ({ rideId, token }: { rideId: number; token: string }, { rejectWithValue }) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${API_BASE_URL}/api/driver/rides/${rideId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to accept ride');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to accept ride');
    }
  }
);

export const updateRideStatus = createAsyncThunk(
  'api/updateRideStatus',
  async (
    { rideId, status, token }: { rideId: number; status: string; token: string },
    { rejectWithValue }
  ) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${API_BASE_URL}/api/driver/rides/${rideId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to update ride status');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to update ride status');
    }
  }
);

export const getDriverEarnings = createAsyncThunk(
  'api/getDriverEarnings',
  async ({ token, period }: { token: string; period?: string }, { rejectWithValue }) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const queryParams = period ? `?period=${period}` : '';
      const response = await fetch(`${API_BASE_URL}/api/driver/earnings${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to fetch earnings');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch earnings');
    }
  }
);

export const updateDriverLocation = createAsyncThunk(
  'api/updateDriverLocation',
  async (
    { latitude, longitude, token }: { latitude: number; longitude: number; token: string },
    { rejectWithValue }
  ) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/api/driver/location`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ latitude, longitude }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to update location');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to update location');
    }
  }
);

const apiSlice = createSlice({
  name: 'api',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<{ key: string; loading: boolean }>) => {
      state.loading[action.payload.key] = action.payload.loading;
    },
    clearError: (state, action: PayloadAction<string>) => {
      state.errors[action.payload] = null;
    },
    clearCache: (state, action: PayloadAction<string>) => {
      delete state.cache[action.payload];
    },
    clearAllCache: (state) => {
      state.cache = {};
    },
  },
  extraReducers: (builder) => {
    builder
      // Generic API call
      .addCase(makeApiCall.pending, (state, action) => {
        const endpoint = action.meta.arg.endpoint;
        state.loading[endpoint] = true;
        state.errors[endpoint] = null;
      })
      .addCase(makeApiCall.fulfilled, (state, action) => {
        const { endpoint, cacheKey, data } = action.payload;
        state.loading[endpoint] = false;
        if (cacheKey) {
          state.cache[cacheKey] = data;
        }
      })
      .addCase(makeApiCall.rejected, (state, action) => {
        const { endpoint } = action.meta.arg;
        state.loading[endpoint] = false;
        state.errors[endpoint] = (action.payload as any)?.message || 'API call failed';
      })
      // Driver rides
      .addCase(getDriverRides.pending, (state) => {
        state.loading['getDriverRides'] = true;
        state.errors['getDriverRides'] = null;
      })
      .addCase(getDriverRides.fulfilled, (state, action) => {
        state.loading['getDriverRides'] = false;
        state.cache['driverRides'] = action.payload;
      })
      .addCase(getDriverRides.rejected, (state, action) => {
        state.loading['getDriverRides'] = false;
        state.errors['getDriverRides'] = action.payload as string;
      })
      // Accept ride
      .addCase(acceptRide.pending, (state) => {
        state.loading['acceptRide'] = true;
        state.errors['acceptRide'] = null;
      })
      .addCase(acceptRide.fulfilled, (state) => {
        state.loading['acceptRide'] = false;
      })
      .addCase(acceptRide.rejected, (state, action) => {
        state.loading['acceptRide'] = false;
        state.errors['acceptRide'] = action.payload as string;
      })
      // Update ride status
      .addCase(updateRideStatus.pending, (state) => {
        state.loading['updateRideStatus'] = true;
        state.errors['updateRideStatus'] = null;
      })
      .addCase(updateRideStatus.fulfilled, (state) => {
        state.loading['updateRideStatus'] = false;
      })
      .addCase(updateRideStatus.rejected, (state, action) => {
        state.loading['updateRideStatus'] = false;
        state.errors['updateRideStatus'] = action.payload as string;
      })
      // Driver earnings
      .addCase(getDriverEarnings.pending, (state) => {
        state.loading['getDriverEarnings'] = true;
        state.errors['getDriverEarnings'] = null;
      })
      .addCase(getDriverEarnings.fulfilled, (state, action) => {
        state.loading['getDriverEarnings'] = false;
        state.cache['driverEarnings'] = action.payload;
      })
      .addCase(getDriverEarnings.rejected, (state, action) => {
        state.loading['getDriverEarnings'] = false;
        state.errors['getDriverEarnings'] = action.payload as string;
      })
      // Update location
      .addCase(updateDriverLocation.pending, (state) => {
        state.loading['updateDriverLocation'] = true;
        state.errors['updateDriverLocation'] = null;
      })
      .addCase(updateDriverLocation.fulfilled, (state) => {
        state.loading['updateDriverLocation'] = false;
      })
      .addCase(updateDriverLocation.rejected, (state, action) => {
        state.loading['updateDriverLocation'] = false;
        state.errors['updateDriverLocation'] = action.payload as string;
      });
  },
});

export const { setLoading, clearError, clearCache, clearAllCache } = apiSlice.actions;
export default apiSlice.reducer;