const DatabaseConnection = require('./config/database.js');

async function checkOrderStatus() {
  try {
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();
    
    // Get the most recent orders to see their status flow
    const result = await pool.request()
      .query(`
        SELECT TOP 5 
          id, 
          order_status, 
          driver_id, 
          user_id,
          created_at,
          updated_at
        FROM orders 
        ORDER BY created_at DESC
      `);
    
    console.log('Son 5 siparişin durumu:');
    if (result.recordset && result.recordset.length > 0) {
      result.recordset.forEach(order => {
        console.log(`Order ${order.id}: status='${order.order_status}', driver_id=${order.driver_id}, user_id=${order.user_id}`);
      });
    }
    
    // Also check if there are any orders with the new statuses
    const newStatuses = await pool.request()
      .query(`
        SELECT id, order_status, driver_id, user_id, created_at 
        FROM orders 
        WHERE order_status IN ('customer_price_approved', 'customer_price_rejected', 'driver_going_to_pickup')
        ORDER BY created_at DESC
      `);
    
    console.log('\nYeni durumlarla olan siparişler:');
    if (newStatuses.recordset && newStatuses.recordset.length > 0) {
      newStatuses.recordset.forEach(order => {
        console.log(`Order ${order.id}: status='${order.order_status}', driver_id=${order.driver_id}, user_id=${order.user_id}`);
      });
    } else {
      console.log('Yeni durumlarda sipariş bulunamadı.');
    }
    
  } catch (error) {
    console.error('Hata:', error);
  }
}

checkOrderStatus();