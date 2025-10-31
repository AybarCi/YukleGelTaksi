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

async function removePhoneNumberColumn() {
  try {
    const pool = await sql.connect(config);
    
    // Önce phone_number kolonunun var olup olmadığını kontrol et
    const columnCheck = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'drivers' AND COLUMN_NAME = 'phone_number'
    `);
    
    if (columnCheck.recordset.length > 0) {
      console.log('phone_number kolonu bulundu, kaldırılıyor...');
      
      // phone_number kolonunu kaldır
      await pool.request().query(`
        ALTER TABLE drivers 
        DROP COLUMN phone_number
      `);
      
      console.log('✅ phone_number kolonu başarıyla kaldırıldı');
    } else {
      console.log('phone_number kolonu zaten mevcut değil');
    }
    
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
  }
}

removePhoneNumberColumn();