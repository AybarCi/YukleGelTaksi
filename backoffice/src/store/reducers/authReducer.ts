import { AuthState, User, LoginResponse, VerifyResponse, Action } from '../types';
import AuthService from '../../services/authService';

const authService = new AuthService();

// Action Types
export const AUTH_LOGIN_REQUEST = 'AUTH_LOGIN_REQUEST';
export const AUTH_LOGIN_SUCCESS = 'AUTH_LOGIN_SUCCESS';
export const AUTH_LOGIN_FAILURE = 'AUTH_LOGIN_FAILURE';
export const AUTH_LOGOUT = 'AUTH_LOGOUT';
export const AUTH_VERIFY_REQUEST = 'AUTH_VERIFY_REQUEST';
export const AUTH_VERIFY_SUCCESS = 'AUTH_VERIFY_SUCCESS';
export const AUTH_VERIFY_FAILURE = 'AUTH_VERIFY_FAILURE';
export const AUTH_CLEAR_ERROR = 'AUTH_CLEAR_ERROR';

// Initial State
const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,
};

// Reducer
export const authReducer = (state = initialState, action: Action): AuthState => {
  switch (action.type) {
    case AUTH_LOGIN_REQUEST:
      return {
        ...state,
        isLoading: true,
      };
    case AUTH_LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload?.user,
        token: action.payload?.token,
        isLoading: false,
        isAuthenticated: true,
      };
    case AUTH_LOGIN_FAILURE:
      return {
        ...state,
        isLoading: false,
        user: null,
        token: null,
        isAuthenticated: false,
      };
    case AUTH_LOGOUT:
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      };
    case AUTH_VERIFY_REQUEST:
      return {
        ...state,
        isLoading: true,
      };
    case AUTH_VERIFY_SUCCESS:
      return {
        ...state,
        user: action.payload?.user,
        isLoading: false,
        isAuthenticated: true,
      };
    case AUTH_VERIFY_FAILURE:
      return {
        ...state,
        isLoading: false,
        user: null,
        token: null,
        isAuthenticated: false,
      };
    case AUTH_CLEAR_ERROR:
      return {
        ...state,
      };
    default:
      return state;
  }
};

// Action Creators
export const loginRequest = () => ({
  type: AUTH_LOGIN_REQUEST,
});

export const loginSuccess = (user: User, token: string) => ({
  type: AUTH_LOGIN_SUCCESS,
  payload: { user, token },
});

export const loginFailure = () => ({
  type: AUTH_LOGIN_FAILURE,
});

export const logoutAction = () => ({
  type: AUTH_LOGOUT,
});

export const verifyRequest = () => ({
  type: AUTH_VERIFY_REQUEST,
});

export const verifySuccess = (user: User) => ({
  type: AUTH_VERIFY_SUCCESS,
  payload: { user },
});

export const verifyFailure = () => ({
  type: AUTH_VERIFY_FAILURE,
});

export const clearError = () => ({
  type: AUTH_CLEAR_ERROR,
});

// Thunk Actions
export const login = (username: string, password: string) => {
  return async (dispatch: any) => {
    dispatch(loginRequest());
    try {
      const response: LoginResponse = await authService.login({ username, password });
      if (response.success) {
        dispatch(loginSuccess(response.supervisor, response.token));
        return { success: true };
      } else {
        dispatch(loginFailure());
        return { success: false, error: 'Giriş başarısız' };
      }
    } catch (error: any) {
      dispatch(loginFailure());
      return { success: false, error: error.message || 'Giriş yapılırken hata oluştu' };
    }
  };
};

export const logout = () => {
  return async (dispatch: any) => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch(logoutAction());
    }
  };
};

export const verifyToken = () => {
  return async (dispatch: any) => {
    dispatch(verifyRequest());
    try {
      const response: VerifyResponse = await authService.verifyToken();
      if (response.valid && response.supervisor) {
        dispatch(verifySuccess(response.supervisor));
        return { valid: true };
      } else {
        dispatch(verifyFailure());
        return { valid: false, error: response.error };
      }
    } catch (error) {
      dispatch(verifyFailure());
      return { valid: false, error: 'Token doğrulama hatası' };
    }
  };
};

export const initializeAuth = () => {
  return async (dispatch: any) => {
    const token = authService.getToken();
    const user = authService.getSupervisor();
    
    if (token && user) {
      // Check local token expiry first
      if (authService.isAuthenticated()) {
        // Token is valid locally, set user data without verification
        dispatch(loginSuccess(user, token));
        
        // Then verify token in background
        const result = await dispatch(verifyToken());
        if (!result.valid) {
          dispatch(logoutAction());
        }
      } else {
        // Token expired locally
        dispatch(logoutAction());
      }
    }
  };
};

// Default export for use in combineReducers
export default authReducer;