const fs = require('fs');
const path = require('path');
const sql = require('mssql');

// Database configuration
const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Ca090353--',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'yuklegeltaksidb',
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

async function runMigration() {
  try {
    console.log('Connecting to database...');
    await sql.connect(config);
    console.log('Connected to database successfully.');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_profile_image_url_column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration: add_profile_image_url_column.sql');
    console.log('SQL:', migrationSQL);

    // Execute migration
    const result = await sql.query(migrationSQL);
    console.log('Migration completed successfully!');
    console.log('Result:', result);

  } catch (error) {
    console.error('Migration failed:', error);
    
    // Check if column already exists
    if (error.message && error.message.includes('already exists')) {
      console.log('Column already exists, migration skipped.');
    } else {
      process.exit(1);
    }
  } finally {
    await sql.close();
    console.log('Database connection closed.');
  }
}

runMigration();