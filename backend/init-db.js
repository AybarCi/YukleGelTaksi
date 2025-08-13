const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

async function initializeDatabase() {
  try {
    const dbPath = path.join(__dirname, 'database', 'yuklegeltaksi.db');
    const dbDir = path.dirname(dbPath);
    
    // Ensure database directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Open database connection
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Read and execute init.sql
    const initSqlPath = path.join(__dirname, 'database', 'init.sql');
    const initSql = fs.readFileSync(initSqlPath, 'utf8');
    
    // Split SQL statements and execute them
    const statements = initSql.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await db.exec(statement);
      }
    }

    console.log('Database initialized successfully!');
    await db.close();
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

initializeDatabase();