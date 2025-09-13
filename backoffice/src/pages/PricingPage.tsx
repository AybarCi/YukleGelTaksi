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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Save as SaveIcon,
  LocalShipping as ShippingIcon,
  AttachMoney as MoneyIcon,
  DirectionsCar as VehicleIcon,
  Build as BuildIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { API_CONFIG } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

interface VehicleType {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
}

interface VehicleTypePricing {
  id: number;
  vehicle_type_id: number;
  vehicle_type_name: string;
  base_price: number;
  price_per_km: number;
  labor_price: number;
  is_active: boolean;
}

const PricingPage: React.FC = () => {
  const { token } = useAuth();
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [pricingData, setPricingData] = useState<VehicleTypePricing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [editingPricing, setEditingPricing] = useState<VehicleTypePricing | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Örnek hesaplama için
  const [exampleDistance, setExampleDistance] = useState(10);
  const [exampleLabor, setExampleLabor] = useState(2);
  const [selectedVehicleTypeForExample, setSelectedVehicleTypeForExample] = useState<number>(1);

  // Sayfa yüklendiğinde mevcut ayarları getir
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Araç tiplerini getir
        const vehicleTypesResponse = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/vehicle-types`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (vehicleTypesResponse.data.success) {
          setVehicleTypes(vehicleTypesResponse.data.data.filter((vt: VehicleType) => vt.is_active));
        }

        // Fiyatlandırma verilerini getir
        const pricingResponse = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/vehicle-type-pricing`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (pricingResponse.data.success) {
          setPricingData(pricingResponse.data.data);
        }
      } catch (err) {
        console.error('Veriler yüklenirken hata:', err);
        setError('Veriler yüklenirken hata oluştu');
      } finally {
        setInitialLoading(false);
      }
    };

    if (token) {
      fetchData();
    }
  }, [token]);

  const calculateExamplePrice = () => {
    const selectedPricing = pricingData.find(p => p.vehicle_type_id === selectedVehicleTypeForExample);
    if (!selectedPricing) return 0;

    const basePrice = selectedPricing.base_price;
    const distancePrice = selectedPricing.price_per_km * exampleDistance;
    const laborPrice = selectedPricing.labor_price * exampleLabor;
    
    // Km ücreti + hammaliye ücreti
    const calculatedPrice = distancePrice + laborPrice;
    
    // Eğer hesaplanan ücret base ücretten düşükse base ücret uygulanır
    return calculatedPrice < basePrice ? basePrice : calculatedPrice;
  };

  const handleEditPricing = (pricing: VehicleTypePricing) => {
    setEditingPricing({ ...pricing });
    setEditDialogOpen(true);
  };

  const handleSavePricing = async () => {
    if (!editingPricing || !token) return;

    setLoading(true);
    setError('');

    try {
      const response = await axios.put(`${API_CONFIG.BASE_URL}/api/admin/vehicle-type-pricing`, {
        vehicle_type_id: editingPricing.vehicle_type_id,
        base_price: editingPricing.base_price,
        price_per_km: editingPricing.price_per_km,
        labor_price: editingPricing.labor_price
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        // Fiyatlandırma verilerini yeniden yükle
        const pricingResponse = await axios.get(`${API_CONFIG.BASE_URL}/api/admin/vehicle-type-pricing`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (pricingResponse.data.success) {
          setPricingData(pricingResponse.data.data);
        }
        
        setEditDialogOpen(false);
        setEditingPricing(null);
        setSuccessModalOpen(true);
      } else {
        setError(response.data.error || 'Fiyatlandırma kaydedilirken bir hata oluştu.');
        setErrorModalOpen(true);
      }
    } catch (err: any) {
      console.error('API hatası:', err);
      setError(err.response?.data?.error || 'Fiyatlandırma kaydedilirken bir hata oluştu.');
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography>Ayarlar yükleniyor...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        Araç Tipi Fiyatlandırma Ayarları
      </Typography>

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Fiyatlandırma Tablosu */}
        <Box sx={{ flex: 2 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <MoneyIcon sx={{ mr: 1 }} />
                Araç Tipi Fiyatlandırmaları
              </Typography>
              
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Fiyatlandırma Kuralları:
                </Typography>
                <Typography variant="body2" component="div">
                  • <strong>Base Ücret:</strong> Her araç tipi için sabit başlangıç ücreti<br/>
                  • <strong>KM Başına Ücret:</strong> Mesafe ile çarpılarak hesaplanır<br/>
                  • <strong>Hammaliye:</strong> Hammal sayısı ile çarpılarak eklenir<br/>
                  • <strong>Toplam:</strong> Base Ücret + (KM × KM Ücreti) + (Hammal × Hammaliye)
                </Typography>
              </Alert>

              <TableContainer component={Paper} sx={{ boxShadow: 1 }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Araç Tipi</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Base Ücret</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>KM Başına Ücret</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Hammaliye</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>İşlemler</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pricingData.map((pricing) => (
                      <TableRow key={pricing.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <VehicleIcon sx={{ color: '#FFD700' }} />
                            <Typography variant="body1" fontWeight="medium">
                              {pricing.vehicle_type_name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            ₺{pricing.base_price.toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            ₺{pricing.price_per_km.toFixed(2)}/km
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            ₺{pricing.labor_price.toFixed(2)}/kişi
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            startIcon={<EditIcon />}
                            onClick={() => handleEditPricing(pricing)}
                            sx={{
                              backgroundColor: '#000000',
                              color: '#FFD700',
                              '&:hover': {
                                backgroundColor: '#212121',
                              },
                            }}
                          >
                            Düzenle
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>

        {/* Örnek Hesaplama */}
        <Box sx={{ flex: 1 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <ShippingIcon sx={{ mr: 1 }} />
                Örnek Hesaplama
              </Typography>

              <Box sx={{ mb: 3 }}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Araç Tipi</InputLabel>
                  <Select
                    value={selectedVehicleTypeForExample}
                    label="Araç Tipi"
                    onChange={(e) => setSelectedVehicleTypeForExample(Number(e.target.value))}
                  >
                    {pricingData.map((pricing) => (
                      <MenuItem key={pricing.vehicle_type_id} value={pricing.vehicle_type_id}>
                        {pricing.vehicle_type_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <TextField
                  fullWidth
                  label="Mesafe"
                  type="number"
                  value={exampleDistance}
                  onChange={(e) => setExampleDistance(parseFloat(e.target.value) || 0)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">km</InputAdornment>,
                  }}
                  sx={{ mb: 2 }}
                />
                
                <TextField
                  fullWidth
                  label="Hammal Sayısı"
                  type="number"
                  value={exampleLabor}
                  onChange={(e) => setExampleLabor(parseFloat(e.target.value) || 0)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">kişi</InputAdornment>,
                  }}
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Paper sx={{ p: 2, backgroundColor: '#F5F5F5' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Hesaplama Detayı:
                </Typography>
                
                {(() => {
                  const selectedPricing = pricingData.find(p => p.vehicle_type_id === selectedVehicleTypeForExample);
                  if (!selectedPricing) return null;
                  
                  const basePrice = selectedPricing.base_price;
                  const distancePrice = selectedPricing.price_per_km * exampleDistance;
                  const laborPrice = selectedPricing.labor_price * exampleLabor;
                  const calculatedPrice = distancePrice + laborPrice;
                  const finalPrice = calculateExamplePrice();
                  
                  return (
                    <>
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="body2">
                          Base Ücret ({selectedPricing.vehicle_type_name}): ₺{basePrice.toFixed(2)}
                        </Typography>
                        <Typography variant="body2">
                          Mesafe ({exampleDistance} km): ₺{distancePrice.toFixed(2)}
                        </Typography>
                        <Typography variant="body2">
                          Hammaliye ({exampleLabor} kişi): ₺{laborPrice.toFixed(2)}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                          Km + Hammaliye Toplamı: ₺{calculatedPrice.toFixed(2)}
                        </Typography>
                        <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#666' }}>
                          {calculatedPrice < basePrice ? 'Base ücret uygulandı' : 'Km + hammaliye ücreti uygulandı'}
                        </Typography>
                      </Box>
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          Toplam:
                        </Typography>
                        <Chip
                          label={`₺${finalPrice.toFixed(2)}`}
                          sx={{
                            backgroundColor: '#000000',
                            color: '#FFD700',
                            fontWeight: 'bold',
                            fontSize: '1rem'
                          }}
                        />
                      </Box>
                    </>
                  );
                })()}
              </Paper>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Düzenleme Dialog'u */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EditIcon />
            {editingPricing?.vehicle_type_name} Fiyatlandırmasını Düzenle
          </Box>
        </DialogTitle>
        <DialogContent>
          {editingPricing && (
            <Box sx={{ pt: 2 }}>
              <TextField
                fullWidth
                label="Base Ücret"
                type="number"
                value={editingPricing.base_price}
                onChange={(e) => setEditingPricing({
                  ...editingPricing,
                  base_price: parseFloat(e.target.value) || 0
                })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₺</InputAdornment>,
                }}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="KM Başına Ücret"
                type="number"
                value={editingPricing.price_per_km}
                onChange={(e) => setEditingPricing({
                  ...editingPricing,
                  price_per_km: parseFloat(e.target.value) || 0
                })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₺</InputAdornment>,
                  endAdornment: <InputAdornment position="end">/km</InputAdornment>,
                }}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Hammaliye Başına Ücret"
                type="number"
                value={editingPricing.labor_price}
                onChange={(e) => setEditingPricing({
                  ...editingPricing,
                  labor_price: parseFloat(e.target.value) || 0
                })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₺</InputAdornment>,
                  endAdornment: <InputAdornment position="end">/kişi</InputAdornment>,
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>
            İptal
          </Button>
          <Button
            onClick={handleSavePricing}
            variant="contained"
            disabled={loading}
            sx={{
              backgroundColor: '#000000',
              color: '#FFD700',
              '&:hover': {
                backgroundColor: '#212121',
              },
            }}
          >
            {loading ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Başarı Modal'ı */}
      <Dialog open={successModalOpen} onClose={() => setSuccessModalOpen(false)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon sx={{ color: 'green' }} />
          Başarılı
        </DialogTitle>
        <DialogContent>
          <Typography>Fiyatlandırma ayarları başarıyla kaydedildi!</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuccessModalOpen(false)} autoFocus>
            Tamam
          </Button>
        </DialogActions>
      </Dialog>

      {/* Hata Modal'ı */}
      <Dialog open={errorModalOpen} onClose={() => setErrorModalOpen(false)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ErrorIcon sx={{ color: 'red' }} />
          Hata
        </DialogTitle>
        <DialogContent>
          <Typography>{error}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setErrorModalOpen(false)} autoFocus>
            Tamam
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PricingPage;