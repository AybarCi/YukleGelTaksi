const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  user: 'sa',
  password: 'Ca090353--',
  database: 'yuklegeltaksidb',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function modifyPhoneNumberColumn() {
  try {
    const pool = await sql.connect(config);
    
    console.log('phone_number kolonunu NULL değer kabul edecek şekilde değiştiriyorum...');
    
    // phone_number kolonunu NULL değer kabul edecek şekilde değiştir
    await pool.request().query(`
      ALTER TABLE drivers 
      ALTER COLUMN phone_number NVARCHAR(20) NULL
    `);
    
    console.log('✅ phone_number kolonu başarıyla güncellendi (NULL değer kabul ediyor)');
    
    // Güncellenmiş tablo yapısını göster
    console.log('\nGüncellenmiş drivers tablosu kolonları:');
    const columns = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'drivers'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.table(columns.recordset);
    
    await pool.close();
  } catch (error) {
    console.error('Hata:', error.message);
  }
}

modifyPhoneNumberColumn();