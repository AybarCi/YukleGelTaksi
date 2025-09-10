const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Database configuration
const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Ca090353--',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'yuklegeltaksidb',
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: false,
    trustServerCertificate: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

async function runMigration() {
  let pool;
  
  try {
    console.log('🔄 Connecting to database...');
    pool = await sql.connect(config);
    console.log('✅ Connected to database successfully');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_cargo_photos_column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🔄 Running cargo photos migration...');
    
    // Split by GO statements and execute each batch
    const batches = migrationSQL.split(/\bGO\b/gi).filter(batch => batch.trim());
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i].trim();
      if (batch) {
        console.log(`🔄 Executing batch ${i + 1}/${batches.length}...`);
        try {
          await pool.request().query(batch);
        } catch (error) {
          // Skip if column already exists
          if (error.message.includes('already exists')) {
            console.log(`⚠️  Column already exists, skipping...`);
          } else {
            throw error;
          }
        }
      }
    }
    
    console.log('✅ Cargo photos migration completed successfully!');
    
    // Verify the column was added
    const result = await pool.request().query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'cargo_photo_urls'
    `);
    
    if (result.recordset[0].count > 0) {
      console.log('✅ cargo_photo_urls column verified in orders table');
    } else {
      console.log('❌ cargo_photo_urls column not found in orders table');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.originalError) {
      console.error('Original error:', error.originalError.message);
    }
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the migration
runMigration();