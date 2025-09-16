-- Migration: Add vehicle_type_id column to drivers table
-- Date: 2024-01-22
-- Description: Add vehicle_type_id column to link drivers with vehicle types

-- Add vehicle_type_id column to drivers table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'drivers' AND COLUMN_NAME = 'vehicle_type_id')
BEGIN
    ALTER TABLE drivers
    ADD vehicle_type_id INT NULL; -- NULL to allow existing drivers without vehicle type
    
    PRINT 'vehicle_type_id column added to drivers table successfully';
END
ELSE
BEGIN
    PRINT 'vehicle_type_id column already exists in drivers table';
END
GO

-- Add foreign key constraint to vehicle_types table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_NAME = 'FK_drivers_vehicle_type_id')
BEGIN
    ALTER TABLE drivers
    ADD CONSTRAINT FK_drivers_vehicle_type_id 
    FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_types(id);
    
    PRINT 'Foreign key constraint added to drivers.vehicle_type_id successfully';
END
ELSE
BEGIN
    PRINT 'Foreign key constraint already exists for drivers.vehicle_type_id';
END
GO

-- Create index for better performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_drivers_vehicle_type_id')
BEGIN
    CREATE INDEX IX_drivers_vehicle_type_id ON drivers(vehicle_type_id);
    PRINT 'Index created for drivers.vehicle_type_id successfully';
END
ELSE
BEGIN
    PRINT 'Index already exists for drivers.vehicle_type_id';
END
GO

PRINT 'Migration completed: vehicle_type_id column added to drivers table';