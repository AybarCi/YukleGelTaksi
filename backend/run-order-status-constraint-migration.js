const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const config = {
    user: 'sa',
    password: 'Ca090353--',
    server: '192.168.1.13',
    database: 'yuklegeltaksidb',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function runMigration() {
    try {
        console.log('🔄 Connecting to database...');
        await sql.connect(config);
        
        console.log('📄 Reading migration file...');
        const migrationPath = path.join(__dirname, 'migrations', 'update_order_status_constraint.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('🚀 Running CHECK constraint migration...');
        
        // Split by GO statements and execute each batch
        const batches = migrationSQL.split(/\bGO\b/i).filter(batch => batch.trim());
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i].trim();
            if (batch) {
                console.log(`📋 Executing batch ${i + 1}/${batches.length}...`);
                await sql.query(batch);
            }
        }
        
        console.log('✅ CHECK constraint migration completed successfully!');
        
        // Verify the constraint exists
        console.log('🔍 Verifying constraint...');
        const result = await sql.query(`
            SELECT name, definition 
            FROM sys.check_constraints 
            WHERE OBJECT_NAME(parent_object_id) = 'orders' 
              AND name LIKE '%order_status%'
        `);
        
        if (result.recordset.length > 0) {
            console.log('✅ Constraint verified:', result.recordset[0]);
        } else {
            console.log('❌ Constraint not found after migration');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await sql.close();
    }
}

runMigration();