const DatabaseConnection = require('./config/database.js');

async function testTriggerError() {
  const db = DatabaseConnection.getInstance();
  try {
    await db.connect();
    
    // Try a simple insert to reproduce the error
    console.log('Testing simple insert into cargo_types...');
    const result = await db.query(`
      INSERT INTO cargo_types (name, description, image_url, is_active, sort_order)
      OUTPUT INSERTED.*
      VALUES ('Test Cargo', 'Test description', NULL, 1, 0)
    `);
    
    console.log('Insert successful:', result.recordset[0]);
    
    // Clean up
    await db.query(`DELETE FROM cargo_types WHERE name = 'Test Cargo'`);
    console.log('Test record cleaned up');
    
    await db.disconnect();
  } catch (error) {
    console.error('Error occurred:', error.message);
    console.error('Error number:', error.number);
    console.error('Error state:', error.state);
    console.error('Full error object:', JSON.stringify(error, null, 2));
  }
}

testTriggerError();