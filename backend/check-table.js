const DatabaseConnection = require('./config/database.js');

async function checkTable() {
  const db = new DatabaseConnection();
  try {
    await db.connect();
    const result = await db.query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'cargo_types'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('Cargo Types Table Columns:');
    if (result && result.recordset && Array.isArray(result.recordset)) {
      result.recordset.forEach(col => {
        console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE}`);
      });
    } else {
      console.log('No columns found or invalid result structure');
      console.log('Result:', result);
    }
    
    await db.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTable();