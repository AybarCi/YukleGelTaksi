-- Migration: Add image_url column to vehicle_types table
-- Date: 2024-01-22
-- Description: Add image_url column to store vehicle type images

-- Add image_url column to vehicle_types table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'vehicle_types' AND COLUMN_NAME = 'image_url')
BEGIN
    ALTER TABLE vehicle_types
    ADD image_url NVARCHAR(500) NULL; -- URL path to vehicle type image
    
    PRINT 'image_url column added to vehicle_types table successfully';
END
ELSE
BEGIN
    PRINT 'image_url column already exists in vehicle_types table';
END
GO

-- Update existing vehicle types with default images if needed
-- These can be updated later through the admin interface
UPDATE vehicle_types 
SET image_url = '/uploads/vehicle-type-photos/default-' + LOWER(REPLACE(name, ' ', '-')) + '.png'
WHERE image_url IS NULL;

PRINT 'Default image URLs set for existing vehicle types';
GO