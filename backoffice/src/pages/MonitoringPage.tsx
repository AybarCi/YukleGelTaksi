import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { Action } from 'redux';
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
import { fetchMonitoringData, setConnectionStatus, setAutoRefresh, updateThresholds, updateMonitoringData } from '../store/reducers/monitoringReducer';
import { RootState } from '../store/types';
import AuthService from '../services/authService';
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
  const dispatch = useDispatch<ThunkDispatch<RootState, unknown, Action>>();
  const { data: monitoringData, loading, error, isConnected, autoRefresh, thresholds } = useSelector((state: RootState) => state.monitoring);
  const [refreshing, setRefreshing] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [localThresholds, setLocalThresholds] = useState(thresholds);
  const [token, setToken] = useState<string | null>(null);

  // AuthService'den token'ı al
  useEffect(() => {
    const authService = new AuthService();
    const supervisorToken = authService.getToken();
    setToken(supervisorToken);
    console.log('Supervisor token from AuthService:', supervisorToken ? 'Available' : 'Not available');
  }, []);

  const fetchMonitoringDataCallback = useCallback(async (isManualRefresh = false) => {
    setRefreshing(true);
    await dispatch(fetchMonitoringData() as any);
    setRefreshing(false);
  }, [dispatch]);

  const updateThresholdsCallback = useCallback(async () => {
    await dispatch(updateThresholds(localThresholds));
  }, [dispatch, localThresholds]);

  useEffect(() => {
    fetchMonitoringDataCallback();
  }, [fetchMonitoringDataCallback]);

  // Socket.IO bağlantısı
  useEffect(() => {
    // Token yoksa socket bağlantısı kurma
    if (!token) {
      console.log('Token not available, skipping socket connection');
      return;
    }

    // Socket URL'sini düzelt - /api kısmını çıkar
    const socketUrl = API_CONFIG.SOCKET_URL;
    console.log('Connecting to socket:', socketUrl);
    console.log('Using supervisor token for socket connection');
    
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
      dispatch(setConnectionStatus(true));
    });

    newSocket.on('disconnect', () => {
      console.log('Socket.IO disconnected');
      dispatch(setConnectionStatus(false));
    });

    newSocket.on('monitoringData', (data) => {
      console.log('Real-time monitoring data received:', data);
      dispatch(updateMonitoringData(data));
    });

    newSocket.on('connection_update', (data) => {
      console.log('Connection update received:', data);
      if (monitoringData) {
        const updatedData = {
          ...monitoringData,
          connections: {
            ...monitoringData.connections,
            ...data.connections
          }
        };
        dispatch(updateMonitoringData(updatedData));
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      dispatch(setConnectionStatus(false));
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return () => {
      console.log('Disconnecting socket');
      newSocket.disconnect();
    };
  }, [token, dispatch, monitoringData]);

  useEffect(() => {
    let interval: number | undefined;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchMonitoringDataCallback();
      }, refreshInterval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval, fetchMonitoringDataCallback]);

  useEffect(() => {
    setLocalThresholds(thresholds);
  }, [thresholds]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading && !monitoringData) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          {error}
        </Alert>
      </Container>
    );
  }

  if (!monitoringData) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="warning">
          Monitoring verisi bulunamadı.
        </Alert>
      </Container>
    );
  }

  // monitoringData'nın tipini kontrol et ve uygun şekilde data değişkenini oluştur
  const data = (monitoringData as any).data || monitoringData;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          Sistem Monitoring
        </Typography>
        <Box>
          <Chip
            icon={<NetworkIcon />}
            label={isConnected ? 'Bağlı' : 'Bağlı Değil'}
            color={isConnected ? 'success' : 'error'}
            variant="outlined"
            sx={{ mr: 1 }}
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => fetchMonitoringDataCallback(true)}
            disabled={refreshing}
            sx={{ mr: 1 }}
          >
            {refreshing ? 'Yenileniyor...' : 'Yenile'}
          </Button>
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => dispatch(setAutoRefresh(e.target.checked))}
              />
            }
            label="Otomatik Yenile"
          />
        </Box>
      </Box>

      <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab icon={<TimelineIcon />} label="Genel Bakış" />
        <Tab icon={<ErrorIcon />} label="Hatalar" />
        <Tab icon={<SpeedIcon />} label="Performans" />
        <Tab icon={<SettingsIcon />} label="Ayarlar" />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        <Box>
          {/* Connection Status Cards */}
          <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(250px, 1fr))" gap={2} mb={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Sürücü Bağlantıları
                </Typography>
                <Typography variant="h5" component="h2">
                  {data.connections?.drivers || 0}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Müşteri Bağlantıları
                </Typography>
                <Typography variant="h5" component="h2">
                  {data.connections?.customers || 0}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Toplam Bağlantı
                </Typography>
                <Typography variant="h5" component="h2">
                  {data.connections?.total || 0}
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {/* Summary Statistics */}
          {data.summary && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Özet İstatistikler (Son 60 Dakika)
                </Typography>
                <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={2}>
                  <Box>
                    <Typography color="textSecondary">
                      Toplam Event
                    </Typography>
                    <Typography variant="h6">
                      {data.summary.totalEvents}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography color="textSecondary">
                      Toplam Hata
                    </Typography>
                    <Typography variant="h6">
                      {data.summary.totalErrors}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography color="textSecondary">
                      Hata Oranı
                    </Typography>
                    <Typography variant="h6">
                      {((data.summary.errorRate || 0) * 100).toFixed(2)}%
                    </Typography>
                  </Box>
                  <Box>
                    <Typography color="textSecondary">
                      Ortalama Yanıt Süresi
                    </Typography>
                    <Typography variant="h6">
                      {(data.summary.avgResponseTime || 0).toFixed(2)}ms
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Real-time Events */}
          {data.recentEvents && data.recentEvents.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Son Event'ler
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Zaman</TableCell>
                        <TableCell>Event</TableCell>
                        <TableCell>Detay</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.recentEvents.map((event: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{new Date(event.timestamp).toLocaleTimeString()}</TableCell>
                          <TableCell>{event.name}</TableCell>
                          <TableCell>{JSON.stringify(event.data)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Box>
          {data.recentErrors && data.recentErrors.length > 0 ? (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Son Hatalar
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Zaman</TableCell>
                        <TableCell>Event</TableCell>
                        <TableCell>Hata</TableCell>
                        <TableCell>Detay</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.recentErrors.map((error: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{new Date(error.timestamp).toLocaleTimeString()}</TableCell>
                          <TableCell>{error.eventName}</TableCell>
                          <TableCell>{error.message}</TableCell>
                          <TableCell>{JSON.stringify(error.details)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          ) : (
            <Alert severity="info">
              Son zamanlarda hata bulunmamaktadır.
            </Alert>
          )}
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Box>
          {data.recentPerformance && data.recentPerformance.length > 0 ? (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Performans Metrikleri
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.recentPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="responseTime" stroke="#8884d8" name="Yanıt Süresi (ms)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Alert severity="info">
              Performans verisi bulunmamaktadır.
            </Alert>
          )}
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Eşik Değerleri Ayarları
              </Typography>
              <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(250px, 1fr))" gap={2}>
                <TextField
                  label="Hata Oranı Eşiği (%)"
                  type="number"
                  value={localThresholds.errorRate * 100}
                  onChange={(e) => setLocalThresholds({
                    ...localThresholds,
                    errorRate: parseFloat(e.target.value) / 100
                  })}
                  inputProps={{ step: 0.1, min: 0, max: 100 }}
                  helperText="Örn: 5 = %5 hata oranı"
                />
                <TextField
                  label="Yanıt Süresi Eşiği (ms)"
                  type="number"
                  value={localThresholds.responseTime}
                  onChange={(e) => setLocalThresholds({
                    ...localThresholds,
                    responseTime: parseInt(e.target.value)
                  })}
                  inputProps={{ step: 100, min: 0 }}
                  helperText="Örn: 1000 = 1 saniye"
                />
                <TextField
                  label="Event Frekansı Eşiği"
                  type="number"
                  value={localThresholds.eventFrequency}
                  onChange={(e) => setLocalThresholds({
                    ...localThresholds,
                    eventFrequency: parseInt(e.target.value)
                  })}
                  inputProps={{ step: 1, min: 0 }}
                  helperText="Dakika başına maksimum event sayısı"
                />
              </Box>
              <Box mt={2}>
                <Button
                  variant="contained"
                  onClick={updateThresholdsCallback}
                  disabled={JSON.stringify(localThresholds) === JSON.stringify(thresholds)}
                >
                  Eşik Değerlerini Güncelle
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>
    </Container>
  );
};

export default MonitoringPage;