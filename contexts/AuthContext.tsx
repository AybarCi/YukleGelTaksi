import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomModal from '../components/CustomModal';

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
  verifySMS: (phone: string, code: string, userType?: string) => Promise<{ success: boolean; token?: string }>;
  logout: () => Promise<void>;
  updateProfile: (userData: Partial<User>) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  refreshAuthToken: () => Promise<boolean>;
  showModal: (title: string, message: string, type: 'success' | 'warning' | 'error' | 'info', buttons?: any[]) => void;
}

interface RegisterData {
  phone: string;
  password: string;
  full_name: string;
  email?: string;
  user_type?: 'passenger' | 'driver';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = 'http://192.168.1.134:3001/api';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'warning' | 'error' | 'info'>('info');
  const [modalButtons, setModalButtons] = useState<any[]>([]);



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
        const userData = JSON.parse(storedUser);
        setToken(storedToken);
        setRefreshToken(storedRefreshToken);
        setUser(userData);
        
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
              return;
            }
          }
          
          // Token is valid, redirect based on user type
          if (userData.user_type === 'driver') {
            // Check driver status
            try {
              const driverStatusResponse = await fetch(`${API_BASE_URL}/drivers/status`, {
                headers: {
                  'Authorization': `Bearer ${storedToken}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (driverStatusResponse.ok) {
                const driverData = await driverStatusResponse.json();
                if (driverData.data.is_approved && driverData.data.is_active) {
                  // Approved driver, go to driver dashboard
                  setTimeout(() => {
                    require('expo-router').router.replace('/driver-dashboard');
                  }, 100);
                } else {
                  // Driver not approved, go to status screen
                  setTimeout(() => {
                    require('expo-router').router.replace('/driver-status');
                  }, 100);
                }
              } else if (driverStatusResponse.status === 404) {
                // No driver record, go to registration
                setTimeout(() => {
                  require('expo-router').router.replace('/driver-registration');
                }, 100);
              }
            } catch (driverError) {
              console.error('Error checking driver status:', driverError);
              // Default to driver registration on error
              setTimeout(() => {
                require('expo-router').router.replace('/driver-registration');
              }, 100);
            }
          } else {
            // Regular user, go to home
            setTimeout(() => {
              require('expo-router').router.replace('/home');
            }, 100);
          }
          
        } catch (tokenTestError) {
          console.error('Error testing token validity:', tokenTestError);
          // If there's a network error, keep the user logged in with stored data
          // But still redirect based on user type
          if (userData.user_type === 'driver') {
            setTimeout(() => {
              require('expo-router').router.replace('/driver-status');
            }, 100);
          } else {
            setTimeout(() => {
              require('expo-router').router.replace('/home');
            }, 100);
          }
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
        showModal('Giriş Hatası', data.message || 'Giriş yapılamadı', 'error');
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      showModal('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
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
        showModal('Kayıt Hatası', data.message || 'Kayıt oluşturulamadı', 'error');
        return false;
      }
    } catch (error) {
      console.error('Register error:', error);
      showModal('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
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
        showModal('SMS Hatası', data.message || 'SMS gönderilemedi', 'error');
        return false;
      }
    } catch (error) {
      console.error('Send SMS error:', error);
      showModal('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
      return false;
    }
  };

  const verifySMS = async (phone: string, code: string, userType?: string): Promise<{ success: boolean; token?: string }> => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/auth/verify-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, code, user_type: userType || 'customer' }),
      });

      const data = await response.json();

      if (data.success) {
        const { user: userData, token: authToken, refreshToken: authRefreshToken } = data.data;
        setUser(userData);
        setToken(authToken);
        setRefreshToken(authRefreshToken);
        await storeAuthData(authToken, authRefreshToken, userData);
        return { success: true, token: authToken };
      } else {
        showModal('Doğrulama Hatası', data.message || 'Kod doğrulanamadı', 'error');
        return { success: false };
      }
    } catch (error) {
      console.error('Verify SMS error:', error);
      showModal('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
      return { success: false };
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
      // Modal'ı kapat
      setModalVisible(false);
    } catch (error) {
      console.error('Logout error:', error);
      // Hata durumunda da modal'ı kapat
      setModalVisible(false);
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
        showModal('Güncelleme Hatası', data.message || 'Profil güncellenemedi', 'error');
        return false;
      }
    } catch (error) {
      console.error('Update profile error:', error);
      showModal('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
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

  const showModal = (title: string, message: string, type: 'success' | 'warning' | 'error' | 'info', buttons?: any[]) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType(type);
    
    // Button'ların onPress fonksiyonlarını wrap et ki modal kapansın
    const wrappedButtons = buttons ? buttons.map(button => ({
      ...button,
      onPress: () => {
        setModalVisible(false);
        if (button.onPress) {
          button.onPress();
        }
      }
    })) : [{ text: 'Tamam', onPress: () => setModalVisible(false) }];
    
    setModalButtons(wrappedButtons);
    setModalVisible(true);
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
    showModal,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <CustomModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={modalTitle}
        message={modalMessage}
        type={modalType}
        buttons={modalButtons}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;