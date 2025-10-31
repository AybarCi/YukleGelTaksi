const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: 1433,
  database: 'yuklegeltaksidb',
  user: 'sa',
  password: 'Ca090353--',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function runOrdersMigration() {
  try {
    console.log('Veritabanına bağlanılıyor...');
    await sql.connect(config);
    
    // Orders table creation
    console.log('Orders tablosu oluşturuluyor...');
    await sql.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='orders' AND xtype='U')
      BEGIN
          CREATE TABLE orders (
              id INT IDENTITY(1,1) PRIMARY KEY,
              user_id INT NOT NULL,
              driver_id INT NULL,
              pickup_address NVARCHAR(MAX) NOT NULL,
              pickup_latitude DECIMAL(10, 8) NOT NULL,
              pickup_longitude DECIMAL(11, 8) NOT NULL,
              destination_address NVARCHAR(MAX) NOT NULL,
              destination_latitude DECIMAL(10, 8) NOT NULL,
              destination_longitude DECIMAL(11, 8) NOT NULL,
              cargo_photo_url NVARCHAR(500) NOT NULL,
              notes NVARCHAR(MAX) NULL,
              distance_km DECIMAL(8, 2) NOT NULL,
              estimated_time_minutes INT NOT NULL,
              weight_kg DECIMAL(8, 2) DEFAULT 0,
              labor_required BIT DEFAULT 0,
              labor_count INT DEFAULT 0,
              estimated_price DECIMAL(10, 2) NOT NULL,
              final_price DECIMAL(10, 2) NULL,
              commission_rate DECIMAL(5, 2) DEFAULT 15.00,
              driver_earnings DECIMAL(10, 2) NULL,
              payment_method NVARCHAR(20) DEFAULT 'card',
              payment_status NVARCHAR(20) DEFAULT 'pending',
              order_status NVARCHAR(20) DEFAULT 'pending',
              created_at DATETIME2 DEFAULT GETDATE(),
              accepted_at DATETIME2 NULL,
              pickup_started_at DATETIME2 NULL,
              cargo_picked_at DATETIME2 NULL,
              delivery_started_at DATETIME2 NULL,
              delivered_at DATETIME2 NULL,
              completed_at DATETIME2 NULL,
              cancelled_at DATETIME2 NULL,
              cancel_reason NVARCHAR(MAX) NULL,
              updated_at DATETIME2 DEFAULT GETDATE()
          );
          PRINT 'orders table created successfully';
      END
      ELSE
      BEGIN
          PRINT 'orders table already exists';
      END
    `);
    
    // Order status history table
    console.log('Order status history tablosu oluşturuluyor...');
    await sql.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='order_status_history' AND xtype='U')
      BEGIN
          CREATE TABLE order_status_history (
              id INT IDENTITY(1,1) PRIMARY KEY,
              order_id INT NOT NULL,
              old_status NVARCHAR(20) NULL,
              new_status NVARCHAR(20) NOT NULL,
              changed_by_user_id INT NULL,
              changed_by_driver_id INT NULL,
              notes NVARCHAR(MAX) NULL,
              created_at DATETIME2 DEFAULT GETDATE()
          );
          PRINT 'order_status_history table created successfully';
      END
      ELSE
      BEGIN
          PRINT 'order_status_history table already exists';
      END
    `);
    
    console.log('✅ Orders migration completed successfully!');
    
  } catch (err) {
    console.error('❌ Migration error:', err);
  } finally {
    await sql.close();
  }
}

runOrdersMigration();