-- orders tablosunu oluştur
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='orders' AND xtype='U')
BEGIN
    CREATE TABLE orders (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        driver_id INT,
        pickup_address NVARCHAR(MAX) NOT NULL,
        pickup_latitude DECIMAL(10, 8) NOT NULL,
        pickup_longitude DECIMAL(11, 8) NOT NULL,
        destination_address NVARCHAR(MAX) NOT NULL,
        destination_latitude DECIMAL(10, 8) NOT NULL,
        destination_longitude DECIMAL(11, 8) NOT NULL,
        distance_km DECIMAL(8, 2) NOT NULL,
        weight_kg DECIMAL(8, 2) NOT NULL,
        labor_count INT NOT NULL DEFAULT 0,
        cargo_photo_url NVARCHAR(255),
        base_price DECIMAL(10, 2) NOT NULL,
        distance_price DECIMAL(10, 2) NOT NULL,
        weight_price DECIMAL(10, 2) NOT NULL,
        labor_price DECIMAL(10, 2) NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        payment_method NVARCHAR(20) CHECK (payment_method IN ('cash', 'card', 'wallet')) NOT NULL DEFAULT 'cash',
        status NVARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'driver_accepted', 'customer_confirmed', 'in_progress', 'completed', 'cancelled')),
        customer_notes NVARCHAR(MAX),
        driver_notes NVARCHAR(MAX),
        cancel_reason NVARCHAR(MAX),
        created_at DATETIME2 DEFAULT GETDATE(),
        accepted_at DATETIME2,
        confirmed_at DATETIME2,
        started_at DATETIME2,
        completed_at DATETIME2,
        cancelled_at DATETIME2,
        updated_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
    );
    
    PRINT 'orders tablosu başarıyla oluşturuldu!';
END
ELSE
BEGIN
    PRINT 'orders tablosu zaten mevcut.';
END;