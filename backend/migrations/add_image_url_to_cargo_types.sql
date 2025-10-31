-- Migration: Add image_url column to cargo_types table
-- Date: 2024-01-01
-- Description: Add image_url column to store cargo types images

-- Add image_url column to cargo_types table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'cargo_types' AND COLUMN_NAME = 'image_url')
BEGIN
    ALTER TABLE cargo_types
    ADD image_url NVARCHAR(500) NULL; -- URL path to cargo types image
    
    PRINT 'image_url column added to cargo_types table successfully';
END
ELSE
BEGIN
    PRINT 'image_url column already exists in cargo_types table';
END

-- Update existing records with default images
UPDATE cargo_types
SET image_url = '/uploads/cargo-type-photos/default-' + LOWER(REPLACE(name, ' ', '-')) + '.png'
WHERE image_url IS NULL;

PRINT 'Default images set for existing cargo types';