const DatabaseConnection = require('./config/database.js');

async function checkOrder() {
  try {
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();
    
    const result = await pool.request()
      .input('orderId', 1)
      .query('SELECT id, order_status, user_id, created_at FROM orders WHERE id = @orderId');
    
    console.log('Order details:');
    console.log(result.recordset);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkOrder();