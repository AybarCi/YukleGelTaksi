const sql = require('mssql');

const config = {
  server: 'localhost',
  port: 1433,
  database: 'yuklegeltaksidb',
  user: 'sa',
  password: 'YourStrong@Passw0rd',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function createPricingTable() {
  try {
    console.log('Veritabanına bağlanılıyor...');
    await sql.connect(config);
    
    const createTableQuery = `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='pricing_settings' AND xtype='U')
      BEGIN
        CREATE TABLE pricing_settings (
          id INT IDENTITY(1,1) PRIMARY KEY,
          base_price DECIMAL(10,2) NOT NULL DEFAULT 50.00,
          price_per_km DECIMAL(10,2) NOT NULL DEFAULT 5.00,
          price_per_kg DECIMAL(10,2) NOT NULL DEFAULT 2.00,
          labor_price DECIMAL(10,2) NOT NULL DEFAULT 25.00,
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE()
        );
        
        INSERT INTO pricing_settings (base_price, price_per_km, price_per_kg, labor_price)
        VALUES (50.00, 5.00, 2.00, 25.00);
        
        PRINT 'pricing_settings tablosu başarıyla oluşturuldu ve varsayılan değerler eklendi!';
      END
      ELSE
      BEGIN
        PRINT 'pricing_settings tablosu zaten mevcut.';
      END
    `;
    
    await sql.query(createTableQuery);
    console.log('İşlem tamamlandı!');
    
  } catch (err) {
    console.error('Hata:', err);
  } finally {
    await sql.close();
  }
}

createPricingTable();