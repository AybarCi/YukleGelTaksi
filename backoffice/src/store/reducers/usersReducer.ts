import { UsersState, UserData, Action } from '../types';
import axios from 'axios';
import { API_CONFIG } from '../../config/api';

const API_BASE_URL = API_CONFIG.BASE_URL;

// Action Types
export const USERS_FETCH_REQUEST = 'USERS_FETCH_REQUEST';
export const USERS_FETCH_SUCCESS = 'USERS_FETCH_SUCCESS';
export const USERS_FETCH_FAILURE = 'USERS_FETCH_FAILURE';
export const USERS_UPDATE_STATUS_REQUEST = 'USERS_UPDATE_STATUS_REQUEST';
export const USERS_UPDATE_STATUS_SUCCESS = 'USERS_UPDATE_STATUS_SUCCESS';
export const USERS_UPDATE_STATUS_FAILURE = 'USERS_UPDATE_STATUS_FAILURE';
export const USERS_CLEAR_ERROR = 'USERS_CLEAR_ERROR';

// Initial State
const initialState: UsersState = {
  users: [],
  loading: false,
  error: null,
  total: 0,
  page: 1,
  limit: 10,
};

// Reducer
export const usersReducer = (state = initialState, action: Action): UsersState => {
  switch (action.type) {
    case USERS_FETCH_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };
    case USERS_FETCH_SUCCESS:
      return {
        ...state,
        users: action.payload.users,
        total: action.payload.total,
        loading: false,
        error: null,
      };
    case USERS_FETCH_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.error || 'Bir hata oluştu',
      };
    case USERS_UPDATE_STATUS_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };
    case USERS_UPDATE_STATUS_SUCCESS:
      return {
        ...state,
        users: state.users.map(user =>
          user.id === action.payload.userId
            ? { ...user, is_active: action.payload.isActive }
            : user
        ),
        loading: false,
        error: null,
      };
    case USERS_UPDATE_STATUS_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.error || 'Bir hata oluştu',
      };
    case USERS_CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

// Action Creators
export const usersFetchRequest = () => ({
  type: USERS_FETCH_REQUEST,
});

export const usersFetchSuccess = (users: UserData[], total: number) => ({
  type: USERS_FETCH_SUCCESS,
  payload: { users, total },
});

export const usersFetchFailure = (error: string) => ({
  type: USERS_FETCH_FAILURE,
  error,
});

export const usersUpdateStatusRequest = () => ({
  type: USERS_UPDATE_STATUS_REQUEST,
});

export const usersUpdateStatusSuccess = (userId: number, isActive: boolean) => ({
  type: USERS_UPDATE_STATUS_SUCCESS,
  payload: { userId, isActive },
});

export const usersUpdateStatusFailure = (error: string) => ({
  type: USERS_UPDATE_STATUS_FAILURE,
  error,
});

export const usersClearError = () => ({
  type: USERS_CLEAR_ERROR,
});

// Thunk Actions
export const fetchUsers = (token: string, page: number = 1, limit: number = 10) => {
  return async (dispatch: any) => {
    dispatch(usersFetchRequest());
    try {
      const response = await axios.get(`${API_BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { page, limit }
      });

      if (response.data.success) {
        const users = response.data.data || [];
        const total = response.data.total || users.length;
        dispatch(usersFetchSuccess(users, total));
      } else {
        dispatch(usersFetchFailure('Kullanıcılar yüklenirken hata oluştu'));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Kullanıcılar yüklenirken hata oluştu';
      dispatch(usersFetchFailure(errorMessage));
    }
  };
};

export const updateUserStatus = (token: string, userId: number, isActive: boolean) => {
  return async (dispatch: any) => {
    dispatch(usersUpdateStatusRequest());
    try {
      const response = await axios.put(
        `${API_BASE_URL}/users/${userId}/status`,
        { is_active: isActive },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        dispatch(usersUpdateStatusSuccess(userId, isActive));
      } else {
        dispatch(usersUpdateStatusFailure('Kullanıcı durumu güncellenirken hata oluştu'));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Kullanıcı durumu güncellenirken hata oluştu';
      dispatch(usersUpdateStatusFailure(errorMessage));
    }
  };
};

// Default export for use in combineReducers
export default usersReducer;