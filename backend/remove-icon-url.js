const DatabaseConnection = require('./config/database.js');
const db = new DatabaseConnection();

async function runMigration() {
  try {
    await db.connect();
    console.log('Connected to database');
    
    // Check if column exists
    const checkResult = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'cargo_types' AND COLUMN_NAME = 'icon_url'
    `);
    
    if (checkResult.recordset.length > 0) {
      console.log('icon_url column exists, removing...');
      await db.query('ALTER TABLE cargo_types DROP COLUMN icon_url');
      console.log('icon_url column removed successfully');
    } else {
      console.log('icon_url column does not exist');
    }
    
    await db.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

runMigration();