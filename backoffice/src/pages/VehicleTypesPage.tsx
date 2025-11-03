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
  Fab,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  DirectionsCar as VehicleIcon,
  Add as AddIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  CloudUpload as CloudUploadIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_CONFIG, getImageUrl } from '../config/api';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface VehicleType {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

const VehicleTypesPage: React.FC = () => {
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [filteredVehicleTypes, setFilteredVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedVehicleType, setSelectedVehicleType] = useState<VehicleType | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState({
    id: undefined as number | undefined,
    name: '',
    description: '',
    is_active: true,
    image_url: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const token = useSelector((state: RootState) => state.auth.token);
  const authLoading = useSelector((state: RootState) => state.auth.isLoading);

  // Token kontrolü
  useEffect(() => {
    if (!authLoading && !token) {
      setError('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
    }
  }, [token, authLoading]);

  const fetchVehicleTypes = useCallback(async () => {
    if (!token) {
      setError('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const response = await axios.get(`${API_CONFIG.BASE_URL}/admin/vehicle-types`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        setVehicleTypes(response.data.data);
        setFilteredVehicleTypes(response.data.data);
      } else {
        setError('Araç tipleri yüklenirken hata oluştu');
      }
    } catch (error: any) {
      console.error('Vehicle types fetch error:', error);
      setError(error.response?.data?.error || 'Araç tipleri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchVehicleTypes();
  }, [fetchVehicleTypes]);

  useEffect(() => {
    const filtered = vehicleTypes.filter(vehicleType =>
      vehicleType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicleType.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredVehicleTypes(filtered);
    setPage(0);
  }, [searchTerm, vehicleTypes]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, vehicleType: VehicleType) => {
    setAnchorEl(event.currentTarget);
    setSelectedVehicleType(vehicleType);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedVehicleType(null);
  };

  const handleOpenDialog = (mode: 'create' | 'edit', vehicleType?: VehicleType) => {
    setDialogMode(mode);
    if (mode === 'edit' && vehicleType) {
      setFormData({
        id: vehicleType.id,
        name: vehicleType.name,
        description: vehicleType.description || '',
        is_active: vehicleType.is_active,
        image_url: vehicleType.image_url || ''
      });
      setImagePreview(vehicleType.image_url ? getImageUrl(vehicleType.image_url) : null);
    } else {
      setFormData({
        id: undefined,
        name: '',
        description: '',
        is_active: true,
        image_url: ''
      });
      setImagePreview(null);
    }
    setSelectedFile(null);
    setOpenDialog(true);
    handleMenuClose();
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setFormData({
      id: undefined,
      name: '',
      description: '',
      is_active: true,
      image_url: ''
    });
    setSelectedFile(null);
    setImagePreview(null);
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Dosya türü kontrolü
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Sadece JPEG, PNG ve WebP dosyaları kabul edilir');
        return;
      }

      // Dosya boyutu kontrolü (5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('Dosya boyutu 5MB\'dan büyük olamaz');
        return;
      }

      setSelectedFile(file);
      
      // Preview oluştur
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedFile || !token) return null;

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await axios.post(
        `${API_CONFIG.BASE_URL}/upload/vehicle-type-image`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        return response.data.data.imageUrl;
      } else {
        setError(response.data.error || 'Fotoğraf yüklenirken hata oluştu');
        return null;
      }
    } catch (error: any) {
      console.error('Image upload error:', error);
      setError(error.response?.data?.error || 'Fotoğraf yüklenirken hata oluştu');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Araç tipi adı gereklidir');
      return;
    }

    if (!token) {
      setError('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      let imageUrl = formData.image_url;
      
      // Yeni dosya seçildiyse önce upload et
      if (selectedFile) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        } else {
          return; // Upload başarısızsa işlemi durdur
        }
      }

      const submitData = {
        ...formData,
        image_url: imageUrl
      };

      if (dialogMode === 'create') {
        const response = await axios.post(
          `${API_CONFIG.BASE_URL}/admin/vehicle-types`,
          submitData,
          { headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } }
        );
        
        if (response.data.success) {
          await fetchVehicleTypes();
          handleCloseDialog();
        } else {
          setError(response.data.error || 'Araç tipi oluşturulurken hata oluştu');
        }
      } else {
        const response = await axios.put(
          `${API_CONFIG.BASE_URL}/admin/vehicle-types`,
          submitData,
          { headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } }
        );
        
        if (response.data.success) {
          await fetchVehicleTypes();
          handleCloseDialog();
        } else {
          setError(response.data.error || 'Araç tipi güncellenirken hata oluştu');
        }
      }
    } catch (error: any) {
      console.error('Submit error:', error);
      setError(error.response?.data?.error || 'İşlem sırasında hata oluştu');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (vehicleType: VehicleType) => {
    if (!token) {
      setError('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
      return;
    }
    
    try {
      const response = await axios.put(
        `${API_CONFIG.BASE_URL}/admin/vehicle-types/${vehicleType.id}/toggle-status`,
        { is_active: !vehicleType.is_active },
        { headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        } }
      );
      
      if (response.data.success) {
        await fetchVehicleTypes();
      } else {
        setError(response.data.error || 'Durum değiştirilirken hata oluştu');
      }
    } catch (error: any) {
      console.error('Toggle status error:', error);
      setError(error.response?.data?.error || 'Durum değiştirilirken hata oluştu');
    }
    handleMenuClose();
  };



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const paginatedVehicleTypes = filteredVehicleTypes.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={40} sx={{ color: '#FFD700' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: '#333', fontWeight: 'bold' }}>
        Araç Tipleri Yönetimi
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card sx={{ boxShadow: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <TextField
              placeholder="Araç tipi ara..."
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={handleSearchChange}
              sx={{ width: 300 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
            
            <Typography variant="body2" color="textSecondary">
              Toplam {filteredVehicleTypes.length} araç tipi
            </Typography>
          </Box>

          <TableContainer component={Paper} sx={{ boxShadow: 1 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Fotoğraf</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Araç Tipi</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Açıklama</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Durum</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Oluşturulma Tarihi</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Güncellenme Tarihi</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>İşlemler</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedVehicleTypes.map((vehicleType) => (
                  <TableRow key={vehicleType.id} hover>
                    <TableCell>
                      <Box sx={{ width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {vehicleType.image_url ? (
                          <img
                            src={getImageUrl(vehicleType.image_url)}
                            alt={vehicleType.name}
                            style={{
                              width: '50px',
                              height: '50px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              border: '1px solid #ddd'
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: '50px',
                              height: '50px',
                              backgroundColor: '#f5f5f5',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid #ddd'
                            }}
                          >
                            <ImageIcon sx={{ color: '#ccc', fontSize: 24 }} />
                          </Box>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <VehicleIcon sx={{ color: '#FFD700' }} />
                        <Box>
                          <Typography variant="body1" fontWeight="medium">
                            {vehicleType.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            ID: {vehicleType.id}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 200 }}>
                        {vehicleType.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={vehicleType.is_active ? 'Aktif' : 'Pasif'}
                        color={vehicleType.is_active ? 'success' : 'error'}
                        size="small"
                        icon={vehicleType.is_active ? <CheckCircleIcon /> : <CancelIcon />}
                      />
                    </TableCell>
                    <TableCell>{formatDate(vehicleType.created_at)}</TableCell>
                    <TableCell>{formatDate(vehicleType.updated_at)}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        onClick={(e) => handleMenuOpen(e, vehicleType)}
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
            count={filteredVehicleTypes.length}
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

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          backgroundColor: '#FFD700',
          '&:hover': {
            backgroundColor: '#FFC107',
          },
        }}
        onClick={() => handleOpenDialog('create')}
      >
        <AddIcon />
      </Fab>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleOpenDialog('edit', selectedVehicleType!)}>
          <EditIcon sx={{ mr: 1 }} />
          Düzenle
        </MenuItem>
        <MenuItem onClick={() => handleToggleStatus(selectedVehicleType!)}>
          {selectedVehicleType?.is_active ? <CancelIcon sx={{ mr: 1 }} /> : <CheckCircleIcon sx={{ mr: 1 }} />}
          {selectedVehicleType?.is_active ? 'Pasif Yap' : 'Aktif Yap'}
        </MenuItem>
      </Menu>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogMode === 'create' ? 'Yeni Araç Tipi Ekle' : 'Araç Tipi Düzenle'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              autoFocus
              margin="dense"
              label="Araç Tipi Adı"
              fullWidth
              variant="outlined"
              value={formData.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="dense"
              label="Açıklama"
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              value={formData.description}
              onChange={(e) => handleFormChange('description', e.target.value)}
              sx={{ mb: 2 }}
            />
            
            {/* Image Upload Section */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Araç Tipi Fotoğrafı
              </Typography>
              
              {imagePreview && (
                <Box sx={{ mb: 2, textAlign: 'center' }}>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{
                      maxWidth: '200px',
                      maxHeight: '150px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: '1px solid #ddd'
                    }}
                  />
                </Box>
              )}
              
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="image-upload"
                type="file"
                onChange={handleFileSelect}
              />
              <label htmlFor="image-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<CloudUploadIcon />}
                  fullWidth
                  sx={{
                    borderColor: '#FFD700',
                    color: '#FFD700',
                    '&:hover': {
                      borderColor: '#FFC107',
                      backgroundColor: 'rgba(255, 215, 0, 0.04)'
                    }
                  }}
                >
                  {selectedFile ? selectedFile.name : 'Fotoğraf Seç'}
                </Button>
              </label>
              
              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                Desteklenen formatlar: JPEG, PNG, WebP (Maksimum 5MB)
              </Typography>
            </Box>
            
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => handleFormChange('is_active', e.target.checked)}
                  color="primary"
                />
              }
              label="Aktif"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>İptal</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={submitting || uploadingImage}
            sx={{ 
              backgroundColor: '#FFD700',
              '&:hover': { backgroundColor: '#FFC107' }
            }}
          >
            {(submitting || uploadingImage) ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                {uploadingImage ? 'Fotoğraf Yükleniyor...' : (dialogMode === 'create' ? 'Ekleniyor...' : 'Güncelleniyor...')}
              </Box>
            ) : (
              dialogMode === 'create' ? 'Ekle' : 'Güncelle'
            )}
          </Button>
        </DialogActions>
      </Dialog>


    </Box>
  );
};

export default VehicleTypesPage;