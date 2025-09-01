// Import database connection
const sql = require('mssql');
const bcrypt = require('bcrypt');

// Database configuration (matching backend config)
const dbConfig = {
  server: process.env.DB_SERVER || 'localhost',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Ca090353--',
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

async function checkAndFixPassword() {
  try {
    console.log('Checking supervisor password...');
    
    const pool = await sql.connect(dbConfig);
    
    // Check current supervisor data
    const result = await pool.request()
      .query('SELECT id, username, password_hash FROM supervisors WHERE username = \'admin\'');
    
    const supervisor = result.recordset[0];
    
    if (!supervisor) {
      console.log('Admin supervisor not found!');
      return;
    }
    
    console.log('Current supervisor data:');
    console.log('ID:', supervisor.id);
    console.log('Username:', supervisor.username);
    console.log('Password Hash:', supervisor.password_hash || 'NULL');
    
    // If no password hash, create one for 'admin123'
    if (!supervisor.password_hash) {
      console.log('\nCreating password hash for admin123...');
      const passwordHash = await bcrypt.hash('admin123', 10);
      
      await pool.request()
        .input('passwordHash', passwordHash)
        .input('supervisorId', supervisor.id)
        .query('UPDATE supervisors SET password_hash = @passwordHash WHERE id = @supervisorId');
      
      console.log('Password hash created and updated!');
      console.log('You can now login with username: admin, password: admin123');
    } else {
      // Test the current password
      console.log('\nTesting password admin123...');
      const isValid = await bcrypt.compare('admin123', supervisor.password_hash);
      console.log('Password admin123 is valid:', isValid);
      
      if (!isValid) {
        console.log('\nUpdating password to admin123...');
        const passwordHash = await bcrypt.hash('admin123', 10);
        
        await pool.request()
          .input('passwordHash', passwordHash)
          .input('supervisorId', supervisor.id)
          .query('UPDATE supervisors SET password_hash = @passwordHash WHERE id = @supervisorId');
        
        console.log('Password updated to admin123!');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAndFixPassword();