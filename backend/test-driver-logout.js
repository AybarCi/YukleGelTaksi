const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const readline = require('readline');

// Test sürücü verisi (özel test numarası)
const testDriverData = {
  phone: '5069384413',
  user_type: 'driver'
};

const API_BASE_URL = 'http://192.168.1.14:3000/api';

// Readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function testDriverLogoutFlow() {
  console.log('=== Sürücü Logout Akışı Testi ===\n');
  
  try {
    // 1. SMS Kodu Gönder
    console.log('1. SMS kodu gönderiliyor...');
    const smsResponse = await fetch(`${API_BASE_URL}/auth/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: testDriverData.phone
      })
    });
    
    const smsResult = await smsResponse.json();
    console.log('SMS Response:', smsResult);
    
    if (!smsResponse.ok) {
      console.error('SMS gönderme başarısız:', smsResult);
      rl.close();
      return;
    }
    
    // Konsol çıktısından kodu al
    console.log('\n⚠️  Backend konsolunda SMS kodu görünecek. Lütfen kodu girin:');
    const code = await askQuestion('SMS Kodu: ');
    
    if (!code || code.length !== 6) {
      console.error('Geçersiz kod formatı!');
      rl.close();
      return;
    }
    
    // 2. SMS Kodu Doğrula ve Giriş Yap
    console.log('\n2. SMS kodu doğrulanıyor ve giriş yapılıyor...');
    const verifyResponse = await fetch(`${API_BASE_URL}/auth/verify-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: testDriverData.phone,
        code: code,
        user_type: testDriverData.user_type
      })
    });
    
    const verifyResult = await verifyResponse.json();
    console.log('Verify Response:', verifyResult);
    
    if (!verifyResponse.ok) {
      console.error('SMS doğrulama başarısız:', verifyResult);
      return;
    }
    
    const { token, refresh_token } = verifyResult.data;
    console.log('\nGiriş başarılı! Token alındı.');
    console.log('Token:', token.substring(0, 50) + '...');
    
    // 3. Sürücü Durumunu Kontrol Et
    console.log('\n3. Sürücü durumu kontrol ediliyor...');
    const statusResponse = await fetch(`${API_BASE_URL}/drivers/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const statusResult = await statusResponse.json();
    console.log('Driver Status Response:', statusResult);
    
    // 4. Token Geçerliliğini Test Et
    console.log('\n4. Token geçerliliği test ediliyor...');
    const profileResponse = await fetch(`${API_BASE_URL}/users/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const profileResult = await profileResponse.json();
    console.log('Profile Response:', profileResult);
    
    // 5. Logout Simülasyonu (Frontend'de token'ları temizleme)
    console.log('\n5. Logout simülasyonu yapılıyor...');
    console.log('- Token ve refresh token temizlendi (frontend simülasyonu)');
    console.log('- Kullanıcı çıkış yaptı');
    
    // 6. Logout Sonrası Tekrar Giriş Testi
    console.log('\n6. Logout sonrası tekrar giriş testi...');
    
    // SMS tekrar gönder
    const smsResponse2 = await fetch(`${API_BASE_URL}/auth/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: testDriverData.phone
      })
    });
    
    const smsResult2 = await smsResponse2.json();
    console.log('SMS Response (2nd time):', smsResult2);
    
    // İkinci SMS için yeni kod al
    console.log('\n⚠️  İkinci SMS kodu için backend konsolunu kontrol edin:');
    const code2 = await askQuestion('İkinci SMS Kodu: ');
    
    if (!code2 || code2.length !== 6) {
      console.error('Geçersiz kod formatı!');
      rl.close();
      return;
    }
    
    // SMS doğrula ve tekrar giriş yap
    const verifyResponse2 = await fetch(`${API_BASE_URL}/auth/verify-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: testDriverData.phone,
        code: code2,
        user_type: testDriverData.user_type
      })
    });
    
    const verifyResult2 = await verifyResponse2.json();
    console.log('Verify Response (2nd time):', verifyResult2);
    
    if (verifyResponse2.ok) {
      const { token: newToken } = verifyResult2.data;
      console.log('\nTekrar giriş başarılı! Yeni token alındı.');
      console.log('New Token:', newToken.substring(0, 50) + '...');
      
      // Yeni token ile sürücü durumunu kontrol et
      const statusResponse2 = await fetch(`${API_BASE_URL}/drivers/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${newToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const statusResult2 = await statusResponse2.json();
      console.log('Driver Status Response (2nd time):', statusResult2);
      
      console.log('\n✅ Sürücü logout sonrası tekrar giriş akışı başarıyla test edildi!');
    } else {
      console.error('❌ Tekrar giriş başarısız:', verifyResult2);
    }
    
  } catch (error) {
    console.error('❌ Test sırasında hata oluştu:', error);
  } finally {
    rl.close();
  }
}

// Test'i çalıştır
testDriverLogoutFlow();