// Basit bir test için API endpoint'ini kullan
import fetch from 'node-fetch';

async function testDriverAPI() {
  try {
    // Test için bir token oluştur (gerçek bir kullanıcı token'ı gerekli)
    console.log('API endpoint test edilecek...');
    console.log('Not: Gerçek test için geçerli bir auth token gerekli.');
    
    // Backend'in çalışıp çalışmadığını kontrol et
    const healthResponse = await fetch('http://172.20.10.8:3001/api/health');
    if (healthResponse.ok) {
      console.log('✓ Backend API çalışıyor');
    } else {
      console.log('✗ Backend API yanıt vermiyor');
    }
    
  } catch (error) {
    console.error('API test hatası:', error.message);
  }
}

testDriverAPI();