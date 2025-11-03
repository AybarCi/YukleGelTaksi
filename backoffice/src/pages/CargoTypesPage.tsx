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
  Avatar,
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Inventory as CargoIcon,
  Add as AddIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  PhotoCamera as PhotoCameraIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_CONFIG, getImageUrl } from '../config/api';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface CargoType {
  id: number;
  name: string;
  description: string;
  image_url: string;
  is_active: boolean;
  sort_order: number;
  labor_count: number;
  created_at: string;
  updated_at: string;
}

const CargoTypesPage: React.FC = () => {
  const [cargoTypes, setCargoTypes] = useState<CargoType[]>([]);
  const [filteredCargoTypes, setFilteredCargoTypes] = useState<CargoType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedCargoType, setSelectedCargoType] = useState<CargoType | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState({
    id: null as number | null,
    name: '',
    description: '',
    image_url: '',
    is_active: true,
    sort_order: 0,
    labor_count: 0
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { token, isLoading: authLoading } = useSelector((state: RootState) => state.auth);

  // Token kontrolü
  useEffect(() => {
    if (!authLoading && !token) {
      setError('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
    }
  }, [token, authLoading]);

  const fetchCargoTypes = useCallback(async () => {
    if (!token) {
      setError('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null); // Clear previous errors
      const response = await axios.get(`${API_CONFIG.BASE_URL}/admin/cargo-types`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        setCargoTypes(response.data.data);
        setFilteredCargoTypes(response.data.data);
      } else {
        setError('Yük tipleri yüklenirken hata oluştu');
      }
    } catch (error: any) {
      console.error('Cargo types fetch error:', error);
      setError(error.response?.data?.error || 'Yük tipleri yüklenirken hata oluştu');
      // Don't retry automatically to prevent infinite loop
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token && !authLoading) {
      fetchCargoTypes();
    }
  }, [token, authLoading]); // Remove fetchCargoTypes from dependencies to prevent loop

  useEffect(() => {
    const filtered = cargoTypes.filter(cargoType =>
      cargoType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cargoType.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredCargoTypes(filtered);
    setPage(0);
  }, [searchTerm, cargoTypes]);

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

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, cargoType: CargoType) => {
    setAnchorEl(event.currentTarget);
    setSelectedCargoType(cargoType);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedCargoType(null);
  };

  const handleOpenDialog = (mode: 'create' | 'edit', cargoType?: CargoType) => {
    setDialogMode(mode);
    if (mode === 'edit' && cargoType) {
      setFormData({
        id: cargoType.id,
        name: cargoType.name,
        description: cargoType.description || '',
        image_url: cargoType.image_url || '',
        is_active: cargoType.is_active,
        sort_order: cargoType.sort_order || 0,
        labor_count: cargoType.labor_count || 0
      });
      setImagePreview(cargoType.image_url ? getImageUrl(cargoType.image_url) : null);
    } else {
      setFormData({
        id: null,
        name: '',
        description: '',
        image_url: '',
        is_active: true,
        sort_order: 0,
        labor_count: 0
      });
      setImagePreview(null);
    }
    setOpenDialog(true);
    handleMenuClose();
  };



  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setFormData({
      id: null,
      name: '',
      description: '',
      image_url: '',
      is_active: true,
      sort_order: 0,
      labor_count: 0
    });
    setImagePreview('');
    setError('');
  };

  const uploadImage = async (): Promise<string | null> => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    
    return new Promise((resolve) => {
      fileInput.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        if (!token) {
          setError('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
          resolve(null);
          return;
        }

        setUploadingImage(true);
        
        try {
          const formData = new FormData();
          formData.append('image', file);

          const response = await axios.post(
            `${API_CONFIG.BASE_URL}/upload/cargo-type-image`,
            formData,
            { 
              headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
              } 
            }
          );

          if (response.data.success) {
            const imageUrl = response.data.data.imageUrl;
            setFormData(prev => ({ ...prev, image_url: imageUrl }));
            setImagePreview(getImageUrl(imageUrl));
            resolve(imageUrl);
          } else {
            setError(response.data.error || 'Fotoğraf yüklenirken hata oluştu');
            resolve(null);
          }
        } catch (error: any) {
          console.error('Image upload error:', error);
          setError(error.response?.data?.error || 'Fotoğraf yüklenirken hata oluştu');
          resolve(null);
        } finally {
          setUploadingImage(false);
        }
      };
      
      fileInput.click();
    });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('İsim alanı zorunludur');
      return;
    }

    if (!token) {
      setError('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // image_url'yi temizle (base64 veri varsa)
      const cleanImageUrl = formData.image_url && formData.image_url.startsWith('data:') ? '' : formData.image_url;

      const payload = {
        name: formData.name,
        description: formData.description,
        image_url: cleanImageUrl,
        is_active: formData.is_active,
        sort_order: formData.sort_order,
        labor_count: formData.labor_count
      };

      if (dialogMode === 'edit') {
        (payload as any).id = formData.id;
      }

      const url = dialogMode === 'create' 
        ? `${API_CONFIG.BASE_URL}/admin/cargo-types`
        : `${API_CONFIG.BASE_URL}/admin/cargo-types`;
      
      const method = dialogMode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('İşlem başarısız oldu');
      }

      await fetchCargoTypes();
      setOpenDialog(false);
      
    } catch (error: any) {
      console.error('İşlem hatası:', error);
      setError(error.response?.data?.error || 'İşlem sırasında bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cargoType: CargoType) => {
    if (!token) {
      setError('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
      return;
    }
    
    try {
      const response = await axios.delete(
        `${API_CONFIG.BASE_URL}/admin/cargo-types/${cargoType.id}`,
        { headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        } }
      );
      
      if (response.data.success) {
        await fetchCargoTypes();
      } else {
        setError(response.data.error || 'Yük tipi silinirken hata oluştu');
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      setError(error.response?.data?.error || 'Yük tipi silinirken hata oluştu');
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

  const paginatedCargoTypes = filteredCargoTypes.slice(
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
        Yük Tipleri Yönetimi
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <TextField
              placeholder="Yük tipi ara..."
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 300 }}
            />
            <Fab
              color="primary"
              size="small"
              onClick={() => handleOpenDialog('create')}
              sx={{ bgcolor: '#FFD700', '&:hover': { bgcolor: '#FFC700' } }}
            >
              <AddIcon />
            </Fab>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Resim</TableCell>
                  <TableCell>İsim</TableCell>
                  <TableCell>Açıklama</TableCell>
                  <TableCell align="center">Sıra</TableCell>
                  <TableCell align="center">Hammaliye Adedi</TableCell>
                  <TableCell align="center">Durum</TableCell>
                  <TableCell>Oluşturulma Tarihi</TableCell>
                  <TableCell align="center">İşlemler</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedCargoTypes.map((cargoType) => (
                  <TableRow key={cargoType.id}>
                    <TableCell>{cargoType.id}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {cargoType.image_url ? (
                          <Avatar
                            src={getImageUrl(cargoType.image_url)}
                            alt={cargoType.name}
                            sx={{ width: 40, height: 40 }}
                            variant="rounded"
                          />
                        ) : (
                          <Avatar sx={{ width: 40, height: 40, bgcolor: 'grey.300' }} variant="rounded">
                            <ImageIcon sx={{ color: 'grey.600' }} />
                          </Avatar>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        {cargoType.name}
                      </Box>
                    </TableCell>
                    <TableCell>{cargoType.description || '-'}</TableCell>
                    <TableCell align="center">{cargoType.sort_order}</TableCell>
                    <TableCell align="center">{cargoType.labor_count || 0}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={cargoType.is_active ? 'Aktif' : 'Pasif'}
                        color={cargoType.is_active ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDate(cargoType.created_at)}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={(event) => handleMenuOpen(event, cargoType)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedCargoTypes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography color="text.secondary" sx={{ py: 3 }}>
                        Yük tipi bulunamadı
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredCargoTypes.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="Sayfa başına satır:"
          />
        </CardContent>
      </Card>

      {/* Menü */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => selectedCargoType && handleOpenDialog('edit', selectedCargoType)}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Düzenle
        </MenuItem>
        <MenuItem 
          onClick={() => selectedCargoType && handleDelete(selectedCargoType)}
          sx={{ color: 'error.main' }}
        >
          <CancelIcon sx={{ mr: 1 }} fontSize="small" />
          Sil
        </MenuItem>
      </Menu>

      {/* Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogMode === 'create' ? 'Yeni Yük Tipi' : 'Yük Tipini Düzenle'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Yük Tipi Adı"
              value={formData.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Açıklama"
              value={formData.description}
              onChange={(e) => handleFormChange('description', e.target.value)}
              margin="normal"
              multiline
              rows={3}
            />
            <Box sx={{ mb: 2 }}>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id="icon-button-file"
                type="file"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file && token) {
                    setUploadingImage(true);
                    try {
                      const formData = new FormData();
                      formData.append('image', file);

                      const response = await axios.post(
                        `${API_CONFIG.BASE_URL}/upload/cargo-type-image`,
                        formData,
                        { 
                          headers: { 
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'multipart/form-data'
                          } 
                        }
                      );

                      if (response.data.success) {
                        const imageUrl = response.data.data.imageUrl;
                        setFormData(prev => ({ ...prev, image_url: imageUrl }));
                        setImagePreview(getImageUrl(imageUrl));
                      } else {
                        setError(response.data.error || 'Fotoğraf yüklenirken hata oluştu');
                      }
                    } catch (error: any) {
                      console.error('Image upload error:', error);
                      setError(error.response?.data?.error || 'Fotoğraf yüklenirken hata oluştu');
                    } finally {
                      setUploadingImage(false);
                    }
                  }
                }}
              />
              <label htmlFor="icon-button-file">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={uploadingImage ? <CircularProgress size={20} /> : <PhotoCameraIcon />}
                  disabled={uploadingImage}
                  fullWidth
                >
                  {uploadingImage ? 'Fotoğraf Yükleniyor...' : 'Fotoğraf Yükle'}
                </Button>
              </label>
              
              {imagePreview && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <img
                    src={imagePreview}
                    alt="Yük tipi ikonu"
                    style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }}
                  />
                </Box>
              )}
            </Box>
            

            <TextField
              fullWidth
              label="Resim URL"
              value={formData.image_url}
              onChange={(e) => handleFormChange('image_url', e.target.value)}
              margin="normal"
              helperText="Büyük resim URL'si (opsiyonel)"
            />
            <TextField
              fullWidth
              label="Sıra Numarası"
              type="number"
              value={formData.sort_order}
              onChange={(e) => handleFormChange('sort_order', parseInt(e.target.value) || 0)}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Hammaliye Adedi"
              type="number"
              value={formData.labor_count}
              onChange={(e) => handleFormChange('labor_count', parseInt(e.target.value) || 0)}
              margin="normal"
              helperText="Bu yük tipi için gereken hammaliye (işçi) adedi"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => handleFormChange('is_active', e.target.checked)}
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
            sx={{ bgcolor: '#FFD700', '&:hover': { bgcolor: '#FFC700' } }}
          >
            {(submitting || uploadingImage) ? <CircularProgress size={20} /> : 'Kaydet'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CargoTypesPage;