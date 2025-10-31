const DatabaseConnection = require('./config/database.js');

async function testFixedAPI() {
  const db = DatabaseConnection.getInstance();
  try {
    await db.connect();
    
    console.log('Testing INSERT without OUTPUT clause...');
    
    // Test the fixed INSERT method (without OUTPUT)
    const insertResult = await db.query(`
      INSERT INTO cargo_types (name, description, image_url, is_active, sort_order)
      VALUES ('Test Cargo Fixed', 'Test description', NULL, 1, 0)
    `);
    
    console.log('Insert result:', insertResult);
    
    // Get the inserted record
    const selectResult = await db.query(`
      SELECT * FROM cargo_types WHERE name = 'Test Cargo Fixed'
    `);
    
    console.log('Selected record:', selectResult[0]);
    
    // Test UPDATE
    console.log('\nTesting UPDATE without OUTPUT clause...');
    
    const updateResult = await db.query(`
      UPDATE cargo_types 
      SET description = 'Updated description'
      WHERE name = 'Test Cargo Fixed'
    `);
    
    console.log('Update result:', updateResult);
    
    // Get the updated record
    const updatedRecord = await db.query(`
      SELECT * FROM cargo_types WHERE name = 'Test Cargo Fixed'
    `);
    
    console.log('Updated record:', updatedRecord[0]);
    
    // Clean up
    await db.query(`DELETE FROM cargo_types WHERE name = 'Test Cargo Fixed'`);
    console.log('\nTest completed successfully!');
    
    await db.disconnect();
  } catch (error) {
    console.error('Error occurred:', error.message);
    console.error('Full error:', error);
  }
}

testFixedAPI();