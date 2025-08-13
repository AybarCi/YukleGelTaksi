import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

class SQLiteDatabaseConnection {
  private static instance: SQLiteDatabaseConnection;
  private db: Database | null = null;

  private constructor() {}

  public static getInstance(): SQLiteDatabaseConnection {
    if (!SQLiteDatabaseConnection.instance) {
      SQLiteDatabaseConnection.instance = new SQLiteDatabaseConnection();
    }
    return SQLiteDatabaseConnection.instance;
  }

  public async connect(): Promise<Database> {
    if (!this.db) {
      try {
        const dbPath = path.join(process.cwd(), 'database', 'yuklegeltaksi.db');
        this.db = await open({
          filename: dbPath,
          driver: sqlite3.Database
        });
        
        console.log('SQLite veritabanına başarıyla bağlanıldı');
      } catch (error) {
        console.error('SQLite veritabanı bağlantı hatası:', error);
        throw error;
      }
    }
    return this.db;
  }

  public async disconnect(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      console.log('SQLite veritabanı bağlantısı kapatıldı');
    }
  }

  public async query(sqlQuery: string, params: any[] = []): Promise<any> {
    const db = await this.connect();
    try {
      return await db.all(sqlQuery, params);
    } catch (error) {
      console.error('SQLite sorgu hatası:', error);
      throw error;
    }
  }

  public async get(sqlQuery: string, params: any[] = []): Promise<any> {
    const db = await this.connect();
    try {
      return await db.get(sqlQuery, params);
    } catch (error) {
      console.error('SQLite get hatası:', error);
      throw error;
    }
  }

  public async run(sqlQuery: string, params: any[] = []): Promise<any> {
    const db = await this.connect();
    try {
      return await db.run(sqlQuery, params);
    } catch (error) {
      console.error('SQLite run hatası:', error);
      throw error;
    }
  }
}

export default SQLiteDatabaseConnection;