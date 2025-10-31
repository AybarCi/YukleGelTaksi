const DatabaseConnection = require('./config/database.js');

async function checkTriggerExists() {
  const db = DatabaseConnection.getInstance();
  try {
    await db.connect();
    
    // Check if the trigger exists
    const result = await db.query(`
      SELECT name, object_id, create_date, modify_date
      FROM sys.triggers
      WHERE name = 'update_cargo_types_updated_at'
    `);
    
    console.log('Trigger check result:', result);
    
    if (result.length > 0) {
      console.log('Trigger found:', result[0]);
    } else {
      console.log('Trigger not found');
    }
    
    // Also check all triggers
    const allTriggers = await db.query(`
      SELECT name, object_id, parent_id, create_date, modify_date
      FROM sys.triggers
      ORDER BY name
    `);
    
    console.log('All triggers:', allTriggers);
    
    await db.disconnect();
  } catch (error) {
    console.error('Error checking trigger:', error);
  }
}

checkTriggerExists();