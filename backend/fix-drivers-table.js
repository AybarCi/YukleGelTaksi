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

async function fixDriversTable() {
  try {
    const pool = await sql.connect(config);
    
    // Check if drivers table exists
    const tableExists = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'drivers'
    `);
    
    if (tableExists.recordset.length === 0) {
      console.log('drivers table not found, creating it...');
      
      // Create drivers table with all required columns
      await pool.request().query(`
        CREATE TABLE drivers (
          id INT IDENTITY(1,1) PRIMARY KEY,
          user_id INT NOT NULL,
          license_number NVARCHAR(50) NOT NULL,
          tax_office NVARCHAR(100),
          license_expiry_date DATE,
          vehicle_type NVARCHAR(50),
          driver_photo NVARCHAR(255),
          license_photo NVARCHAR(255),
          vehicle_plate NVARCHAR(20),
          vehicle_model NVARCHAR(100),
          vehicle_year INT,
          is_verified BIT DEFAULT 0,
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE(),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);
      
      console.log('drivers table created successfully!');
    } else {
      console.log('drivers table exists, checking for missing columns...');
      
      // Get current columns
      const currentColumns = await pool.request().query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'drivers'
      `);
      
      const existingColumns = currentColumns.recordset.map(row => row.COLUMN_NAME.toLowerCase());
      
      // Define required columns
      const requiredColumns = [
        { name: 'tax_office', type: 'NVARCHAR(100)' },
        { name: 'license_expiry_date', type: 'DATE' },
        { name: 'vehicle_type', type: 'NVARCHAR(50)' },
        { name: 'driver_photo', type: 'NVARCHAR(255)' },
        { name: 'license_photo', type: 'NVARCHAR(255)' }
      ];
      
      // Add missing columns
      for (const column of requiredColumns) {
        if (!existingColumns.includes(column.name.toLowerCase())) {
          console.log(`Adding missing column: ${column.name}`);
          await pool.request().query(`
            ALTER TABLE drivers 
            ADD ${column.name} ${column.type}
          `);
        } else {
          console.log(`Column ${column.name} already exists`);
        }
      }
    }
    
    // Show current table structure
    const columns = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'drivers'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('Current drivers table structure:');
    console.table(columns.recordset);
    
    await pool.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

fixDriversTable();