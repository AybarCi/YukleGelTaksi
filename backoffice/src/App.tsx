import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/UsersPage';
import DriversPage from './pages/DriversPage';
import OrdersPage from './pages/OrdersPage';
import PricingPage from './pages/PricingPage';
import SystemSettingsPage from './pages/SystemSettingsPage';
import CancellationSettingsPage from './pages/CancellationSettingsPage';
import SupportTicketsPage from './pages/SupportTicketsPage';
import VehicleTypesPage from './pages/VehicleTypesPage';
import CargoTypesPage from './pages/CargoTypesPage';
import MonitoringPage from './pages/MonitoringPage';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

const theme = createTheme({
  palette: {
    primary: {
      main: '#FFD700', // Sarı (kurumsal renk)
      dark: '#FFC107',
      light: '#FFEB3B',
      contrastText: '#000000', // Siyah metin
    },
    secondary: {
      main: '#000000', // Siyah (kurumsal renk)
      dark: '#212121',
      light: '#424242',
      contrastText: '#FFFFFF', // Beyaz metin
    },
    background: {
      default: '#FAFAFA', // Açık gri-beyaz
      paper: '#FFFFFF', // Beyaz (kurumsal renk)
    },
    text: {
      primary: '#000000', // Siyah metin
      secondary: '#424242', // Koyu gri
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute>
                <Layout>
                  <UsersPage />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/drivers" element={
              <ProtectedRoute>
                <Layout>
                  <DriversPage />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/vehicle-types" element={
              <ProtectedRoute>
                <Layout>
                  <VehicleTypesPage />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/cargo-types" element={
              <ProtectedRoute>
                <Layout>
                  <CargoTypesPage />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/orders" element={
              <ProtectedRoute>
                <Layout>
                  <OrdersPage />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/pricing" element={
              <ProtectedRoute>
                <Layout>
                  <PricingPage />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/system-settings" element={
              <ProtectedRoute>
                <Layout>
                  <SystemSettingsPage />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/cancellation-settings" element={
              <ProtectedRoute>
                <Layout>
                  <CancellationSettingsPage />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/support-tickets" element={
              <ProtectedRoute>
                <Layout>
                  <SupportTicketsPage />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/monitoring" element={
              <ProtectedRoute>
                <Layout>
                  <MonitoringPage />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
