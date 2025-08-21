-- Migration: Add location fields to users table
-- Date: 2024-01-20
-- Description: Add current_latitude, current_longitude, and last_location_update fields to users table

USE yuklegeltaksidb;
GO

-- Add location fields to users table
ALTER TABLE users 
ADD current_latitude DECIMAL(10,8),
    current_longitude DECIMAL(11,8),
    last_location_update DATETIME2;

GO

-- Create index for location-based queries
CREATE INDEX IX_users_location ON users(current_latitude, current_longitude);
CREATE INDEX IX_users_last_location_update ON users(last_location_update);

GO

PRINT 'User location fields migration completed successfully!';
GO