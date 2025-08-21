const sql = require('mssql');

const config = {
  server: 'localhost',
  user: 'sa',
  password: 'Ca090353--',
  database: 'yuklegeltaksidb',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function runMigration() {
  try {
    const pool = await sql.connect(config);
    
    console.log('Veritabanına bağlanıldı. Migration başlatılıyor...');
    
    // Check if columns already exist
    const checkColumns = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users' 
        AND COLUMN_NAME IN ('current_latitude', 'current_longitude', 'last_location_update')
    `);
    
    if (checkColumns.recordset.length > 0) {
      console.log('Konum alanları zaten mevcut:', checkColumns.recordset.map(r => r.COLUMN_NAME));
      return;
    }
    
    // Add location fields to users table
    await pool.request().query(`
      ALTER TABLE users 
      ADD current_latitude DECIMAL(10,8),
          current_longitude DECIMAL(11,8),
          last_location_update DATETIME2
    `);
    
    console.log('Konum alanları users tablosuna eklendi.');
    
    // Create indexes
    await pool.request().query(`
      CREATE INDEX IX_users_location ON users(current_latitude, current_longitude)
    `);
    
    await pool.request().query(`
      CREATE INDEX IX_users_last_location_update ON users(last_location_update)
    `);
    
    console.log('İndeksler oluşturuldu.');
    
    console.log('Migration başarıyla tamamlandı!');
    
  } catch (error) {
    console.error('Migration hatası:', error);
  } finally {
    await sql.close();
  }
}

runMigration();