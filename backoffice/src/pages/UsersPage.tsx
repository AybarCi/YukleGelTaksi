import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { Action } from 'redux';
import { RootState, AppDispatch } from '../store';
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
import { fetchUsers, updateUserStatus } from '../store/reducers/usersReducer';

import { UserData } from '../store/types';

const UsersPage: React.FC = () => {
  const dispatch = useDispatch<ThunkDispatch<RootState, unknown, Action>>();
  const { users, loading, error } = useSelector((state: RootState) => state.users);
  const { token } = useSelector((state: RootState) => state.auth);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (token) {
      dispatch(fetchUsers(token));
    }
  }, [dispatch, token]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: UserData) => {
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
    if (selectedUser && token) {
      dispatch(updateUserStatus(token, selectedUser.id, !selectedUser.is_active));
      handleMenuClose();
    }
  };

  const filteredUsers = (users || []).filter(user => 
    (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
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
                            {user.full_name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            ID: {user.id}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{user.phone_number}</TableCell>
                    <TableCell>{user.email}</TableCell>

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
                <strong>Ad Soyad:</strong> {selectedUser.full_name}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Telefon:</strong> {selectedUser.phone_number}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>E-posta:</strong> {selectedUser.email}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Doğum Tarihi:</strong> Belirtilmemiş
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Cinsiyet:</strong> Belirtilmemiş
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
                <strong>Son Güncelleme:</strong> {formatDate(selectedUser.created_at)}
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