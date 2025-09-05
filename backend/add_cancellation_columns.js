const DatabaseConnection = require('./config/database.js');

async function addCancellationColumns() {
  try {
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();
    
    // Check if columns exist first
    const checkColumns = await pool.request()
      .query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'orders' 
        AND COLUMN_NAME IN ('cancellation_confirm_code', 'cancellation_fee')
      `);
    
    console.log('Existing cancellation columns:', checkColumns.recordset);
    
    // Add cancellation_confirm_code column if it doesn't exist
    if (!checkColumns.recordset.some(col => col.COLUMN_NAME === 'cancellation_confirm_code')) {
      await pool.request()
        .query('ALTER TABLE orders ADD cancellation_confirm_code VARCHAR(10) NULL');
      console.log('Added cancellation_confirm_code column');
    } else {
      console.log('cancellation_confirm_code column already exists');
    }
    
    // Add cancellation_fee column if it doesn't exist
    if (!checkColumns.recordset.some(col => col.COLUMN_NAME === 'cancellation_fee')) {
      await pool.request()
        .query('ALTER TABLE orders ADD cancellation_fee DECIMAL(10,2) DEFAULT 0');
      console.log('Added cancellation_fee column');
    } else {
      console.log('cancellation_fee column already exists');
    }
    
    console.log('Cancellation columns setup completed');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addCancellationColumns();