import DatabaseConnection from './config/database.ts';

async function truncateTables() {
  try {
    console.log('Veritabanı bağlantısı kuruluyor...');
    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();

    console.log('Drivers tablosu temizleniyor...');
    await pool.request().query('TRUNCATE TABLE drivers');
    console.log('✓ Drivers tablosu başarıyla temizlendi');

    console.log('Users tablosu temizleniyor...');
    await pool.request().query('TRUNCATE TABLE users');
    console.log('✓ Users tablosu başarıyla temizlendi');

    console.log('\n🎉 Tüm tablolar başarıyla temizlendi!');
    
  } catch (error) {
    console.error('❌ Hata oluştu:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

truncateTables();