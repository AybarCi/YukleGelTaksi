const axios = require('axios');

// Test için örnek veriler
const testData = {
  distance_km: 15.5,
  weight_kg: 25.0,
  labor_count: 2
};

const baseURL = 'http://localhost:3001';

async function testCalculatePriceAPI() {
  try {
    console.log('🧪 Fiyat hesaplama API testi başlatılıyor...');
    console.log('📊 Test verileri:', testData);
    console.log('\n' + '='.repeat(50));

    // API'ye POST isteği gönder
    const response = await axios.post(`${baseURL}/api/calculate-price`, testData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ API yanıtı başarılı!');
    console.log('📈 Status Code:', response.status);
    console.log('💰 Hesaplanan fiyat detayları:');
    console.log(JSON.stringify(response.data, null, 2));

    // Yanıt yapısını kontrol et
    const { success, data } = response.data;
    
    if (success && data) {
      console.log('\n' + '='.repeat(50));
      console.log('🔍 Detaylı fiyat analizi:');
      console.log(`📍 Mesafe: ${data.distance_km} km`);
      console.log(`⚖️  Ağırlık: ${data.weight_kg} kg`);
      console.log(`👷 Hamal sayısı: ${data.labor_count}`);
      console.log(`💵 Temel fiyat: ${data.base_price} TL`);
      console.log(`🛣️  Mesafe fiyatı: ${data.distance_price} TL`);
      console.log(`📦 Ağırlık fiyatı: ${data.weight_price} TL`);
      console.log(`👷 Hamal fiyatı: ${data.labor_price} TL`);
      console.log(`💰 TOPLAM: ${data.total_price} TL`);
      
      // Hesaplama doğruluğunu kontrol et
      const expectedTotal = data.base_price + data.distance_price + 
                           data.weight_price + data.labor_price;
      
      if (Math.abs(expectedTotal - data.total_price) < 0.01) {
        console.log('✅ Fiyat hesaplaması doğru!');
      } else {
        console.log('❌ Fiyat hesaplamasında hata var!');
        console.log(`🔢 Beklenen: ${expectedTotal}, Hesaplanan: ${data.total_price}`);
      }
    } else {
      console.log('❌ API yanıtında fiyat verisi bulunamadı');
    }

  } catch (error) {
    console.error('❌ API test hatası:');
    
    if (error.response) {
      console.error('📊 Status Code:', error.response.status);
      console.error('📝 Hata mesajı:', error.response.data);
    } else if (error.request) {
      console.error('🌐 İstek gönderildi ama yanıt alınamadı');
      console.error('🔗 URL:', `${baseURL}/api/calculate-price`);
    } else {
      console.error('⚠️  İstek hazırlanırken hata:', error.message);
    }
  }
}

// Farklı senaryoları test et
async function runAllTests() {
  console.log('🚀 Fiyat hesaplama API test süiti başlatılıyor...\n');
  
  // Test 1: Normal sipariş
  console.log('📋 Test 1: Normal sipariş');
  await testCalculatePriceAPI();
  
  console.log('\n' + '='.repeat(70) + '\n');
  
  // Test 2: Hamal olmayan sipariş
  console.log('📋 Test 2: Hamal olmayan sipariş');
  const testData2 = {
    distance_km: 8.2,
    weight_kg: 12.5,
    labor_count: 0
  };
  
  try {
    const response = await axios.post(`${baseURL}/api/calculate-price`, testData2);
    if (response.data.data && response.data.data.total_price !== undefined) {
      console.log('✅ Hamal olmayan sipariş testi başarılı');
      console.log('💰 Toplam fiyat:', response.data.data.total_price, 'TL');
    } else {
      console.log('❌ Hamal olmayan sipariş testi başarısız: Fiyat verisi bulunamadı');
    }
  } catch (error) {
    console.error('❌ Hamal olmayan sipariş testi başarısız:', error.response?.data || error.message);
  }
  
  console.log('\n' + '='.repeat(70) + '\n');
  
  // Test 3: Geçersiz veri testi
  console.log('📋 Test 3: Geçersiz veri testi');
  const invalidData = {
    distance_km: -5, // Negatif değer
    weight_kg: 'abc', // String değer
    labor_count: 2
  };
  
  try {
    const response = await axios.post(`${baseURL}/api/calculate-price`, invalidData);
    console.log('❌ Geçersiz veri kabul edildi (bu bir hata!)');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Geçersiz veri doğru şekilde reddedildi');
      console.log('📝 Hata mesajı:', error.response.data.error);
    } else {
      console.error('❌ Beklenmeyen hata:', error.response?.data || error.message);
    }
  }
  
  console.log('\n🏁 Tüm testler tamamlandı!');
}

// Testleri çalıştır
runAllTests();