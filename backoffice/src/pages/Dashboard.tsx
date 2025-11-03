import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import {
  People as PeopleIcon,
  DirectionsCar as DriversIcon,
  Assignment as OrdersIcon,
  AttachMoney as RevenueIcon,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { fetchDashboardData } from '../store/reducers/dashboardReducer';
import { RootState, AppDispatch } from '../store';

const COLORS = ['#FFD700', '#FFC107', '#FF8F00', '#FF6F00'];

const getStatusText = (status: string) => {
  switch (status) {
    case 'completed': return 'Tamamlandı';
    case 'in_transit': return 'Devam Ediyor';
    case 'cancelled': return 'İptal Edildi';
    case 'pending': return 'Bekliyor';
    default: return status;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'success';
    case 'in_transit': return 'warning';
    case 'cancelled': return 'error';
    case 'pending': return 'default';
    default: return 'default';
  }
};

const Dashboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, error } = useSelector((state: RootState) => state.dashboard);

  useEffect(() => {
    dispatch(fetchDashboardData());
  }, [dispatch]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <Typography variant="h6">Veri bulunamadı</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      {/* Statistics Cards */}
      <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(250px, 1fr))" gap={3} mb={4}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom>
                  Toplam Kullanıcılar
                </Typography>
                <Typography variant="h5" component="h2">
                  {data.stats.totalUsers}
                </Typography>
              </Box>
              <PeopleIcon color="primary" fontSize="large" />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom>
                  Toplam Sürücüler
                </Typography>
                <Typography variant="h5" component="h2">
                  {data.stats.totalDrivers}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Müsait: {data.stats.availableDrivers}
                </Typography>
              </Box>
              <DriversIcon color="primary" fontSize="large" />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom>
                  Toplam Siparişler
                </Typography>
                <Typography variant="h5" component="h2">
                  {data.stats.totalOrders}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Tamamlanan: {data.stats.completedOrders}
                </Typography>
              </Box>
              <OrdersIcon color="primary" fontSize="large" />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom>
                  Toplam Gelir
                </Typography>
                <Typography variant="h5" component="h2">
                  ₺{data.stats.totalRevenue.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Bugün: ₺{data.stats.todayRevenue.toLocaleString()}
                </Typography>
              </Box>
              <RevenueIcon color="primary" fontSize="large" />
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Charts Row */}
      <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(400px, 1fr))" gap={3} mb={4}>
        {/* Monthly Revenue Chart */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Aylık Gelir
            </Typography>
            <Box sx={{ width: '100%', height: 300, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%" aspect={undefined}>
                <LineChart data={data.monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="#FFD700" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {/* Order Status Distribution */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Sipariş Durum Dağılımı
            </Typography>
            <Box sx={{ width: '100%', height: 300, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%" aspect={undefined}>
                <PieChart>
                  <Pie
                    data={data.ordersByStatus.map(item => ({ name: item.status, value: item.count }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {data.ordersByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Tables Row */}
      <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(400px, 1fr))" gap={3}>
        {/* Top Drivers Table */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              En İyi Sürücüler
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Sürücü</TableCell>
                    <TableCell align="right">Tamamlanan</TableCell>
                    <TableCell align="right">Puan</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.topDrivers.map((driver, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body2">{driver.driver_name}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {driver.phone_number}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{driver.completed_orders}</TableCell>
                      <TableCell align="right">{driver.avg_rating.toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Recent Orders Table */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Son Siparişler
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Müşteri</TableCell>
                    <TableCell>Şoför</TableCell>
                    <TableCell>Durum</TableCell>
                    <TableCell align="right">Tutar</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.recentOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Typography variant="body2">{order.customer_name}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          {order.pickup_address.split(',')[0]}
                        </Typography>
                      </TableCell>
                      <TableCell>{order.driver_name}</TableCell>
                      <TableCell>
                        <Chip 
                          label={getStatusText(order.status)} 
                          size="small" 
                          color={getStatusColor(order.status) as any}
                        />
                      </TableCell>
                      <TableCell align="right">₺{order.total_price}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default Dashboard;