const DatabaseConnection = require('./config/database');
const fs = require('fs');
const path = require('path');

async function runCargoTypesMigration() {
  const db = DatabaseConnection.getInstance();
  
  try {
    console.log('Connecting to database...');
    await db.connect();
    
    console.log('Reading cargo types migration...');
    const migrationPath = path.join(__dirname, 'migrations/create_cargo_types_table.sql');
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by GO statements (SQL Server batch separator)
    const batches = migrationContent.split(/\bGO\b/i).filter(batch => batch.trim());
    
    console.log(`Executing ${batches.length} SQL batches...`);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i].trim();
      if (batch) {
        try {
          console.log(`Executing batch ${i + 1}...`);
          await db.query(batch);
          console.log(`Batch ${i + 1} executed successfully`);
        } catch (error) {
          // Ignore errors like "already exists"
          if (error.message.includes('already exists') || 
              error.message.includes('There is already an object') ||
              error.message.includes('Cannot add duplicate key')) {
            console.log(`Batch ${i + 1} skipped (already exists)`);
          } else {
            console.error(`Error in batch ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
    }
    
    console.log('Cargo types migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await db.disconnect();
  }
}

// Run the migration
runCargoTypesMigration();