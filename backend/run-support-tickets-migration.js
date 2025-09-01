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
    const migrationPath = path.join(__dirname, 'migrations', 'create_support_tickets_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🔄 Running support tickets migration...');
    
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
    
    console.log('✅ Support tickets migration completed successfully!');
    
    // Verify the tables were created
    const tablesResult = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('support_tickets', 'support_ticket_attachments', 'support_ticket_comments')
    `);
    
    console.log('📊 Created tables:');
    tablesResult.recordset.forEach(table => {
      console.log(`  • ${table.TABLE_NAME}`);
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