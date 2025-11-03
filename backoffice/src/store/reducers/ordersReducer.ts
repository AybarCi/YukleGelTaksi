import { OrdersState, OrderData, Action } from '../types';
import axios from 'axios';
import { API_CONFIG } from '../../config/api';

const API_BASE_URL = API_CONFIG.BASE_URL;

// Action Types
export const ORDERS_FETCH_REQUEST = 'ORDERS_FETCH_REQUEST';
export const ORDERS_FETCH_SUCCESS = 'ORDERS_FETCH_SUCCESS';
export const ORDERS_FETCH_FAILURE = 'ORDERS_FETCH_FAILURE';
export const ORDERS_CLEAR_ERROR = 'ORDERS_CLEAR_ERROR';

// Initial State
const initialState: OrdersState = {
  orders: [],
  loading: false,
  error: null,
  total: 0,
  page: 1,
  limit: 10,
};

// Reducer
export const ordersReducer = (state = initialState, action: Action): OrdersState => {
  switch (action.type) {
    case ORDERS_FETCH_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };
    case ORDERS_FETCH_SUCCESS:
      return {
        ...state,
        orders: action.payload.orders,
        total: action.payload.total,
        page: action.payload.page || state.page,
        limit: action.payload.limit || state.limit,
        loading: false,
        error: null,
      };
    case ORDERS_FETCH_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.error || 'Bir hata oluştu',
      };
    case ORDERS_CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

// Action Creators
export const ordersFetchRequest = () => ({
  type: ORDERS_FETCH_REQUEST,
});

export const ordersFetchSuccess = (orders: OrderData[], total: number, page?: number, limit?: number) => ({
  type: ORDERS_FETCH_SUCCESS,
  payload: { orders, total, page, limit },
});

export const ordersFetchFailure = (error: string) => ({
  type: ORDERS_FETCH_FAILURE,
  error,
});

export const ordersClearError = () => ({
  type: ORDERS_CLEAR_ERROR,
});

// Thunk Actions
export const fetchOrders = (page: number = 1, limit: number = 10, status?: string, search?: string) => {
  return async (dispatch: any, getState: any) => {
    dispatch(ordersFetchRequest());
    try {
      const token = getState().auth.token;
      const params = new URLSearchParams();
      
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      
      if (status && status !== 'all') {
        params.append('status', status);
      }
      
      if (search && search.trim()) {
        params.append('search', search.trim());
      }

      const response = await axios.get(`${API_BASE_URL}/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const orders = response.data.data?.orders || [];
        const total = response.data.total || orders.length;
        dispatch(ordersFetchSuccess(orders, total, page, limit));
      } else {
        dispatch(ordersFetchFailure('Siparişler yüklenirken hata oluştu'));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Siparişler yüklenirken hata oluştu';
      dispatch(ordersFetchFailure(errorMessage));
    }
  };
};

// Default export for use in combineReducers
export default ordersReducer;