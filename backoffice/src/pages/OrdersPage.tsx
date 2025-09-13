import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Tabs,
  Tab,
  Tooltip,
  Badge,
  Fade,
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  LocalShipping as LocalShippingIcon,
  Person as PersonIcon,
  DirectionsCar as DirectionsCarIcon,
  LocationOn as LocationOnIcon,
  Schedule as ScheduleIcon,
  MonetizationOn as MonetizationOnIcon,
  Image as ImageIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Assignment as AssignmentIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  AccessTime as AccessTimeIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import ordersService, { Order, OrdersParams } from '../services/ordersService';





const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedOrderForMenu, setSelectedOrderForMenu] = useState<Order | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const statusTabs = useMemo(() => [
    { label: 'Tümü', value: 'all', icon: <AssignmentIcon /> },
    { label: 'Beklemede', value: 'pending', icon: <AccessTimeIcon /> },
    { label: 'Sürücü Kabul Etti', value: 'driver_accepted_awaiting_customer', icon: <CheckCircleIcon /> },
    { label: 'Onaylandı', value: 'confirmed', icon: <PlayArrowIcon /> },
    { label: 'Sürücü Yola Çıktı', value: 'driver_going_to_pickup', icon: <DirectionsCarIcon /> },
    { label: 'Yük Alındı', value: 'pickup_completed', icon: <LocalShippingIcon /> },
    { label: 'Yolda', value: 'in_transit', icon: <DirectionsCarIcon /> },
    { label: 'Teslim Edildi', value: 'delivered', icon: <CheckCircleIcon /> },
    { label: 'Ödeme Tamamlandı', value: 'payment_completed', icon: <CheckCircleIcon /> },
    { label: 'İptal Edildi', value: 'cancelled', icon: <CancelIcon /> },
  ], []);

  const fetchOrders =
 useCallback(async (params: OrdersParams = {}) => {
    try {
      setRefreshing(true);
      const currentStatus = statusTabs[tabValue]?.value;
      const response = await ordersService.getOrders({
        page: page + 1,
        limit: rowsPerPage,
        search: searchTerm || undefined,
        status: currentStatus !== 'all' ? currentStatus : undefined,
        ...params
      });
      setOrders(response.data.orders);
      setTotalCount(response.data.pagination.total);
      setError(null);
    } catch (err) {
      setError('Siparişler yüklenirken bir hata oluştu');
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, rowsPerPage, tabValue, searchTerm, statusTabs]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setPage(0);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, order: Order) => {
    setAnchorEl(event.currentTarget);
    setSelectedOrderForMenu(order);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedOrderForMenu(null);
  };

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setDetailsOpen(true);
    handleMenuClose();
  };

  const handleRefresh = async () => {
    await fetchOrders();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <AccessTimeIcon />;
      case 'driver_accepted_awaiting_customer': return <CheckCircleIcon />;
      case 'confirmed': return <PlayArrowIcon />;
      case 'driver_going_to_pickup': return <DirectionsCarIcon />;
      case 'pickup_completed': return <LocalShippingIcon />;
      case 'in_transit': return <DirectionsCarIcon />;
      case 'delivered': return <CheckCircleIcon />;
      case 'payment_completed': return <CheckCircleIcon />;
      case 'cancelled': return <CancelIcon />;
      default: return <AssignmentIcon />;
    }
  };

  const getOrderCounts = () => {
    const counts: { [key: string]: number } = { all: orders.length };
    statusTabs.forEach(tab => {
      if (tab.value !== 'all') {
        counts[tab.value] = orders.filter(order => order.status === tab.value).length;
      }
    });
    return counts;
  };

  const orderCounts = getOrderCounts();

  if (loading && !refreshing) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={40} sx={{ color: '#FFD700' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography 
          variant="h4" 
          component="h1" 
          sx={{ 
            fontWeight: 800,
            background: 'linear-gradient(135deg, #FFD700 0%, #FFC107 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 1
          }}
        >
          Siparişler
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Tüm siparişleri görüntüleyin ve yönetin
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Search and Actions */}
      <Card sx={{ mb: 3, borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Box sx={{ flex: 1, minWidth: '300px' }}>
              <TextField
                fullWidth
                placeholder="Sipariş ara... (Adres, müşteri adı, sipariş ID)"
                value={searchTerm}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#FFD700' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover fieldset': {
                      borderColor: '#FFD700',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#FFD700',
                    },
                  },
                }}
              />
            </Box>
            <Box display="flex" gap={1}>
              <Tooltip title="Yenile">
                <span>
                  <IconButton 
                    onClick={handleRefresh}
                    disabled={refreshing}
                    sx={{ 
                      bgcolor: '#FFD700',
                      color: 'white',
                      '&:hover': { bgcolor: '#FFC107' }
                    }}
                  >
                    {refreshing ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Status Tabs */}
      <Card sx={{ mb: 3, borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              minHeight: 72,
              textTransform: 'none',
              fontSize: '0.95rem',
              fontWeight: 600,
            },
            '& .Mui-selected': {
              color: '#FFD700 !important',
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#FFD700',
              height: 3,
            },
          }}
        >
          {statusTabs.map((tab, index) => (
            <Tab
              key={tab.value}
              icon={
                <Badge 
                  badgeContent={orderCounts[tab.value] || 0} 
                  color="primary"
                  sx={{
                    '& .MuiBadge-badge': {
                      backgroundColor: ordersService.getStatusColor(tab.value),
                      color: 'white'
                    }
                  }}
                >
                  {tab.icon}
                </Badge>
              }
              label={tab.label}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Card>

      {/* Orders Table */}
      <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                <TableCell sx={{ fontWeight: 700, color: '#333' }}>Sipariş ID</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#333' }}>Müşteri</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#333' }}>Sürücü</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#333' }}>Rota</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#333' }}>Durum</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#333' }}>Tutar</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#333' }}>Tarih</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#333' }}>İşlemler</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order, index) => (
                <Fade in={true} timeout={300 + index * 100} key={order.id}>
                  <TableRow 
                    hover 
                    sx={{ 
                      '&:hover': { 
                        bgcolor: 'rgba(255, 215, 0, 0.05)',
                        transform: 'scale(1.001)',
                        transition: 'all 0.2s ease-in-out'
                      },
                      cursor: 'pointer'
                    }}
                    onClick={() => handleViewDetails(order)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} color="primary">
                        #{order.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Avatar 
                          sx={{ 
                            width: 32, 
                            height: 32, 
                            bgcolor: '#FFD700',
                            fontSize: '0.8rem'
                          }}
                        >
                          {order.customer.first_name.charAt(0)}{order.customer.last_name.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {order.customer.first_name} {order.customer.last_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {order.customer.phone}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {order.driver ? (
                        <Box display="flex" alignItems="center" gap={1}>
                          <Avatar 
                            sx={{ 
                              width: 32, 
                              height: 32, 
                              bgcolor: '#4CAF50',
                              fontSize: '0.8rem'
                            }}
                          >
                            {order.driver.first_name.charAt(0)}{order.driver.last_name.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              {order.driver.first_name} {order.driver.last_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {order.driver.vehicle_plate}
                            </Typography>
                          </Box>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Atanmamış
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <strong>Alış:</strong> {order.pickup_address}
                        </Typography>
                        <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <strong>Varış:</strong> {order.destination_address}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {order.distance_km.toFixed(1)} km • {order.weight_kg} kg
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(order.status)}
                        label={ordersService.getStatusText(order.status)}
                        size="small"
                        sx={{
                          bgcolor: ordersService.getStatusColor(order.status),
                          color: 'white',
                          fontWeight: 600,
                          '& .MuiChip-icon': {
                            color: 'white'
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} color="success.main">
                        {ordersService.formatPrice(order.total_price)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {ordersService.formatDate(order.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMenuOpen(e, order);
                        }}
                        sx={{ color: '#FFD700' }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                </Fade>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, 50]}
          labelRowsPerPage="Sayfa başına satır:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
          sx={{
            '& .MuiTablePagination-toolbar': {
              bgcolor: '#f8f9fa'
            },
            '& .MuiTablePagination-selectIcon': {
              color: '#FFD700'
            }
          }}
        />
      </Card>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => selectedOrderForMenu && handleViewDetails(selectedOrderForMenu)}>
          <VisibilityIcon sx={{ mr: 1, color: '#FFD700' }} />
          Detayları Görüntüle
        </MenuItem>
      </Menu>

      {/* Order Details Dialog */}
      <Dialog 
        open={detailsOpen} 
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
          }
        }}
      >
        {selectedOrder && (
          <>
            <DialogTitle sx={{ 
              background: 'linear-gradient(135deg, #FFD700 0%, #FFC107 100%)',
              color: 'white',
              fontWeight: 700
            }}>
              <Box display="flex" alignItems="center" gap={1}>
                <LocalShippingIcon />
                Sipariş Detayları - #{selectedOrder.id}
              </Box>
            </DialogTitle>
            <DialogContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Customer and Driver Info */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                  <Card sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon sx={{ color: '#FFD700' }} />
                      Müşteri Bilgileri
                    </Typography>
                    <Typography><strong>Ad Soyad:</strong> {selectedOrder.customer.first_name} {selectedOrder.customer.last_name}</Typography>
                    <Typography><strong>Telefon:</strong> {selectedOrder.customer.phone}</Typography>
                    <Typography><strong>E-posta:</strong> {selectedOrder.customer.email}</Typography>
                  </Card>

                  <Card sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DirectionsCarIcon sx={{ color: '#FFD700' }} />
                      Sürücü Bilgileri
                    </Typography>
                    {selectedOrder.driver ? (
                      <>
                        <Typography><strong>Ad Soyad:</strong> {selectedOrder.driver.first_name} {selectedOrder.driver.last_name}</Typography>
                        <Typography><strong>Telefon:</strong> {selectedOrder.driver.phone}</Typography>
                        <Typography><strong>Araç:</strong> {selectedOrder.driver.vehicle_model} - {selectedOrder.driver.vehicle_plate}</Typography>
                        <Typography><strong>Renk:</strong> {selectedOrder.driver.vehicle_color}</Typography>
                        <Typography><strong>Puan:</strong> ⭐ {selectedOrder.driver.rating.toFixed(1)}</Typography>
                      </>
                    ) : (
                      <Typography color="text.secondary">Henüz sürücü atanmamış</Typography>
                    )}
                  </Card>
                </Box>

                {/* Route Info */}
                <Card sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationOnIcon sx={{ color: '#FFD700' }} />
                    Rota Bilgileri
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
                    <Box>
                      <Typography><strong>Alış Adresi:</strong></Typography>
                      <Typography variant="body2" color="text.secondary">{selectedOrder.pickup_address}</Typography>
                    </Box>
                    <Box>
                      <Typography><strong>Varış Adresi:</strong></Typography>
                      <Typography variant="body2" color="text.secondary">{selectedOrder.destination_address}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                    <Typography><strong>Mesafe:</strong> {selectedOrder.distance_km.toFixed(1)} km</Typography>
                    <Typography><strong>Ağırlık:</strong> {selectedOrder.weight_kg} kg</Typography>
                    <Typography><strong>Hammal:</strong> {selectedOrder.labor_count} kişi</Typography>
                  </Box>
                </Card>

                {/* Price Details */}
                <Card sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MonetizationOnIcon sx={{ color: '#FFD700' }} />
                    Fiyat Detayları
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 2, mb: 2 }}>
                    <Box>
                      <Typography><strong>Taban Fiyat:</strong></Typography>
                      <Typography color="success.main">{ordersService.formatPrice(selectedOrder.base_price)}</Typography>
                    </Box>
                    <Box>
                      <Typography><strong>Mesafe Fiyatı:</strong></Typography>
                      <Typography color="success.main">{ordersService.formatPrice(selectedOrder.distance_price)}</Typography>
                    </Box>
                    <Box>
                      <Typography><strong>Ağırlık Fiyatı:</strong></Typography>
                      <Typography color="success.main">{ordersService.formatPrice(selectedOrder.weight_price)}</Typography>
                    </Box>
                    <Box>
                      <Typography><strong>Hammal Fiyatı:</strong></Typography>
                      <Typography color="success.main">{ordersService.formatPrice(selectedOrder.labor_price)}</Typography>
                    </Box>
                  </Box>
                  <Typography variant="h6" sx={{ mt: 1 }}>
                    <strong>Toplam: {ordersService.formatPrice(selectedOrder.total_price)}</strong>
                  </Typography>
                </Card>

                {/* Status and Dates */}
                <Card sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ScheduleIcon sx={{ color: '#FFD700' }} />
                    Durum ve Tarihler
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                    <Box>
                      <Typography><strong>Durum:</strong></Typography>
                      <Chip
                        icon={getStatusIcon(selectedOrder.status)}
                        label={ordersService.getStatusText(selectedOrder.status)}
                        sx={{
                          bgcolor: ordersService.getStatusColor(selectedOrder.status),
                          color: 'white',
                          fontWeight: 600,
                          '& .MuiChip-icon': {
                            color: 'white'
                          }
                        }}
                      />
                    </Box>
                    <Box>
                      <Typography><strong>Oluşturulma:</strong> {ordersService.formatDate(selectedOrder.created_at)}</Typography>
                      {selectedOrder.accepted_at && (
                        <Typography><strong>Kabul:</strong> {ordersService.formatDate(selectedOrder.accepted_at)}</Typography>
                      )}
                      {selectedOrder.confirmed_at && (
                        <Typography><strong>Onay:</strong> {ordersService.formatDate(selectedOrder.confirmed_at)}</Typography>
                      )}
                      {selectedOrder.started_at && (
                        <Typography><strong>Başlangıç:</strong> {ordersService.formatDate(selectedOrder.started_at)}</Typography>
                      )}
                      {selectedOrder.completed_at && (
                        <Typography><strong>Tamamlanma:</strong> {ordersService.formatDate(selectedOrder.completed_at)}</Typography>
                      )}
                      {selectedOrder.cancelled_at && (
                        <Typography><strong>İptal:</strong> {ordersService.formatDate(selectedOrder.cancelled_at)}</Typography>
                      )}
                    </Box>
                  </Box>
                </Card>

                {/* Notes */}
                {(selectedOrder.customer_notes || selectedOrder.driver_notes || selectedOrder.cancel_reason) && (
                  <Card sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Notlar
                    </Typography>
                    {selectedOrder.customer_notes && (
                      <Typography><strong>Müşteri Notu:</strong> {selectedOrder.customer_notes}</Typography>
                    )}
                    {selectedOrder.driver_notes && (
                      <Typography><strong>Sürücü Notu:</strong> {selectedOrder.driver_notes}</Typography>
                    )}
                    {selectedOrder.cancel_reason && (
                      <Typography color="error"><strong>İptal Nedeni:</strong> {selectedOrder.cancel_reason}</Typography>
                    )}
                  </Card>
                )}

                {/* Cargo Photo */}
                {selectedOrder.cargo_photo_url && (
                  <Card sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ImageIcon sx={{ color: '#FFD700' }} />
                      Kargo Fotoğrafı
                    </Typography>
                    <Box
                      component="img"
                      src={selectedOrder.cargo_photo_url}
                      alt="Kargo Fotoğrafı"
                      sx={{
                        maxWidth: '100%',
                        maxHeight: 300,
                        borderRadius: 2,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                  </Card>
                )}
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
              <Button 
                onClick={() => setDetailsOpen(false)}
                variant="contained"
                sx={{
                  bgcolor: '#FFD700',
                  color: 'white',
                  '&:hover': { bgcolor: '#FFC107' },
                  borderRadius: 2,
                  px: 3
                }}
              >
                Kapat
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default OrdersPage;