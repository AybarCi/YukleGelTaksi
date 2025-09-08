-- pricing_settings tablosunu oluştur
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='pricing_settings' AND xtype='U')
BEGIN
    CREATE TABLE pricing_settings (
        id INT IDENTITY(1,1) PRIMARY KEY,
        base_price DECIMAL(10,2) NOT NULL DEFAULT 50.00,
        price_per_km DECIMAL(10,2) NOT NULL DEFAULT 5.00,
        price_per_kg DECIMAL(10,2) NOT NULL DEFAULT 2.00,
        labor_price DECIMAL(10,2) NOT NULL DEFAULT 800.00,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );
    
    -- Varsayılan değerleri ekle
    INSERT INTO pricing_settings (base_price, price_per_km, price_per_kg, labor_price)
    VALUES (50.00, 5.00, 2.00, 800.00);
    
    PRINT 'pricing_settings tablosu başarıyla oluşturuldu ve varsayılan değerler eklendi!';
END
ELSE
BEGIN
    PRINT 'pricing_settings tablosu zaten mevcut.';
END;