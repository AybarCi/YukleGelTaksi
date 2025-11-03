import { configureStore } from '@reduxjs/toolkit';
import { RootState } from './types';
import authReducer from './reducers/authReducer';
import dashboardReducer from './reducers/dashboardReducer';
import usersReducer from './reducers/usersReducer';
import driversReducer from './reducers/driversReducer';
import ordersReducer from './reducers/ordersReducer';
import monitoringReducer from './reducers/monitoringReducer';
import supportTicketsReducer from './reducers/supportTicketsReducer';

// Re-export RootState for use in components
export type { RootState } from './types';

// Create store with configureStore
export const store = configureStore({
  reducer: {
    auth: authReducer,
    dashboard: dashboardReducer,
    users: usersReducer,
    drivers: driversReducer,
    orders: ordersReducer,
    monitoring: monitoringReducer,
    supportTickets: supportTicketsReducer,
  },
});

// Infer the AppDispatch type from the store itself
export type AppDispatch = typeof store.dispatch;