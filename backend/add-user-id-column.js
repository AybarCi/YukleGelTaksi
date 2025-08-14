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

async function addUserIdColumn() {
  try {
    const pool = await sql.connect(config);
    
    console.log('user_id kolonunu drivers tablosuna ekliyorum...');
    
    // user_id kolonunu ekle
    await pool.request().query(`
      ALTER TABLE drivers 
      ADD user_id INT
    `);
    
    console.log('✅ user_id kolonu başarıyla eklendi');
    
    // Foreign key constraint ekle
    console.log('Foreign key constraint ekliyorum...');
    await pool.request().query(`
      ALTER TABLE drivers 
      ADD CONSTRAINT FK_drivers_user_id 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    `);
    
    console.log('✅ Foreign key constraint başarıyla eklendi');
    
    // Güncellenmiş tablo yapısını göster
    console.log('\nGüncellenmiş drivers tablosu kolonları:');
    const columns = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'drivers'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.table(columns.recordset);
    
    await pool.close();
  } catch (error) {
    console.error('Hata:', error.message);
    if (error.message.includes('already exists')) {
      console.log('user_id kolonu zaten mevcut olabilir.');
    }
  }
}

addUserIdColumn();