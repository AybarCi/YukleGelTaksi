const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'yuklegeltaksidb',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Ca090353--',
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function checkDriver28Location() {
  try {
    console.log('🔍 Driver 28 konum bilgilerini kontrol ediliyor...');
    await sql.connect(config);
    
    // Driver 28'in user_id'sini bul
    const driverResult = await sql.query`
      SELECT id, user_id, current_latitude, current_longitude, last_location_update, is_available
      FROM drivers 
      WHERE id = 28
    `;
    
    if (driverResult.recordset.length === 0) {
      console.log('❌ Driver 28 bulunamadı!');
      return;
    }
    
    const driver = driverResult.recordset[0];
    console.log('\n🚗 Driver 28 Bilgileri:');
    console.log('======================');
    console.log('Driver ID:', driver.id);
    console.log('User ID:', driver.user_id);
    console.log('Current Latitude (drivers):', driver.current_latitude);
    console.log('Current Longitude (drivers):', driver.current_longitude);
    console.log('Last Location Update (drivers):', driver.last_location_update);
    console.log('Is Available:', driver.is_available);
    
    // Users tablosundan da kontrol et
    const userResult = await sql.query`
      SELECT id, current_latitude, current_longitude, last_location_update
      FROM users 
      WHERE id = ${driver.user_id}
    `;
    
    if (userResult.recordset.length > 0) {
      const user = userResult.recordset[0];
      console.log('\n👤 User Bilgileri:');
      console.log('==================');
      console.log('User ID:', user.id);
      console.log('Current Latitude (users):', user.current_latitude);
      console.log('Current Longitude (users):', user.current_longitude);
      console.log('Last Location Update (users):', user.last_location_update);
    }
    
    // Durum analizi
    console.log('\n📊 Durum Analizi:');
    console.log('=================');
    const hasDriverLocation = driver.current_latitude !== null && driver.current_longitude !== null;
    const hasUserLocation = userResult.recordset.length > 0 && 
                           userResult.recordset[0].current_latitude !== null && 
                           userResult.recordset[0].current_longitude !== null;
    
    console.log('Drivers tablosunda konum:', hasDriverLocation ? '✅ VAR' : '❌ YOK');
    console.log('Users tablosunda konum:', hasUserLocation ? '✅ VAR' : '❌ YOK');
    
    if (hasDriverLocation && hasUserLocation) {
      console.log('🎉 Konum bilgileri her iki tabloda da mevcut!');
    } else if (hasDriverLocation || hasUserLocation) {
      console.log('⚠️ Konum bilgileri sadece bir tabloda mevcut!');
    } else {
      console.log('💥 Konum bilgileri hiçbir tabloda yok!');
    }
    
    await sql.close();
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
  }
}

checkDriver28Location();