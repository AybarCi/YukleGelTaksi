import axios from 'axios';
import { API_CONFIG } from '../config/api';

export interface Order {
  id: number;
  user_id: number;
  driver_id?: number;
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  destination_address: string;
  destination_latitude: number;
  destination_longitude: number;
  distance_km: number;
  weight_kg: number;
  labor_count: number;
  cargo_photo_url?: string;
  base_price: number;
  distance_price: number;
  weight_price: number;
  labor_price: number;
  total_price: number;
  payment_method?: string;
  status: 'pending' | 'driver_accepted_awaiting_customer' | 'confirmed' | 'driver_going_to_pickup' | 'pickup_completed' | 'in_transit' | 'delivered' | 'payment_completed' | 'cancelled';
  customer_notes?: string;
  driver_notes?: string;
  cancel_reason?: string;
  created_at: string;
  accepted_at?: string;
  confirmed_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  updated_at: string;
  customer: {
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
  };
  driver?: {
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    vehicle_plate: string;
    vehicle_model: string;
    vehicle_color: string;
    rating: number;
  } | null;
}

export interface OrdersResponse {
  success: boolean;
  data: {
    orders: Order[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

export interface OrdersParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

class OrdersService {
  private getAuthHeaders() {
    const token = localStorage.getItem('supervisor_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async getOrders(params: OrdersParams = {}): Promise<OrdersResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.status && params.status !== 'all') queryParams.append('status', params.status);
      if (params.search) queryParams.append('search', params.search);

      const response = await axios.get(
        `${API_CONFIG.BASE_URL}/api/orders?${queryParams.toString()}`,
        { headers: this.getAuthHeaders() }
      );

      return response.data;
    } catch (error: any) {
      console.error('Orders fetch error:', error);
      throw new Error(error.response?.data?.error || 'Siparişler alınırken bir hata oluştu');
    }
  }

  async getOrderById(id: number): Promise<Order> {
    try {
      const response = await axios.get(
        `${API_CONFIG.BASE_URL}/api/orders/${id}`,
        { headers: this.getAuthHeaders() }
      );

      return response.data.data;
    } catch (error: any) {
      console.error('Order fetch error:', error);
      throw new Error(error.response?.data?.error || 'Sipariş alınırken bir hata oluştu');
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'pending':
        return '#ff9800'; // Orange
      case 'driver_accepted_awaiting_customer':
        return '#2196f3'; // Blue
      case 'confirmed':
        return '#9c27b0'; // Purple
      case 'driver_going_to_pickup':
        return '#3f51b5'; // Indigo
      case 'pickup_completed':
        return '#ff5722'; // Deep Orange
      case 'in_transit':
        return '#795548'; // Brown
      case 'delivered':
        return '#607d8b'; // Blue Grey
      case 'payment_completed':
        return '#4caf50'; // Green
      case 'cancelled':
        return '#f44336'; // Red
      default:
        return '#757575'; // Grey
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'pending':
        return 'Beklemede';
      case 'driver_accepted_awaiting_customer':
        return 'Sürücü Kabul Etti - Müşteri Onayı Bekleniyor';
      case 'confirmed':
        return 'Onaylandı';
      case 'driver_going_to_pickup':
        return 'Sürücü Yola Çıktı';
      case 'pickup_completed':
        return 'Yük Alındı';
      case 'in_transit':
        return 'Yolda';
      case 'delivered':
        return 'Teslim Edildi';
      case 'payment_completed':
        return 'Ödeme Tamamlandı';
      case 'cancelled':
        return 'İptal Edildi';
      default:
        return 'Bilinmeyen';
    }
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(price);
  }

  formatDate(dateString: string): string {
    return new Intl.DateTimeFormat('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  }
}

export default new OrdersService();