const axios = require('axios');

// Test konfigürasyonu
const config = {
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
};

const baseURL = 'http://localhost:3001';
const testPhoneNumber = '+905551234567';
const testCode = '123456'; // Genellikle test ortamında sabit kod kullanılır

async function testAuthAndOrders() {
  console.log('🚀 Auth ve Sipariş API test süiti başlatılıyor...');
  console.log('=' * 60);

  let authToken = null;

  // Test 1: SMS kodu gönderme
  console.log('\n📋 Test 1: SMS kodu gönderme');
  try {
    const response = await axios.post(
      `${baseURL}/api/auth/send-code`,
      { phoneNumber: testPhoneNumber },
      config
    );

    console.log('✅ SMS kodu gönderme başarılı!');
    console.log('📈 Status Code:', response.status);
    console.log('📝 Yanıt:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.log('❌ SMS kodu gönderme hatası:');
    console.log('📊 Status Code:', error.response?.status || 'N/A');
    console.log('📝 Hata mesajı:', error.response?.data || error.message);
  }

  console.log('\n' + '='.repeat(70));

  // Test 2: SMS kodu doğrulama
  console.log('\n📋 Test 2: SMS kodu doğrulama');
  try {
    const response = await axios.post(
      `${baseURL}/api/auth/verify-code`,
      { 
        phoneNumber: testPhoneNumber,
        code: testCode
      },
      config
    );

    console.log('✅ SMS kodu doğrulama başarılı!');
    console.log('📈 Status Code:', response.status);
    console.log('📝 Yanıt:', JSON.stringify(response.data, null, 2));

    // Token'ı kaydet
    if (response.data.data && response.data.data.token) {
      authToken = response.data.data.token;
      console.log('🔑 Auth token alındı:', authToken.substring(0, 20) + '...');
    }

  } catch (error) {
    console.log('❌ SMS kodu doğrulama hatası:');
    console.log('📊 Status Code:', error.response?.status || 'N/A');
    console.log('📝 Hata mesajı:', error.response?.data || error.message);
    
    // Test devam etsin diye mock token kullan
    console.log('⚠️  Mock token kullanılacak...');
    authToken = 'mock-token-for-testing';
  }

  console.log('\n' + '='.repeat(70));

  // Test 3: Sipariş oluşturma (token ile)
  if (authToken) {
    console.log('\n📋 Test 3: Sipariş oluşturma');
    const orderData = {
      pickup_address: 'Kadıköy, İstanbul',
      pickup_latitude: 40.9833,
      pickup_longitude: 29.0167,
      delivery_address: 'Beşiktaş, İstanbul',
      delivery_latitude: 41.0422,
      delivery_longitude: 29.0061,
      distance_km: 12.5,
      weight_kg: 20,
      labor_count: 1,
      cargo_photo_url: 'https://example.com/photo.jpg',
      payment_method: 'credit_card',
      notes: 'Dikkatli taşınması gereken eşyalar'
    };

    try {
      console.log('🧪 Sipariş oluşturma testi başlatılıyor...');
      console.log('📊 Test verileri:', JSON.stringify(orderData, null, 2));

      const response = await axios.post(
        `${baseURL}/api/orders`,
        orderData,
        {
          ...config,
          headers: {
            ...config.headers,
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      console.log('\n' + '='.repeat(50));
      console.log('✅ Sipariş oluşturma başarılı!');
      console.log('📈 Status Code:', response.status);
      console.log('📝 Yanıt:', JSON.stringify(response.data, null, 2));

      if (response.data.success && response.data.data) {
        console.log('✅ Sipariş başarıyla oluşturuldu');
        console.log(`🆔 Sipariş ID: ${response.data.data.id}`);
        if (response.data.data.total_price) {
          console.log(`💰 Toplam fiyat: ${response.data.data.total_price} TL`);
        }
      }

    } catch (error) {
      console.log('\n' + '='.repeat(50));
      console.log('❌ Sipariş oluşturma hatası:');
      console.log('📊 Status Code:', error.response?.status || 'N/A');
      console.log('📝 Hata mesajı:', error.response?.data || error.message);
    }

    console.log('\n' + '='.repeat(70));

    // Test 4: Siparişleri listeleme
    console.log('\n📋 Test 4: Siparişleri listeleme');
    try {
      const response = await axios.get(
        `${baseURL}/api/orders`,
        {
          ...config,
          headers: {
            ...config.headers,
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      console.log('✅ Sipariş listeleme başarılı');
      console.log('📈 Status Code:', response.status);
      console.log('📊 Sipariş sayısı:', response.data.data?.length || 0);
      
      if (response.data.data && response.data.data.length > 0) {
        console.log('📝 İlk sipariş özeti:');
        const firstOrder = response.data.data[0];
        console.log(`  - ID: ${firstOrder.id}`);
        console.log(`  - Durum: ${firstOrder.status}`);
        console.log(`  - Toplam: ${firstOrder.total_price} TL`);
      }

    } catch (error) {
      console.log('❌ Sipariş listeleme hatası:', error.response?.data || error.message);
    }

    console.log('\n' + '='.repeat(70));

    // Test 5: Geçersiz veri ile sipariş oluşturma
    console.log('\n📋 Test 5: Geçersiz veri testi');
    const invalidOrderData = {
      pickup_address: '', // Boş adres
      weight_kg: -5, // Negatif ağırlık
      labor_count: -1 // Negatif hammal sayısı
    };

    try {
      const response = await axios.post(
        `${baseURL}/api/orders`,
        invalidOrderData,
        {
          ...config,
          headers: {
            ...config.headers,
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      console.log('❌ Geçersiz veri kabul edildi (bu bir hata!)');
      console.log('📝 Yanıt:', response.data);

    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Geçersiz veri doğru şekilde reddedildi');
        console.log('📝 Hata mesajı:', error.response.data.error || error.response.data.message);
      } else {
        console.log('❌ Beklenmeyen hata:', error.response?.data || error.message);
      }
    }
  } else {
    console.log('\n❌ Auth token alınamadığı için sipariş testleri atlanıyor');
  }

  console.log('\n🏁 Tüm testler tamamlandı!');
}

// Test fonksiyonunu çalıştır
testAuthAndOrders().catch(console.error);