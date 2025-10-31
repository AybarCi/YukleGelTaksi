const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

/**
 * Test script to verify coordinate flow from order_inspection_started to MapComponent
 * This test simulates the complete flow and validates coordinate handling
 */

// Test configuration
const TEST_CONFIG = {
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  JWT_SECRET: process.env.JWT_SECRET || 'yuklegel_taksi_super_secret_key_2024',
  DRIVER_USER_ID: 32,
  DRIVER_ID: 28,
  TEST_ORDER_ID: 1, // You may need to adjust this based on your test data
};

// Create driver token
const driverToken = jwt.sign(
  { userId: TEST_CONFIG.DRIVER_USER_ID, userType: 'driver' },
  TEST_CONFIG.JWT_SECRET,
  { expiresIn: '24h' }
);

console.log('🧪 Testing coordinate flow from order_inspection_started to MapComponent...');
console.log(`📝 Test Configuration:`, TEST_CONFIG);

// Test data structure to validate coordinate flow
const coordinateFlowTest = {
  socketConnected: false,
  orderInspectionStartedReceived: false,
  orderDetails: null,
  coordinatesValid: false,
  validationErrors: [],
};

// Helper function to validate coordinates
function validateCoordinates(lat, lng, fieldName) {
  const errors = [];
  
  if (lat == null || lng == null) {
    errors.push(`${fieldName}: Null or undefined coordinates`);
    return { valid: false, errors };
  }
  
  const latNum = Number(lat);
  const lngNum = Number(lng);
  
  if (isNaN(latNum) || isNaN(lngNum)) {
    errors.push(`${fieldName}: Coordinates are not valid numbers (lat: ${lat}, lng: ${lng})`);
  }
  
  if (latNum < -90 || latNum > 90) {
    errors.push(`${fieldName}: Latitude out of range (-90 to 90): ${latNum}`);
  }
  
  if (lngNum < -180 || lngNum > 180) {
    errors.push(`${fieldName}: Longitude out of range (-180 to 180): ${lngNum}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    coordinates: { latitude: latNum, longitude: lngNum }
  };
}

// Connect to socket server
const socket = io(TEST_CONFIG.API_BASE_URL, {
  auth: {
    token: driverToken
  },
  transports: ['websocket', 'polling']
});

// Socket event handlers
socket.on('connect', () => {
  console.log('✅ Driver connected successfully');
  coordinateFlowTest.socketConnected = true;
  
  // Send location update
  const location = {
    latitude: 41.00617181181938,
    longitude: 28.541649293257095,
    heading: 0
  };
  
  console.log('📍 Sending location update:', location);
  socket.emit('location_update', location);
  
  // Set driver as available
  setTimeout(() => {
    console.log('🟢 Setting driver as available');
    socket.emit('availability_update', { isAvailable: true });
  }, 1000);
  
  // Simulate order inspection after 2 seconds
  setTimeout(() => {
    console.log('🔍 Simulating order inspection...');
    socket.emit('inspect_order', { orderId: TEST_CONFIG.TEST_ORDER_ID });
  }, 2000);
});

socket.on('disconnect', () => {
  console.log('❌ Driver disconnected');
  coordinateFlowTest.socketConnected = false;
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  coordinateFlowTest.validationErrors.push(`Connection error: ${error.message}`);
});

// Listen for order_inspection_started event
socket.on('order_inspection_started', (data) => {
  console.log('📨 Received order_inspection_started event:', JSON.stringify(data, null, 2));
  coordinateFlowTest.orderInspectionStartedReceived = true;
  
  if (data && data.orderDetails) {
    coordinateFlowTest.orderDetails = data.orderDetails;
    
    // Validate pickup coordinates
    const pickupValidation = validateCoordinates(
      data.orderDetails.pickup_latitude,
      data.orderDetails.pickup_longitude,
      'pickup'
    );
    
    // Validate delivery coordinates (both naming conventions)
    const deliveryValidation = validateCoordinates(
      data.orderDetails.delivery_latitude || data.orderDetails.destination_latitude,
      data.orderDetails.delivery_longitude || data.orderDetails.destination_longitude,
      'delivery'
    );
    
    // Combine validation results
    coordinateFlowTest.coordinatesValid = pickupValidation.valid && deliveryValidation.valid;
    coordinateFlowTest.validationErrors = [
      ...pickupValidation.errors,
      ...deliveryValidation.errors
    ];
    
    console.log('📊 Coordinate Validation Results:');
    console.log(`   Pickup valid: ${pickupValidation.valid}`);
    console.log(`   Delivery valid: ${deliveryValidation.valid}`);
    console.log(`   Overall valid: ${coordinateFlowTest.coordinatesValid}`);
    
    if (coordinateFlowTest.validationErrors.length > 0) {
      console.log('❌ Validation errors:', coordinateFlowTest.validationErrors);
    } else {
      console.log('✅ All coordinates are valid!');
    }
    
    // Log coordinate mapping for verification
    console.log('🗺️  Coordinate Mapping:');
    console.log(`   Pickup: (${data.orderDetails.pickup_latitude}, ${data.orderDetails.pickup_longitude})`);
    console.log(`   Delivery: (${data.orderDetails.delivery_latitude || data.orderDetails.destination_latitude}, ${data.orderDetails.delivery_longitude || data.orderDetails.destination_longitude})`);
    
    // Check for both naming conventions
    if (data.orderDetails.delivery_latitude && data.orderDetails.destination_latitude) {
      console.log('✅ Both delivery_* and destination_* fields present (backward compatibility maintained)');
    }
    
  } else {
    coordinateFlowTest.validationErrors.push('No orderDetails in order_inspection_started event');
    console.log('❌ No orderDetails received in order_inspection_started event');
  }
  
  // End test after 3 seconds
  setTimeout(() => {
    endTest();
  }, 3000);
});

// Listen for other relevant events
socket.on('order_locked_for_inspection', (data) => {
  console.log('🔒 Order locked for inspection:', data);
});

socket.on('order_status_update', (data) => {
  console.log('📊 Order status update:', data);
});

// Test completion function
function endTest() {
  console.log('\n' + '='.repeat(60));
  console.log('🎯 COORDINATE FLOW TEST RESULTS');
  console.log('='.repeat(60));
  
  console.log('📋 Test Summary:');
  console.log(`   Socket Connected: ${coordinateFlowTest.socketConnected ? '✅' : '❌'}`);
  console.log(`   Order Inspection Started Received: ${coordinateFlowTest.orderInspectionStartedReceived ? '✅' : '❌'}`);
  console.log(`   Order Details Available: ${coordinateFlowTest.orderDetails ? '✅' : '❌'}`);
  console.log(`   Coordinates Valid: ${coordinateFlowTest.coordinatesValid ? '✅' : '❌'}`);
  
  if (coordinateFlowTest.validationErrors.length > 0) {
    console.log('\n❌ Validation Errors:');
    coordinateFlowTest.validationErrors.forEach(error => console.log(`   - ${error}`));
  }
  
  // Final assessment
  const allTestsPassed = 
    coordinateFlowTest.socketConnected &&
    coordinateFlowTest.orderInspectionStartedReceived &&
    coordinateFlowTest.orderDetails &&
    coordinateFlowTest.coordinatesValid;
  
  console.log('\n🏆 Final Result:');
  if (allTestsPassed) {
    console.log('✅ ALL TESTS PASSED - Coordinate flow is working correctly!');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED - Coordinate flow has issues!');
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  socket.disconnect();
  endTest();
});

process.on('exit', (code) => {
  console.log(`\n🚪 Process exiting with code: ${code}`);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('\n⏰ Test timeout - ending test');
  coordinateFlowTest.validationErrors.push('Test timeout after 30 seconds');
  socket.disconnect();
  endTest();
}, 30000);