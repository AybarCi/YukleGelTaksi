const axios = require('axios');

// Test konfigürasyonu
const config = {
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
};

const baseURL = 'http://localhost:3001';

// Test kullanıcısı için token (gerçek bir kullanıcı token'ı gerekli)
const testToken = 'test-token-here'; // Bu gerçek bir token olmalı

async function testOrdersAPI() {
  console.log('🚀 Sipariş API test süiti başlatılıyor...');
  console.log('=' * 60);

  // Test 1: Sipariş oluşturma
  console.log('\n📋 Test 1: Sipariş oluşturma');
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
          'Authorization': `Bearer ${testToken}`
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
      console.log(`💰 Toplam fiyat: ${response.data.data.total_price} TL`);
      return response.data.data.id; // Sonraki testler için sipariş ID'sini döndür
    } else {
      console.log('❌ Sipariş oluşturma yanıtında veri bulunamadı');
    }

  } catch (error) {
    console.log('\n' + '='.repeat(50));
    console.log('❌ Sipariş oluşturma hatası:');
    console.log('📊 Status Code:', error.response?.status || 'N/A');
    console.log('📝 Hata mesajı:', error.response?.data || error.message);
  }

  console.log('\n' + '='.repeat(70));

  // Test 2: Siparişleri listeleme
  console.log('\n📋 Test 2: Siparişleri listeleme');
  try {
    const response = await axios.get(
      `${baseURL}/api/orders`,
      {
        ...config,
        headers: {
          ...config.headers,
          'Authorization': `Bearer ${testToken}`
        }
      }
    );

    console.log('✅ Sipariş listeleme başarılı');
    console.log('📈 Status Code:', response.status);
    console.log('📊 Sipariş sayısı:', response.data.data?.length || 0);
    
    if (response.data.data && response.data.data.length > 0) {
      console.log('📝 İlk sipariş:', JSON.stringify(response.data.data[0], null, 2));
    }

  } catch (error) {
    console.log('❌ Sipariş listeleme hatası:', error.response?.data || error.message);
  }

  console.log('\n' + '='.repeat(70));

  // Test 3: Geçersiz veri ile sipariş oluşturma
  console.log('\n📋 Test 3: Geçersiz veri testi');
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
          'Authorization': `Bearer ${testToken}`
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

  console.log('\n🏁 Tüm testler tamamlandı!');
}

// Test fonksiyonunu çalıştır
testOrdersAPI().catch(console.error);