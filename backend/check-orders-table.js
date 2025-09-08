const sql = require('mssql');

const config = {
  server: 'localhost',
  port: 1433,
  database: 'yuklegeltaksidb',
  user: 'sa',
  password: 'Ca090353--',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function checkOrdersTable() {
  try {
    console.log('Veritabanına bağlanılıyor...');
    await sql.connect(config);
    
    // Check if orders table exists
    const tableCheck = await sql.query(`
      SELECT COUNT(*) as table_count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'orders'
    `);
    
    console.log('Orders tablosu var mı?', tableCheck.recordset[0].table_count > 0);
    
    if (tableCheck.recordset[0].table_count > 0) {
      // Get column names
      const columns = await sql.query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'orders' 
        ORDER BY ORDINAL_POSITION
      `);
      
      console.log('\nOrders tablosu kolonları:');
      columns.recordset.forEach(col => {
        console.log(`- ${col.COLUMN_NAME} (${col.DATA_TYPE}) ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
      
      // Check specifically for estimated_price and estimated_time_minutes
      const hasEstimatedPrice = columns.recordset.some(col => col.COLUMN_NAME === 'estimated_price');
      const hasEstimatedTime = columns.recordset.some(col => col.COLUMN_NAME === 'estimated_time_minutes');
      
      console.log('\nKritik kolonlar:');
      console.log('estimated_price var mı?', hasEstimatedPrice);
      console.log('estimated_time_minutes var mı?', hasEstimatedTime);
    }
    
    await sql.close();
  } catch (error) {
    console.error('Hata:', error.message);
  }
}

checkOrdersTable();