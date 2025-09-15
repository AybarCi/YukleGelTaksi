import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import authReducer from './slices/authSlice';
import apiReducer from './slices/apiSlice';
import uiReducer from './slices/uiSlice';
import orderReducer from './slices/orderSlice';
import vehicleReducer from './slices/vehicleSlice';
import driverReducer from './slices/driverSlice';
import routeReducer from './slices/routeSlice';
import { socketMiddleware } from './middleware/socketMiddleware';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    api: apiReducer,
    ui: uiReducer,
    order: orderReducer,
    vehicle: vehicleReducer,
    driver: driverReducer,
    route: routeReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['ui/showModal'],
        ignoredPaths: ['ui.modal.buttons'],
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

// API selectors
export const selectApiLoading = (key: string) => (state: RootState) => state.api.loading[key] || false;
export const selectApiError = (key: string) => (state: RootState) => state.api.errors[key];
export const selectApiCache = (key: string) => (state: RootState) => state.api.cache[key];

// UI selectors
export const selectModal = (state: RootState) => state.ui.modal;
export const selectTheme = (state: RootState) => state.ui.theme;
export const selectNetworkStatus = (state: RootState) => state.ui.isNetworkConnected;
export const selectGlobalLoading = (state: RootState) => state.ui.loading.global;
export const selectOverlayLoading = (state: RootState) => state.ui.loading.overlay;

// Order selectors
export const selectOrder = (state: RootState) => state.order;
export const selectCurrentOrder = (state: RootState) => state.order.currentOrder;
export const selectOrderLoading = (state: RootState) => state.order.loading;
export const selectOrderError = (state: RootState) => state.order.error;
export const selectCreateOrderLoading = (state: RootState) => state.order.createOrderLoading;
export const selectCheckOrderLoading = (state: RootState) => state.order.checkOrderLoading;
export const selectCancelOrderLoading = (state: RootState) => state.order.cancelOrderLoading;

export default store;