const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: 'yuklegeltaksidb',
  user: 'sa',
  password: 'Ca090353--',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function checkDriverLocation() {
  try {
    console.log('Veritabanına bağlanıyor...');
    await sql.connect(config);
    
    const result = await sql.query`
      SELECT 
        u.id as user_id,
        u.current_latitude,
        u.current_longitude,
        u.last_location_update,
        d.id as driver_id,
        d.current_latitude as driver_lat,
        d.current_longitude as driver_lng,
        d.last_location_update as driver_last_update
      FROM users u
      LEFT JOIN drivers d ON u.id = d.user_id
      WHERE u.id = 32
    `;
    
    console.log('\n🔍 Sürücü konum bilgileri (user_id: 32):');
    console.log('=====================================');
    
    if (result.recordset.length === 0) {
      console.log('❌ Sürücü bulunamadı!');
      return;
    }
    
    result.recordset.forEach(row => {
      console.log('👤 Users tablosu:');
      console.log('   - current_latitude:', row.current_latitude);
      console.log('   - current_longitude:', row.current_longitude);
      console.log('   - last_location_update:', row.last_location_update);
      console.log('');
      console.log('🚗 Drivers tablosu:');
      console.log('   - driver_id:', row.driver_id);
      console.log('   - current_latitude:', row.driver_lat);
      console.log('   - current_longitude:', row.driver_lng);
      console.log('   - last_location_update:', row.driver_last_update);
      
      // Konum bilgilerinin güncellenip güncellenmediğini kontrol et
      const hasUserLocation = row.current_latitude !== null && row.current_longitude !== null;
      const hasDriverLocation = row.driver_lat !== null && row.driver_lng !== null;
      
      console.log('\n📊 Durum:');
      console.log('   - Users tablosunda konum:', hasUserLocation ? '✅ VAR' : '❌ YOK');
      console.log('   - Drivers tablosunda konum:', hasDriverLocation ? '✅ VAR' : '❌ YOK');
      
      if (hasUserLocation || hasDriverLocation) {
        console.log('🎉 Konum güncelleme sistemi ÇALIŞIYOR!');
      } else {
        console.log('💥 Konum güncelleme sistemi ÇALIŞMIYOR!');
      }
    });
    
    await sql.close();
    console.log('\n✅ Veritabanı bağlantısı kapatıldı.');
    
  } catch (err) {
    console.error('❌ Hata:', err.message);
    process.exit(1);
  }
}

checkDriverLocation();