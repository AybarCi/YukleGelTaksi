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
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Person as PersonIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_CONFIG } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

interface User {
  id: number;
  phone_number: string;
  first_name: string;
  last_name: string;
  email: string;
  date_of_birth: string;
  gender: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const UsersPage: React.FC = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      // Get auth token from useAuth hook
      if (!token) {
        setError('Yetkilendirme hatası. Lütfen tekrar giriş yapın.');
        return;
      }

      // API call to get users
      const response = await axios.get(`${API_CONFIG.BASE_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      setUsers(response.data.data.users || []);
    } catch (err: any) {
      console.error('Users fetch error:', err);
      if (err.response?.status === 401) {
        setError('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
      } else {
        setError('Kullanıcılar yüklenirken hata oluştu');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: User) => {
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    // selectedUser'ı null yapmıyoruz çünkü modal açıkken kullanıcı bilgilerine ihtiyacımız var
  };

  const handleViewDetails = () => {
    setDetailsOpen(true);
    handleMenuClose();
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setSelectedUser(null); // Modal kapandığında selectedUser'ı temizle
  };

  const handleToggleStatus = async () => {
    if (selectedUser) {
      try {
        setError('');
        
        // Get auth token from useAuth hook
        if (!token) {
          setError('Yetkilendirme hatası. Lütfen tekrar giriş yapın.');
          return;
        }

        // TODO: Replace with actual API call when backend is ready
        // const response = await fetch(`${API_CONFIG.BASE_URL}/users/${selectedUser.id}/toggle-status`, {
        //   method: 'PATCH',
        //   headers: {
        //     'Authorization': `Bearer ${token}`,
        //   },
        // });
        // 
        // if (!response.ok) {
        //   if (response.status === 401) {
        //     setError('Yetkilendirme hatası. Lütfen tekrar giriş yapın.');
        //     setTimeout(() => {
        //       forceLogout();
        //     }, 2000);
        //     return;
        //   }
        //   throw new Error('Kullanıcı durumu güncellenirken hata oluştu');
        // }
        
        // Mock API call - replace with actual implementation
        const updatedUsers = users.map(user => 
          user.id === selectedUser.id 
            ? { ...user, is_active: !user.is_active }
            : user
        );
        setUsers(updatedUsers);
        handleMenuClose();
      } catch (err) {
        setError('Kullanıcı durumu güncellenirken hata oluştu');
      }
    }
  };

  const filteredUsers = (users || []).filter(user => 
    (user.first_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.last_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.phone_number || '').includes(searchTerm)
  );

  const paginatedUsers = filteredUsers.slice(
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

  const getGenderText = (gender: string) => {
    switch (gender) {
      case 'male': return 'Erkek';
      case 'female': return 'Kadın';
      case 'other': return 'Diğer';
      default: return 'Belirtilmemiş';
    }
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
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Kullanıcı Yönetimi
      </Typography>

      {error && (
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
              placeholder="Kullanıcı ara..."
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
                  <TableCell>Kullanıcı</TableCell>
                  <TableCell>Telefon</TableCell>
                  <TableCell>E-posta</TableCell>
                  <TableCell>Cinsiyet</TableCell>
                  <TableCell>Durum</TableCell>
                  <TableCell>Kayıt Tarihi</TableCell>
                  <TableCell align="right">İşlemler</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedUsers.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: '#FFD700', color: '#000000' }}> {/* Sarı arka plan, siyah ikon */}
                          <PersonIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="body1" fontWeight="medium">
                            {user.first_name} {user.last_name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            ID: {user.id}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{user.phone_number}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{getGenderText(user.gender)}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.is_active ? 'Aktif' : 'Pasif'}
                        color={user.is_active ? 'success' : 'error'}
                        size="small"
                        icon={user.is_active ? <CheckCircleIcon /> : <BlockIcon />}
                      />
                    </TableCell>
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        onClick={(e) => handleMenuOpen(e, user)}
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
            count={filteredUsers.length}
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
        <MenuItem onClick={handleToggleStatus}>
          {selectedUser?.is_active ? 'Pasif Yap' : 'Aktif Yap'}
        </MenuItem>
      </Menu>

      {/* User Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Kullanıcı Detayları
        </DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body1" gutterBottom>
                <strong>Ad Soyad:</strong> {selectedUser.first_name} {selectedUser.last_name}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Telefon:</strong> {selectedUser.phone_number}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>E-posta:</strong> {selectedUser.email}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Doğum Tarihi:</strong> {selectedUser.date_of_birth ? formatDate(selectedUser.date_of_birth) : 'Belirtilmemiş'}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Cinsiyet:</strong> {getGenderText(selectedUser.gender)}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Durum:</strong> 
                <Chip
                  label={selectedUser.is_active ? 'Aktif' : 'Pasif'}
                  color={selectedUser.is_active ? 'success' : 'error'}
                  size="small"
                  sx={{ ml: 1 }}
                />
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Kayıt Tarihi:</strong> {formatDate(selectedUser.created_at)}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Son Güncelleme:</strong> {formatDate(selectedUser.updated_at)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Kapat</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersPage;