-- Migration: Create driver_earnings table
-- Description: Create table to store driver earnings data
-- Date: 2024-12-20

-- Create driver_earnings table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'driver_earnings')
BEGIN
    CREATE TABLE driver_earnings (
        id INT IDENTITY(1,1) PRIMARY KEY,
        driver_id INT NOT NULL,
        trip_id INT NULL, -- Hangi seferden geldiği (NULL ise manuel eklenen kazanç)
        amount DECIMAL(10,2) NOT NULL, -- Kazanç miktarı
        commission_amount DECIMAL(10,2) DEFAULT 0, -- Komisyon miktarı
        net_amount DECIMAL(10,2) NOT NULL, -- Net kazanç (amount - commission_amount)
        earning_type NVARCHAR(50) NOT NULL DEFAULT 'trip', -- 'trip', 'bonus', 'adjustment'
        description NVARCHAR(500) NULL, -- Açıklama
        earning_date DATE NOT NULL, -- Kazanç tarihi
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
        FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL
    );
    
    -- Create indexes for better performance
    CREATE INDEX idx_driver_earnings_driver_id ON driver_earnings(driver_id);
    CREATE INDEX idx_driver_earnings_date ON driver_earnings(earning_date);
    CREATE INDEX idx_driver_earnings_trip_id ON driver_earnings(trip_id);
    CREATE INDEX idx_driver_earnings_type ON driver_earnings(earning_type);
    
    PRINT 'driver_earnings table created successfully';
END
ELSE
BEGIN
    PRINT 'driver_earnings table already exists';
END
GO

-- Insert sample earnings data for testing
IF EXISTS (SELECT * FROM drivers WHERE id = 1)
BEGIN
    -- Son 30 gün için örnek kazanç verileri
    DECLARE @i INT = 0;
    DECLARE @date DATE = DATEADD(DAY, -30, GETDATE());
    
    WHILE @i < 30
    BEGIN
        -- Her gün için rastgele kazanç ekle
        INSERT INTO driver_earnings (driver_id, amount, commission_amount, net_amount, earning_type, description, earning_date)
        VALUES (
            1, -- driver_id
            ROUND(RAND() * 500 + 100, 2), -- 100-600 TL arası rastgele kazanç
            ROUND((RAND() * 500 + 100) * 0.15, 2), -- %15 komisyon
            ROUND((RAND() * 500 + 100) * 0.85, 2), -- Net kazanç
            'trip',
            'Günlük sefer kazancı',
            @date
        );
        
        SET @i = @i + 1;
        SET @date = DATEADD(DAY, 1, @date);
    END
    
    PRINT 'Sample earnings data inserted for driver_id = 1';
END
GO