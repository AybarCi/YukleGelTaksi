import React, { useState, useEffect } from 'react';
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
import axios from 'axios';
import { API_CONFIG } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = API_CONFIG.BASE_URL;

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

// Mock data for development
const mockData: DashboardData = {
  totalUsers: 1250,
  totalDrivers: 85,
  availableDrivers: 42,
  totalOrders: 3420,
  completedOrders: 3180,
  todayOrders: 28,
  totalRevenue: 125000,
  todayRevenue: 3200,
  ordersByStatus: [
    { status: 'Tamamlandı', count: 3180 },
    { status: 'Devam Ediyor', count: 45 },
    { status: 'İptal Edildi', count: 195 },
  ],
  topDrivers: [
    { driver_name: 'Ahmet Yılmaz', phone_number: '+90 532 123 4567', completed_orders: 245, avg_rating: 4.8 },
    { driver_name: 'Mehmet Kaya', phone_number: '+90 533 234 5678', completed_orders: 198, avg_rating: 4.7 },
    { driver_name: 'Ali Demir', phone_number: '+90 534 345 6789', completed_orders: 176, avg_rating: 4.6 },
  ],
  recentOrders: [
    {
      id: 1001,
      pickup_address: 'Kadıköy, İstanbul',
      destination_address: 'Beşiktaş, İstanbul',
      status: 'completed',
      total_price: 85,
      created_at: '2024-01-15T10:30:00Z',
      customer_name: 'Ayşe Özkan',
      driver_name: 'Ahmet Yılmaz'
    },
    {
      id: 1002,
      pickup_address: 'Şişli, İstanbul',
      destination_address: 'Ataşehir, İstanbul',
      status: 'in_transit',
      total_price: 120,
      created_at: '2024-01-15T11:15:00Z',
      customer_name: 'Fatma Kara',
      driver_name: 'Mehmet Kaya'
    },
  ],
  monthlyRevenue: [
    { month: 'Oca', revenue: 45000, order_count: 890 },
    { month: 'Şub', revenue: 52000, order_count: 1020 },
    { month: 'Mar', revenue: 48000, order_count: 950 },
    { month: 'Nis', revenue: 55000, order_count: 1100 },
    { month: 'May', revenue: 62000, order_count: 1240 },
    { month: 'Haz', revenue: 58000, order_count: 1160 },
  ],
};

interface DashboardData {
  totalUsers: number;
  totalDrivers: number;
  availableDrivers: number;
  totalOrders: number;
  completedOrders: number;
  todayOrders: number;
  totalRevenue: number;
  todayRevenue: number;
  ordersByStatus: Array<{ status: string; count: number }>;
  topDrivers: Array<{
    driver_name: string;
    phone_number: string;
    completed_orders: number;
    avg_rating: number;
  }>;
  recentOrders: Array<{
    id: number;
    pickup_address: string;
    destination_address: string;
    status: string;
    total_price: number;
    created_at: string;
    customer_name: string;
    driver_name: string;
  }>;
  monthlyRevenue: Array<{
    month: string;
    revenue: number;
    order_count: number;
  }>;
}

const Dashboard: React.FC = () => {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Real API integration
      // Get auth token from useAuth hook
      if (!token) {
        setError('Yetkilendirme hatası. Lütfen tekrar giriş yapın.');
        setLoading(false);
        return;
      }

      // Fetch all data in parallel
      const [usersResponse, driversResponse, ordersResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/users`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/api/drivers`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/api/orders`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      // Process the data
      const users = usersResponse.data.data || [];
      const drivers = driversResponse.data.data || [];
      const orders = ordersResponse.data.data?.orders || [];
      
      // Calculate statistics
      const totalUsers = users.length;
      const totalDrivers = drivers.length;
      const availableDrivers = drivers.filter((d: any) => d.is_available).length;
      const totalOrders = orders.length;
      const completedOrders = orders.filter((o: any) => o.status === 'completed').length;
      const todayOrders = orders.filter((o: any) => {
        const today = new Date().toISOString().split('T')[0];
        return o.created_at?.startsWith(today);
      }).length;
      
      const totalRevenue = orders
        .filter((o: any) => o.status === 'completed')
        .reduce((sum: number, o: any) => sum + (o.total_price || 0), 0);
      
      const todayRevenue = orders
        .filter((o: any) => {
          const today = new Date().toISOString().split('T')[0];
          return o.status === 'completed' && o.created_at?.startsWith(today);
        })
        .reduce((sum: number, o: any) => sum + (o.total_price || 0), 0);

      // Order status distribution
      const statusCounts = orders.reduce((acc: any, order: any) => {
        const status = order.status === 'completed' ? 'Tamamlandı' : 
                      order.status === 'in_transit' ? 'Devam Ediyor' : 
                      order.status === 'cancelled' ? 'İptal Edildi' : 'Diğer';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      
      const ordersByStatus = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count: count as number
      }));

      // Top drivers (mock for now as we need more complex query)
      const topDrivers = drivers.slice(0, 3).map((driver: any) => ({
        driver_name: `${driver.user_first_name || driver.first_name || ''} ${driver.user_last_name || driver.last_name || ''}`.trim() || 'Bilinmiyor',
        phone_number: driver.user_phone_number || driver.phone_number || 'Bilinmiyor',
        completed_orders: Math.floor(Math.random() * 200) + 50, // Mock data
        avg_rating: 4.5 + Math.random() * 0.5 // Mock data
      }));

      // Recent orders
      const recentOrders = orders.slice(0, 5).map((order: any) => ({
        id: order.id,
        pickup_address: order.pickup_address || 'Bilinmiyor',
        destination_address: order.destination_address || 'Bilinmiyor',
        status: order.status,
        total_price: order.total_price || 0,
        created_at: order.created_at,
        customer_name: order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() || 'Bilinmiyor' : 'Bilinmiyor',
        driver_name: order.driver ? `${order.driver.first_name || ''} ${order.driver.last_name || ''}`.trim() || 'Atanmadı' : 'Atanmadı'
      }));

      // Monthly revenue (mock data for now)
      const monthlyRevenue = [
        { month: 'Oca', revenue: Math.floor(totalRevenue * 0.15), order_count: Math.floor(totalOrders * 0.15) },
        { month: 'Şub', revenue: Math.floor(totalRevenue * 0.18), order_count: Math.floor(totalOrders * 0.18) },
        { month: 'Mar', revenue: Math.floor(totalRevenue * 0.16), order_count: Math.floor(totalOrders * 0.16) },
        { month: 'Nis', revenue: Math.floor(totalRevenue * 0.17), order_count: Math.floor(totalOrders * 0.17) },
        { month: 'May', revenue: Math.floor(totalRevenue * 0.19), order_count: Math.floor(totalOrders * 0.19) },
        { month: 'Haz', revenue: Math.floor(totalRevenue * 0.15), order_count: Math.floor(totalOrders * 0.15) },
      ];

      const dashboardData: DashboardData = {
        totalUsers,
        totalDrivers,
        availableDrivers,
        totalOrders,
        completedOrders,
        todayOrders,
        totalRevenue,
        todayRevenue,
        ordersByStatus,
        topDrivers,
        recentOrders,
        monthlyRevenue
      };

      setData(dashboardData);
    } catch (err: any) {
      console.error('Dashboard error:', err);
      if (err.response?.status === 401) {
        setError('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
      } else {
        setError('Veri yüklenirken hata oluştu. Lütfen sayfayı yenileyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    subtitle?: string;
  }> = ({ title, value, icon, color, subtitle }) => (
    <Card 
      className="card-hover animate-fade-in"
      sx={{ 
        height: '100%',
        background: 'linear-gradient(135deg, #FFFFFF 0%, #FAFAFA 100%)',
        border: '1px solid rgba(255, 215, 0, 0.1)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: `linear-gradient(90deg, ${color}, ${color}AA)`,
        },
        '&:hover': {
          '&::before': {
            height: '6px',
          }
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          mb: 2
        }}>
          <Box sx={{ flex: 1 }}>
            <Typography 
              color="textSecondary" 
              gutterBottom 
              variant="overline"
              sx={{ 
                fontWeight: 600,
                fontSize: '0.75rem',
                letterSpacing: '0.1em'
              }}
            >
              {title}
            </Typography>
            <Typography 
              variant="h3" 
              component="div" 
              sx={{ 
                fontWeight: 800,
                color: '#000000',
                fontSize: '2.5rem',
                lineHeight: 1.2,
                mb: 0.5
              }}
            >
              {value}
            </Typography>
            {subtitle && (
              <Typography 
                variant="body2" 
                sx={{
                  color: '#666666',
                  fontWeight: 500
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box sx={{ 
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${color}20, ${color}10)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: color,
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'scale(1.1) rotate(5deg)',
              background: `linear-gradient(135deg, ${color}30, ${color}20)`,
            }
          }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );



  if (loading) {
    return (
      <Box 
        display="flex" 
        flexDirection="column"
        justifyContent="center" 
        alignItems="center" 
        minHeight="400px"
        className="animate-pulse"
      >
        <CircularProgress 
          size={60} 
          sx={{ 
            color: '#FFD700',
            mb: 2
          }} 
        />
        <Typography 
          variant="h6" 
          sx={{ 
            color: '#666666',
            fontWeight: 500
          }}
        >
          Dashboard yükleniyor...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        sx={{ 
          mb: 2,
          borderRadius: 2,
          '& .MuiAlert-icon': {
            color: '#d32f2f'
          }
        }}
      >
        {error}
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert 
        severity="warning" 
        sx={{ 
          mb: 2,
          borderRadius: 2,
          '& .MuiAlert-icon': {
            color: '#ed6c02'
          }
        }}
      >
        Veri bulunamadı
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box 
        className="animate-slide-in-left"
        sx={{ 
          mb: 4,
          pb: 2,
          borderBottom: '3px solid',
          borderImage: 'linear-gradient(90deg, #FFD700, #FFC107) 1'
        }}
      >
        <Typography 
          variant="h3" 
          sx={{ 
            fontWeight: 800,
            background: 'linear-gradient(135deg, #FFD700, #FFC107)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 1
          }}
        >
          Dashboard
        </Typography>
        <Typography 
          variant="subtitle1" 
          sx={{ 
            color: '#666666',
            fontWeight: 500
          }}
        >
          Sistem genel durumu ve istatistikler
        </Typography>
      </Box>

      {/* Stats Cards */}
      {data && (
        <Box 
          className="animate-fade-in"
          sx={{ 
            display: 'grid', 
            gridTemplateColumns: { 
              xs: '1fr', 
              sm: '1fr 1fr', 
              md: 'repeat(4, 1fr)' 
            }, 
            gap: 3, 
            mb: 4 
          }}
        >
          <StatCard
            title="Toplam Kullanıcı"
            value={(data.totalUsers || 0).toLocaleString()}
            icon={<PeopleIcon />}
            color="#FFD700"
            />
          
          <StatCard
            title="Aktif Sürücü"
            value={`${data.availableDrivers || 0}/${data.totalDrivers || 0}`}
            icon={<DriversIcon />}
            color="#000000"
            subtitle="Müsait/Toplam"
          />
          
          <StatCard
            title="Toplam Sipariş"
            value={(data.totalOrders || 0).toLocaleString()}
            icon={<OrdersIcon />}
            color="#FFC107"
            subtitle={`Bugün: ${data.todayOrders || 0}`}
          />
          
          <StatCard
            title="Toplam Gelir"
            value={`₺${(data.totalRevenue || 0).toLocaleString()}`}
            icon={<RevenueIcon />}
            color="#FF8F00"
            subtitle={`Bugün: ₺${(data.todayRevenue || 0).toLocaleString()}`}
          />
        </Box>
      )}

      <Box 
        className="animate-slide-in-right"
        sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, 
          gap: 3,
          mb: 4
        }}
      >
        {/* Monthly Revenue Chart */}
        <Card 
          className="card-hover"
          sx={{
            background: 'linear-gradient(135deg, #FFFFFF 0%, #FAFAFA 100%)',
            border: '1px solid rgba(255, 215, 0, 0.1)',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #FFD700, #FFC107)',
            }
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              mb: 3
            }}>
              <Typography 
                variant="h5" 
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #FFD700, #FFC107)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                Aylık Gelir Trendi
              </Typography>
            </Box>
            <Box sx={{ height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.monthlyRevenue || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fill: '#666666', fontSize: 12 }}
                    axisLine={{ stroke: '#e0e0e0' }}
                  />
                  <YAxis 
                    tick={{ fill: '#666666', fontSize: 12 }}
                    axisLine={{ stroke: '#e0e0e0' }}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`₺${Number(value).toLocaleString()}`, 'Gelir']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #FFD700',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#FFD700" 
                    strokeWidth={4}
                    dot={{ fill: '#FFD700', strokeWidth: 2, r: 6 }}
                    activeDot={{ r: 8, fill: '#FFC107' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {/* Order Status Distribution */}
        <Card 
          className="card-hover"
          sx={{
            background: 'linear-gradient(135deg, #FFFFFF 0%, #FAFAFA 100%)',
            border: '1px solid rgba(255, 215, 0, 0.1)',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #000000, #424242)',
            }
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Typography 
              variant="h5" 
              sx={{
                fontWeight: 700,
                color: '#000000',
                mb: 3
              }}
            >
              Sipariş Durumu Dağılımı
            </Typography>
            <Box sx={{ height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.ordersByStatus || []}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={40}
                    fill="#8884d8"
                    dataKey="count"
                    label={({ status, count }: any) => `${getStatusText(status)}: ${count}`}
                  >
                    {(data?.ordersByStatus || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #000000',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Box 
        className="animate-fade-in"
        sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, 
          gap: 3 
        }}
      >
        {/* Top Drivers */}
        <Card 
          className="card-hover"
          sx={{
            background: 'linear-gradient(135deg, #FFFFFF 0%, #FAFAFA 100%)',
            border: '1px solid rgba(255, 215, 0, 0.1)',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #FFD700, #FFC107)',
            }
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Typography 
              variant="h5" 
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #FFD700, #FFC107)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 3
              }}
            >
              En Başarılı Sürücüler
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell 
                      sx={{ 
                        fontWeight: 700,
                        color: '#000000',
                        borderBottom: '2px solid #FFD700'
                      }}
                    >
                      Sürücü
                    </TableCell>
                    <TableCell 
                      align="right"
                      sx={{ 
                        fontWeight: 700,
                        color: '#000000',
                        borderBottom: '2px solid #FFD700'
                      }}
                    >
                      Tamamlanan
                    </TableCell>
                    <TableCell 
                      align="right"
                      sx={{ 
                        fontWeight: 700,
                        color: '#000000',
                        borderBottom: '2px solid #FFD700'
                      }}
                    >
                      Puan
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data?.topDrivers || []).map((driver, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {driver.driver_name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {driver.phone_number}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{driver.completed_orders}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={driver.avg_rating.toFixed(1)}
                          size="small"
                          color={driver.avg_rating >= 4.5 ? 'success' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card 
          className="card-hover"
          sx={{
            background: 'linear-gradient(135deg, #FFFFFF 0%, #FAFAFA 100%)',
            border: '1px solid rgba(255, 215, 0, 0.1)',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #000000, #424242)',
            }
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Typography 
              variant="h5" 
              sx={{
                fontWeight: 700,
                color: '#000000',
                mb: 3
              }}
            >
              Son Siparişler
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell 
                      sx={{ 
                        fontWeight: 700,
                        color: '#000000',
                        borderBottom: '2px solid #000000'
                      }}
                    >
                      Müşteri
                    </TableCell>
                    <TableCell 
                      sx={{ 
                        fontWeight: 700,
                        color: '#000000',
                        borderBottom: '2px solid #000000'
                      }}
                    >
                      Durum
                    </TableCell>
                    <TableCell 
                      align="right"
                      sx={{ 
                        fontWeight: 700,
                        color: '#000000',
                        borderBottom: '2px solid #000000'
                      }}
                    >
                      Tutar
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data?.recentOrders || []).slice(0, 5).map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {order.customer_name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          #{order.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusText(order.status)}
                          size="small"
                          color={getStatusColor(order.status) as any}
                        />
                      </TableCell>
                      <TableCell align="right">
                        ₺{(order.total_price || 0).toLocaleString()}
                      </TableCell>
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