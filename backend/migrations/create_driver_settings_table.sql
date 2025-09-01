-- Migration: Create driver_settings table
-- Description: Create table to store driver notification, sound and vibration settings
-- Date: 2024-12-20

-- Create driver_settings table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'driver_settings')
BEGIN
    CREATE TABLE driver_settings (
        id INT IDENTITY(1,1) PRIMARY KEY,
        driver_id INT NOT NULL UNIQUE,
        notifications_enabled BIT NOT NULL DEFAULT 1, -- Bildirimler açık/kapalı
        sound_enabled BIT NOT NULL DEFAULT 1, -- Ses açık/kapalı
        vibration_enabled BIT NOT NULL DEFAULT 1, -- Titreşim açık/kapalı
        location_sharing_enabled BIT NOT NULL DEFAULT 1, -- Konum paylaşımı açık/kapalı
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
    );
    
    -- Create index for better performance
    CREATE INDEX idx_driver_settings_driver_id ON driver_settings(driver_id);
    
    PRINT 'driver_settings table created successfully';
END
ELSE
BEGIN
    PRINT 'driver_settings table already exists';
END
GO

-- Insert default settings for existing drivers
INSERT INTO driver_settings (driver_id, notifications_enabled, sound_enabled, vibration_enabled, location_sharing_enabled)
SELECT 
    d.id,
    1, -- notifications_enabled default true
    1, -- sound_enabled default true
    1, -- vibration_enabled default true
    1  -- location_sharing_enabled default true
FROM drivers d
WHERE NOT EXISTS (
    SELECT 1 FROM driver_settings ds WHERE ds.driver_id = d.id
);

PRINT 'Default settings inserted for existing drivers';
GO