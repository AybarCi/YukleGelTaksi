const sql = require('mssql');
const path = require('path');
const fs = require('fs');

class DatabaseConnection {
  constructor() {
    this.pool = null;
    this.config = {
      server: process.env.DB_SERVER || '172.20.10.8',
      user: process.env.DB_USER || 'sa',
      password: process.env.DB_PASSWORD || 'Ca090353--',
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
  }

  static getInstance() {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  async connect() {
    if (!this.pool) {
      try {
        this.pool = await new sql.ConnectionPool(this.config).connect();
        
        // Initialize database with schema if needed
        await this.initializeDatabase();
        
        console.log('Azure SQL Edge veritabanına başarıyla bağlanıldı');
      } catch (error) {
        console.error('Veritabanı bağlantı hatası:', error);
        throw error;
      }
    }
    return this.pool;
  }

  async initializeDatabase() {
    try {
      const schemaPath = path.join(__dirname, '../database/init.sql');
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        // Split by GO statements only
        const batches = schema.split(/\bGO\b/i).filter(batch => batch.trim());
        
        for (const batch of batches) {
          const trimmedBatch = batch.trim();
          if (trimmedBatch) {
            try {
              await this.query(trimmedBatch);
            } catch (error) {
              // Ignore table already exists errors
              if (!error.message.includes('already exists')) {
                console.error('Schema initialization error:', error);
              }
            }
          }
        }
        console.log('Database schema initialized');
      }
    } catch (error) {
      console.error('Error initializing database:', error);
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      console.log('Veritabanı bağlantısı kapatıldı');
    }
  }

  async query(sqlQuery, params = {}) {
    try {
      const pool = await this.connect();
      const request = pool.request();
      
      // Add parameters to request
      Object.keys(params).forEach(key => {
        request.input(key, params[key]);
      });
      
      const result = await request.query(sqlQuery);
      return result.recordset;
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }

  async get(sqlQuery, params = {}) {
    try {
      const pool = await this.connect();
      const request = pool.request();
      
      // Add parameters to request
      Object.keys(params).forEach(key => {
        request.input(key, params[key]);
      });
      
      const result = await request.query(sqlQuery);
      return result.recordset[0] || null;
    } catch (error) {
      console.error('Get query error:', error);
      throw error;
    }
  }

  async run(sqlQuery, params = {}) {
    try {
      const pool = await this.connect();
      const request = pool.request();
      
      // Add parameters to request
      Object.keys(params).forEach(key => {
        request.input(key, params[key]);
      });
      
      const result = await request.query(sqlQuery);
      return result;
    } catch (error) {
      console.error('Run query error:', error);
      throw error;
    }
  }
}

module.exports = DatabaseConnection;