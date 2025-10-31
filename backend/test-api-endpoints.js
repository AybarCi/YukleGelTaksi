const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/admin/cargo-types';

async function testCargoTypesAPI() {
  try {
    console.log('Testing POST /api/admin/cargo-types...');
    
    // Test POST (Create)
    const postResponse = await axios.post(API_BASE_URL, {
      name: 'Test Cargo Type',
      description: 'Test description for cargo type',
      image_url: null,
      is_active: true,
      sort_order: 99
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // This might fail but let's see
      }
    });
    
    console.log('POST Response:', postResponse.data);
    
    // Test PUT (Update)
    if (postResponse.data && postResponse.data.id) {
      console.log('\nTesting PUT /api/admin/cargo-types...');
      
      const putResponse = await axios.put(`${API_BASE_URL}/${postResponse.data.id}`, {
        name: 'Updated Test Cargo Type',
        description: 'Updated description',
        image_url: null,
        is_active: true,
        sort_order: 100
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });
      
      console.log('PUT Response:', putResponse.data);
      
      // Clean up - DELETE
      console.log('\nCleaning up test data...');
      await axios.delete(`${API_BASE_URL}/${postResponse.data.id}`, {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      
      console.log('✅ All tests completed successfully!');
    }
    
  } catch (error) {
    console.error('❌ API test failed:', error.response ? error.response.data : error.message);
    
    // If it's an auth error, let's try without auth to see if the database operations work
    if (error.response && error.response.status === 401) {
      console.log('\nTrying without authentication to test database operations...');
      
      try {
        const postResponse = await axios.post(API_BASE_URL, {
          name: 'Test Cargo Type No Auth',
          description: 'Test description',
          image_url: null,
          is_active: true,
          sort_order: 99
        });
        
        console.log('POST Response (no auth):', postResponse.data);
      } catch (noAuthError) {
        console.log('No auth error:', noAuthError.response ? noAuthError.response.data : noAuthError.message);
      }
    }
  }
}

testCargoTypesAPI();