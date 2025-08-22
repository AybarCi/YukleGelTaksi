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
    encrypt: false, // Yerel geliştirme için false
    trustServerCertificate: true // Yerel geliştirme için true
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
    const migrationPath = path.join(__dirname, 'migrations', 'create_system_settings_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🔄 Running system settings migration...');
    
    // Split by GO statements and execute each batch
    const batches = migrationSQL.split(/\bGO\b/gi).filter(batch => batch.trim());
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i].trim();
      if (batch) {
        console.log(`🔄 Executing batch ${i + 1}/${batches.length}...`);
        await pool.request().query(batch);
      }
    }
    
    console.log('✅ System settings migration completed successfully!');
    
    // Verify the table was created and data was inserted
    const result = await pool.request().query('SELECT COUNT(*) as count FROM system_settings');
    console.log(`📊 System settings table contains ${result.recordset[0].count} records`);
    
    // Show current settings
    const settings = await pool.request().query('SELECT setting_key, setting_value, description FROM system_settings ORDER BY category, setting_key');
    console.log('\n📋 Current system settings:');
    settings.recordset.forEach(setting => {
      console.log(`  • ${setting.setting_key}: ${setting.setting_value} (${setting.description})`);
    });
    
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