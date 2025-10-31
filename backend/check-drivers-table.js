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

async function checkDriversTable() {
  try {
    const pool = await sql.connect(config);
    
    console.log('Drivers tablosu kolonları:');
    const columns = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'drivers'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.table(columns.recordset);
    
    // user_id kolonunun varlığını özellikle kontrol et
    const hasUserId = columns.recordset.some(col => col.COLUMN_NAME.toLowerCase() === 'user_id');
    console.log('\nuser_id kolonu var mı?', hasUserId ? 'EVET' : 'HAYIR');
    
    // Tablo içeriğini de kontrol et
    console.log('\nDrivers tablosundaki kayıt sayısı:');
    const count = await pool.request().query('SELECT COUNT(*) as total FROM drivers');
    console.log('Toplam kayıt:', count.recordset[0].total);
    
    await pool.close();
  } catch (error) {
    console.error('Hata:', error.message);
  }
}

checkDriversTable();