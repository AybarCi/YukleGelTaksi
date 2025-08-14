const sql = require('mssql');
require('dotenv').config({ path: '.env.local' });

const config = {
  server: process.env.DB_SERVER || 'localhost',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Ca090353--',
  database: process.env.DB_NAME || 'yuklegeltaksidb',
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function addApprovalColumn() {
  let pool;
  
  try {
    console.log('Azure SQL Edge veritabanına bağlanılıyor...');
    pool = await new sql.ConnectionPool(config).connect();
    console.log('Bağlantı başarılı!');

    // Check if is_approved column exists
    const checkColumnQuery = `
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'drivers' 
      AND COLUMN_NAME = 'is_approved'
    `;
    
    const result = await pool.request().query(checkColumnQuery);
    const columnExists = result.recordset[0].count > 0;
    
    if (columnExists) {
      console.log('is_approved sütunu zaten mevcut.');
      return;
    }

    console.log('drivers tablosuna is_approved sütunu ekleniyor...');
    
    // Add is_approved column
    const addColumnQuery = `
      ALTER TABLE drivers 
      ADD is_approved BIT NOT NULL DEFAULT 0
    `;
    
    await pool.request().query(addColumnQuery);
    console.log('is_approved sütunu başarıyla eklendi.');

    // Update existing drivers to be approved (if any)
    const updateQuery = `
      UPDATE drivers 
      SET is_approved = 1 
      WHERE is_approved = 0
    `;
    
    const updateResult = await pool.request().query(updateQuery);
    console.log(`${updateResult.rowsAffected[0]} sürücü onaylandı.`);
    
    console.log('Migration başarıyla tamamlandı!');
    
  } catch (error) {
    console.error('Migration hatası:', error);
    throw error;
  } finally {
    if (pool) {
      await pool.close();
      console.log('Veritabanı bağlantısı kapatıldı.');
    }
  }
}

// Run the migration
addApprovalColumn()
  .then(() => {
    console.log('Migration scripti tamamlandı.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration scripti başarısız:', error);
    process.exit(1);
  });