const axios = require('axios');

async function testTripsAPI() {
  try {
    // Test the trips create API
    const authToken = Buffer.from(JSON.stringify({ userId: 1 })).toString('base64');
    
    const tripData = {
      pickupAddress: 'Test Pickup Address',
      pickupLatitude: 40.7128,
      pickupLongitude: -74.0060,
      destinationAddress: 'Test Destination Address',
      destinationLatitude: 40.7589,
      destinationLongitude: -73.9851,
      paymentMethod: 'cash'
    };

    console.log('Testing trips create API...');
    
    const response = await axios.post(process.env.API_BASE_URL ? `${process.env.API_BASE_URL}/trips/create` : 'http://localhost:3000/api/trips/create', tripData, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Trips API Response:', response.data);
    
    if (response.data.trip) {
      console.log('✅ Trips API working correctly - no trigger conflicts!');
      console.log('Trip ID:', response.data.trip.id);
      
      // Clean up - delete the test trip
      console.log('Cleaning up test trip...');
      await axios.delete(process.env.API_BASE_URL ? `${process.env.API_BASE_URL}/trips/${response.data.trip.id}` : `http://localhost:3000/api/trips/${response.data.trip.id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      console.log('✅ Test trip cleaned up');
    }
    
  } catch (error) {
    console.error('❌ Trips API test failed:', error.response?.data || error.message);
  }
}

testTripsAPI();