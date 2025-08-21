-- Migration: Remove location fields from drivers table
-- Description: Remove current_latitude and current_longitude fields from drivers table
-- as location information is now managed in users table
-- Date: 2024-12-20

-- Drop the location index first
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_drivers_location')
DROP INDEX idx_drivers_location ON drivers;
GO

-- Remove current_latitude column
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_NAME = 'drivers' AND COLUMN_NAME = 'current_latitude')
BEGIN
    ALTER TABLE drivers DROP COLUMN current_latitude;
END
GO

-- Remove current_longitude column
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_NAME = 'drivers' AND COLUMN_NAME = 'current_longitude')
BEGIN
    ALTER TABLE drivers DROP COLUMN current_longitude;
END
GO

PRINT 'Location fields removed from drivers table successfully';
GO