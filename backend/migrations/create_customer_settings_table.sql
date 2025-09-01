-- Migration: Create customer_settings table
-- Description: Create table to store customer notification, sound, vibration, marketing and location settings
-- Date: 2024-12-20

-- Create customer_settings table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'customer_settings')
BEGIN
    CREATE TABLE customer_settings (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        notifications_enabled BIT NOT NULL DEFAULT 1, -- Bildirimler açık/kapalı
        sound_enabled BIT NOT NULL DEFAULT 1, -- Ses açık/kapalı
        vibration_enabled BIT NOT NULL DEFAULT 1, -- Titreşim açık/kapalı
        marketing_enabled BIT NOT NULL DEFAULT 1, -- Pazarlama bildirimleri açık/kapalı
        location_enabled BIT NOT NULL DEFAULT 1, -- Konum izni açık/kapalı
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    
    -- Create index for better performance
    CREATE INDEX idx_customer_settings_user_id ON customer_settings(user_id);
    
    PRINT 'customer_settings table created successfully';
END
ELSE
BEGIN
    PRINT 'customer_settings table already exists';
END
GO

-- Insert default settings for existing customers
INSERT INTO customer_settings (user_id, notifications_enabled, sound_enabled, vibration_enabled, marketing_enabled, location_enabled)
SELECT 
    u.id,
    1, -- notifications_enabled default true
    1, -- sound_enabled default true
    1, -- vibration_enabled default true
    1, -- marketing_enabled default true
    1  -- location_enabled default true
FROM users u
WHERE u.user_type = 'customer'
AND NOT EXISTS (
    SELECT 1 FROM customer_settings cs WHERE cs.user_id = u.id
);

PRINT 'Default settings inserted for existing customers';
GO