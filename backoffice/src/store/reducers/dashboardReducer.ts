import { DashboardState, DashboardData, Action } from '../types';
import axios from 'axios';
import { API_CONFIG } from '../../config/api';

const API_BASE_URL = API_CONFIG.BASE_URL;

// Action Types
export const DASHBOARD_DATA_REQUEST = 'DASHBOARD_DATA_REQUEST';
export const DASHBOARD_DATA_SUCCESS = 'DASHBOARD_DATA_SUCCESS';
export const DASHBOARD_DATA_FAILURE = 'DASHBOARD_DATA_FAILURE';
export const DASHBOARD_CLEAR_ERROR = 'DASHBOARD_CLEAR_ERROR';

// Initial State
const initialState: DashboardState = {
  data: null,
  loading: false,
  error: null,
};

// Reducer
export const dashboardReducer = (state = initialState, action: Action): DashboardState => {
  switch (action.type) {
    case DASHBOARD_DATA_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };
    case DASHBOARD_DATA_SUCCESS:
      return {
        ...state,
        data: action.payload,
        loading: false,
        error: null,
      };
    case DASHBOARD_DATA_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.error || 'Bir hata oluştu',
      };
    case DASHBOARD_CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

// Action Creators
export const dashboardDataRequest = () => ({
  type: DASHBOARD_DATA_REQUEST,
});

export const dashboardDataSuccess = (data: DashboardData) => ({
  type: DASHBOARD_DATA_SUCCESS,
  payload: data,
});

export const dashboardDataFailure = (error: string) => ({
  type: DASHBOARD_DATA_FAILURE,
  error,
});

export const dashboardClearError = () => ({
  type: DASHBOARD_CLEAR_ERROR,
});

// Thunk Actions
export const fetchDashboardData = () => async (dispatch: any) => {
  dispatch(dashboardDataRequest());
  try {
    // Fetch all data in parallel
    const [usersResponse, driversResponse, ordersResponse] = await Promise.all([
      axios.get(`${API_BASE_URL}/users`),
      axios.get(`${API_BASE_URL}/drivers`),
      axios.get(`${API_BASE_URL}/orders`)
    ]);

    // Process the data
    const users = usersResponse.data.data || [];
    const drivers = driversResponse.data.data || [];
    const orders = ordersResponse.data.data?.orders || [];
    
    // Calculate statistics
    const totalUsers = users.length;
    const totalDrivers = drivers.length;
    const availableDrivers = drivers.filter((d: any) => d.is_available).length;
    const totalOrders = orders.length;
    const completedOrders = orders.filter((o: any) => o.status === 'completed').length;
    const todayOrders = orders.filter((o: any) => {
      const today = new Date().toISOString().split('T')[0];
      return o.created_at?.startsWith(today);
    }).length;
    
    const totalRevenue = orders
      .filter((o: any) => o.status === 'completed')
      .reduce((sum: number, o: any) => sum + (o.total_price || 0), 0);
    
    const todayRevenue = orders
      .filter((o: any) => {
        const today = new Date().toISOString().split('T')[0];
        return o.status === 'completed' && o.created_at?.startsWith(today);
      })
      .reduce((sum: number, o: any) => sum + (o.total_price || 0), 0);

    // Order status distribution
    const ordersByStatus = [
      { status: 'Tamamlandı', count: completedOrders },
      { status: 'Devam Ediyor', count: orders.filter((o: any) => o.status === 'in_transit').length },
      { status: 'İptal Edildi', count: orders.filter((o: any) => o.status === 'cancelled').length },
    ].filter(item => item.count > 0);

    // Top drivers (simplified - in real app would need separate API call)
    const topDrivers = drivers
      .sort((a: any, b: any) => (b.completed_orders || 0) - (a.completed_orders || 0))
      .slice(0, 3)
      .map((driver: any) => ({
        driver_name: driver.full_name || `${driver.first_name} ${driver.last_name}`,
        phone_number: driver.phone_number || 'N/A',
        completed_orders: driver.completed_orders || 0,
        avg_rating: driver.avg_rating || 4.5,
      }));

    // Recent orders (last 10)
    const recentOrders = orders
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map((order: any) => ({
        id: order.id,
        pickup_address: order.pickup_address,
        destination_address: order.destination_address,
        status: order.status,
        total_price: order.total_price,
        created_at: order.created_at,
        customer_name: order.customer_name || 'Bilinmeyen Müşteri',
        driver_name: order.driver_name || 'Atanmadı',
      }));

    // Monthly revenue (mock data for now - would need analytics API)
    const monthlyRevenue = [
      { month: 'Oca', revenue: 45000, order_count: 890 },
      { month: 'Şub', revenue: 52000, order_count: 1020 },
      { month: 'Mar', revenue: 48000, order_count: 950 },
      { month: 'Nis', revenue: 55000, order_count: 1100 },
      { month: 'May', revenue: 62000, order_count: 1240 },
      { month: 'Haz', revenue: 58000, order_count: 1160 },
    ];

    const dashboardData: DashboardData = {
      stats: {
        totalUsers,
        totalDrivers,
        availableDrivers,
        totalOrders,
        completedOrders,
        todayOrders,
        totalRevenue,
        todayRevenue,
      },
      ordersByStatus,
      topDrivers,
      recentOrders,
      monthlyRevenue,
    };

    dispatch(dashboardDataSuccess(dashboardData));
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || 'Dashboard verileri yüklenirken hata oluştu';
    dispatch(dashboardDataFailure(errorMessage));
  }
};

// Default export for use in combineReducers
export default dashboardReducer;