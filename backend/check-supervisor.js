// Import database connection
const sql = require('mssql');

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
const jwt = require('jsonwebtoken');

async function checkSupervisorData() {
  try {
    console.log('Checking supervisor data...');
    
    const pool = await sql.connect(dbConfig);
    
    // Check supervisors table
    console.log('\n=== Supervisors Table ===');
    const supervisorsResult = await pool.request()
      .query('SELECT * FROM supervisors');
    
    console.log('Supervisors found:', supervisorsResult.recordset.length);
    supervisorsResult.recordset.forEach(supervisor => {
      console.log(`ID: ${supervisor.id}, Username: ${supervisor.username}, Active: ${supervisor.is_active}`);
    });
    
    // Check supervisor_sessions table
    console.log('\n=== Supervisor Sessions Table ===');
    try {
      const sessionsResult = await pool.request()
        .query('SELECT * FROM supervisor_sessions');
      
      console.log('Sessions found:', sessionsResult.recordset.length);
      sessionsResult.recordset.forEach(session => {
        console.log(`Supervisor ID: ${session.supervisor_id}, Expires: ${session.expires_at}`);
      });
    } catch (sessionError) {
      console.log('supervisor_sessions table might not exist:', sessionError.message);
    }
    
    // Create a test supervisor if none exists
    if (supervisorsResult.recordset.length === 0) {
      console.log('\n=== Creating Test Supervisor ===');
      const insertResult = await pool.request()
        .input('username', 'test_supervisor')
        .input('email', 'test@example.com')
        .input('firstName', 'Test')
        .input('lastName', 'Supervisor')
        .input('role', 'supervisor')
        .input('isActive', 1)
        .query(`
          INSERT INTO supervisors (username, email, first_name, last_name, role, is_active, created_at)
          OUTPUT INSERTED.id
          VALUES (@username, @email, @firstName, @lastName, @role, @isActive, GETDATE())
        `);
      
      const newSupervisorId = insertResult.recordset[0].id;
      console.log('Created supervisor with ID:', newSupervisorId);
      
      // Generate token for the new supervisor
      const token = jwt.sign(
        {
          supervisorId: newSupervisorId,
          username: 'test_supervisor',
          role: 'supervisor'
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '10h' }
      );
      
      console.log('\n=== Generated Token ===');
      console.log(token);
      
      // Create session if supervisor_sessions table exists
      try {
        await pool.request()
          .input('supervisorId', newSupervisorId)
          .input('token', token)
          .input('expiresAt', new Date(Date.now() + 10 * 60 * 60 * 1000)) // 10 hours
          .query(`
            INSERT INTO supervisor_sessions (supervisor_id, token, expires_at, created_at)
            VALUES (@supervisorId, @token, @expiresAt, GETDATE())
          `);
        console.log('Session created successfully');
      } catch (sessionError) {
        console.log('Could not create session (table might not exist):', sessionError.message);
      }
    } else {
      // Generate token for existing supervisor
      const supervisor = supervisorsResult.recordset[0];
      const token = jwt.sign(
        {
          supervisorId: supervisor.id,
          username: supervisor.username,
          role: supervisor.role
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '10h' }
      );
      
      console.log('\n=== Generated Token for Existing Supervisor ===');
      console.log(token);
    }
    
  } catch (error) {
    console.error('Error checking supervisor data:', error);
  }
}

checkSupervisorData();