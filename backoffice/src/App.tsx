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
        background: 'linear-gradient(-45deg, #FFD700, #FFA500, #FF8C00, #FF6B35)',
        backgroundSize: '400% 400%',
        animation: 'gradientShift 3s ease infinite',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Arka plan animasyonları */}
        <div style={{
          position: 'absolute',
          width: '200%',
          height: '200%',
          top: '-50%',
          left: '-50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
          animation: 'backgroundMove 20s linear infinite',
          opacity: 0.3
        }}></div>
        
        <div style={{ textAlign: 'center', zIndex: 10 }}>
          {/* Ana logo konteyneri */}
          <div style={{
            width: 100,
            height: 100,
            border: '2px solid rgba(255,255,255,0.8)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 30px',
            background: 'rgba(255, 255, 255, 0.95)',
            boxShadow: '0 15px 40px rgba(0, 0, 0, 0.3), inset 0 0 15px rgba(255, 215, 0, 0.2)',
            animation: 'logoFloat 3s ease-in-out infinite',
            position: 'relative'
          }}>
            {/* Dış halka animasyonu */}
            <div style={{
              position: 'absolute',
              width: '120px',
              height: '120px',
              border: '1px solid rgba(255, 255, 255, 0.6)',
              borderRadius: '50%',
              animation: 'ringPulse 2s ease-in-out infinite',
              top: '-10px',
              left: '-10px'
            }}></div>
            
            <img 
              src="/logo2.jpeg" 
              alt="Yükle Gel Taksi Logo" 
              style={{
                width: '75%',
                height: '75%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.2))'
              }}
            />
          </div>
          
          {/* Profesyonel loading animasyonu */}
          <div style={{ 
            position: 'relative',
            width: '80px', 
            height: '80px', 
            margin: '0 auto 30px'
          }}>
            {/* Dış halka */}
            <div style={{ 
              position: 'absolute',
              width: '100%', 
              height: '100%', 
              border: '4px solid rgba(255,255,255,0.3)', 
              borderTop: '4px solid #fff', 
              borderRadius: '50%', 
              animation: 'spin 1.2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite',
            }}></div>
            
            {/* İç halka */}
            <div style={{ 
              position: 'absolute',
              width: '60%', 
              height: '60%', 
              top: '20%',
              left: '20%',
              border: '3px solid transparent', 
              borderTop: '3px solid rgba(255,255,255,0.8)', 
              borderRadius: '50%', 
              animation: 'spinReverse 1.5s ease-in-out infinite'
            }}></div>
            
            {/* Merkez nokta */}
            <div style={{
              position: 'absolute',
              width: '8px',
              height: '8px',
              background: '#fff',
              borderRadius: '50%',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              animation: 'dotPulse 1.5s ease-in-out infinite'
            }}></div>
          </div>
          
          {/* Başlık ve açıklama */}
          <div style={{ animation: 'fadeInUp 0.8s ease-out' }}>
            <h2 style={{ 
              fontSize: '32px', 
              fontWeight: '700',
              marginBottom: '15px',
              color: '#fff',
              textShadow: '0 2px 10px rgba(0,0,0,0.3)',
              letterSpacing: '1px'
            }}>
              {isTransitioning ? 'Giriş Başarılı!' : 'Yükleniyor...'}
            </h2>
            
            <p style={{ 
              color: 'rgba(255, 255, 255, 0.9)', 
              fontSize: '18px',
              margin: '0 0 30px 0',
              fontWeight: '300'
            }}>
              {isTransitioning ? 'Yönetim panelinize yönlendiriliyorsunuz...' : 'Lütfen bekleyin...'}
            </p>
          </div>
          
          {/* Progress bar */}
          <div style={{
            width: '250px',
            height: '4px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '2px',
            margin: '0 auto',
            overflow: 'hidden'
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, #fff, #FFD700)',
              borderRadius: '2px',
              animation: 'progressFill 2s ease-in-out infinite'
            }}></div>
          </div>
        </div>
        
        {/* CSS Animasyonları */}
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes spinReverse {
              0% { transform: rotate(360deg); }
              100% { transform: rotate(0deg); }
            }
            @keyframes gradientShift {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            @keyframes logoFloat {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-10px); }
            }
            @keyframes ringPulse {
              0% { transform: scale(1); opacity: 1; }
              100% { transform: scale(1.2); opacity: 0; }
            }
            
            @keyframes ringPulse2 {
            0% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.15); opacity: 0.4; }
            100% { transform: scale(1); opacity: 0.8; }
          }
          
          @keyframes ringPulse3 {
            0% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.2); opacity: 0.2; }
            100% { transform: scale(1); opacity: 0.6; }
          }
            @keyframes dotPulse {
              0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
              50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.2); }
            }
            @keyframes fadeInUp {
              0% { opacity: 0; transform: translateY(30px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes progressFill {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
            @keyframes backgroundMove {
              0% { transform: translate(0, 0); }
              100% { transform: translate(50px, 50px); }
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
