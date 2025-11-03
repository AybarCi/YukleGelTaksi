import axios from 'axios';
import { API_CONFIG } from '../config/api';

const API_BASE_URL = API_CONFIG.BASE_URL;

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface Supervisor {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  supervisor: Supervisor;
}

export interface VerifyResponse {
  valid: boolean;
  supervisor?: Supervisor;
  error?: string;
}

class AuthService {
  private token: string | null = null;
  private tokenCheckInterval: NodeJS.Timeout | number | null = null;

  constructor() {
    this.token = localStorage.getItem('supervisor_token');
    this.startTokenExpiryCheck();
  }

  public async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/supervisor/auth/login`, credentials);
      
      if (response.data.success) {
        this.token = response.data.token;
        localStorage.setItem('supervisor_token', this.token!);
        localStorage.setItem('supervisor_data', JSON.stringify(response.data.supervisor));
        
        // Set token expiry (10 hours from now)
        const expiryTime = new Date().getTime() + (10 * 60 * 60 * 1000);
        localStorage.setItem('supervisor_token_expiry', expiryTime.toString());
        
        // Start token expiry check
        this.startTokenExpiryCheck();
      }
      
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Giriş yapılırken hata oluştu');
    }
  }

  public async logout(): Promise<void> {
    try {
      if (this.token) {
        await axios.post(
          `${API_BASE_URL}/supervisor/auth/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${this.token}`
            }
          }
        );
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.stopTokenExpiryCheck();
      this.clearLocalStorage();
    }
  }

  public async verifyToken(): Promise<VerifyResponse> {
    if (!this.token) {
      return { valid: false, error: 'Token bulunamadı' };
    }

    // Check local token expiry first
    if (this.isTokenExpiredLocally()) {
      this.clearLocalStorage();
      return { valid: false, error: 'Token süresi dolmuş' };
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/supervisor/auth/verify`, {
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      });
      
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        this.clearLocalStorage();
        return { valid: false, error: error.response.data?.error || 'Token geçersiz' };
      }
      
      throw new Error('Token doğrulama hatası');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public getSupervisor(): Supervisor | null {
    const supervisorData = localStorage.getItem('supervisor_data');
    return supervisorData ? JSON.parse(supervisorData) : null;
  }

  public isAuthenticated(): boolean {
    return this.token !== null && !this.isTokenExpiredLocally();
  }

  private isTokenExpiredLocally(): boolean {
    const expiryTime = localStorage.getItem('supervisor_token_expiry');
    if (!expiryTime) {
      return true;
    }
    
    return new Date().getTime() > parseInt(expiryTime);
  }

  private clearLocalStorage(): void {
    this.token = null;
    localStorage.removeItem('supervisor_token');
    localStorage.removeItem('supervisor_data');
    localStorage.removeItem('supervisor_token_expiry');
  }

  private startTokenExpiryCheck(): void {
    // Clear existing interval if any
    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
    }

    // Check token expiry every minute
    this.tokenCheckInterval = setInterval(() => {
      if (this.token && this.isTokenExpiredLocally()) {
        console.log('Token expired, logging out...');
        this.clearLocalStorage();
        window.location.href = '/login';
      }
    }, 60000); // Check every minute
  }

  private stopTokenExpiryCheck(): void {
    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
      this.tokenCheckInterval = null;
    }
  }

  // Setup axios interceptor for automatic token attachment
  public setupAxiosInterceptors(onUnauthorized?: () => void): void {
    axios.interceptors.request.use(
      (config) => {
        // Don't add token to login requests
        if (this.token && !config.url?.includes('/auth/login') && (config.url?.includes('/supervisor/') || config.url?.includes('/admin/') || config.url?.includes('/api/'))) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && (error.config?.url?.includes('/supervisor/') || error.config?.url?.includes('/admin/') || error.config?.url?.includes('/api/'))) {
          this.stopTokenExpiryCheck();
          this.clearLocalStorage();
          if (onUnauthorized) {
            onUnauthorized();
          } else {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }
}

export default AuthService;