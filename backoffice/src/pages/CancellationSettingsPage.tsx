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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip
} from '@mui/material';
import {
  Save as SaveIcon,
  MonetizationOn as MoneyIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { API_CONFIG } from '../config/api';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface CancellationFee {
  id: number;
  order_status: string;
  fee_percentage: number;
  is_active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

const CancellationSettingsPage: React.FC = () => {
  const { token, user } = useSelector((state: RootState) => state.auth);
  const [cancellationFees, setCancellationFees] = useState<CancellationFee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);

  const orderStatusLabels: { [key: string]: string } = {
    'pending': 'Beklemede',
    'inspecting': 'İnceleme Aşamasında',
    'driver_accepted_awaiting_customer': 'Sürücü Kabul Etti - Müşteri Onayı Bekleniyor',
    'confirmed': 'Onaylandı',
    'driver_going_to_pickup': 'Sürücü Yola Çıktı',
    'pickup_completed': 'Yük Alındı',
    'in_transit': 'Yolda',
    'delivered': 'Teslim Edildi',
    'payment_completed': 'Ödeme Tamamlandı'
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending':
        return '#ff9800'; // Orange
      case 'inspecting':
        return '#00bcd4'; // Cyan
      case 'driver_accepted_awaiting_customer':
        return '#2196f3'; // Blue
      case 'confirmed':
        return '#9c27b0'; // Purple
      case 'driver_going_to_pickup':
        return '#3f51b5'; // Indigo
      case 'pickup_completed':
        return '#ff5722'; // Deep Orange
      case 'in_transit':
        return '#795548'; // Brown
      case 'delivered':
        return '#607d8b'; // Blue Grey
      case 'payment_completed':
        return '#4caf50'; // Green
      default:
        return '#757575'; // Grey
    }
  };

  // Sayfa yüklendiğinde mevcut cezai şart ayarlarını getir
  useEffect(() => {
    const fetchCancellationFees = async () => {
      try {
        if (!token || !user) {
          setError('Oturum süresi dolmuş. Lütfen tekrar giriş yapın.');
          setInitialLoading(false);
          return;
        }

        const response = await axios.get(`${API_CONFIG.BASE_URL}/admin/cancellation-fees`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.data.success && response.data.data) {
          let fees = response.data.data;
          
          // inspecting statüsü yoksa ekle
          const hasInspecting = fees.some((fee: CancellationFee) => fee.order_status === 'inspecting');
          if (!hasInspecting) {
            fees.push({
              id: Date.now(), // Geçici ID
              order_status: 'inspecting',
              fee_percentage: 0,
              is_active: true,
              description: 'İnceleme aşamasındaki siparişler için cezai şart yok',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
          
          // payment_completed statüsünü UI'da gösterme (kullanıcı istemedi)
          fees = fees.filter((fee: CancellationFee) => fee.order_status !== 'payment_completed');
          
          setCancellationFees(fees);
        }
      } catch (err: any) {
        console.error('Cezai şart ayarları yüklenirken hata:', err);
        if (err.response?.status === 401) {
          setError('Oturum süresi dolmuş. Lütfen tekrar giriş yapın.');
        } else {
          setError('Cezai şart ayarları yüklenirken bir hata oluştu.');
        }
      } finally {
        setInitialLoading(false);
      }
    };

    fetchCancellationFees();
  }, [token, user]);

  const handleFeePercentageChange = (id: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setCancellationFees(prev => 
      prev.map(fee => 
        fee.id === id ? { ...fee, fee_percentage: numValue } : fee
      )
    );
  };

  const handleActiveToggle = (id: number, isActive: boolean) => {
    setCancellationFees(prev => 
      prev.map(fee => 
        fee.id === id ? { ...fee, is_active: isActive } : fee
      )
    );
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!token || !user) {
        setError('Oturum süresi dolmuş. Lütfen tekrar giriş yapın.');
        setErrorModalOpen(true);
        setLoading(false);
        return;
      }

      // payment_completed statüsünü backend'e gönderme (kullanıcı istemedi)
      const filteredFees = cancellationFees.filter(fee => fee.order_status !== 'payment_completed');
      
      const response = await axios.put(
        `${API_CONFIG.BASE_URL}/admin/cancellation-fees`,
        { cancellationFees: filteredFees },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        setSuccess('Cezai şart ayarları başarıyla güncellendi!');
        setSuccessModalOpen(true);
      } else {
        setError(response.data.error || 'Ayarlar güncellenirken bir hata oluştu.');
        setErrorModalOpen(true);
      }
    } catch (err: any) {
      console.error('Cezai şart ayarları güncellenirken hata:', err);
      if (err.response?.status === 401) {
        setError('Oturum süresi dolmuş. Lütfen tekrar giriş yapın.');
      } else {
        setError(err.response?.data?.error || 'Ayarlar güncellenirken bir hata oluştu.');
      }
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };



  if (initialLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Cezai şart ayarları yükleniyor...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <MoneyIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            Cezai Şart Ayarları
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary" mb={3}>
          Sipariş durumlarına göre iptal cezai şart yüzdelerini yönetin. Bu ayarlar, müşteriler siparişlerini iptal ettiğinde uygulanacak cezai tutarları belirler.
        </Typography>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box mb={3}>
            <Typography variant="h6" component="h2">
              Sipariş Durumlarına Göre Cezai Şart Yüzdeleri
            </Typography>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Sipariş Durumu</TableCell>
                  <TableCell>Cezai Şart Yüzdesi (%)</TableCell>
                  <TableCell>Aktif</TableCell>
                  <TableCell>Açıklama</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cancellationFees.map((fee) => (
                  <TableRow key={fee.id}>
                    <TableCell>
                      <Chip
                        label={orderStatusLabels[fee.order_status] || fee.order_status}
                        sx={{
                          backgroundColor: getStatusColor(fee.order_status),
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        value={fee.fee_percentage}
                        onChange={(e) => handleFeePercentageChange(fee.id, e.target.value)}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">%</InputAdornment>,
                        }}
                        size="small"
                        sx={{ width: 120 }}
                        inputProps={{ min: 0, max: 100, step: 0.1 }}
                      />
                    </TableCell>
                    <TableCell>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={fee.is_active}
                            onChange={(e) => handleActiveToggle(fee.id, e.target.checked)}
                            color="primary"
                          />
                        }
                        label={fee.is_active ? 'Aktif' : 'Pasif'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {fee.description || 'Açıklama yok'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Divider sx={{ my: 3 }} />

          <Box display="flex" justifyContent="flex-end" gap={2}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Success Modal */}
      <Dialog open={successModalOpen} onClose={() => setSuccessModalOpen(false)}>
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <CheckCircleIcon color="success" sx={{ mr: 1 }} />
            Başarılı
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography>{success}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuccessModalOpen(false)} color="primary">
            Tamam
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Modal */}
      <Dialog open={errorModalOpen} onClose={() => setErrorModalOpen(false)}>
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <ErrorIcon color="error" sx={{ mr: 1 }} />
            Hata
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography>{error}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setErrorModalOpen(false)} color="primary">
            Tamam
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CancellationSettingsPage;