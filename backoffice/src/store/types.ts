// Auth Types
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Dashboard Types
export interface DashboardStats {
  totalUsers: number;
  totalDrivers: number;
  availableDrivers: number;
  totalOrders: number;
  completedOrders: number;
  todayOrders: number;
  totalRevenue: number;
  todayRevenue: number;
}

export interface OrderStatusData {
  status: string;
  count: number;
}

export interface TopDriver {
  driver_name: string;
  phone_number: string;
  completed_orders: number;
  avg_rating: number;
}

export interface RecentOrder {
  id: number;
  pickup_address: string;
  destination_address: string;
  status: string;
  total_price: number;
  created_at: string;
  customer_name: string;
  driver_name: string;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  order_count: number;
}

export interface DashboardData {
  stats: DashboardStats;
  ordersByStatus: OrderStatusData[];
  topDrivers: TopDriver[];
  recentOrders: RecentOrder[];
  monthlyRevenue: MonthlyRevenue[];
}

export interface DashboardState {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
}

// Users Types
export interface UserData {
  id: number;
  full_name: string;
  phone_number: string;
  email: string;
  created_at: string;
  is_active: boolean;
}

export interface UsersState {
  users: UserData[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  limit: number;
}

// Drivers Types
export interface DriverData {
  id: number;
  full_name: string;
  phone_number: string;
  email: string;
  license_number: string;
  vehicle_type: string;
  vehicle_model: string;
  vehicle_plate: string;
  is_verified: boolean;
  is_available: boolean;
  created_at: string;
  rating: number;
  // Additional fields for API compatibility
  first_name?: string;
  last_name?: string;
  // Optional fields that may be present
  license_expiry_date?: string;
  total_earnings?: number;
  total_trips?: number;
  last_location_update?: string;
  has_driver_photo?: boolean;
  has_license_photo?: boolean;
  has_eligibility_certificate?: boolean;
  driver_photo?: string;
  license_photo?: string;
  eligibility_certificate?: string;
  vehicle_year?: string | number;
}

export interface DriversState {
  drivers: DriverData[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  limit: number;
}

// Orders Types
export interface OrderData {
  id: number;
  user_id: number;
  driver_id?: number;
  pickup_address: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  destination_address: string;
  destination_latitude?: number;
  destination_longitude?: number;
  distance_km: number;
  weight_kg: number;
  labor_count?: number;
  cargo_photo_url?: string;
  base_price?: number;
  distance_price?: number;
  weight_price?: number;
  labor_price?: number;
  total_price: number;
  payment_method?: string;
  status: string;
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
    email?: string;
  };
  driver?: {
    first_name: string;
    last_name: string;
    phone?: string;
    email?: string;
    vehicle_plate: string;
    vehicle_model?: string;
    vehicle_color?: string;
    rating?: number;
  } | null;
}

export interface OrdersState {
  orders: OrderData[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  limit: number;
}

// Monitoring Types
export interface MonitoringConnections {
  drivers: number;
  customers: number;
  total: number;
}

export interface MonitoringThresholds {
  errorRate: number;
  responseTime: number;
  eventFrequency: number;
}

export interface MonitoringSummary {
  totalEvents: number;
  totalErrors: number;
  errorRate: number;
  avgResponseTime: number;
  uptime: number;
  period: string;
}

export interface MonitoringData {
  connections: MonitoringConnections;
  monitoring?: {
    isActive: boolean;
    thresholds: MonitoringThresholds;
    uptime: number;
  };
  summary?: MonitoringSummary;
  timestamp: string;
  events?: any[];
  errors?: any[];
  performance?: any[];
  recentEvents?: any[];
  recentErrors?: any[];
  recentPerformance?: any[];
}

export interface MonitoringState {
  data: MonitoringData | null;
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  autoRefresh: boolean;
  thresholds: MonitoringThresholds;
}

// Support Ticket Types
export interface SupportTicketData {
  id: number;
  driver_id: number;
  issue_type: string;
  subject: string;
  message: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  admin_response?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  driver_name?: string;
  driver_phone?: string;
  driver_email?: string;
}

export interface CustomerSupportTicketData {
  id: number;
  user_id: number;
  issue_type: string;
  subject: string;
  message: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  admin_response?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
}

export interface SupportTicketsState {
  driverTickets: SupportTicketData[];
  customerTickets: CustomerSupportTicketData[];
  loading: boolean;
  error: string | null;
  totalDriverTickets: number;
  totalCustomerTickets: number;
  page: number;
  rowsPerPage: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  supervisor: User;
}

export interface VerifyResponse {
  valid: boolean;
  supervisor?: User;
  error?: string;
}

// Action Types
export interface Action<T = any> {
  type: string;
  payload?: T;
  error?: string;
}

// Thunk Types
export type AppDispatch = (action: Action | ((dispatch: AppDispatch) => Promise<void>)) => Promise<void>;
export type RootState = {
  auth: AuthState;
  dashboard: DashboardState;
  users: UsersState;
  drivers: DriversState;
  orders: OrdersState;
  monitoring: MonitoringState;
  supportTickets: SupportTicketsState;
};