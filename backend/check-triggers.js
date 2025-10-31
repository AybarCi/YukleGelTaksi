const DatabaseConnection = require('./config/database.js');

async function checkTriggers() {
  const db = DatabaseConnection.getInstance();
  try {
    await db.connect();
    
    // Check all triggers
    const allTriggers = await db.query(`
      SELECT t.name AS trigger_name, 
             tb.name AS table_name,
             OBJECT_DEFINITION(t.object_id) AS trigger_definition
      FROM sys.triggers t
      JOIN sys.tables tb ON t.parent_id = tb.object_id
      ORDER BY tb.name, t.name
    `);
    
    console.log('All triggers in database:');
    if (allTriggers.recordset && allTriggers.recordset.length > 0) {
      allTriggers.recordset.forEach(row => {
        console.log(`${row.table_name}: ${row.trigger_name}`);
        if (row.trigger_definition && row.trigger_definition.includes('update_cargo_types_updated_at')) {
          console.log('  -> This is the cargo_types updated_at trigger!');
        }
      });
    } else {
      console.log('No triggers found in database');
    }
    
    // Also check if cargo_types table exists and has any triggers
    const cargoTypesTriggers = await db.query(`
      SELECT t.name AS trigger_name, 
             tb.name AS table_name
      FROM sys.triggers t
      JOIN sys.tables tb ON t.parent_id = tb.object_id
      WHERE tb.name = 'cargo_types'
    `);
    
    console.log('\nSpecifically checking cargo_types table:');
    if (cargoTypesTriggers.recordset && cargoTypesTriggers.recordset.length > 0) {
      cargoTypesTriggers.recordset.forEach(row => {
        console.log(`${row.table_name}: ${row.trigger_name}`);
      });
    } else {
      console.log('No triggers found for cargo_types table');
    }
    
    await db.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkTriggers();