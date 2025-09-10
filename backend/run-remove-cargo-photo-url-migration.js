const DatabaseConnection = require('./config/database');
const fs = require('fs');
const path = require('path');

async function runRemoveCargoPhotoUrlMigration() {
  let db;
  
  try {
    console.log('🚀 Starting cargo_photo_url column removal migration...');
    
    // Database bağlantısı
    db = DatabaseConnection.getInstance();
    const pool = await db.connect();
    
    // Migration dosyasını oku
    const migrationPath = path.join(__dirname, 'migrations', 'remove_cargo_photo_url_column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded successfully');
    
    // SQL'i satırlara böl ve GO statement'larını işle
    const sqlBatches = migrationSQL.split(/\bGO\b/gi).filter(batch => batch.trim());
    
    console.log(`📊 Found ${sqlBatches.length} SQL batches to execute`);
    
    // Her batch'i ayrı ayrı çalıştır
    for (let i = 0; i < sqlBatches.length; i++) {
      const batch = sqlBatches[i].trim();
      if (batch) {
        console.log(`⚡ Executing batch ${i + 1}/${sqlBatches.length}`);
        const result = await pool.request().query(batch);
        
        // Print messages varsa göster
        if (result.output) {
          console.log(`📝 Output: ${result.output}`);
        }
      }
    }
    
    console.log('✅ Migration completed successfully!');
    
    // Sütunun gerçekten kaldırıldığını doğrula
    const verificationResult = await pool.request().query(`
      SELECT COUNT(*) as column_count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'orders' 
      AND COLUMN_NAME = 'cargo_photo_url'
    `);
    
    const columnExists = verificationResult.recordset[0].column_count > 0;
    
    if (!columnExists) {
      console.log('✅ Verification successful: cargo_photo_url column has been removed');
    } else {
      console.log('❌ Verification failed: cargo_photo_url column still exists');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (db) {
      await db.close();
      console.log('🔌 Database connection closed');
    }
  }
}

// Script'i çalıştır
runRemoveCargoPhotoUrlMigration();