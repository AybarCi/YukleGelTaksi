-- Migration: Add cargo_photo_urls column to orders table for multiple photos
-- Date: 2024-01-21
-- Description: Add cargo_photo_urls column to support multiple cargo photos

USE yuklegeltaksidb;
GO

-- Add cargo_photo_urls column to orders table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'cargo_photo_urls')
BEGIN
    ALTER TABLE orders ADD cargo_photo_urls NVARCHAR(MAX) NULL;
    PRINT 'cargo_photo_urls column added to orders table successfully';
END
ELSE
BEGIN
    PRINT 'cargo_photo_urls column already exists in orders table';
END
GO

-- Update existing records to move single photo URL to new format
UPDATE orders 
SET cargo_photo_urls = '["' + cargo_photo_url + '"]'
WHERE cargo_photo_url IS NOT NULL AND cargo_photo_urls IS NULL;
GO

PRINT 'Migration completed: cargo_photo_urls column added and existing data migrated';
GO