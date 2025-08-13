import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

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

interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<boolean>;
  register: (userData: RegisterData) => Promise<boolean>;
  sendSMS: (phone: string) => Promise<boolean>;
  verifySMS: (phone: string, code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (userData: Partial<User>) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  refreshAuthToken: () => Promise<boolean>;
}

interface RegisterData {
  phone: string;
  password: string;
  full_name: string;
  email?: string;
  user_type?: 'passenger' | 'driver';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = 'http://localhost:3001/api';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);



  // Load stored auth data on app start
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedRefreshToken = await AsyncStorage.getItem('refresh_token');
      const storedUser = await AsyncStorage.getItem('user_data');
      
      if (storedToken && storedRefreshToken && storedUser) {
        setToken(storedToken);
        setRefreshToken(storedRefreshToken);
        setUser(JSON.parse(storedUser));
        
        // Test if current token is valid by making a simple API call
        try {
          const testResponse = await fetch(`${API_BASE_URL}/auth/profile`, {
            headers: {
              'Authorization': `Bearer ${storedToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (testResponse.status === 401) {
            // Token expired, try to refresh
            const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ refreshToken: storedRefreshToken }),
            });
            
            const refreshData = await refreshResponse.json();
            
            if (refreshData.success) {
              const { token: newToken } = refreshData.data;
              setToken(newToken);
              await AsyncStorage.setItem('auth_token', newToken);
            } else {
              // Refresh token also expired, logout user
              await clearAuthData();
              setUser(null);
              setToken(null);
              setRefreshToken(null);
            }
          }
        } catch (tokenTestError) {
          console.error('Error testing token validity:', tokenTestError);
          // If there's a network error, keep the user logged in with stored data
        }
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const storeAuthData = async (token: string, refreshToken: string, userData: User) => {
    try {
      await AsyncStorage.setItem('auth_token', token);
      await AsyncStorage.setItem('refresh_token', refreshToken);
      await AsyncStorage.setItem('user_data', JSON.stringify(userData));
    } catch (error) {
      console.error('Error storing auth data:', error);
    }
  };

  const clearAuthData = async () => {
    try {
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('refresh_token');
      await AsyncStorage.removeItem('user_data');
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  };

  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    });

    // If token is expired (401), try to refresh it
    if (response.status === 401 && refreshToken) {
      const refreshSuccess = await refreshAuthToken();
      if (refreshSuccess) {
        // Retry the request with new token
        const newHeaders = {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        };
        
        return fetch(`${API_BASE_URL}${url}`, {
          ...options,
          headers: newHeaders,
        });
      }
    }

    return response;
  };

  const login = async (phone: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, password }),
      });

      const data = await response.json();

      if (data.success) {
        const { user: userData, token: authToken, refreshToken: authRefreshToken } = data.data;
        setUser(userData);
        setToken(authToken);
        setRefreshToken(authRefreshToken || '');
        await storeAuthData(authToken, authRefreshToken || '', userData);
        return true;
      } else {
        Alert.alert('Giriş Hatası', data.message || 'Giriş yapılamadı');
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterData): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (data.success) {
        const { user: newUser, token: authToken, refreshToken: authRefreshToken } = data.data;
        setUser(newUser);
        setToken(authToken);
        setRefreshToken(authRefreshToken || '');
        await storeAuthData(authToken, authRefreshToken || '', newUser);
        return true;
      } else {
        Alert.alert('Kayıt Hatası', data.message || 'Kayıt oluşturulamadı');
        return false;
      }
    } catch (error) {
      console.error('Register error:', error);
      Alert.alert('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const sendSMS = async (phone: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (data.success) {
        return true;
      } else {
        Alert.alert('SMS Hatası', data.message || 'SMS gönderilemedi');
        return false;
      }
    } catch (error) {
      console.error('Send SMS error:', error);
      Alert.alert('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.');
      return false;
    }
  };

  const verifySMS = async (phone: string, code: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/auth/verify-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, code }),
      });

      const data = await response.json();

      if (data.success) {
        const { user: userData, token: authToken, refreshToken: authRefreshToken } = data.data;
        setUser(userData);
        setToken(authToken);
        setRefreshToken(authRefreshToken);
        await storeAuthData(authToken, authRefreshToken, userData);
        return true;
      } else {
        Alert.alert('Doğrulama Hatası', data.message || 'Kod doğrulanamadı');
        return false;
      }
    } catch (error) {
      console.error('Verify SMS error:', error);
      Alert.alert('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setUser(null);
      setToken(null);
      setRefreshToken(null);
      await clearAuthData();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateProfile = async (userData: Partial<User>): Promise<boolean> => {
    try {
      const response = await makeAuthenticatedRequest('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.data);
        await AsyncStorage.setItem('user_data', JSON.stringify(data.data));
        return true;
      } else {
        Alert.alert('Güncelleme Hatası', data.message || 'Profil güncellenemedi');
        return false;
      }
    } catch (error) {
      console.error('Update profile error:', error);
      Alert.alert('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.');
      return false;
    }
  };

  const refreshProfile = async (): Promise<void> => {
    try {
      const response = await makeAuthenticatedRequest('/auth/profile');
      const data = await response.json();

      if (data.success) {
        setUser(data.data);
        await AsyncStorage.setItem('user_data', JSON.stringify(data.data));
      }
    } catch (error) {
      console.error('Refresh profile error:', error);
    }
  };

  const refreshAuthToken = async (): Promise<boolean> => {
    try {
      if (!refreshToken) {
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (data.success) {
        const { token: newToken } = data.data;
        setToken(newToken);
        await AsyncStorage.setItem('auth_token', newToken);
        return true;
      } else {
        // Refresh token is invalid, logout user
        await logout();
        return false;
      }
    } catch (error) {
      console.error('Refresh token error:', error);
      await logout();
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    token,
    refreshToken,
    isLoading,
    login,
    register,
    sendSMS,
    verifySMS,
    logout,
    updateProfile,
    refreshProfile,
    refreshAuthToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;