import sql from 'mssql';
import path from 'path';
import fs from 'fs';

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: sql.ConnectionPool | null = null;
  private config: sql.config;

  private constructor() {
    this.config = {
      server: process.env.DB_SERVER || '192.168.1.137',
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

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async connect(): Promise<sql.ConnectionPool> {
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

  private async initializeDatabase(): Promise<void> {
    if (!this.pool) return;
    
    try {
      // Read and execute the SQL schema file
      const schemaPath = path.join(process.cwd(), 'database', 'init.sql');
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        const statements = schema.split('GO').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
          const trimmedStatement = statement.trim();
          if (trimmedStatement && trimmedStatement.length > 0 && !trimmedStatement.startsWith('--')) {
            try {
              const request = this.pool.request();
              await request.query(trimmedStatement);
            } catch (statementError) {
              console.error('SQL Statement Error:', statementError);
              console.error('Problematic statement:', trimmedStatement);
              throw statementError;
            }
          }
        }
        console.log('Veritabanı şeması başarıyla oluşturuldu');
      }
    } catch (error) {
      console.error('Veritabanı şeması oluşturma hatası:', error);
    }
  }

  public async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      console.log('Veritabanı bağlantısı kapatıldı');
    }
  }

  // Helper method for running queries
  public async query(sqlQuery: string, params: any = {}): Promise<any> {
    const pool = await this.connect();
    const request = pool.request();
    
    // Add parameters to request
    Object.keys(params).forEach(key => {
      request.input(key, params[key]);
    });
    
    const result = await request.query(sqlQuery);
    return result.recordset;
  }

  // Helper method for running single queries
  public async get(sqlQuery: string, params: any = {}): Promise<any> {
    const pool = await this.connect();
    const request = pool.request();
    
    // Add parameters to request
    Object.keys(params).forEach(key => {
      request.input(key, params[key]);
    });
    
    const result = await request.query(sqlQuery);
    return result.recordset[0] || null;
  }

  // Helper method for running insert/update/delete
  public async run(sqlQuery: string, params: any = {}): Promise<any> {
    const pool = await this.connect();
    const request = pool.request();
    
    // Add parameters to request
    Object.keys(params).forEach(key => {
      request.input(key, params[key]);
    });
    
    const result = await request.query(sqlQuery);
    return result;
  }
}

export default DatabaseConnection;