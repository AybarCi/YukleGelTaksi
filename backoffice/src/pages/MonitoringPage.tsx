import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Tabs,
  Tab,
  LinearProgress,
  Container,
  Backdrop,
  Fade,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  Error as ErrorIcon,
  Speed as SpeedIcon,
  NetworkCheck as NetworkIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import axios from 'axios';
import { API_CONFIG } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import io from 'socket.io-client';

const API_BASE_URL = API_CONFIG.BASE_URL;

interface MonitoringData {
  success?: boolean;
  data?: {
    connections: {
      drivers: number;
      customers: number;
      total: number;
    };
    monitoring?: {
      isActive: boolean;
      thresholds: {
        errorRate: number;
        responseTime: number;
        eventFrequency: number;
      };
      uptime: number;
    };
    summary?: {
      totalEvents: number;
      totalErrors: number;
      errorRate: number;
      avgResponseTime: number;
      uptime: number;
      period: string;
    };
    timestamp: string;
  };
  // Legacy fields for backward compatibility
  connections?: {
    drivers: number;
    customers: number;
    total: number;
  };
  events?: any[];
  errors?: any[];
  performance?: any[];
  thresholds?: {
    errorRate: number;
    responseTime: number;
    eventFrequency: number;
  };
  timestamp?: string;
  summary?: {
    totalEvents: number;
    totalErrors: number;
    connectedDrivers: number;
    connectedCustomers: number;
    uptime: number;
    errorRate: number;
    avgResponseTime: number;
  };
  recentEvents?: any[];
  recentErrors?: any[];
  recentPerformance?: any[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`monitoring-tabpanel-${index}`}
      aria-labelledby={`monitoring-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const MonitoringPage: React.FC = () => {
  const { token } = useAuth();
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [thresholds, setThresholds] = useState({
    errorRate: 5,
    responseTime: 1000,
    eventFrequency: 100
  });

  const fetchMonitoringData = useCallback(async (isManualRefresh = false) => {
    try {
      // Her durumda refreshing state'ini kullan (aynı indicator için)
      setRefreshing(true);
      
      const response = await axios.get(`${API_BASE_URL}/monitoring`);
      console.log('API Response:', response.data);
      console.log('Connections data:', response.data?.data?.connections);
      setMonitoringData(response.data);
      setError(null);
      
      // Loading indicator'ı en az 2 saniye göster (hem manuel hem otomatik yenileme için)
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      setError('Monitoring verileri alınamadı');
      console.error('Monitoring fetch error:', err);
      
      // Hata durumunda da minimum süre bekle
      await new Promise(resolve => setTimeout(resolve, 1500));
    } finally {
      setRefreshing(false);
      // İlk yükleme tamamlandıysa loading'i false yap
      if (loading) {
        setLoading(false);
      }
    }
  }, [loading]);

  const updateThresholds = async () => {
    try {
      await axios.post(`${API_BASE_URL}/monitoring/thresholds`, thresholds);
      await fetchMonitoringData();
    } catch (err) {
      console.error('Threshold update error:', err);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
  }, [fetchMonitoringData]);

  // Socket.IO bağlantısı
  useEffect(() => {
    // Token yoksa socket bağlantısı kurma
    if (!token) {
      console.log('Token not available, skipping socket connection');
      return;
    }

    // Socket URL'sini düzelt - /api kısmını çıkar ve localhost kullan
    const socketUrl = API_BASE_URL.replace('/api', '').replace(/192\.168\.\d+\.\d+/, 'localhost');
    console.log('Connecting to socket:', socketUrl);
    
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      auth: {
        token: token
      }
    });

    newSocket.on('connect', () => {
      console.log('Socket.IO connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket.IO disconnected');
      setIsConnected(false);
    });

    newSocket.on('monitoringData', (data) => {
      console.log('Real-time monitoring data received:', data);
      setMonitoringData(data);
    });

    newSocket.on('connection_update', (data) => {
      console.log('Connection update received:', data);
      setMonitoringData(prevData => {
        if (!prevData) return prevData;
        return {
          ...prevData,
          connections: {
            ...prevData.connections,
            ...data
          }
        };
      });
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    return () => {
      newSocket.close();
    };
  }, [token]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchMonitoringData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchMonitoringData]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('tr-TR');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
          <Button onClick={() => fetchMonitoringData()} sx={{ ml: 2 }}>
            Tekrar Dene
          </Button>
        </Alert>
      </Box>
    );
  }

  if (!monitoringData) {
    return (
      <Box p={3}>
        <Alert severity="info">Monitoring verisi bulunamadı</Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          📊 Real-time Monitoring Dashboard
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip 
            label={isConnected ? 'Bağlı' : 'Bağlantı Kesildi'} 
            color={isConnected ? 'success' : 'error'} 
            variant="outlined" 
          />
          <Button
            variant="outlined"
            onClick={() => fetchMonitoringData(true)}
            disabled={refreshing}
          >
            {refreshing ? <CircularProgress size={20} /> : 'Yenile'}
          </Button>
        </Box>
      </Box>

      {/* Control Panel */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
              }
              label="Otomatik Yenileme"
            />
            <TextField
              label="Yenileme Aralığı (ms)"
              type="number"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              size="small"
              sx={{ width: 150 }}
            />
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => fetchMonitoringData(true)}
            >
              Manuel Yenile
            </Button>
            <Box flexGrow={1} />
            <Typography variant="body2" color="textSecondary">
              Son Güncelleme: {monitoringData?.timestamp ? new Date(monitoringData.timestamp).toLocaleString('tr-TR') : 'Bilinmiyor'}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <Box display="flex" flexWrap="wrap" gap={3} sx={{ mb: 3 }}>
        <Card sx={{ minWidth: 300, flex: 1 }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <NetworkIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Aktif Bağlantılar</Typography>
            </Box>
            <Typography variant="h3" color="primary">
              {monitoringData?.data?.connections?.total || monitoringData?.connections?.total || 0}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Sürücü: {monitoringData?.data?.connections?.drivers || 0} | 
              Müşteri: {monitoringData?.data?.connections?.customers || 0}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ minWidth: 300, flex: 1 }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <TimelineIcon color="success" sx={{ mr: 1 }} />
              <Typography variant="h6">Toplam Event</Typography>
            </Box>
            <Typography variant="h3" color="success.main">
              {monitoringData?.summary?.totalEvents || (monitoringData?.events ? monitoringData.events.reduce((sum, event) => sum + event.count, 0) : 0)}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Son 5 dakika
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ minWidth: 300, flex: 1 }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <ErrorIcon color="error" sx={{ mr: 1 }} />
              <Typography variant="h6">Toplam Hata</Typography>
            </Box>
            <Typography variant="h3" color="error.main">
              {monitoringData?.summary?.totalErrors || (monitoringData?.errors ? monitoringData.errors.reduce((sum, error) => sum + error.errorCount, 0) : 0)}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Son 5 dakika
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ minWidth: 300, flex: 1 }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <SpeedIcon color="warning" sx={{ mr: 1 }} />
              <Typography variant="h6">Ortalama Response Time</Typography>
            </Box>
            <Typography variant="h3" color="warning.main">
              {monitoringData?.summary?.avgResponseTime || 0}ms
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Son 5 dakika
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Real-time Performance Metrics */}
      {monitoringData?.summary && (
        <Container maxWidth="xl" sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {/* Performance Metrikleri */}
            <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Performance Metrikleri
                  </Typography>
                  <Box>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2">Ortalama Yanıt Süresi:</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {monitoringData.summary.avgResponseTime}ms
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2">Hata Oranı:</Typography>
                      <Typography 
                        variant="body2" 
                        fontWeight="bold"
                        color={monitoringData.summary.errorRate > 5 ? 'error' : 'success'}
                      >
                        {monitoringData.summary.errorRate}%
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2">Uptime:</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {Math.floor(monitoringData.summary.uptime / 3600)}h {Math.floor((monitoringData.summary.uptime % 3600) / 60)}m
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>

            {/* Son Olaylar */}
            <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Son Olaylar
                  </Typography>
                  {monitoringData?.recentEvents && monitoringData.recentEvents.length > 0 ? (
                    <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                      {monitoringData.recentEvents.map((event, index) => (
                        <Box key={index} mb={1} p={1} bgcolor="grey.50" borderRadius={1}>
                          <Typography variant="body2" fontWeight="bold">
                            {event.eventName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(event.timestamp).toLocaleTimeString()} - {event.eventCount} olay
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Henüz olay kaydı yok
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Box>

            {/* Son Hatalar */}
            <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Son Hatalar
                  </Typography>
                  {monitoringData?.recentErrors && monitoringData.recentErrors.length > 0 ? (
                    <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                      {monitoringData.recentErrors.map((error, index) => (
                        <Box key={index} mb={1} p={1} bgcolor="error.light" borderRadius={1}>
                          <Typography variant="body2" fontWeight="bold" color="error.dark">
                            {error.eventName}
                          </Typography>
                          <Typography variant="caption" color="error.main">
                            {new Date(error.timestamp).toLocaleTimeString()} - {error.errorCount} hata
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Henüz hata kaydı yok
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Box>

            {/* Performance Geçmişi */}
            <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Performance Geçmişi
                  </Typography>
                  {monitoringData?.recentPerformance && monitoringData.recentPerformance.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={monitoringData.recentPerformance}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timestamp" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="avgResponseTime" stroke="#8884d8" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Henüz performance geçmişi yok
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Container>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="📈 Event Tracking" />
          <Tab label="❌ Error Analysis" />
          <Tab label="⚡ Performance" />
          <Tab label="⚙️ Settings" />
        </Tabs>
      </Box>

      {/* Event Tracking Tab */}
      <TabPanel value={tabValue} index={0}>
        <Box display="flex" flexWrap="wrap" gap={3}>
          <Card sx={{ minWidth: 600, flex: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Son Event'ler
              </Typography>
              {monitoringData?.events && monitoringData.events.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monitoringData.events}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="eventName" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Typography>Henüz event verisi yok</Typography>
              )}
            </CardContent>
          </Card>

          <Card sx={{ minWidth: 300, flex: 1 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Event Detayları
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Event</TableCell>
                      <TableCell align="right">Sayı</TableCell>
                      <TableCell align="right">Zaman</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {monitoringData?.events?.map((event, index) => (
                      <TableRow key={index}>
                        <TableCell>{event.eventName}</TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={event.count} 
                            size="small" 
                            color={event.count > thresholds.eventFrequency ? 'warning' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {formatTimestamp(event.timestamp)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      {/* Error Analysis Tab */}
      <TabPanel value={tabValue} index={1}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Hata Analizi
            </Typography>
            {monitoringData?.errors && monitoringData.errors.length > 0 ? (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Event Adı</TableCell>
                      <TableCell align="right">Hata Sayısı</TableCell>
                      <TableCell align="right">Zaman</TableCell>
                      <TableCell>Son Hatalar</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {monitoringData?.errors?.map((error, index) => (
                      <TableRow key={index}>
                        <TableCell>{error.eventName}</TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={error.errorCount} 
                            color="error" 
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          {formatTimestamp(error.timestamp)}
                        </TableCell>
                        <TableCell>
                          {error.errors.slice(0, 2).map((err: any, i: number) => (
                            <Typography key={i} variant="caption" display="block">
                              {err.error}
                            </Typography>
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="success">Henüz hata kaydı yok! 🎉</Alert>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* Performance Tab */}
      <TabPanel value={tabValue} index={2}>
        <Box display="flex" flexWrap="wrap" gap={3}>
          <Card sx={{ minWidth: 600, flex: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Metrikleri
              </Typography>
              {monitoringData?.performance && monitoringData.performance.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monitoringData.performance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="eventName" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value}ms`, 'Süre']} />
                    <Line 
                      type="monotone" 
                      dataKey="avgDuration" 
                      stroke="#8884d8" 
                      name="Ortalama Süre"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="maxDuration" 
                      stroke="#ff7300" 
                      name="Maksimum Süre"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Typography>Henüz performance verisi yok</Typography>
              )}
            </CardContent>
          </Card>

          <Card sx={{ minWidth: 300, flex: 1 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Özeti
              </Typography>
              {monitoringData?.performance?.map((perf, index) => (
                <Box key={index} mb={2}>
                  <Typography variant="subtitle2">{perf.eventName}</Typography>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Typography variant="body2" sx={{ minWidth: 80 }}>
                      Ortalama:
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min((perf.avgDuration / thresholds.responseTime) * 100, 100)}
                      sx={{ flexGrow: 1, mx: 1 }}
                      color={perf.avgDuration > thresholds.responseTime ? 'error' : 'success'}
                    />
                    <Typography variant="body2">
                      {perf.avgDuration}ms
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="textSecondary">
                    Max: {perf.maxDuration}ms | Ölçüm: {perf.measurementCount}
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      {/* Settings Tab */}
      <TabPanel value={tabValue} index={3}>
        <Box display="flex" flexWrap="wrap" gap={3}>
          <Card sx={{ minWidth: 400, flex: 1 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <SettingsIcon sx={{ mr: 1 }} />
                Threshold Ayarları
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                <TextField
                  fullWidth
                  label="Hata Oranı Threshold (%)"
                  type="number"
                  value={thresholds.errorRate * 100}
                  onChange={(e) => setThresholds({
                    ...thresholds,
                    errorRate: Number(e.target.value) / 100
                  })}
                  inputProps={{ min: 0, max: 100, step: 1 }}
                />
                <TextField
                  fullWidth
                  label="Response Time Threshold (ms)"
                  type="number"
                  value={thresholds.responseTime}
                  onChange={(e) => setThresholds({
                    ...thresholds,
                    responseTime: Number(e.target.value)
                  })}
                  inputProps={{ min: 100, step: 100 }}
                />
                <TextField
                  fullWidth
                  label="Event Frequency Threshold (per minute)"
                  type="number"
                  value={thresholds.eventFrequency}
                  onChange={(e) => setThresholds({
                    ...thresholds,
                    eventFrequency: Number(e.target.value)
                  })}
                  inputProps={{ min: 1, step: 10 }}
                />
                <Button
                  variant="contained"
                  onClick={updateThresholds}
                  fullWidth
                >
                  Threshold'ları Güncelle
                </Button>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ minWidth: 300, flex: 1 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Mevcut Threshold'lar
              </Typography>
              <Box>
                <Typography variant="body2" gutterBottom>
                  <strong>Hata Oranı:</strong> {((monitoringData?.thresholds?.errorRate || monitoringData?.data?.monitoring?.thresholds?.errorRate || 0) * 100).toFixed(1)}%
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Response Time:</strong> {monitoringData?.thresholds?.responseTime || monitoringData?.data?.monitoring?.thresholds?.responseTime || 0}ms
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Event Frequency:</strong> {monitoringData?.thresholds?.eventFrequency || monitoringData?.data?.monitoring?.thresholds?.eventFrequency || 0}/dakika
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      {/* Şık Loading Indicator */}
      <Backdrop
        sx={{
          color: '#fff',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
        }}
        open={refreshing}
      >
        <Fade in={refreshing}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <CircularProgress
              size={60}
              thickness={4}
              sx={{
                color: '#1976d2',
                '& .MuiCircularProgress-circle': {
                  strokeLinecap: 'round',
                },
              }}
            />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 500,
                textAlign: 'center',
                color: 'white',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              Monitoring verileri güncelleniyor...
            </Typography>
          </Box>
        </Fade>
      </Backdrop>
    </Box>
  );
};

export default MonitoringPage;