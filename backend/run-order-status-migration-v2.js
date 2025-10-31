const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Database configuration
const config = {
  user: 'sa',
  password: 'Ca090353--',
  server: 'localhost',
  port: 1433,
  database: 'yuklegeltaksidb',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    requestTimeout: 30000,
    connectionTimeout: 30000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

async function runMigration() {
  let pool;
  
  try {
    console.log('🔄 Connecting to database...');
    pool = await sql.connect(config);
    console.log('✅ Connected to database');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', 'increase_order_status_length_v2.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🔄 Running migration to increase order_status column length...');
    
    // Execute migration
    await pool.request().query(migrationSQL);
    
    console.log('✅ Migration completed successfully');
    
    // Verify the change
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'order_status'
    `);
    
    console.log('📊 Column info after migration:', result.recordset[0]);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run migration
runMigration();