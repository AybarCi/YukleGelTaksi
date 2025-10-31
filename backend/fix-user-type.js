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

async function fixUserType() {
  try {
    const pool = await sql.connect(config);
    
    // Check if user_type column exists
    const checkColumn = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'user_type'
    `);
    
    if (checkColumn.recordset.length === 0) {
      console.log('user_type column not found, adding it...');
      
      // Add user_type column
      await pool.request().query(`
        ALTER TABLE users 
        ADD user_type NVARCHAR(20) DEFAULT 'customer' 
        CHECK (user_type IN ('customer', 'driver'))
      `);
      
      console.log('user_type column added successfully!');
    } else {
      console.log('user_type column already exists');
    }
    
    // Show current table structure
    const columns = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('Current users table structure:');
    console.table(columns.recordset);
    
    await pool.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

fixUserType();