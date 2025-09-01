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
    const migrationPath = path.join(__dirname, 'migrations', 'create_driver_settings_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🔄 Running driver settings migration...');
    
    // Split by GO statements and execute each batch
    const batches = migrationSQL.split(/\bGO\b/gi).filter(batch => batch.trim());
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i].trim();
      if (batch) {
        console.log(`🔄 Executing batch ${i + 1}/${batches.length}...`);
        try {
          await pool.request().query(batch);
        } catch (error) {
          // Skip if table already exists
          if (error.message.includes('already exists')) {
            console.log(`⚠️  Table already exists, skipping...`);
          } else {
            throw error;
          }
        }
      }
    }
    
    console.log('✅ Driver settings migration completed successfully!');
    
    // Verify the table was created
    const result = await pool.request().query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'driver_settings'
    `);
    
    if (result.recordset[0].count > 0) {
      console.log('📊 driver_settings table created successfully');
      
      // Check how many driver settings were created
      const settingsCount = await pool.request().query(`
        SELECT COUNT(*) as settings_count 
        FROM driver_settings
      `);
      
      console.log(`📋 Driver settings records: ${settingsCount.recordset[0].settings_count}`);
      
      // Show sample settings
      const sampleSettings = await pool.request().query(`
        SELECT TOP 3 ds.driver_id, ds.notifications_enabled, ds.sound_enabled, ds.vibration_enabled, ds.location_sharing_enabled
        FROM driver_settings ds
        ORDER BY ds.created_at DESC
      `);
      
      if (sampleSettings.recordset.length > 0) {
        console.log('\n📋 Sample driver settings:');
        sampleSettings.recordset.forEach(setting => {
          console.log(`  • Driver ${setting.driver_id}: Notifications=${setting.notifications_enabled}, Sound=${setting.sound_enabled}, Vibration=${setting.vibration_enabled}, Location=${setting.location_sharing_enabled}`);
        });
      }
    } else {
      console.log('❌ Table creation failed');
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