const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Database configuration
const config = {
  user: 'sa',
  password: 'YourStrong@Passw0rd',
  server: '192.168.1.12',
  database: 'YukleGelTaksi',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function runMigration() {
  try {
    console.log('🔄 Veritabanına bağlanılıyor...');
    await sql.connect(config);
    console.log('✅ Veritabanı bağlantısı başarılı');

    // Migration dosyasını oku
    const migrationPath = path.join(__dirname, 'migrations', 'add_image_url_to_vehicle_types.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔄 Migration çalıştırılıyor...');
    
    // SQL komutlarını ayır ve çalıştır
    const commands = migrationSQL.split('GO').filter(cmd => cmd.trim());
    
    for (const command of commands) {
      if (command.trim()) {
        await sql.query(command);
      }
    }

    console.log('✅ Migration başarıyla tamamlandı!');
    console.log('📝 vehicle_types tablosuna image_url kolonu eklendi');
    
  } catch (error) {
    console.error('❌ Migration hatası:', error);
  } finally {
    await sql.close();
    console.log('🔌 Veritabanı bağlantısı kapatıldı');
  }
}

runMigration();