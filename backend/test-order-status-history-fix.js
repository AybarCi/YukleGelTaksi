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

async function testOrderStatusHistoryInsert() {
  try {
    console.log('🧪 Testing Order Status History Insert with Long Status Names\n');
    await sql.connect(config);
    
    // Test inserting the problematic status that was causing truncation
    console.log('📝 Testing insertion of driver_accepted_awaiting_customer status...');
    
    const result = await sql.query(`
      INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_driver_id, created_at)
      VALUES (2124, 'pending', 'driver_accepted_awaiting_customer', 28, DATEADD(hour, 3, GETDATE()));
      
      SELECT SCOPE_IDENTITY() as inserted_id;
    `);
    
    const insertedId = result.recordset[0].inserted_id;
    console.log(`✅ Successfully inserted record with ID: ${insertedId}`);
    
    // Verify the inserted data
    console.log('\n🔍 Verifying inserted data...');
    const verifyResult = await sql.query(`
      SELECT id, order_id, old_status, new_status, changed_by_driver_id, created_at
      FROM order_status_history 
      WHERE id = ${insertedId}
    `);
    
    const record = verifyResult.recordset[0];
    console.log('Inserted record details:');
    console.log(`- ID: ${record.id}`);
    console.log(`- Order ID: ${record.order_id}`);
    console.log(`- Old Status: ${record.old_status}`);
    console.log(`- New Status: ${record.new_status} (${record.new_status.length} characters)`);
    console.log(`- Driver ID: ${record.changed_by_driver_id}`);
    console.log(`- Created At: ${record.created_at}`);
    
    // Test other long status names
    console.log('\n📝 Testing other long status names...');
    const longStatuses = [
      'customer_price_approved',
      'customer_price_rejected',
      'driver_going_to_pickup',
      'driver_accepted_awaiting_customer'
    ];
    
    for (let i = 0; i < longStatuses.length; i++) {
      const status = longStatuses[i];
      const testResult = await sql.query(`
        INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_driver_id, created_at)
        VALUES (2125, 'pending', '${status}', 28, DATEADD(hour, 3, GETDATE()));
        
        SELECT SCOPE_IDENTITY() as inserted_id;
      `);
      
      console.log(`✅ Successfully inserted status: ${status} (${status.length} characters)`);
      
      // Clean up this test record
      await sql.query(`DELETE FROM order_status_history WHERE id = ${testResult.recordset[0].inserted_id}`);
    }
    
    // Clean up the main test record
    await sql.query(`DELETE FROM order_status_history WHERE id = ${insertedId}`);
    console.log('\n🧹 Test data cleaned up');
    
    console.log('\n🎉 All tests passed! The column length fix is working correctly.');
    
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    await sql.close();
  }
}

testOrderStatusHistoryInsert();