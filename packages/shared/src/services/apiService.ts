import { ApiResponse, User, Driver, Customer, Ride, Location } from '../types';
import { API_CONFIG } from '../config/environment';

class ApiService {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string = API_CONFIG.BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data: any = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Request failed',
        };
      }

      return {
        success: true,
        data: data as T,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // Auth endpoints
  async login(email: string, password: string, userType: 'customer' | 'driver'): Promise<ApiResponse<{ user: User; token: string }>> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, userType }),
    });
  }

  async register(userData: Partial<User>, userType: 'customer' | 'driver'): Promise<ApiResponse<{ user: User; token: string }>> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...userData, userType }),
    });
  }

  async logout(): Promise<ApiResponse<void>> {
    const result = await this.request<void>('/auth/logout', {
      method: 'POST',
    });
    this.authToken = null;
    return result;
  }

  // User endpoints
  async getProfile(): Promise<ApiResponse<User>> {
    return this.request('/user/profile');
  }

  async updateProfile(userData: Partial<User>): Promise<ApiResponse<User>> {
    return this.request('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  // Driver endpoints
  async getDrivers(location?: Location, radius?: number): Promise<ApiResponse<Driver[]>> {
    const params = new URLSearchParams();
    if (location) {
      params.append('lat', location.latitude.toString());
      params.append('lng', location.longitude.toString());
    }
    if (radius) {
      params.append('radius', radius.toString());
    }

    const query = params.toString();
    return this.request(`/drivers${query ? `?${query}` : ''}`);
  }

  async updateDriverAvailability(isAvailable: boolean): Promise<ApiResponse<Driver>> {
    return this.request('/driver/availability', {
      method: 'PUT',
      body: JSON.stringify({ isAvailable }),
    });
  }

  async updateDriverLocation(location: Location): Promise<ApiResponse<void>> {
    return this.request('/driver/location', {
      method: 'PUT',
      body: JSON.stringify(location),
    });
  }

  // Ride endpoints
  async createRide(pickupLocation: Location, dropoffLocation: Location): Promise<ApiResponse<Ride>> {
    return this.request('/rides', {
      method: 'POST',
      body: JSON.stringify({ pickupLocation, dropoffLocation }),
    });
  }

  async getRides(userId?: string): Promise<ApiResponse<Ride[]>> {
    const params = userId ? `?userId=${userId}` : '';
    return this.request(`/rides${params}`);
  }

  async getRide(rideId: string): Promise<ApiResponse<Ride>> {
    return this.request(`/rides/${rideId}`);
  }

  async updateRideStatus(rideId: string, status: string, location?: Location): Promise<ApiResponse<Ride>> {
    return this.request(`/rides/${rideId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, location }),
    });
  }

  async cancelRide(rideId: string, reason?: string): Promise<ApiResponse<Ride>> {
    return this.request(`/rides/${rideId}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  }

  async acceptRide(rideId: string): Promise<ApiResponse<Ride>> {
    return this.request(`/rides/${rideId}/accept`, {
      method: 'PUT',
    });
  }

  // Location endpoints
  async geocodeAddress(address: string): Promise<ApiResponse<Location>> {
    return this.request('/location/geocode', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });
  }

  async reverseGeocode(location: Location): Promise<ApiResponse<{ address: string }>> {
    return this.request('/location/reverse-geocode', {
      method: 'POST',
      body: JSON.stringify(location),
    });
  }

  async calculateRoute(origin: Location, destination: Location): Promise<ApiResponse<{ distance: number; duration: number; fare: number }>> {
    return this.request('/location/route', {
      method: 'POST',
      body: JSON.stringify({ origin, destination }),
    });
  }
}

export default ApiService;