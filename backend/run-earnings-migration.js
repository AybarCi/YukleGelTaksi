const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const config = {
  server: 'localhost',
  user: 'sa',
  password: 'Ca090353--',
  database: 'yuklegeltaksidb',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function runEarningsMigration() {
  try {
    console.log('Connecting to database...');
    const pool = await sql.connect(config);
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'create_driver_earnings_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by GO statements and execute each batch
    const batches = migrationSQL.split(/\bGO\b/gi).filter(batch => batch.trim());
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i].trim();
      if (batch) {
        console.log(`Executing batch ${i + 1}/${batches.length}...`);
        await pool.request().query(batch);
      }
    }
    
    console.log('Migration completed successfully!');
    
    // Verify table creation
    const result = await pool.request().query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'driver_earnings'
    `);
    
    if (result.recordset[0].count > 0) {
      console.log('✅ driver_earnings table created successfully');
      
      // Check sample data
      const sampleData = await pool.request().query(`
        SELECT COUNT(*) as earnings_count 
        FROM driver_earnings
      `);
      
      console.log(`📊 Sample earnings records: ${sampleData.recordset[0].earnings_count}`);
    } else {
      console.log('❌ Table creation failed');
    }
    
    await pool.close();
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

runEarningsMigration();