const DatabaseConnection = require('./config/database');

async function testOrderStatusFlow() {
  try {
    console.log('🧪 Testing Order Status Flow\n');
    
    const db = DatabaseConnection.getInstance();
    
    // Test 1: Check current order statuses
    console.log('📊 Current Order Status Distribution:');
    const statusStats = await db.query(`
      SELECT order_status, COUNT(*) as count 
      FROM orders 
      GROUP BY order_status 
      ORDER BY count DESC
    `);
    
    statusStats.forEach(stat => {
      console.log(`   ${stat.order_status || 'null/undefined'}: ${stat.count} orders`);
    });
    
    // Test 2: Check orders with new status types
    console.log('\n🔍 Orders with new status types:');
    const newStatuses = await db.query(`
      SELECT id, order_status, user_id, driver_id, created_at, updated_at 
      FROM orders 
      WHERE order_status IN ('customer_price_approved', 'customer_price_rejected', 'driver_going_to_pickup', 'accepted')
      ORDER BY updated_at DESC
    `);
    
    if (newStatuses.length === 0) {
      console.log('   No orders with new status types found.');
    } else {
      newStatuses.forEach(order => {
        console.log(`   Order #${order.id}: ${order.order_status} (Customer: ${order.user_id}, Driver: ${order.driver_id || 'None'})`);
      });
    }
    
    // Test 3: Check for orders that might be stuck in accepted state
    console.log('\n⚠️  Orders that might need attention:');
    const stuckOrders = await db.query(`
      SELECT id, order_status, user_id, driver_id, created_at, updated_at 
      FROM orders 
      WHERE order_status = 'accepted'
      ORDER BY updated_at DESC
    `);
    
    if (stuckOrders.length === 0) {
      console.log('   No stuck orders found.');
    } else {
      stuckOrders.forEach(order => {
        console.log(`   Order #${order.id}: ${order.order_status} (Updated: ${order.updated_at})`);
      });
    }
    
    // Test 4: Check recent order transitions
    console.log('\n🔄 Recent order status transitions:');
    const recentTransitions = await db.query(`
      SELECT TOP 10 id, order_status, user_id, driver_id, created_at, updated_at 
      FROM orders 
      WHERE updated_at > DATEADD(hour, -1, GETDATE())
      ORDER BY updated_at DESC
    `);
    
    recentTransitions.forEach(order => {
      console.log(`   Order #${order.id}: ${order.order_status} (Updated: ${order.updated_at})`);
    });
    
    console.log('\n✅ Order status flow test completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testOrderStatusFlow();