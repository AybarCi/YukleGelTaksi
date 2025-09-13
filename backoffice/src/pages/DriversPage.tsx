import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  Chip,
  Avatar,
  CircularProgress,
  Alert,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,

  Paper,
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  DirectionsCar as DirectionsCarIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Star as StarIcon,
  LocationOn as LocationOnIcon,
  Add as AddIcon,
  Upload as UploadIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_CONFIG } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

interface Driver {
  id: number;
  user_id: number;
  license_number: string;
  license_expiry_date: string;
  vehicle_type: string;
  vehicle_plate: string;
  vehicle_model: string;
  vehicle_color?: string;
  vehicle_year: number;
  is_verified: boolean;
  is_available: boolean;
  is_approved?: boolean;
  rating: number;
  total_trips: number;
  total_earnings: number;
  last_location_lat?: number;
  last_location_lng?: number;
  last_location_update?: string;
  created_at: string;
  updated_at: string;
  // User info
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
  user_first_name?: string;
  user_last_name?: string;
  user_email?: string;
  user_phone_number?: string;
  user_type?: string;
  user_is_active?: boolean;
  user_created_at?: string;
  // Additional driver info
  tc_number?: string;
  tax_number?: string;
  tax_office?: string;
  driver_photo?: string;
  license_photo?: string;
  eligibility_certificate?: string;
  // Document status
  has_driver_photo?: boolean;
  has_license_photo?: boolean;
  has_eligibility_certificate?: boolean;
}

interface NewDriverForm {
  tc_number: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
  tax_number: string;
  tax_office: string;
  license_number: string;
  license_expiry_date: string;
  vehicle_type: string;
  vehicle_plate: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_year: number;
  driver_photo: File | null;
  license_photo: File | null;
  eligibility_certificate: File | null;
}

const DriversPage: React.FC = () => {
  const { token } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addDriverOpen, setAddDriverOpen] = useState(false);
  const [addDriverLoading, setAddDriverLoading] = useState(false);
  const [viewDocumentsOpen, setViewDocumentsOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; data: any } | null>(null);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [resultType, setResultType] = useState<'success' | 'error'>('success');
  const [newDriverForm, setNewDriverForm] = useState<NewDriverForm>({
    tc_number: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    email: '',
    tax_number: '',
    tax_office: '',
    license_number: '',
    license_expiry_date: '',
    vehicle_type: 'pickup',
    vehicle_plate: '',
    vehicle_model: '',
    vehicle_color: '',
    vehicle_year: new Date().getFullYear(),
    driver_photo: null,
    license_photo: null,
    eligibility_certificate: null,
  });

  const fetchDrivers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      // Get auth token from useAuth hook
      if (!token) {
        setError('Yetkilendirme hatası. Lütfen tekrar giriş yapın.');
        return;
      }

      const response = await axios.get(`${API_CONFIG.BASE_URL}/api/drivers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const driversData = response.data.data || [];
      
      // Map API response to match interface
      const mappedDrivers: Driver[] = driversData.map((driver: any) => ({
        id: driver.id,
        user_id: driver.user_id || 0,
        first_name: driver.user_first_name || driver.first_name || 'Bilinmiyor',
        last_name: driver.user_last_name || driver.last_name || 'Bilinmiyor',
        phone_number: driver.user_phone_number || driver.phone_number || 'Bilinmiyor',
        email: driver.user_email || driver.email || 'Bilinmiyor',
        user_first_name: driver.user_first_name,
        user_last_name: driver.user_last_name,
        user_email: driver.user_email,
        user_phone_number: driver.user_phone_number,
        user_type: driver.user_type,
        user_is_active: driver.user_is_active,
        user_created_at: driver.user_created_at,
        tc_number: driver.tc_number,
        tax_number: driver.tax_number,
        tax_office: driver.tax_office,
        license_number: driver.license_number || 'Bilinmiyor',
        license_expiry_date: driver.license_expiry_date || 'Bilinmiyor',
        vehicle_type: driver.vehicle_type || 'sedan',
        vehicle_plate: driver.vehicle_plate || 'Bilinmiyor',
        vehicle_model: driver.vehicle_model || 'Bilinmiyor',
        vehicle_color: driver.vehicle_color || 'Bilinmiyor',
        vehicle_year: driver.vehicle_year || 2020,
        driver_photo: driver.driver_photo,
        license_photo: driver.license_photo,
        eligibility_certificate: driver.eligibility_certificate,
        has_driver_photo: driver.has_driver_photo === 1,
        has_license_photo: driver.has_license_photo === 1,
        has_eligibility_certificate: driver.has_eligibility_certificate === 1,
        is_verified: driver.is_active || false,
        is_available: driver.is_available || false,
        is_approved: driver.is_approved || false,
        rating: driver.rating || 5.0,
        total_trips: driver.total_trips || 0,
        total_earnings: 0, // Not available in API response
        last_location_lat: driver.current_latitude,
        last_location_lng: driver.current_longitude,
        last_location_update: driver.last_location_update,
        created_at: driver.created_at,
        updated_at: driver.updated_at
      }));
      
      setDrivers(mappedDrivers);
    } catch (err) {
      setError('Sürücüler yüklenirken hata oluştu');
       console.error('Drivers fetch error:', err);
     } finally {
       setLoading(false);
     }
   }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);





    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, driver: Driver) => {
    setAnchorEl(event.currentTarget);
    setSelectedDriver(driver);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedDriver(null);
  };

  const showConfirmDialog = (type: string, data: any) => {
    setConfirmAction({ type, data });
    setConfirmDialogOpen(true);
    handleMenuClose();
  };

  const showResultDialog = (message: string, type: 'success' | 'error') => {
    setResultMessage(message);
    setResultType(type);
    setResultDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    setConfirmDialogOpen(false);
    
    try {
      switch (confirmAction.type) {
        case 'approve':
          await executeApproveDriver(confirmAction.data.driverId, confirmAction.data.isApproved);
          showResultDialog(
            confirmAction.data.isApproved ? 'Sürücü başarıyla onaylandı.' : 'Sürücü onayı başarıyla kaldırıldı.',
            'success'
          );
          break;
        case 'toggleAvailability':
          await executeToggleAvailability(confirmAction.data.driver);
          showResultDialog(
            confirmAction.data.driver.is_available 
              ? 'Sürücü başarıyla meşgul yapıldı.' 
              : 'Sürücü başarıyla müsait yapıldı.',
            'success'
          );
          break;
        default:
          break;
      }
    } catch (error: any) {
      showResultDialog(error.message || 'İşlem sırasında bir hata oluştu.', 'error');
    }
    
    setConfirmAction(null);
  };

  const handleViewDetails = () => {
    setDetailsOpen(true);
    setAnchorEl(null); // Close menu but keep selectedDriver
  };

  const executeToggleAvailability = async (driver: Driver) => {
    // Mock API call - replace with actual implementation
    const updatedDrivers = drivers.map(d => 
      d.id === driver.id 
        ? { ...d, is_available: !d.is_available }
        : d
    );
    setDrivers(updatedDrivers);
  };

  const handleApproveDriver = (driverId: number, isApproved: boolean) => {
    showConfirmDialog('approve', { driverId, isApproved });
  };

  const handleToggleAvailability = (driver: Driver) => {
    showConfirmDialog('toggleAvailability', { driver });
  };

  const executeApproveDriver = async (driverId: number, isApproved: boolean) => {
    try {
      setError('');
      
      // Get auth token from useAuth hook
      if (!token) {
        setError('Yetkilendirme hatası. Lütfen tekrar giriş yapın.');
        return;
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/drivers/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          driverId,
          isApproved
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setError('Yetkilendirme hatası. Lütfen tekrar giriş yapın.');
          return;
        }
        throw new Error(result.error || 'Sürücü onay durumu güncellenirken hata oluştu');
      }

      // Update driver in list
      const updatedDrivers = drivers.map(driver => 
        driver.id === driverId 
          ? { ...driver, is_approved: isApproved }
          : driver
      );
      setDrivers(updatedDrivers);
      
    } catch (err: any) {
      setError(err.message || 'Sürücü onay durumu güncellenirken hata oluştu');
    }
  };

  const handleAddDriver = async () => {
    try {
      setAddDriverLoading(true);
      setError('');

      // Validate required fields
      if (!newDriverForm.tc_number || !newDriverForm.first_name || !newDriverForm.last_name || 
          !newDriverForm.phone_number || !newDriverForm.license_number || !newDriverForm.vehicle_plate || !newDriverForm.vehicle_model) {
        setError('Lütfen zorunlu alanları doldurun.');
        return;
      }

      // Get auth token from useAuth hook
      if (!token) {
        setError('Yetkilendirme hatası. Lütfen tekrar giriş yapın.');
        return;
      }

      let uploadedFiles: { [key: string]: string } = {};

      // Upload files if any
      if (newDriverForm.driver_photo || newDriverForm.license_photo || newDriverForm.eligibility_certificate) {
        const formData = new FormData();
        
        if (newDriverForm.driver_photo) {
          formData.append('driver_photo', newDriverForm.driver_photo);
        }
        if (newDriverForm.license_photo) {
          formData.append('license_photo', newDriverForm.license_photo);
        }
        if (newDriverForm.eligibility_certificate) {
          formData.append('eligibility_certificate', newDriverForm.eligibility_certificate);
        }

        const uploadResponse = await fetch(`${API_CONFIG.BASE_URL}/api/drivers/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        const uploadResult = await uploadResponse.json();

        if (!uploadResponse.ok) {
          throw new Error(uploadResult.error || 'Dosya yükleme başarısız');
        }

        uploadedFiles = uploadResult.data.files;
      }

      // Prepare data for API call
      const driverData = {
        tc_number: newDriverForm.tc_number,
        first_name: newDriverForm.first_name,
        last_name: newDriverForm.last_name,
        phone_number: newDriverForm.phone_number,
        email: newDriverForm.email || undefined,
        tax_number: newDriverForm.tax_number || undefined,
        tax_office: newDriverForm.tax_office || undefined,
        license_number: newDriverForm.license_number,
        license_expiry_date: newDriverForm.license_expiry_date,
        vehicle_type: newDriverForm.vehicle_type,
        vehicle_plate: newDriverForm.vehicle_plate,
        vehicle_model: newDriverForm.vehicle_model,
        vehicle_color: newDriverForm.vehicle_color || undefined,
        vehicle_year: newDriverForm.vehicle_year,
        uploaded_files: uploadedFiles,
      };

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/drivers/admin-register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(driverData),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setError('Yetkilendirme hatası. Lütfen tekrar giriş yapın.');

          return;
        }
        throw new Error(result.error || 'Sürücü kaydı başarısız');
      }

      // Add new driver to list
      const newDriver: Driver = {
        id: result.data.driverId,
        user_id: result.data.userId,
        tc_number: newDriverForm.tc_number,
        first_name: newDriverForm.first_name,
        last_name: newDriverForm.last_name,
        phone_number: newDriverForm.phone_number,
        email: newDriverForm.email,
        tax_number: newDriverForm.tax_number,
        tax_office: newDriverForm.tax_office,
        license_number: newDriverForm.license_number,
        license_expiry_date: newDriverForm.license_expiry_date,
        vehicle_type: newDriverForm.vehicle_type,
        vehicle_plate: newDriverForm.vehicle_plate,
        vehicle_model: newDriverForm.vehicle_model,
        vehicle_year: newDriverForm.vehicle_year,
        vehicle_color: newDriverForm.vehicle_color,
        driver_photo: uploadedFiles.driver_photo || '',
        license_photo: uploadedFiles.license_photo || '',
        eligibility_certificate: uploadedFiles.eligibility_certificate || '',
        is_verified: false,
        is_available: false,
        rating: 5.0,
        total_trips: 0,
        total_earnings: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setDrivers([...drivers, newDriver]);
      setAddDriverOpen(false);
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Sürücü eklenirken bir hata oluştu.');
    } finally {
      setAddDriverLoading(false);
    }
  };

  const resetForm = () => {
    setNewDriverForm({
      tc_number: '',
      first_name: '',
      last_name: '',
      phone_number: '',
      email: '',
      tax_number: '',
      tax_office: '',
      license_number: '',
      license_expiry_date: '',
      vehicle_type: 'pickup',
      vehicle_plate: '',
      vehicle_model: '',
      vehicle_color: '',
      vehicle_year: new Date().getFullYear(),
      driver_photo: null,
      license_photo: null,
      eligibility_certificate: null,
    });
  };

  const handleFormChange = (field: keyof NewDriverForm, value: string | number | File | null) => {
    setNewDriverForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileUpload = (field: keyof NewDriverForm, file: File | null) => {
    setNewDriverForm(prev => ({
      ...prev,
      [field]: file
    }));
  };

  const handleViewDocuments = (driver: Driver) => {
    setSelectedDriver(driver);
    setViewDocumentsOpen(true);
  };

  const filteredDrivers = drivers.filter(driver => 
    driver.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.phone_number.includes(searchTerm) ||
    driver.vehicle_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.license_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedDrivers = filteredDrivers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount);
  };

  const getVehicleTypeText = (type: string) => {
    switch (type) {
      case 'pickup': return 'Pickup';
      case 'van': return 'Van';
      case 'truck': return 'Kamyon';
      case 'motorcycle': return 'Motosiklet';
      default: return type;
    }
  };

  const renderRating = (rating: number) => {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <StarIcon sx={{ color: 'gold', fontSize: 16 }} />
        <Typography variant="body2">{rating.toFixed(1)}</Typography>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Sürücü Yönetimi
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddDriverOpen(true)}
          sx={{
            backgroundColor: '#FFD700',
            color: '#000000',
            '&:hover': {
              backgroundColor: '#FFC107',
            },
          }}
        >
          Sürücü Ekle
        </Button>
      </Box>

      {error && !addDriverOpen && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Sürücü ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ maxWidth: 400 }}
            />
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Sürücü</TableCell>
                  <TableCell>Araç</TableCell>
                  <TableCell>Ehliyet</TableCell>
                  <TableCell>Belgeler</TableCell>
                  <TableCell>Onay Durumu</TableCell>
                  <TableCell>Müsaitlik</TableCell>
                  <TableCell>Kayıt Tarihi</TableCell>
                  <TableCell align="right">İşlemler</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedDrivers.map((driver) => (
                  <TableRow key={driver.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar 
                          sx={{ bgcolor: '#FFD700', color: '#000000', width: 40, height: 40 }}
                          src={driver.driver_photo ? `${API_CONFIG.FILES_URL}/${driver.driver_photo}` : undefined}
                        >
                          <DirectionsCarIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="body1" fontWeight="medium">
                            {driver.first_name} {driver.last_name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {driver.phone_number}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {driver.vehicle_plate}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {driver.vehicle_model} ({driver.vehicle_year})
                        </Typography>
                        <Typography variant="caption" display="block" color="textSecondary">
                          {getVehicleTypeText(driver.vehicle_type)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">
                          {driver.license_number}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Bitiş: {formatDate(driver.license_expiry_date)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Chip
                          label={driver.has_driver_photo ? 'Fotoğraf ✓' : 'Fotoğraf ✗'}
                          color={driver.has_driver_photo ? 'success' : 'error'}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={driver.has_license_photo ? 'Ehliyet ✓' : 'Ehliyet ✗'}
                          color={driver.has_license_photo ? 'success' : 'error'}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={driver.has_eligibility_certificate ? 'Uygunluk ✓' : 'Uygunluk ✗'}
                          color={driver.has_eligibility_certificate ? 'success' : 'error'}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={driver.is_approved ? 'Onaylandı' : 'Beklemede'}
                        color={driver.is_approved ? 'success' : 'warning'}
                        size="small"
                        icon={driver.is_approved ? <CheckCircleIcon /> : <BlockIcon />}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={driver.is_available ? 'Müsait' : 'Meşgul'}
                        color={driver.is_available ? 'info' : 'error'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{formatDate(driver.created_at)}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        onClick={(e) => handleMenuOpen(e, driver)}
                        size="small"
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredDrivers.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="Sayfa başına satır:"
            labelDisplayedRows={({ from, to, count }) => 
              `${from}-${to} / ${count !== -1 ? count : `${to}'den fazla`}`
            }
          />
        </CardContent>
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewDetails}>
          Detayları Görüntüle
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedDriver) {
            const driver = selectedDriver;
            handleMenuClose();
            handleViewDocuments(driver);
          }
        }}>
          Belgeleri Görüntüle
        </MenuItem>
        {!selectedDriver?.is_approved && (
          <MenuItem 
            onClick={() => {
              if (selectedDriver) {
                handleApproveDriver(selectedDriver.id, true);
              }
            }}
            sx={{ color: 'success.main' }}
          >
            Onayla
          </MenuItem>
        )}
        {selectedDriver?.is_approved && (
          <MenuItem 
            onClick={() => {
              if (selectedDriver) {
                handleApproveDriver(selectedDriver.id, false);
              }
            }}
            sx={{ color: 'error.main' }}
          >
            Onayı Kaldır
          </MenuItem>
        )}
        <MenuItem onClick={() => {
          if (selectedDriver) {
            handleToggleAvailability(selectedDriver);
          }
        }}>
          {selectedDriver?.is_available ? 'Meşgul Yap' : 'Müsait Yap'}
        </MenuItem>
      </Menu>

      {/* Add Driver Dialog */}
      <Dialog open={addDriverOpen} onClose={() => { setAddDriverOpen(false); setError(''); }} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon />
            Yeni Sürücü Ekle
          </Box>
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Box sx={{ pt: 2, display: 'grid', gap: 3 }}>
            {/* Kişisel Bilgiler */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                Kişisel Bilgiler
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                <TextField
                  fullWidth
                  label="TC Kimlik No *"
                  value={newDriverForm.tc_number}
                  onChange={(e) => handleFormChange('tc_number', e.target.value)}
                  inputProps={{ maxLength: 11 }}
                />
                <TextField
                  fullWidth
                  label="Ad *"
                  value={newDriverForm.first_name}
                  onChange={(e) => handleFormChange('first_name', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Soyad *"
                  value={newDriverForm.last_name}
                  onChange={(e) => handleFormChange('last_name', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Telefon *"
                  value={newDriverForm.phone_number}
                  onChange={(e) => handleFormChange('phone_number', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="E-posta"
                  type="email"
                  value={newDriverForm.email}
                  onChange={(e) => handleFormChange('email', e.target.value)}
                />
              </Box>
            </Paper>

            {/* Vergi Bilgileri */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                Vergi Bilgileri
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                <TextField
                  fullWidth
                  label="Vergi Numarası"
                  value={newDriverForm.tax_number}
                  onChange={(e) => handleFormChange('tax_number', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Vergi Dairesi"
                  value={newDriverForm.tax_office}
                  onChange={(e) => handleFormChange('tax_office', e.target.value)}
                />
              </Box>
            </Paper>

            {/* Ehliyet ve Araç Bilgileri */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                Ehliyet ve Araç Bilgileri
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                <TextField
                  fullWidth
                  label="Ehliyet Numarası *"
                  value={newDriverForm.license_number}
                  onChange={(e) => handleFormChange('license_number', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Ehliyet Bitiş Tarihi"
                  type="date"
                  value={newDriverForm.license_expiry_date}
                  onChange={(e) => handleFormChange('license_expiry_date', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  fullWidth
                  label="Araç Tipi"
                  select
                  value={newDriverForm.vehicle_type}
                  onChange={(e) => handleFormChange('vehicle_type', e.target.value)}
                  SelectProps={{ native: true }}
                >
                  <option value="pickup">Pickup</option>
                  <option value="van">Van</option>
                  <option value="truck">Kamyon</option>
                  <option value="motorcycle">Motosiklet</option>
                </TextField>
                <TextField
                  fullWidth
                  label="Araç Plakası"
                  value={newDriverForm.vehicle_plate}
                  onChange={(e) => handleFormChange('vehicle_plate', e.target.value.toUpperCase())}
                />
                <TextField
                  fullWidth
                  label="Araç Modeli"
                  value={newDriverForm.vehicle_model}
                  onChange={(e) => handleFormChange('vehicle_model', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Araç Rengi"
                  value={newDriverForm.vehicle_color}
                  onChange={(e) => handleFormChange('vehicle_color', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Araç Yılı"
                  type="number"
                  value={newDriverForm.vehicle_year}
                  onChange={(e) => handleFormChange('vehicle_year', parseInt(e.target.value))}
                  inputProps={{ min: 1990, max: new Date().getFullYear() + 1 }}
                />
              </Box>
            </Paper>

            {/* Dosya Yüklemeleri */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                Belgeler
              </Typography>
              <Box sx={{ display: 'grid', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Sürücü Fotoğrafı
                  </Typography>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<UploadIcon />}
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    {newDriverForm.driver_photo ? newDriverForm.driver_photo.name : 'Fotoğraf Seç'}
                    <input
                      type="file"
                      hidden
                      accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => handleFileUpload('driver_photo', e.target.files?.[0] || null)}
                    />
                  </Button>
                </Box>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Sürücü Belgesi Fotoğrafı
                  </Typography>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<UploadIcon />}
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    {newDriverForm.license_photo ? newDriverForm.license_photo.name : 'Belge Fotoğrafı Seç'}
                    <input
                      type="file"
                      hidden
                      accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => handleFileUpload('license_photo', e.target.files?.[0] || null)}
                    />
                  </Button>
                </Box>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Uygunluk Belgesi
                  </Typography>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<UploadIcon />}
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    {newDriverForm.eligibility_certificate ? newDriverForm.eligibility_certificate.name : 'Uygunluk Belgesi Seç'}
                    <input
                      type="file"
                      hidden
                      accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => handleFileUpload('eligibility_certificate', e.target.files?.[0] || null)}
                    />
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddDriverOpen(false); resetForm(); setError(''); }}>
            İptal
          </Button>
          <Button
            variant="contained"
            onClick={handleAddDriver}
            disabled={addDriverLoading}
            sx={{
              backgroundColor: '#FFD700',
              color: '#000000',
              '&:hover': {
                backgroundColor: '#FFC107',
              },
            }}
          >
            {addDriverLoading ? 'Ekleniyor...' : 'Sürücü Ekle'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Driver Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Sürücü Detayları
        </DialogTitle>
        <DialogContent>
          {selectedDriver && (
            <Box sx={{ pt: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  Kişisel Bilgiler
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Ad Soyad:</strong> {selectedDriver.first_name} {selectedDriver.last_name}
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Telefon:</strong> {selectedDriver.phone_number}
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>E-posta:</strong> {selectedDriver.email}
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Kayıt Tarihi:</strong> {formatDate(selectedDriver.created_at)}
                </Typography>
              </Paper>
              
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  Araç Bilgileri
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Plaka:</strong> {selectedDriver.vehicle_plate}
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Model:</strong> {selectedDriver.vehicle_model} ({selectedDriver.vehicle_year})
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Tip:</strong> {getVehicleTypeText(selectedDriver.vehicle_type)}
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Ehliyet No:</strong> {selectedDriver.license_number}
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Ehliyet Bitiş:</strong> {formatDate(selectedDriver.license_expiry_date)}
                </Typography>
              </Paper>
              
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  İstatistikler
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Toplam Sefer:</strong> {selectedDriver.total_trips}
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Toplam Kazanç:</strong> {formatCurrency(selectedDriver.total_earnings)}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="body1" component="span">
                    <strong>Değerlendirme:</strong>
                  </Typography>
                  {renderRating(selectedDriver.rating)}
                </Box>
              </Paper>
              
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  Durum Bilgileri
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Chip
                    label={selectedDriver.is_verified ? 'Doğrulanmış' : 'Doğrulama Bekliyor'}
                    color={selectedDriver.is_verified ? 'success' : 'warning'}
                    icon={selectedDriver.is_verified ? <CheckCircleIcon /> : <BlockIcon />}
                  />
                  <Chip
                    label={selectedDriver.is_available ? 'Müsait' : 'Meşgul'}
                    color={selectedDriver.is_available ? 'info' : 'error'}
                    variant="outlined"
                  />
                </Box>
                {selectedDriver.last_location_update && (
                  <Typography variant="body2" sx={{ mt: 2 }} color="textSecondary">
                    <LocationOnIcon sx={{ fontSize: 16, mr: 0.5 }} />
                    Son konum güncellemesi: {formatDate(selectedDriver.last_location_update)}
                  </Typography>
                )}
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDetailsOpen(false); setSelectedDriver(null); }}>Kapat</Button>
        </DialogActions>
      </Dialog>

        {/* Belgeleri Görüntüleme Modalı */}
        <Dialog
          open={viewDocumentsOpen}
          onClose={() => setViewDocumentsOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Sürücü Belgeleri - {selectedDriver?.first_name} {selectedDriver?.last_name}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'grid', gap: 3, mt: 2 }}>
              {/* Sürücü Fotoğrafı */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Sürücü Fotoğrafı
                </Typography>
                {selectedDriver?.driver_photo ? (
                  <Box sx={{ textAlign: 'center' }}>
                    <img
                      src={`${API_CONFIG.FILES_URL}/${selectedDriver.driver_photo}`}
                      alt="Sürücü Fotoğrafı"
                      style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'cover' }}
                    />
                  </Box>
                ) : (
                  <Typography color="text.secondary">Fotoğraf yüklenmemiş</Typography>
                )}
              </Paper>

              {/* Ehliyet Fotoğrafı */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Ehliyet Fotoğrafı
                </Typography>
                {selectedDriver?.license_photo ? (
                  <Box sx={{ textAlign: 'center' }}>
                    <img
                      src={`${API_CONFIG.FILES_URL}/${selectedDriver.license_photo}`}
                      alt="Ehliyet Fotoğrafı"
                      style={{ maxWidth: '300px', maxHeight: '200px', objectFit: 'cover' }}
                    />
                  </Box>
                ) : (
                  <Typography color="text.secondary">Ehliyet fotoğrafı yüklenmemiş</Typography>
                )}
              </Paper>

              {/* Uygunluk Belgesi */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Uygunluk Belgesi
                </Typography>
                {selectedDriver?.eligibility_certificate ? (
                  <Box sx={{ textAlign: 'center' }}>
                    {selectedDriver.eligibility_certificate.endsWith('.pdf') || 
                     selectedDriver.eligibility_certificate.endsWith('.doc') || 
                     selectedDriver.eligibility_certificate.endsWith('.docx') ? (
                      <Button
                        variant="outlined"
                        onClick={() => window.open(`${API_CONFIG.FILES_URL}/${selectedDriver.eligibility_certificate}`, '_blank')}
                      >
                        {selectedDriver.eligibility_certificate.endsWith('.pdf') ? 'PDF Belgesini Aç' : 'Word Belgesini Aç'}
                      </Button>
                    ) : (
                      <img
                        src={`${API_CONFIG.FILES_URL}/${selectedDriver.eligibility_certificate}`}
                        alt="Uygunluk Belgesi"
                        style={{ maxWidth: '300px', maxHeight: '200px', objectFit: 'cover' }}
                      />
                    )}
                  </Box>
                ) : (
                  <Typography color="text.secondary">Uygunluk belgesi yüklenmemiş</Typography>
                )}
              </Paper>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setViewDocumentsOpen(false)}>
              Kapat
            </Button>
          </DialogActions>
        </Dialog>

        {/* Confirmation Dialog */}
        <Dialog 
          open={confirmDialogOpen} 
          onClose={() => setConfirmDialogOpen(false)}
          maxWidth="xs"
          PaperProps={{
            sx: {
              borderRadius: 3,
              backgroundColor: '#FFD700',
              overflow: 'hidden',
              width: '400px',
              maxWidth: '90vw'
            }
          }}
        >
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            p: 4,
            backgroundColor: '#FFD700',
            minHeight: 300
          }}>
            {/* Icon Section */}
            <Box sx={{ 
              width: 80, 
              height: 80, 
              borderRadius: '50%', 
              backgroundColor: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
              mt: 2
            }}>
              {confirmAction?.type === 'approve' ? (
                <CheckCircleIcon sx={{ fontSize: 48, color: '#fff' }} />
              ) : (
                <DirectionsCarIcon sx={{ fontSize: 48, color: '#fff' }} />
              )}
            </Box>
            
            {/* Message Section */}
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#fff',
                textAlign: 'center',
                mb: 4,
                fontWeight: 500,
                lineHeight: 1.4
              }}
            >
              {confirmAction?.type === 'approve' && confirmAction.data.isApproved && 'Bu sürücüyü onaylamak istediğinizden emin misiniz?'}
              {confirmAction?.type === 'approve' && !confirmAction.data.isApproved && 'Bu sürücünün onayını kaldırmak istediğinizden emin misiniz?'}
              {confirmAction?.type === 'toggleAvailability' && confirmAction.data.driver?.is_available && 'Bu sürücüyü meşgul yapmak istediğinizden emin misiniz?'}
              {confirmAction?.type === 'toggleAvailability' && !confirmAction.data.driver?.is_available && 'Bu sürücüyü müsait yapmak istediğinizden emin misiniz?'}
            </Typography>
            
            {/* Buttons Section */}
            <Box sx={{ display: 'flex', gap: 2, width: '100%', maxWidth: 300 }}>
              <Button 
                onClick={() => setConfirmDialogOpen(false)} 
                variant="outlined"
                fullWidth
                sx={{ 
                  borderRadius: 25,
                  py: 1.5,
                  borderColor: '#fff',
                  color: '#fff',
                  backgroundColor: 'transparent',
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: '#000',
                    borderColor: '#000',
                    color: '#fff'
                  }
                }}
              >
                İptal
              </Button>
              <Button 
                onClick={handleConfirmAction} 
                variant="outlined"
                fullWidth
                sx={{ 
                  borderRadius: 25,
                  py: 1.5,
                  borderColor: '#fff',
                  color: '#fff',
                  backgroundColor: 'transparent',
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: '#000',
                    borderColor: '#000',
                    color: '#fff'
                  }
                }}
              >
                Tamam
              </Button>
            </Box>
          </Box>
        </Dialog>

        {/* Result Dialog */}
        <Dialog 
          open={resultDialogOpen} 
          onClose={() => setResultDialogOpen(false)}
          maxWidth="xs"
          PaperProps={{
            sx: {
              borderRadius: 3,
              backgroundColor: '#FFD700',
              overflow: 'hidden',
              width: '400px',
              maxWidth: '90vw'
            }
          }}
        >
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            p: 4,
            backgroundColor: '#FFD700',
            minHeight: 300
          }}>
            {/* Icon Section */}
            <Box sx={{ 
              width: 80, 
              height: 80, 
              borderRadius: '50%', 
              backgroundColor: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
              mt: 2
            }}>
              {resultType === 'success' ? (
                <CheckCircleIcon sx={{ fontSize: 48, color: '#fff' }} />
              ) : (
                <BlockIcon sx={{ fontSize: 48, color: '#fff' }} />
              )}
            </Box>
            
            {/* Title Section */}
            <Typography 
              variant="h5" 
              sx={{ 
                color: '#fff',
                textAlign: 'center',
                mb: 2,
                fontWeight: 600
              }}
            >
              {resultType === 'success' ? 'İşlem Başarılı' : 'İşlem Başarısız'}
            </Typography>
            
            {/* Message Section */}
            <Typography 
              variant="body1" 
              sx={{ 
                color: '#fff',
                textAlign: 'center',
                mb: 4,
                fontWeight: 400,
                lineHeight: 1.4
              }}
            >
              {resultMessage}
            </Typography>
            
            {/* Button Section */}
            <Box sx={{ width: '100%', maxWidth: 200 }}>
              <Button 
                onClick={() => setResultDialogOpen(false)} 
                variant="outlined"
                fullWidth
                sx={{ 
                  borderRadius: 25,
                  py: 1.5,
                  borderColor: '#fff',
                  color: '#fff',
                  backgroundColor: 'transparent',
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: '#000',
                    borderColor: '#000',
                    color: '#fff'
                  }
                }}
              >
                Tamam
              </Button>
            </Box>
          </Box>
        </Dialog>
      </Box>
    );
  };

  export default DriversPage;