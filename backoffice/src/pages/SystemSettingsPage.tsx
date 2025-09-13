import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Divider,
  InputAdornment,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid
} from '@mui/material';
import {
  Save as SaveIcon,
  Settings as SettingsIcon,
  LocationOn as LocationIcon,
  Group as GroupIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { API_CONFIG } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

interface SystemSetting {
  id: number;
  setting_key: string;
  setting_value: string;
  setting_type: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface SystemSettings {
  driverSearchRadiusKm: number;
  maxDriversPerRequest: number;
  driverLocationUpdateIntervalMinutes: number;
  customerLocationChangeThresholdMeters: number;
  driverCommissionRate: number;
}

const SystemSettingsPage: React.FC = () => {
  const { token, user } = useAuth();
  const [settings, setSettings] = useState<SystemSettings>({
    driverSearchRadiusKm: 5,
    maxDriversPerRequest: 20,
    driverLocationUpdateIntervalMinutes: 10,
    customerLocationChangeThresholdMeters: 100,
    driverCommissionRate: 15
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);

  // Sayfa yüklendiğinde mevcut ayarları getir
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        if (!token || !user) {
          setError('Oturum süresi dolmuş. Lütfen tekrar giriş yapın.');
          setInitialLoading(false);
          return;
        }

        const response = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/system-settings`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.data.success && response.data.settings) {
          const settingsData = response.data.settings;
          const settingsMap: { [key: string]: string } = {};
          
          settingsData.forEach((setting: SystemSetting) => {
            settingsMap[setting.setting_key] = setting.setting_value;
          });

          setSettings({
            driverSearchRadiusKm: parseFloat(settingsMap['driver_search_radius_km'] || '5'),
            maxDriversPerRequest: parseInt(settingsMap['max_drivers_per_request'] || '20'),
            driverLocationUpdateIntervalMinutes: parseFloat(settingsMap['driver_location_update_interval_minutes'] || '10'),
            customerLocationChangeThresholdMeters: parseFloat(settingsMap['customer_location_change_threshold_meters'] || '100'),
            driverCommissionRate: parseFloat(settingsMap['driver_commission_rate'] || '15')
          });
        }
      } catch (err: any) {
        console.error('Sistem ayarları yüklenirken hata:', err);
        if (err.response?.status === 401) {
          setError('Oturum süresi dolmuş. Lütfen tekrar giriş yapın.');
        } else {
          setError('Sistem ayarları yüklenirken bir hata oluştu.');
        }
      } finally {
        setInitialLoading(false);
      }
    };

    fetchSettings();
  }, [token, user]);

  const handleInputChange = (field: keyof SystemSettings, value: string) => {
    const numValue = parseFloat(value) || 0;
    setSettings(prev => ({
      ...prev,
      [field]: numValue
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');

    try {
      if (!token || !user) {
        setError('Oturum süresi dolmuş. Lütfen tekrar giriş yapın.');
        setErrorModalOpen(true);
        setLoading(false);
        return;
      }

      const settingsToUpdate = [
        {
          setting_key: 'driver_search_radius_km',
          setting_value: settings.driverSearchRadiusKm.toString(),
          setting_type: 'number'
        },
        {
          setting_key: 'max_drivers_per_request',
          setting_value: settings.maxDriversPerRequest.toString(),
          setting_type: 'number'
        },
        {
          setting_key: 'driver_location_update_interval_minutes',
          setting_value: settings.driverLocationUpdateIntervalMinutes.toString(),
          setting_type: 'number'
        },
        {
          setting_key: 'customer_location_change_threshold_meters',
          setting_value: settings.customerLocationChangeThresholdMeters.toString(),
          setting_type: 'number'
        },
        {
          setting_key: 'driver_commission_rate',
          setting_value: settings.driverCommissionRate.toString(),
          setting_type: 'number'
        }
      ];

      const response = await axios.put(`${API_CONFIG.BASE_URL}/api/admin/system-settings`, {
        settings: settingsToUpdate
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        setSuccessModalOpen(true);
      } else {
        setError(response.data.error || 'Sistem ayarları kaydedilirken bir hata oluştu.');
        setErrorModalOpen(true);
      }
    } catch (err: any) {
      console.error('API hatası:', err);
      if (err.response?.status === 401) {
        setError('Oturum süresi dolmuş. Lütfen tekrar giriş yapın.');
      } else {
        setError(err.response?.data?.error || 'Sistem ayarları kaydedilirken bir hata oluştu.');
      }
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography>Sistem ayarları yükleniyor...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SettingsIcon />
        Sistem Ayarları
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Uygulama genelindeki sistem parametrelerini buradan yönetebilirsiniz.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Mevcut Ayarlar Özeti */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Mevcut Ayarlar Özeti
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr 1fr' }, gap: 2 }}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {settings.driverSearchRadiusKm}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                km arama yarıçapı
              </Typography>
            </Paper>
            
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {settings.maxDriversPerRequest}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                maksimum sürücü
              </Typography>
            </Paper>
            
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {settings.driverLocationUpdateIntervalMinutes}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                dakika güncelleme
              </Typography>
            </Paper>
            
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {settings.customerLocationChangeThresholdMeters}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                metre eşik değeri
              </Typography>
            </Paper>
            
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {settings.driverCommissionRate}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                komisyon oranı
              </Typography>
            </Paper>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
        {/* Sürücü Arama Ayarları */}
        <Box sx={{ flex: 1 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocationIcon color="primary" />
                Sürücü Arama Ayarları
              </Typography>
              
              <Box sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  label="Sürücü Arama Yarıçapı"
                  type="number"
                  value={settings.driverSearchRadiusKm}
                  onChange={(e) => handleInputChange('driverSearchRadiusKm', e.target.value)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">km</InputAdornment>,
                  }}
                  helperText="Müşteriye en yakın sürücüleri bulmak için kullanılan arama yarıçapı"
                  sx={{ mb: 2 }}
                />
                
                <TextField
                  fullWidth
                  label="Maksimum Sürücü Sayısı"
                  type="number"
                  value={settings.maxDriversPerRequest}
                  onChange={(e) => handleInputChange('maxDriversPerRequest', e.target.value)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">sürücü</InputAdornment>,
                  }}
                  helperText="Bir sipariş için gösterilecek maksimum sürücü sayısı"
                  sx={{ mb: 2 }}
                />
                
                <TextField
                  fullWidth
                  label="Sürücü Komisyon Oranı"
                  type="number"
                  value={settings.driverCommissionRate}
                  onChange={(e) => handleInputChange('driverCommissionRate', e.target.value)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                  helperText="Sürücülerden alınacak komisyon oranı (yüzde)"
                />
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Konum Güncelleme Ayarları */}
        <Box sx={{ flex: 1 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <RefreshIcon color="primary" />
                Konum Güncelleme Ayarları
              </Typography>
              
              <Box sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  label="Sürücü Konum Güncelleme Aralığı"
                  type="number"
                  value={settings.driverLocationUpdateIntervalMinutes}
                  onChange={(e) => handleInputChange('driverLocationUpdateIntervalMinutes', e.target.value)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">dakika</InputAdornment>,
                  }}
                  helperText="Sürücü konumlarının ne sıklıkla güncelleneceği"
                  sx={{ mb: 2 }}
                />
                
                <TextField
                  fullWidth
                  label="Müşteri Konum Değişim Eşiği"
                  type="number"
                  value={settings.customerLocationChangeThresholdMeters}
                  onChange={(e) => handleInputChange('customerLocationChangeThresholdMeters', e.target.value)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">metre</InputAdornment>,
                  }}
                  helperText="Müşteri konumu bu mesafeden fazla değişirse sürücü listesi güncellenir"
                />
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>



      {/* Kaydet Butonu */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={loading}
          sx={{ minWidth: 150 }}
        >
          {loading ? 'Kaydediliyor...' : 'Kaydet'}
        </Button>
      </Box>

      {/* Başarı Modal */}
      <Dialog open={successModalOpen} onClose={() => setSuccessModalOpen(false)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon color="success" />
          Başarılı
        </DialogTitle>
        <DialogContent>
          <Typography>
            Sistem ayarları başarıyla güncellendi.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuccessModalOpen(false)} variant="contained">
            Tamam
          </Button>
        </DialogActions>
      </Dialog>

      {/* Hata Modal */}
      <Dialog open={errorModalOpen} onClose={() => setErrorModalOpen(false)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ErrorIcon color="error" />
          Hata
        </DialogTitle>
        <DialogContent>
          <Typography>
            {error}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setErrorModalOpen(false)} variant="contained">
            Tamam
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SystemSettingsPage;