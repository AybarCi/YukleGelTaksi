import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import authReducer from './slices/authSlice';
import apiReducer from './slices/apiSlice';
import uiReducer from './slices/uiSlice';
import { socketMiddleware } from './middleware/socketMiddleware';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    api: apiReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['ui/showModal', 'ui/showRideRequest'],
        ignoredPaths: ['ui.modal.buttons', 'ui.rideRequest.data'],
      },
    }).concat(socketMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Selectors
export const selectAuth = (state: RootState) => state.auth;
export const selectApi = (state: RootState) => state.api;
export const selectUi = (state: RootState) => state.ui;

// Auth selectors
export const selectUser = (state: RootState) => state.auth.user;
export const selectToken = (state: RootState) => state.auth.token;
export const selectIsAuthenticated = (state: RootState) => !!state.auth.token && !!state.auth.user;
export const selectAuthLoading = (state: RootState) => state.auth.isLoading;
export const selectAuthError = (state: RootState) => state.auth.error;
export const selectDriverStatus = (state: RootState) => state.auth.driverStatus;

// API selectors
export const selectApiLoading = (key: string) => (state: RootState) => state.api.loading[key] || false;
export const selectApiError = (key: string) => (state: RootState) => state.api.errors[key];
export const selectApiCache = (key: string) => (state: RootState) => state.api.cache[key];
export const selectDriverRides = (state: RootState) => state.api.cache['driverRides'];
export const selectDriverEarnings = (state: RootState) => state.api.cache['driverEarnings'];

// UI selectors
export const selectModal = (state: RootState) => state.ui.modal;
export const selectTheme = (state: RootState) => state.ui.theme;
export const selectNetworkStatus = (state: RootState) => state.ui.isNetworkConnected;
export const selectGlobalLoading = (state: RootState) => state.ui.loading.global;
export const selectOverlayLoading = (state: RootState) => state.ui.loading.overlay;
export const selectRideRequest = (state: RootState) => state.ui.rideRequest;
export const selectMapSettings = (state: RootState) => state.ui.mapSettings;

export default store;