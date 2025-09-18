const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

// Gerçek bir sürücü ID'si kullan (user_id: 32, driver_id: 28)
const driverToken = jwt.sign(
  { userId: 32, userType: 'driver' },
  'your-secret-key',
  { expiresIn: '24h' }
);

console.log('Connecting driver (user_id: 32) to socket server...');

const socket = io('http://localhost:3001', {
  auth: {
    token: driverToken
  },
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('✅ Driver connected successfully');
  
  // Konum güncellemesi gönder (müşterinin yakınında)
  const location = {
    latitude: 41.00617181181938,
    longitude: 28.541649293257095,
    heading: 0
  };
  
  console.log('📍 Sending location update:', location);
  socket.emit('location_update', location);
  
  // Müsaitlik durumunu güncelle
  setTimeout(() => {
    console.log('🟢 Setting driver as available');
    socket.emit('availability_update', { isAvailable: true });
  }, 2000);
  
  // Periyodik konum güncellemeleri gönder
  const locationInterval = setInterval(() => {
    const updatedLocation = {
      latitude: 41.00617181181938 + (Math.random() - 0.5) * 0.001,
      longitude: 28.541649293257095 + (Math.random() - 0.5) * 0.001,
      heading: Math.floor(Math.random() * 360)
    };
    console.log('📍 Sending periodic location update:', updatedLocation);
    socket.emit('location_update', updatedLocation);
  }, 5000);
  
  // 30 saniye sonra bağlantıyı kapat
  setTimeout(() => {
    clearInterval(locationInterval);
    console.log('🔌 Disconnecting driver');
    socket.disconnect();
    process.exit(0);
  }, 30000);
});

socket.on('disconnect', () => {
  console.log('❌ Driver disconnected');
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error);
  process.exit(1);
});

socket.on('request_location_update', () => {
  console.log('📡 Server requested location update');
  const location = {
    latitude: 41.00617181181938,
    longitude: 28.541649293257095,
    heading: 0
  };
  socket.emit('location_update', location);
});

// Diğer socket event'lerini dinle
socket.on('order_request', (data) => {
  console.log('📦 Order request received:', data);
});

socket.on('token_refreshed', (data) => {
  console.log('🔄 Token refreshed:', data);
});