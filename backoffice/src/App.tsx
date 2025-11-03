import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from './store';
import { initializeAuth } from './store/reducers/authReducer';
import AuthService from './services/authService';
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

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useSelector((state: RootState) => state.auth);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    // Initialize auth on app start
    dispatch(initializeAuth());
  }, [dispatch]);

  useEffect(() => {
    // Sayfa geçişlerinde loading ekranı göster
    if (isAuthenticated && !isLoading) {
      setIsTransitioning(true);
      // 2 saniye sonra geçişi tamamla
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    // Setup axios interceptors for automatic token handling
    const authService = new AuthService();
    authService.setupAxiosInterceptors(() => {
      // Handle unauthorized access - only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        navigate('/login');
      }
    });
  }, [navigate]);

  if (isLoading || isTransitioning) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #FFD700 0%, #FFC107 50%, #FF8F00 100%)',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 100,
            height: 100,
            border: '4px solid #000',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 30px',
            background: 'rgba(255, 255, 255, 0.9)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}>
            <img 
              src="/logo2.jpeg" 
              alt="Yükle Gel Taksi Logo" 
              style={{
                width: '85%',
                height: '85%',
                objectFit: 'contain',
              }}
            />
          </div>
          <div style={{ 
            width: 50, 
            height: 50, 
            border: '3px solid #000', 
            borderTop: '3px solid transparent', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold',
            marginBottom: '10px',
            color: '#000'
          }}>
            {isTransitioning ? 'Giriş Başarılı!' : 'Yükleniyor...'}
          </h2>
          <p style={{ 
            color: 'rgba(0, 0, 0, 0.8)', 
            fontSize: '16px',
            margin: 0
          }}>
            {isTransitioning ? 'Yönetim panelinize yönlendiriliyorsunuz...' : 'Lütfen bekleyin...'}
          </p>
        </div>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes pulse {
              0% { transform: scale(1); }
              50% { transform: scale(1.05); }
              100% { transform: scale(1); }
            }
          `}
        </style>
      </div>
    );
  }

  return (
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
  );
};

export default App;
