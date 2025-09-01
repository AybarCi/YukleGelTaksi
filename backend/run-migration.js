const DatabaseConnection = require('./config/database.js');
const fs = require('fs');

(async () => {
  try {
    console.log('Connecting to database...');
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();
    
    console.log('Reading migration file...');
    const sql = fs.readFileSync('./migrations/create_customer_support_tickets_table.sql', 'utf8');
    
    console.log('Executing migration...');
    await pool.request().query(sql);
    
    console.log('✅ Migration executed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
})();