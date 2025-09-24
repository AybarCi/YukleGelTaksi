import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomModal from '../components/CustomModal';
import { API_CONFIG } from '../config/api';
import socketService from '../services/socketService';
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
  updateUserInfo: (firstName: string, lastName: string, email?: string) => Promise<boolean>;
  updateEmail: (email: string) => Promise<boolean>;
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

const API_BASE_URL = API_CONFIG.BASE_URL;

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
  const [tokenRefreshTimer, setTokenRefreshTimer] = useState<number | null>(null);



  // Load stored auth data on app start
  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Socket token yenileme olayını dinle
  useEffect(() => {
    const handleTokenRefresh = (data: { token: string }) => {
      // Token refreshed via socket
      setToken(data.token);
    };

    socketService.on('token_refreshed', handleTokenRefresh);

    return () => {
      socketService.off('token_refreshed', handleTokenRefresh);
    };
  }, []);

  const loadStoredAuth = async () => {
    try {
      let storedToken = await AsyncStorage.getItem('auth_token');
      const storedRefreshToken = await AsyncStorage.getItem('refresh_token');
      const storedUser = await AsyncStorage.getItem('user_data');
      
      if (storedToken && storedRefreshToken && storedUser) {
        const userData = JSON.parse(storedUser);
        setToken(storedToken);
        setRefreshToken(storedRefreshToken);
        setUser(userData);
        
        // Test if current token is valid by making a simple API call
        try {
          // Timeout controller ekle - daha uzun timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 saniye timeout
          
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
            const refreshTimeoutId = setTimeout(() => refreshController.abort(), 30000); // 30 saniye timeout
            
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
              setToken(newToken);
              await AsyncStorage.setItem('auth_token', newToken);
              // Yeni token'ı storedToken değişkenine ata
              storedToken = newToken;
            } else {
              // Refresh token also expired, logout user
              await clearAuthData();
              setUser(null);
              setToken(null);
              setRefreshToken(null);
              return;
            }
          }
          
          // Token is valid, start auto-refresh timer
          startTokenRefreshTimer();
          
          // Redirect based on user type
          if (userData.user_type === 'driver') {
            // Check driver status
            try {
              // Timeout controller ekle - daha uzun timeout
              const driverController = new AbortController();
              const driverTimeoutId = setTimeout(() => driverController.abort(), 30000); // 30 saniye timeout
              
              const driverStatusResponse = await fetch(`${API_BASE_URL}/api/drivers/status`, {
                headers: {
                  'Authorization': `Bearer ${storedToken}`,
                  'Content-Type': 'application/json'
                },
                signal: driverController.signal
              });
              
              clearTimeout(driverTimeoutId);
              
              if (driverStatusResponse.ok) {
                const driverData = await driverStatusResponse.json();
                // Null/undefined kontrolü ekle
                if (driverData && driverData.data && driverData.data.is_approved && driverData.data.is_active) {
                  // Approved driver - navigation will be handled by index.tsx
                  // Driver approved and active
                } else {
                  // Driver not approved - navigation will be handled by index.tsx
                  // Driver not approved or inactive
                }
              } else if (driverStatusResponse.status === 404) {
                // No driver record - navigation will be handled by index.tsx
                // No driver record found
              } else {
                // Other HTTP errors - navigation will be handled by index.tsx
                console.error('Driver status check failed with status:', driverStatusResponse.status);
              }
            } catch (driverError) {
              console.error('Error checking driver status:', driverError);
              
              // AbortError durumunda kullanıcıyı logout yapma
              if (driverError instanceof Error && driverError.name === 'AbortError') {
                // Driver status check timed out
                return;
              }
              
              // Network error - logout user
              await clearAuthData();
              setUser(null);
              setToken(null);
              setRefreshToken(null);
            }
          } else {
            // Regular user - navigation will be handled by index.tsx
            // Regular user authenticated
          }
          
        } catch (tokenTestError) {
          console.error('Error testing token validity:', tokenTestError);
          
          // AbortError durumunda kullanıcıyı logout yapma, sadece loading'i durdur
          if (tokenTestError instanceof Error && tokenTestError.name === 'AbortError') {
            // Token validation timed out, keeping user logged in
            return;
          }
          
          // Network error - logout user
          await clearAuthData();
          setUser(null);
          setToken(null);
          setRefreshToken(null);
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
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
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
        
        // Token otomatik yenileme timer'ını başlat
        startTokenRefreshTimer();
        
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
      // Müşteri kayıt akışında zorunlu alanları kontrol et
      if (userData.user_type === 'passenger' || !userData.user_type) {
        if (!userData.full_name || userData.full_name.trim().length === 0) {
          showModal('Kayıt Hatası', 'Ad ve soyad zorunludur', 'error');
          return false;
        }
        
        if (!userData.phone || userData.phone.trim().length === 0) {
          showModal('Kayıt Hatası', 'Telefon numarası zorunludur', 'error');
          return false;
        }
        
        // Email opsiyonel ama girilmişse geçerli olmalı
        if (userData.email && userData.email.trim().length > 0) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(userData.email)) {
            showModal('Kayıt Hatası', 'Geçerli bir email adresi girin', 'error');
            return false;
          }
        }
      }
      
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
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
      // Timeout controller ekle
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 saniye timeout
      
      const response = await fetch(`${API_BASE_URL}/api/auth/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      // Response kontrolü
      if (!response.ok) {
        if (response.status === 500) {
          showModal('Sunucu Hatası', 'SMS servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.', 'error');
        } else if (response.status === 404) {
          showModal('Hata', 'SMS servisi bulunamadı. Lütfen sistem yöneticisi ile iletişime geçin.', 'error');
        } else {
          showModal('Hata', `SMS gönderilirken hata oluştu (${response.status})`, 'error');
        }
        return false;
      }

      const data = await response.json();

      if (data.success) {
        return true;
      } else {
        showModal('SMS Hatası', data.message || 'SMS gönderilemedi', 'error');
        return false;
      }
    } catch (error: any) {
      console.error('Send SMS error:', error);
      
      if (error.name === 'AbortError') {
        showModal('Zaman Aşımı', 'SMS gönderme işlemi zaman aşımına uğradı. Lütfen tekrar deneyin.', 'error');
      } else if (error.message?.includes('Network request failed') || error.message?.includes('fetch')) {
        showModal('Bağlantı Hatası', 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.', 'error');
      } else {
        showModal('Hata', 'SMS gönderilirken beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.', 'error');
      }
      return false;
    }
  };

  const verifySMS = async (phone: string, code: string, userType?: string): Promise<{ success: boolean; token?: string }> => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, code, user_type: userType || 'passenger' }),
      });

      const data = await response.json();

      if (data.success) {
        const { user: userData, token: authToken, refreshToken: authRefreshToken } = data.data;
        setUser(userData);
        setToken(authToken);
        setRefreshToken(authRefreshToken);
        await storeAuthData(authToken, authRefreshToken, userData);
        
        // Token otomatik yenileme timer'ını başlat
        startTokenRefreshTimer();
        
        // SMS doğrulama sonrası kullanıcı tipine göre yönlendirme
        setTimeout(() => {
          if (userData.user_type === 'driver') {
            // Sürücü için durum kontrolü yap
            checkDriverStatusAndRedirect(authToken);
          } else {
            // Normal kullanıcı için bilgi kontrolü yap
            checkCustomerInfoAndRedirect(userData);
          }
        }, 100);
        
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

  // Sürücü durumu kontrol et ve yönlendir
  const checkDriverStatusAndRedirect = async (authToken: string) => {
    try {
      // Önce AsyncStorage'dan kullanıcı tipini kontrol et
      const storedUserType = await AsyncStorage.getItem('userType');
      // Stored user type check
      
      const driverStatusResponse = await fetch(`${API_BASE_URL}/api/drivers/status`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (driverStatusResponse.ok) {
        const driverData = await driverStatusResponse.json();
        if (driverData && driverData.data && driverData.data.is_approved && driverData.data.is_active) {
          // Driver approved after SMS verification
          // Onaylanmış ve aktif sürücü - dashboard'a yönlendir
          router.replace('/driver-dashboard');
        } else {
          // Driver not approved after SMS verification
          // Henüz onaylanmamış sürücü - durum ekranına yönlendir
          router.replace('/driver-status');
        }
      } else if (driverStatusResponse.status === 404) {
         // No driver record found after SMS verification
        // Sürücü kaydı yok - kayıt ekranına yönlendir
        // Eğer kullanıcı daha önce sürücü kayıt sürecindeyse form verilerini koru
        if (storedUserType === 'driver') {
          // User was in driver registration process, preserving form data
        }
        router.replace('/driver-registration');
      } else {
        // Driver status check failed after SMS verification
        // Hata durumunda kayıt ekranına yönlendir
        router.replace('/driver-registration');
      }
    } catch (error) {
      console.error('Error checking driver status after SMS verification:', error);
      // Network hatası - kayıt ekranına yönlendir
      router.replace('/driver-registration');
    }
  };

  // Müşteri bilgi kontrolü yap ve yönlendir
  const checkCustomerInfoAndRedirect = (userData: User) => {
    // Ad/soyad eksikse user-info ekranına yönlendir
    if (!userData.full_name || userData.full_name.trim().length === 0) {
      // User info incomplete
      router.replace('/user-info');
    } else {
        // User info complete
      // Bilgiler tamamsa ana ekrana yönlendir
      router.replace('/driver-dashboard');
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // Token yenileme timer'ını durdur
      stopTokenRefreshTimer();
      
      setUser(null);
      setToken(null);
      setRefreshToken(null);
      await clearAuthData();
      // Kullanıcı tipini de temizle
      await AsyncStorage.removeItem('userType');
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
      const response = await makeAuthenticatedRequest('/api/auth/profile', {
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

  const updateUserInfo = async (firstName: string, lastName: string, email?: string): Promise<boolean> => {
    try {
      const response = await makeAuthenticatedRequest('/api/auth/update-user-info', {
        method: 'PUT',
        body: JSON.stringify({ 
          first_name: firstName, 
          last_name: lastName, 
          email: email || '' 
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update user data with new info
        const updatedUser = {
          ...user!,
          full_name: `${firstName} ${lastName}`,
          email: email || user?.email
        };
        setUser(updatedUser);
        await AsyncStorage.setItem('user_data', JSON.stringify(updatedUser));
        return true;
      } else {
        showModal('Güncelleme Hatası', data.message || 'Kullanıcı bilgileri güncellenemedi', 'error');
        return false;
      }
    } catch (error) {
      console.error('Update user info error:', error);
      showModal('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
      return false;
    }
  };

  const updateEmail = async (email: string): Promise<boolean> => {
    try {
      const response = await makeAuthenticatedRequest('/api/auth/update-user-info', {
        method: 'PUT',
        body: JSON.stringify({ 
          first_name: user?.full_name?.split(' ')[0] || '',
          last_name: user?.full_name?.split(' ').slice(1).join(' ') || '',
          email: email 
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update user data with new email
        const updatedUser = {
          ...user!,
          email: email
        };
        setUser(updatedUser);
        await AsyncStorage.setItem('user_data', JSON.stringify(updatedUser));
        return true;
      } else {
        showModal('Güncelleme Hatası', data.message || 'Email güncellenemedi', 'error');
        return false;
      }
    } catch (error) {
      console.error('Update email error:', error);
      showModal('Hata', 'Bağlantı hatası. Lütfen tekrar deneyin.', 'error');
      return false;
    }
  };

  const refreshProfile = async (): Promise<void> => {
    try {
      const response = await makeAuthenticatedRequest('/api/auth/profile');
      const data = await response.json();

      if (data.success) {
        setUser(data.data);
        await AsyncStorage.setItem('user_data', JSON.stringify(data.data));
      }
    } catch (error) {
      console.error('Refresh profile error:', error);
    }
  };

  // Token'ı otomatik yenileme timer'ını başlat
  const startTokenRefreshTimer = () => {
    // Mevcut timer'ı temizle
    if (tokenRefreshTimer) {
      clearInterval(tokenRefreshTimer);
    }
    
    // 50 dakikada bir token'ı yenile (token süresi 1 saat olacak)
    const timer = setInterval(async () => {
      if (token && refreshToken) {
        // Auto-refreshing token
        await refreshAuthToken();
      }
    }, 50 * 60 * 1000); // 50 dakika
    
    setTokenRefreshTimer(timer);
  };

  // Token refresh timer'ını durdur
  const stopTokenRefreshTimer = () => {
    if (tokenRefreshTimer) {
      clearInterval(tokenRefreshTimer);
      setTokenRefreshTimer(null);
    }
  };

  const refreshAuthToken = async (retryCount: number = 0): Promise<boolean> => {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 saniye
    
    try {
      if (!refreshToken) {
        // No refresh token available
        return false;
      }

      // Refreshing auth token with retry
      
      // Timeout controller ekle
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 saniye timeout
      
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      // Response kontrolü
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        const { token: newToken, refreshToken: newRefreshToken } = data.data;
        
        // Token validation
        if (!newToken || typeof newToken !== 'string') {
          throw new Error('Invalid token received from server');
        }
        
        setToken(newToken);
        
        // AsyncStorage işlemlerini güvenli şekilde yap
        const storageErrors: string[] = [];
        
        try {
          await AsyncStorage.setItem('auth_token', newToken);
        } catch (error) {
          console.error('Error storing new auth token:', error);
          storageErrors.push('auth_token');
        }
        
        // Yeni refresh token varsa onu da güncelle
        if (newRefreshToken && typeof newRefreshToken === 'string') {
          setRefreshToken(newRefreshToken);
          try {
            await AsyncStorage.setItem('refresh_token', newRefreshToken);
          } catch (error) {
            console.error('Error storing new refresh token:', error);
            storageErrors.push('refresh_token');
          }
        }
        
        if (storageErrors.length > 0) {
          console.warn(`Failed to store tokens in AsyncStorage: ${storageErrors.join(', ')}`);
        }
        
        // Token refreshed successfully
        return true;
      } else {
          // Refresh token is invalid, logging out user
        // Refresh token is invalid, logout user
        await logout();
        return false;
      }
    } catch (error) {
      console.error(`Refresh token error (attempt ${retryCount + 1}):`, error);
      
      // Network veya timeout hatalarında retry yap
      const isRetryableError = 
        error instanceof TypeError || // Network error
        (error as Error).name === 'AbortError' || // Timeout
        (error as Error).message.includes('fetch'); // Fetch related errors
      
      if (isRetryableError && retryCount < maxRetries) {
        // Exponential backoff ile retry
        const delay = baseDelay * Math.pow(2, retryCount);
        // Retrying token refresh with delay
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return refreshAuthToken(retryCount + 1);
      }
      
      // Max retry'a ulaştık veya retry edilemez hata
      console.error('Token refresh failed permanently, logging out user');
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
    updateUserInfo,
    updateEmail,
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