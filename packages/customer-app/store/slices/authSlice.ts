import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../../config/api';
import socketService from '../../services/socketService';
import { router } from 'expo-router';

interface User {
  id: number;
  phone: string;
  full_name: string;
  email?: string;
  user_type: 'passenger' | 'driver';
  is_verified: boolean;
  profile_image?: string;
  wallet_balance?: number;
}

interface RegisterData {
  phone: string;
  password: string;
  full_name: string;
  email?: string;
  user_type?: 'passenger' | 'driver';
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isLoading: false,
  error: null,
};

const API_BASE_URL = API_CONFIG.BASE_URL;

// Async Thunks
export const loadStoredAuth = createAsyncThunk(
  'auth/loadStoredAuth',
  async (_, { rejectWithValue }) => {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedRefreshToken = await AsyncStorage.getItem('refresh_token');
      const storedUser = await AsyncStorage.getItem('user_data');
      
      if (storedToken && storedRefreshToken && storedUser) {
        const userData = JSON.parse(storedUser);
        
        // Test if current token is valid
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const testResponse = await fetch(`${API_BASE_URL}/api/auth/profile`, {
          headers: {
            'Authorization': `Bearer ${storedToken}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (testResponse.status === 401) {
          // Token expired, try to refresh
          const refreshController = new AbortController();
          const refreshTimeoutId = setTimeout(() => refreshController.abort(), 30000);
          
          const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken: storedRefreshToken }),
            signal: refreshController.signal
          });
          
          clearTimeout(refreshTimeoutId);
          
          const refreshData = await refreshResponse.json();
          
          if (refreshData.success) {
            const { token: newToken } = refreshData.data;
            await AsyncStorage.setItem('auth_token', newToken);
            return {
              user: userData,
              token: newToken,
              refreshToken: storedRefreshToken
            };
          } else {
            // Refresh token also expired
            await AsyncStorage.multiRemove(['auth_token', 'refresh_token', 'user_data']);
            throw new Error('Session expired');
          }
        }
        
        return {
          user: userData,
          token: storedToken,
          refreshToken: storedRefreshToken
        };
      }
      
      return null;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to load stored auth');
    }
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async ({ phone, password }: { phone: string; password: string }, { rejectWithValue }) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, password }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      if (data.success) {
        const { user, token, refreshToken } = data.data;
        
        // Store auth data
        await AsyncStorage.multiSet([
          ['auth_token', token],
          ['refresh_token', refreshToken],
          ['user_data', JSON.stringify(user)]
        ]);
        
        return { user, token, refreshToken };
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Login failed');
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (userData: RegisterData, { rejectWithValue }) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || 'Registration failed');
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Registration failed');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      const { token } = state.auth;
      
      if (token) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
      }
      
      // Clear stored data
      await AsyncStorage.multiRemove(['auth_token', 'refresh_token', 'user_data']);
      
      // Disconnect socket
      socketService.disconnect();
      
      return null;
    } catch (error) {
      // Even if logout API fails, clear local data
      await AsyncStorage.multiRemove(['auth_token', 'refresh_token', 'user_data']);
      socketService.disconnect();
      return null;
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    updateToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Load stored auth
      .addCase(loadStoredAuth.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadStoredAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.user = action.payload.user;
          state.token = action.payload.token;
          state.refreshToken = action.payload.refreshToken;
        }
      })
      .addCase(loadStoredAuth.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Register
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isLoading = false;
        state.error = null;
      });
  },
});

export const { clearError, updateToken, updateUser } = authSlice.actions;
export default authSlice.reducer;