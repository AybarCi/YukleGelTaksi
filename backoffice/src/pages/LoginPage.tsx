import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
  Paper,
  Avatar,
  InputAdornment,
  IconButton
} from '@mui/material';
import { keyframes } from '@mui/system';
import {
  Person as PersonIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  LocalShipping as TruckIcon
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState, AppDispatch } from '../store';
import { login } from '../store/reducers/authReducer';

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const pulse = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
`;

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoginSuccess, setIsLoginSuccess] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  const { user, isLoading: authLoading } = useSelector((state: RootState) => state.auth);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    setIsLoading(authLoading);
  }, [authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const result = await dispatch(login(username, password));
      if (result && result.success) {
        setIsLoginSuccess(true);
        // Kısa bekleme süresi ekle, App.tsx'deki geçiş ekranı için
        setTimeout(() => {
          navigate('/');
        }, 500);
      } else {
        setError('Kullanıcı adı veya şifre hatalı');
      }
    } catch (err) {
      setError('Kullanıcı adı veya şifre hatalı');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `
          linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.7)),
          url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%23FFD700;stop-opacity:1" /><stop offset="50%" style="stop-color:%23FFC107;stop-opacity:1" /><stop offset="100%" style="stop-color:%23FF8F00;stop-opacity:1" /></linearGradient><linearGradient id="suitcase" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%23D4AF37;stop-opacity:0.8" /><stop offset="100%" style="stop-color:%23B8860B;stop-opacity:0.8" /></linearGradient></defs><rect width="100%" height="100%" fill="url(%23bg)"/><g opacity="0.15"><rect x="150" y="120" width="80" height="60" rx="8" fill="url(%23suitcase)" transform="rotate(-15 190 150)"/><rect x="140" y="110" width="100" height="80" rx="10" fill="url(%23suitcase)" transform="rotate(-15 190 150)"/><circle cx="165" cy="135" r="3" fill="%238B4513"/><rect x="175" y="130" width="20" height="4" rx="2" fill="%238B4513"/><rect x="900" y="180" width="100" height="70" rx="12" fill="url(%23suitcase)" transform="rotate(20 950 215)"/><rect x="890" y="170" width="120" height="90" rx="15" fill="url(%23suitcase)" transform="rotate(20 950 215)"/><circle cx="920" cy="200" r="4" fill="%23654321"/><rect x="940" y="195" width="25" height="5" rx="2" fill="%23654321"/><path d="M300 500 Q320 480 340 500 Q360 520 380 500 Q400 480 420 500" stroke="url(%23suitcase)" stroke-width="8" fill="none" opacity="0.6"/><rect x="310" y="490" width="15" height="20" rx="3" fill="url(%23suitcase)"/><rect x="350" y="485" width="20" height="25" rx="4" fill="url(%23suitcase)"/><rect x="390" y="492" width="18" height="22" rx="3" fill="url(%23suitcase)"/><rect x="1000" y="550" width="90" height="65" rx="10" fill="url(%23suitcase)" transform="rotate(-10 1045 582)"/><circle cx="1020" cy="570" r="3" fill="%238B4513"/><rect x="1035" y="565" width="20" height="4" rx="2" fill="%238B4513"/><path d="M600 300 L650 280 L700 300 L680 320 L620 320 Z" fill="url(%23suitcase)" opacity="0.7"/><circle cx="640" cy="300" r="5" fill="%23654321"/><rect x="660" y="295" width="15" height="3" rx="1" fill="%23654321"/></g><g opacity="0.08"><circle cx="200" cy="150" r="80" fill="white"/><circle cx="800" cy="200" r="120" fill="white"/><circle cx="1000" cy="600" r="100" fill="white"/><circle cx="300" cy="700" r="60" fill="white"/></g></svg>')
        `,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        padding: 2
      }}
    >
      <Container component="main" maxWidth="sm">
        <Paper
          elevation={24}
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}
        >
          <Box
            sx={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FFC107 100%)',
              py: 4,
              textAlign: 'center',
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                opacity: 0.3
              }
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                mb: 2
              }}
            >
              <Box
                sx={{
                  width: 200,
                  height: 200,
                  borderRadius: 3,
                  border: '4px solid #000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 3,
                  background: 'rgba(255, 255, 255, 0.9)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                  overflow: 'hidden'
                }}
              >
                <Box
                  component="img"
                  src="/logo2.jpeg"
                  alt="Yükle Gel Taksi Logo"
                  sx={{
                    width: '90%',
                    height: '90%',
                    objectFit: 'contain',
                  }}
                />
              </Box>
              <Typography
                variant="h4"
                sx={{
                  background: 'linear-gradient(135deg, #000 0%, #333 50%, #000 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 800,
                  letterSpacing: '2px',
                  textTransform: 'capitalize',
                  position: 'relative',
                  zIndex: 1,
                  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)',
                  fontFamily: '"Roboto", "Arial", sans-serif',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 193, 7, 0.2) 100%)',
                    borderRadius: 2,
                    zIndex: -1,
                    transform: 'skew(-5deg)',
                    padding: '8px 16px',
                    margin: '-8px -16px'
                  }
                }}
              >
                Yönetim Paneli
              </Typography>
            </Box>
          </Box>
          
          <CardContent sx={{ p: 4, position: 'relative' }}>

            {/* Login Success Loading Overlay */}
            {isLoginSuccess && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.95) 0%, rgba(255, 193, 7, 0.95) 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 9999,
                  borderRadius: 4,
                  animation: `${fadeIn} 0.3s ease-in-out`
                }}
              >
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    border: '4px solid #000',
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 3,
                    background: 'rgba(255, 255, 255, 0.9)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                    animation: `${pulse} 1.5s ease-in-out infinite`
                  }}
                >
                  <Box
                    component="img"
                    src="/logo2.jpeg"
                    alt="Yükle Gel Taksi Logo"
                    sx={{
                      width: '85%',
                      height: '85%',
                      objectFit: 'contain',
                    }}
                  />
                </Box>
                <CircularProgress 
                  size={40} 
                  sx={{ 
                    color: '#000',
                    mb: 2,
                    '& .MuiCircularProgress-circle': {
                      strokeWidth: 3
                    }
                  }} 
                />
                <Typography
                  variant="h6"
                  sx={{
                    color: '#000',
                    fontWeight: 700,
                    mb: 1,
                    textAlign: 'center'
                  }}
                >
                  Giriş Başarılı!
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(0, 0, 0, 0.8)',
                    textAlign: 'center'
                  }}
                >
                  Yönetim panelinize yönlendiriliyorsunuz...
                </Typography>
              </Box>
            )}

            {error && (
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 3,
                  borderRadius: 2,
                  '& .MuiAlert-icon': {
                    fontSize: '1.5rem'
                  }
                }}
              >
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="Kullanıcı Adı"
                name="username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon sx={{ color: 'rgba(0, 0, 0, 0.54)' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ 
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover fieldset': {
                      borderColor: '#FFD700',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#FFC107',
                    },
                  },
                }}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Şifre"
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: 'rgba(0, 0, 0, 0.54)' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        disabled={isLoading}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ 
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover fieldset': {
                      borderColor: '#FFD700',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#FFC107',
                    },
                  },
                }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{
                  mt: 1,
                  mb: 2,
                  py: 1.8,
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFC107 100%)',
                  color: '#000',
                  textTransform: 'none',
                  boxShadow: '0 4px 15px rgba(255, 193, 7, 0.4)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #FFC107 0%, #FF8F00 100%)',
                    boxShadow: '0 6px 20px rgba(255, 193, 7, 0.6)',
                    transform: 'translateY(-2px)',
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                  },
                  '&:disabled': {
                    background: 'rgba(0, 0, 0, 0.12)',
                    color: 'rgba(0, 0, 0, 0.26)',
                    boxShadow: 'none',
                    transform: 'none',
                  }
                }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} sx={{ color: 'rgba(0, 0, 0, 0.6)' }} />
                    <span>Giriş yapılıyor...</span>
                  </Box>
                ) : (
                  'Giriş Yap'
                )}
              </Button>
            </Box>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Paper
                sx={{
                  p: 2,
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 193, 7, 0.1) 100%)',
                  border: '1px solid rgba(255, 193, 7, 0.2)',
                  borderRadius: 2
                }}
              >
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'rgba(0, 0, 0, 0.7)',
                    fontWeight: 500,
                    mb: 0.5
                  }}
                >
                  Demo Hesabı
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'rgba(0, 0, 0, 0.6)',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem'
                  }}
                >
                  Kullanıcı: <strong>admin</strong> • Şifre: <strong>admin123</strong>
                </Typography>
              </Paper>
            </Box>
          </CardContent>
        </Paper>
      </Container>
    </Box>
  );
};

export default LoginPage;