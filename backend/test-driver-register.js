const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

// Test data for driver registration
const testDriverData = {
  tc_number: "12345678901",
  first_name: "Ahmet",
  last_name: "Yılmaz",
  phone_number: "+905551234567",
  email: "ahmet.yilmaz@example.com",
  tax_number: "1234567890",
  tax_office: "Kadıköy Vergi Dairesi",
  license_number: "ABC123456789",
  license_expiry_date: "2025-12-31",
  vehicle_type: "sedan",
  vehicle_plate: "34ABC123",
  vehicle_model: "Toyota Corolla",
  vehicle_color: "Beyaz",
  vehicle_year: 2020,
  driver_photo: "test-driver-photo.jpg",
  license_photo: "test-license-photo.jpg",
  eligibility_certificate: "test-certificate.pdf"
};

// Generate a proper JWT token for supervisor
const supervisorToken = jwt.sign(
  {
    supervisorId: 1,
    username: 'test_supervisor',
    role: 'supervisor'
  },
  process.env.JWT_SECRET || 'your-secret-key',
  { expiresIn: '10h' }
);

async function testDriverRegistration() {
  try {
    console.log('Testing driver registration API...');
    console.log('Test data:', JSON.stringify(testDriverData, null, 2));
    
    const response = await fetch('http://localhost:3001/api/drivers/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supervisorToken}`
      },
      body: JSON.stringify(testDriverData)
    });
    
    const responseText = await response.text();
    console.log('\nResponse Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    console.log('Response Body:', responseText);
    
    if (response.ok) {
      console.log('\n✅ Driver registration successful!');
      const data = JSON.parse(responseText);
      if (data.data) {
        console.log('Driver ID:', data.data.driverId);
        console.log('User ID:', data.data.userId);
      }
    } else {
      console.log('\n❌ Driver registration failed!');
      try {
        const errorData = JSON.parse(responseText);
        console.log('Error:', errorData.error || errorData.message);
      } catch (e) {
        console.log('Raw error response:', responseText);
      }
    }
    
  } catch (error) {
    console.error('\n💥 Test failed with error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('Make sure the backend server is running on http://localhost:3001');
    }
  }
}

// Run the test
testDriverRegistration();

// Also test with minimal required fields
async function testMinimalDriverRegistration() {
  const minimalData = {
    tc_number: "98765432109",
    first_name: "Mehmet",
    last_name: "Demir",
    phone_number: "+905559876543",
    license_number: "XYZ987654321",
    vehicle_plate: "34XYZ987",
    vehicle_model: "Renault Clio",
    vehicle_year: 2019,
    license_expiry_date: "2026-06-30",
    vehicle_type: "hatchback"
  };
  
  try {
    console.log('\n\n=== Testing minimal driver registration ===');
    console.log('Minimal data:', JSON.stringify(minimalData, null, 2));
    
    const response = await fetch('http://localhost:3001/api/drivers/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supervisorToken}`
      },
      body: JSON.stringify(minimalData)
    });
    
    const responseText = await response.text();
    console.log('\nMinimal Response Status:', response.status);
    console.log('Minimal Response Body:', responseText);
    
    if (response.ok) {
      console.log('\n✅ Minimal driver registration successful!');
    } else {
      console.log('\n❌ Minimal driver registration failed!');
    }
    
  } catch (error) {
    console.error('\n💥 Minimal test failed:', error.message);
  }
}

// Run minimal test after a delay
setTimeout(testMinimalDriverRegistration, 2000);