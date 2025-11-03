import { MonitoringState, MonitoringData, MonitoringThresholds } from '../types';
import { API_CONFIG } from '../../config/api';

// Action Types
export const MONITORING_FETCH_REQUEST = 'MONITORING_FETCH_REQUEST';
export const MONITORING_FETCH_SUCCESS = 'MONITORING_FETCH_SUCCESS';
export const MONITORING_FETCH_FAILURE = 'MONITORING_FETCH_FAILURE';
export const MONITORING_SET_CONNECTION_STATUS = 'MONITORING_SET_CONNECTION_STATUS';
export const MONITORING_SET_AUTO_REFRESH = 'MONITORING_SET_AUTO_REFRESH';
export const MONITORING_UPDATE_THRESHOLDS = 'MONITORING_UPDATE_THRESHOLDS';
export const MONITORING_UPDATE_DATA = 'MONITORING_UPDATE_DATA';

// Action Interfaces
interface MonitoringFetchRequestAction {
  type: typeof MONITORING_FETCH_REQUEST;
}

interface MonitoringFetchSuccessAction {
  type: typeof MONITORING_FETCH_SUCCESS;
  payload: MonitoringData;
}

interface MonitoringFetchFailureAction {
  type: typeof MONITORING_FETCH_FAILURE;
  payload: string;
}

interface MonitoringSetConnectionStatusAction {
  type: typeof MONITORING_SET_CONNECTION_STATUS;
  payload: boolean;
}

interface MonitoringSetAutoRefreshAction {
  type: typeof MONITORING_SET_AUTO_REFRESH;
  payload: boolean;
}

interface MonitoringUpdateThresholdsAction {
  type: typeof MONITORING_UPDATE_THRESHOLDS;
  payload: MonitoringThresholds;
}

interface MonitoringUpdateDataAction {
  type: typeof MONITORING_UPDATE_DATA;
  payload: MonitoringData;
}

export type MonitoringActionTypes =
  | MonitoringFetchRequestAction
  | MonitoringFetchSuccessAction
  | MonitoringFetchFailureAction
  | MonitoringSetConnectionStatusAction
  | MonitoringSetAutoRefreshAction
  | MonitoringUpdateThresholdsAction
  | MonitoringUpdateDataAction;

// Initial State
const initialState: MonitoringState = {
  data: null,
  loading: false,
  error: null,
  isConnected: false,
  autoRefresh: true,
  thresholds: {
    errorRate: 5,
    responseTime: 1000,
    eventFrequency: 100
  }
};

// Reducer
export default function monitoringReducer(
  state = initialState,
  action: MonitoringActionTypes | { type: string; payload?: any }
): MonitoringState {
  switch (action.type) {
    case MONITORING_FETCH_REQUEST:
      return {
        ...state,
        loading: true,
        error: null
      };
    case MONITORING_FETCH_SUCCESS:
      return {
        ...state,
        loading: false,
        error: null,
        data: action.payload
      };
    case MONITORING_FETCH_FAILURE:
      return {
        ...state,
        loading: false,
        error: action.payload
      };
    case MONITORING_SET_CONNECTION_STATUS:
      return {
        ...state,
        isConnected: action.payload
      };
    case MONITORING_SET_AUTO_REFRESH:
      return {
        ...state,
        autoRefresh: action.payload
      };
    case MONITORING_UPDATE_THRESHOLDS:
      return {
        ...state,
        thresholds: action.payload
      };
    case MONITORING_UPDATE_DATA:
      return {
        ...state,
        data: action.payload
      };
    default:
      return state;
  }
}

// Action Creators
export const fetchMonitoringData = () => async (dispatch: any) => {
  try {
    dispatch({ type: MONITORING_FETCH_REQUEST });
    
    const response = await fetch(`${API_CONFIG.BASE_URL}/monitoring`);
    const data = await response.json();
    
    if (data.success) {
      dispatch({
        type: MONITORING_FETCH_SUCCESS,
        payload: data.data || data
      });
    } else {
      dispatch({
        type: MONITORING_FETCH_FAILURE,
        payload: data.message || 'Monitoring verileri alınamadı'
      });
    }
  } catch (error) {
    dispatch({
      type: MONITORING_FETCH_FAILURE,
      payload: 'Monitoring verileri alınamadı'
    });
  }
};

export const setConnectionStatus = (isConnected: boolean): MonitoringSetConnectionStatusAction => ({
  type: MONITORING_SET_CONNECTION_STATUS,
  payload: isConnected
});

export const setAutoRefresh = (autoRefresh: boolean): MonitoringSetAutoRefreshAction => ({
  type: MONITORING_SET_AUTO_REFRESH,
  payload: autoRefresh
});

export const updateThresholds = (thresholds: MonitoringThresholds): MonitoringUpdateThresholdsAction => ({
  type: MONITORING_UPDATE_THRESHOLDS,
  payload: thresholds
});

export const updateMonitoringData = (data: MonitoringData): MonitoringUpdateDataAction => ({
  type: MONITORING_UPDATE_DATA,
  payload: data
});