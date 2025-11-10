const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: 1433,
  database: 'yuklegeltaksidb',
  user: 'sa',
  password: 'Ca090353--',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function fixOrderStatusHistoryColumnLength() {
  try {
    console.log('🔧 Order Status History column length fix starting...\n');
    await sql.connect(config);
    
    // Check current column length
    console.log('📊 Checking current column lengths...');
    const currentColumns = await sql.query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'order_status_history' AND COLUMN_NAME IN ('old_status', 'new_status')
    `);
    
    console.log('Current column lengths:');
    currentColumns.recordset.forEach(col => {
      console.log(`- ${col.COLUMN_NAME}: ${col.CHARACTER_MAXIMUM_LENGTH} characters`);
    });
    
    // Increase old_status column length from 20 to 50 characters
    console.log('\n📏 Increasing old_status column length to 50 characters...');
    await sql.query(`
      ALTER TABLE order_status_history
      ALTER COLUMN old_status NVARCHAR(50) NULL
    `);
    console.log('✅ old_status column length increased');
    
    // Increase new_status column length from 20 to 50 characters
    console.log('\n📏 Increasing new_status column length to 50 characters...');
    await sql.query(`
      ALTER TABLE order_status_history
      ALTER COLUMN new_status NVARCHAR(50) NOT NULL
    `);
    console.log('✅ new_status column length increased');
    
    // Verify the changes
    console.log('\n🔍 Verifying changes...');
    const updatedColumns = await sql.query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'order_status_history' AND COLUMN_NAME IN ('old_status', 'new_status')
    `);
    
    console.log('Updated column lengths:');
    updatedColumns.recordset.forEach(col => {
      console.log(`- ${col.COLUMN_NAME}: ${col.CHARACTER_MAXIMUM_LENGTH} characters`);
    });
    
    // Test with the problematic status
    console.log('\n🧪 Testing with driver_accepted_awaiting_customer status...');
    await sql.query(`
      INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_driver_id, created_at)
      VALUES (999, 'pending', 'driver_accepted_awaiting_customer', 28, DATEADD(hour, 3, GETDATE()))
    `);
    console.log('✅ Test insert successful!');
    
    // Clean up test data
    await sql.query(`
      DELETE FROM order_status_history 
      WHERE order_id = 999 AND new_status = 'driver_accepted_awaiting_customer'
    `);
    console.log('🧹 Test data cleaned up');
    
    console.log('\n🎉 Migration completed successfully! Column length increased to 50 characters.');
    
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  } finally {
    await sql.close();
  }
}

fixOrderStatusHistoryColumnLength();