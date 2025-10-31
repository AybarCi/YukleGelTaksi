const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: 1433,
  database: 'yuklegeltaksidb',
  user: 'sa',
  password: 'Ca090353--',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function addEstimatedColumns() {
  try {
    console.log('Veritabanına bağlanılıyor...');
    await sql.connect(config);
    
    console.log('estimated_price kolonu ekleniyor...');
    await sql.query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
                     WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'estimated_price')
      BEGIN
        ALTER TABLE orders ADD estimated_price DECIMAL(10,2) NULL;
        PRINT 'estimated_price kolonu eklendi';
      END
      ELSE
      BEGIN
        PRINT 'estimated_price kolonu zaten mevcut';
      END
    `);
    
    console.log('estimated_time_minutes kolonu ekleniyor...');
    await sql.query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
                     WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'estimated_time_minutes')
      BEGIN
        ALTER TABLE orders ADD estimated_time_minutes INT NULL;
        PRINT 'estimated_time_minutes kolonu eklendi';
      END
      ELSE
      BEGIN
        PRINT 'estimated_time_minutes kolonu zaten mevcut';
      END
    `);
    
    console.log('Mevcut siparişler için estimated değerler hesaplanıyor...');
    await sql.query(`
      UPDATE orders 
      SET estimated_price = total_price,
          estimated_time_minutes = CAST(distance_km * 3 AS INT)
      WHERE estimated_price IS NULL OR estimated_time_minutes IS NULL
    `);
    
    console.log('✅ Estimated kolonları başarıyla eklendi!');
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    await sql.close();
  }
}

addEstimatedColumns();