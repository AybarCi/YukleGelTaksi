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

// Specific API calls
export const sendSMS = createAsyncThunk(
  'api/sendSMS',
  async ({ phone }: { phone: string }, { rejectWithValue }) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${API_BASE_URL}/api/auth/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || 'SMS send failed');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'SMS send failed');
    }
  }
);

export const verifySMS = createAsyncThunk(
  'api/verifySMS',
  async (
    { phone, code, userType }: { phone: string; code: string; userType?: string },
    { rejectWithValue }
  ) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${API_BASE_URL}/api/auth/verify-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, code, userType }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.success) {
        return { success: true, token: data.data?.token };
      } else {
        throw new Error(data.message || 'SMS verification failed');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'SMS verification failed');
    }
  }
);

export const updateProfile = createAsyncThunk(
  'api/updateProfile',
  async (
    { userData, token }: { userData: any; token: string },
    { rejectWithValue }
  ) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${API_BASE_URL}/api/auth/update-profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || 'Profile update failed');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Profile update failed');
    }
  }
);

export const refreshProfile = createAsyncThunk(
  'api/refreshProfile',
  async ({ token }: { token: string }, { rejectWithValue }) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
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
        throw new Error(data.message || 'Profile refresh failed');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Profile refresh failed');
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
      // SMS operations
      .addCase(sendSMS.pending, (state) => {
        state.loading['sendSMS'] = true;
        state.errors['sendSMS'] = null;
      })
      .addCase(sendSMS.fulfilled, (state) => {
        state.loading['sendSMS'] = false;
      })
      .addCase(sendSMS.rejected, (state, action) => {
        state.loading['sendSMS'] = false;
        state.errors['sendSMS'] = action.payload as string;
      })
      .addCase(verifySMS.pending, (state) => {
        state.loading['verifySMS'] = true;
        state.errors['verifySMS'] = null;
      })
      .addCase(verifySMS.fulfilled, (state) => {
        state.loading['verifySMS'] = false;
      })
      .addCase(verifySMS.rejected, (state, action) => {
        state.loading['verifySMS'] = false;
        state.errors['verifySMS'] = action.payload as string;
      })
      // Profile operations
      .addCase(updateProfile.pending, (state) => {
        state.loading['updateProfile'] = true;
        state.errors['updateProfile'] = null;
      })
      .addCase(updateProfile.fulfilled, (state) => {
        state.loading['updateProfile'] = false;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading['updateProfile'] = false;
        state.errors['updateProfile'] = action.payload as string;
      })
      .addCase(refreshProfile.pending, (state) => {
        state.loading['refreshProfile'] = true;
        state.errors['refreshProfile'] = null;
      })
      .addCase(refreshProfile.fulfilled, (state) => {
        state.loading['refreshProfile'] = false;
      })
      .addCase(refreshProfile.rejected, (state, action) => {
        state.loading['refreshProfile'] = false;
        state.errors['refreshProfile'] = action.payload as string;
      });
  },
});

export const { setLoading, clearError, clearCache, clearAllCache } = apiSlice.actions;
export default apiSlice.reducer;