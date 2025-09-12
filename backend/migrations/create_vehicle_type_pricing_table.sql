-- Migration: Create vehicle_type_pricing table for vehicle type based pricing
-- Date: 2024-01-21
-- Description: Create vehicle_type_pricing table to manage pricing per vehicle type

-- Create vehicle_type_pricing table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='vehicle_type_pricing' AND xtype='U')
BEGIN
    CREATE TABLE vehicle_type_pricing (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vehicle_type_id INT NOT NULL,
        base_price DECIMAL(10,2) NOT NULL DEFAULT 50.00,
        price_per_km DECIMAL(10,2) NOT NULL DEFAULT 5.00,
        labor_price DECIMAL(10,2) NOT NULL DEFAULT 25.00,
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        
        FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_types(id) ON DELETE CASCADE
    );
    
    -- Create indexes for better performance
    CREATE INDEX IX_vehicle_type_pricing_vehicle_type_id ON vehicle_type_pricing(vehicle_type_id);
    CREATE INDEX IX_vehicle_type_pricing_is_active ON vehicle_type_pricing(is_active);
    
    PRINT 'vehicle_type_pricing tablosu başarıyla oluşturuldu!';
END
ELSE
BEGIN
    PRINT 'vehicle_type_pricing tablosu zaten mevcut.';
END