-- Migration: Create vehicle_types table for vehicle type management
-- Date: 2024-01-21
-- Description: Create vehicle_types table to manage different vehicle types in the system

-- Create vehicle_types table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='vehicle_types' AND xtype='U')
BEGIN
    CREATE TABLE vehicle_types (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL UNIQUE, -- Araç tipi adı (örn: Kamyonet, Kamyon, Minibüs)
        description NVARCHAR(500) NULL, -- Araç tipi açıklaması
        is_active BIT DEFAULT 1, -- Aktif/Pasif durumu
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );
    
    -- Create indexes for better performance
    CREATE INDEX IX_vehicle_types_name ON vehicle_types(name);
    CREATE INDEX IX_vehicle_types_is_active ON vehicle_types(is_active);
    
    -- Insert default vehicle types
    INSERT INTO vehicle_types (name, description, is_active) VALUES
    ('Kamyonet', 'Küçük yük taşımacılığı için uygun araç tipi', 1),
    ('Kamyon', 'Büyük yük taşımacılığı için uygun araç tipi', 1),
    ('Minibüs', 'Orta boy yük taşımacılığı için uygun araç tipi', 1),
    ('Pikap', 'Açık kasa yük taşımacılığı için uygun araç tipi', 1),
    ('Panelvan', 'Kapalı kasa yük taşımacılığı için uygun araç tipi', 1);
END