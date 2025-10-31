-- Migration: Remove icon_url column from cargo_types table
-- Date: 2024-01-01
-- Description: Remove icon_url column as we're using image_url instead

-- Remove icon_url column from cargo_types table if it exists
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'cargo_types' AND COLUMN_NAME = 'icon_url')
BEGIN
    ALTER TABLE cargo_types
    DROP COLUMN icon_url;
    
    PRINT 'icon_url column removed from cargo_types table successfully';
END
ELSE
BEGIN
    PRINT 'icon_url column does not exist in cargo_types table';
END