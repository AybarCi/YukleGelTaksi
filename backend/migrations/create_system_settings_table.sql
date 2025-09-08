-- Migration: Create system_settings table
-- Description: Create table to store system configuration settings like driver radius and max driver count
-- Date: 2024-12-20

-- Create system_settings table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'system_settings')
BEGIN
    CREATE TABLE system_settings (
        id INT IDENTITY(1,1) PRIMARY KEY,
        setting_key NVARCHAR(100) NOT NULL UNIQUE,
        setting_value NVARCHAR(500) NOT NULL,
        setting_type NVARCHAR(50) NOT NULL DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
        description NVARCHAR(500) NULL,
        category NVARCHAR(100) NOT NULL DEFAULT 'general',
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        created_by NVARCHAR(100) NULL,
        updated_by NVARCHAR(100) NULL
    );
    
    -- Create index on setting_key for faster lookups
    CREATE INDEX idx_system_settings_key ON system_settings(setting_key);
    CREATE INDEX idx_system_settings_category ON system_settings(category);
    
    PRINT 'system_settings table created successfully';
END
ELSE
BEGIN
    PRINT 'system_settings table already exists';
END
GO

-- Insert default system settings
IF NOT EXISTS (SELECT * FROM system_settings WHERE setting_key = 'driver_search_radius_km')
BEGIN
    INSERT INTO system_settings (setting_key, setting_value, setting_type, description, category, created_by)
    VALUES ('driver_search_radius_km', '5', 'number', 'Sürücü arama yarıçapı (kilometre)', 'driver_management', 'system');
END
GO

IF NOT EXISTS (SELECT * FROM system_settings WHERE setting_key = 'max_drivers_per_request')
BEGIN
    INSERT INTO system_settings (setting_key, setting_value, setting_type, description, category, created_by)
    VALUES ('max_drivers_per_request', '20', 'number', 'Bir istekte gösterilecek maksimum sürücü sayısı', 'driver_management', 'system');
END
GO

IF NOT EXISTS (SELECT * FROM system_settings WHERE setting_key = 'driver_location_update_interval_minutes')
BEGIN
    INSERT INTO system_settings (setting_key, setting_value, setting_type, description, category, created_by)
    VALUES ('driver_location_update_interval_minutes', '10', 'number', 'Sürücü konum güncellemesi için maksimum süre (dakika)', 'driver_management', 'system');
END
GO

IF NOT EXISTS (SELECT * FROM system_settings WHERE setting_key = 'customer_location_change_threshold_meters')
BEGIN
    INSERT INTO system_settings (setting_key, setting_value, setting_type, description, category, created_by)
    VALUES ('customer_location_change_threshold_meters', '100', 'number', 'Müşteri konum değişikliği eşiği (metre)', 'customer_management', 'system');
END
GO

IF NOT EXISTS (SELECT * FROM system_settings WHERE setting_key = 'driver_commission_rate')
BEGIN
    INSERT INTO system_settings (setting_key, setting_value, setting_type, description, category, created_by)
    VALUES ('driver_commission_rate', '15', 'number', 'Sürücü komisyon oranı (yüzde)', 'driver_management', 'system');
END
GO

-- labor_price_per_person ayarı kaldırıldı, artık pricing_settings tablosu kullanılıyor

PRINT 'Default system settings inserted successfully';
GO