const DatabaseConnection = require('./config/database.js');

async function checkSchema() {
  const db = DatabaseConnection.getInstance();
  try {
    await db.connect();
    
    // Check if the trigger exists by name
    const result = await db.query(`
      SELECT name, object_id, type_desc 
      FROM sys.objects 
      WHERE name LIKE '%cargo%' AND type_desc = 'SQL_TRIGGER'
    `);
    
    console.log('Objects with cargo in name that are triggers:');
    if (result.recordset && result.recordset.length > 0) {
      result.recordset.forEach(row => {
        console.log(row.name + ' (' + row.type_desc + ')');
      });
    } else {
      console.log('No trigger objects found with cargo in name');
    }
    
    // Check all objects in the database
    const allObjects = await db.query(`
      SELECT name, type_desc 
      FROM sys.objects 
      WHERE type_desc = 'SQL_TRIGGER'
    `);
    
    console.log('All triggers in database:');
    if (allObjects.recordset && allObjects.recordset.length > 0) {
      allObjects.recordset.forEach(row => {
        console.log(row.name + ' (' + row.type_desc + ')');
      });
    } else {
      console.log('No triggers found in database');
    }
    
    await db.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkSchema();