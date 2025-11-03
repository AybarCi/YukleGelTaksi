import { DriversState, DriverData, Action } from '../types';
import axios from 'axios';
import { API_CONFIG } from '../../config/api';

const API_BASE_URL = API_CONFIG.BASE_URL;

// Action Types
export const DRIVERS_FETCH_REQUEST = 'DRIVERS_FETCH_REQUEST';
export const DRIVERS_FETCH_SUCCESS = 'DRIVERS_FETCH_SUCCESS';
export const DRIVERS_FETCH_FAILURE = 'DRIVERS_FETCH_FAILURE';
export const DRIVERS_UPDATE_STATUS_REQUEST = 'DRIVERS_UPDATE_STATUS_REQUEST';
export const DRIVERS_UPDATE_STATUS_SUCCESS = 'DRIVERS_UPDATE_STATUS_SUCCESS';
export const DRIVERS_UPDATE_STATUS_FAILURE = 'DRIVERS_UPDATE_STATUS_FAILURE';
export const DRIVERS_UPDATE_AVAILABILITY_REQUEST = 'DRIVERS_UPDATE_AVAILABILITY_REQUEST';
export const DRIVERS_UPDATE_AVAILABILITY_SUCCESS = 'DRIVERS_UPDATE_AVAILABILITY_SUCCESS';
export const DRIVERS_UPDATE_AVAILABILITY_FAILURE = 'DRIVERS_UPDATE_AVAILABILITY_FAILURE';
export const DRIVERS_CLEAR_ERROR = 'DRIVERS_CLEAR_ERROR';

// Initial State
const initialState: DriversState = {
  drivers: [],
  loading: false,
  error: null,
  total: 0,
  page: 1,
  limit: 10,
};

// Reducer
export const driversReducer = (state = initialState, action: Action): DriversState => {
  switch (action.type) {
    case DRIVERS_FETCH_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };
    case DRIVERS_FETCH_SUCCESS:
      return {
        ...state,
        drivers: action.payload.drivers,
        total: action.payload.total,
        loading: false,
        error: null,
      };
    case DRIVERS_FETCH_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.error || 'Bir hata oluştu',
      };
    case DRIVERS_UPDATE_STATUS_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };
    case DRIVERS_UPDATE_STATUS_SUCCESS:
      return {
        ...state,
        drivers: state.drivers.map(driver =>
          driver.id === action.payload.driverId
            ? { ...driver, is_verified: action.payload.isVerified }
            : driver
        ),
        loading: false,
        error: null,
      };
    case DRIVERS_UPDATE_STATUS_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.error || 'Bir hata oluştu',
      };
    case DRIVERS_UPDATE_AVAILABILITY_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };
    case DRIVERS_UPDATE_AVAILABILITY_SUCCESS:
      return {
        ...state,
        drivers: state.drivers.map(driver =>
          driver.id === action.payload.driverId
            ? { ...driver, is_available: action.payload.isAvailable }
            : driver
        ),
        loading: false,
        error: null,
      };
    case DRIVERS_UPDATE_AVAILABILITY_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.error || 'Bir hata oluştu',
      };
    case DRIVERS_CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

// Action Creators
export const driversFetchRequest = () => ({
  type: DRIVERS_FETCH_REQUEST,
});

export const driversFetchSuccess = (drivers: DriverData[], total: number) => ({
  type: DRIVERS_FETCH_SUCCESS,
  payload: { drivers, total },
});

export const driversFetchFailure = (error: string) => ({
  type: DRIVERS_FETCH_FAILURE,
  error,
});

export const driversUpdateStatusRequest = () => ({
  type: DRIVERS_UPDATE_STATUS_REQUEST,
});

export const driversUpdateStatusSuccess = (driverId: number, isVerified: boolean) => ({
  type: DRIVERS_UPDATE_STATUS_SUCCESS,
  payload: { driverId, isVerified },
});

export const driversUpdateStatusFailure = (error: string) => ({
  type: DRIVERS_UPDATE_STATUS_FAILURE,
  error,
});

export const driversUpdateAvailabilityRequest = () => ({
  type: DRIVERS_UPDATE_AVAILABILITY_REQUEST,
});

export const driversUpdateAvailabilitySuccess = (driverId: number, isAvailable: boolean) => ({
  type: DRIVERS_UPDATE_AVAILABILITY_SUCCESS,
  payload: { driverId, isAvailable },
});

export const driversUpdateAvailabilityFailure = (error: string) => ({
  type: DRIVERS_UPDATE_AVAILABILITY_FAILURE,
  error,
});

export const driversClearError = () => ({
  type: DRIVERS_CLEAR_ERROR,
});

// Thunk Actions
export const fetchDrivers = (page: number = 1, limit: number = 10) => {
  return async (dispatch: any) => {
    dispatch(driversFetchRequest());
    try {
      const response = await axios.get(`${API_BASE_URL}/drivers`, {
        params: { page, limit }
      });

      if (response.data.success) {
        const drivers = response.data.data || [];
        const total = response.data.total || drivers.length;
        dispatch(driversFetchSuccess(drivers, total));
      } else {
        dispatch(driversFetchFailure('Sürücüler yüklenirken hata oluştu'));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Sürücüler yüklenirken hata oluştu';
      dispatch(driversFetchFailure(errorMessage));
    }
  };
};

export const updateDriverStatus = (driverId: number, isVerified: boolean) => {
  return async (dispatch: any) => {
    dispatch(driversUpdateStatusRequest());
    try {
      const response = await axios.put(
        `${API_BASE_URL}/drivers/${driverId}/status`,
        { is_verified: isVerified }
      );

      if (response.data.success) {
        dispatch(driversUpdateStatusSuccess(driverId, isVerified));
      } else {
        dispatch(driversUpdateStatusFailure('Sürücü durumu güncellenirken hata oluştu'));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Sürücü durumu güncellenirken hata oluştu';
      dispatch(driversUpdateStatusFailure(errorMessage));
    }
  };
};

export const updateDriverAvailability = (driverId: number, isAvailable: boolean) => {
  return async (dispatch: any) => {
    dispatch(driversUpdateAvailabilityRequest());
    try {
      const response = await axios.put(
        `${API_BASE_URL}/drivers/${driverId}/availability`,
        { is_available: isAvailable }
      );

      if (response.data.success) {
        dispatch(driversUpdateAvailabilitySuccess(driverId, isAvailable));
      } else {
        dispatch(driversUpdateAvailabilityFailure('Sürücü müsaitliği güncellenirken hata oluştu'));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Sürücü müsaitliği güncellenirken hata oluştu';
      dispatch(driversUpdateAvailabilityFailure(errorMessage));
    }
  };
};

// Default export for use in combineReducers
export default driversReducer;