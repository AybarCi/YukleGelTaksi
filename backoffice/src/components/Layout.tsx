import React, { useState } from 'react';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  DirectionsCar as DriversIcon,
  DirectionsCar,
  LocalShipping as LocalShippingIcon,
  Settings as SettingsIcon,
  Support as SupportIcon,
  Assignment as AssignmentIcon,
  MonetizationOn as MonetizationOnIcon,
  AccountCircle,
  Logout,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const drawerWidth = 240;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, redirect to login
      navigate('/login');
    } finally {
      handleProfileMenuClose();
    }
  };

  const menuItems = [
    {
      text: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/'
    },
    {
      text: 'Kullanıcılar',
      icon: <PeopleIcon />,
      path: '/users'
    },
    {
      text: 'Sürücüler',
      icon: <DriversIcon />,
      path: '/drivers'
    },
    {
      text: 'Araç Tipleri',
      icon: <DirectionsCar />,
      path: '/vehicle-types'
    },
    {
      text: 'Siparişler',
      icon: <AssignmentIcon />,
      path: '/orders'
    },
    {
      text: 'Destek Talepleri',
      icon: <SupportIcon />,
      path: '/support-tickets'
    },
    {
      text: 'Taşıma Hesaplama',
      icon: <LocalShippingIcon />,
      path: '/pricing'
    },
    {
      text: 'Cezai Şart Ayarları',
      icon: <MonetizationOnIcon />,
      path: '/cancellation-settings'
    },
    {
      text: 'Sistem Ayarları',
      icon: <SettingsIcon />,
      path: '/system-settings'
    }
  ];

  const drawer = (
    <div className="animate-fade-in">
      <Toolbar sx={{ 
        background: 'linear-gradient(135deg, #FFD700 0%, #FFC107 100%)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%)',
          animation: 'shimmer 3s infinite',
        }
      }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <Typography 
            variant="h6" 
            noWrap 
            component="div" 
            sx={{ 
              color: '#000000', 
              fontWeight: 800,
              fontSize: '1.5rem',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              position: 'relative',
              zIndex: 1
            }}
          >
            Yükle Gel Taksi
          </Typography>
          <Typography 
            variant="caption" 
            sx={{ 
              color: '#666666', 
              fontSize: '0.75rem',
              fontWeight: 500,
              mt: -0.5
            }}
          >
            Yönetim Paneli
          </Typography>
        </Box>
      </Toolbar>
      <Box sx={{ 
        background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%)',
        height: '100%'
      }}>
        <List sx={{ pt: 2 }}>
          {menuItems.map((item, index) => (
            <ListItem 
              key={item.text} 
              disablePadding 
              sx={{ 
                mb: 1,
                px: 2,
                animation: `slideInLeft 0.6s ease-out ${index * 0.1}s both`
              }}
            >
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: 2,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  '&.Mui-selected': {
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFC107 100%)',
                    color: '#000000',
                    boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)',
                    transform: 'translateX(4px)',
                    '& .MuiListItemIcon-root': {
                      color: '#000000',
                      transform: 'scale(1.1)',
                    },
                    '& .MuiListItemText-primary': {
                      color: '#000000',
                      fontWeight: 700,
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.2) 50%, transparent 70%)',
                      animation: 'shimmer 2s infinite',
                    }
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(255, 215, 0, 0.1)',
                    transform: 'translateX(2px)',
                    '& .MuiListItemIcon-root': {
                      transform: 'scale(1.05)',
                      color: '#FFD700',
                    },
                  },
                  '&:active': {
                    transform: 'translateX(1px) scale(0.98)',
                  }
                }}
              >
                <ListItemIcon sx={{ 
                  color: location.pathname === item.path ? '#000000' : '#666666',
                  transition: 'all 0.3s ease',
                  minWidth: 40
                }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  sx={{
                    '& .MuiListItemText-primary': {
                      fontSize: '0.95rem',
                      fontWeight: location.pathname === item.path ? 700 : 500,
                      transition: 'all 0.3s ease',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          background: 'linear-gradient(135deg, #FFFFFF 0%, #FAFAFA 100%)',
          color: '#000000',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
          backdropFilter: 'blur(10px)',
          zIndex: 1201,
        }}
      >
        <Toolbar sx={{ 
          minHeight: '70px !important',
          px: 3,
          position: 'relative'
        }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ 
              mr: 2, 
              display: { sm: 'none' },
              borderRadius: 2,
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: 'rgba(255, 215, 0, 0.1)',
                transform: 'scale(1.05)'
              }
            }}
          >
            <MenuIcon />
          </IconButton>
          
          <Box sx={{ 
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}>
            <Typography 
              variant="h5" 
              noWrap 
              component="div" 
              className="gradient-text"
              sx={{ 
                fontWeight: 700,
                fontSize: '1.5rem',
                background: 'linear-gradient(135deg, #FFD700, #FFC107)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              Yönetim Paneli
            </Typography>
          </Box>
          
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            background: 'rgba(255, 215, 0, 0.1)',
            borderRadius: 3,
            px: 2,
            py: 1,
            transition: 'all 0.3s ease',
            '&:hover': {
              background: 'rgba(255, 215, 0, 0.15)',
              transform: 'translateY(-1px)'
            }
          }}>
            <Typography 
              variant="body2" 
              sx={{ 
                display: { xs: 'none', sm: 'block' },
                fontWeight: 600,
                color: '#000000'
              }}
            >
              {user?.first_name} {user?.last_name}
            </Typography>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="profile-menu"
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              sx={{
                p: 0,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.1) rotate(5deg)'
                }
              }}
            >
              <Avatar sx={{ 
                width: 40, 
                height: 40, 
                background: 'linear-gradient(135deg, #FFD700, #FFC107)',
                color: '#000000',
                fontWeight: 700,
                fontSize: '1.1rem',
                boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)',
                border: '2px solid #FFFFFF'
              }}>
                {user?.first_name?.charAt(0)}
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      
      <Menu
        id="profile-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        onClick={handleProfileMenuClose}
      >
        <MenuItem onClick={handleProfileMenuClose}>
          <ListItemIcon>
            <AccountCircle fontSize="small" />
          </ListItemIcon>
          Profil
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          Çıkış Yap
        </MenuItem>
      </Menu>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default Layout;