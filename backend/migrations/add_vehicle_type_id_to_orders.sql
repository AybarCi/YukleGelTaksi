-- Migration: Add vehicle_type_id column to orders table
-- Date: 2024-01-22
-- Description: Add vehicle_type_id column to link orders with required vehicle types

-- Add vehicle_type_id column to orders table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'vehicle_type_id')
BEGIN
    ALTER TABLE orders
    ADD vehicle_type_id INT NULL; -- NULL to allow existing orders without vehicle type
    
    PRINT 'vehicle_type_id column added to orders table successfully';
END
ELSE
BEGIN
    PRINT 'vehicle_type_id column already exists in orders table';
END
GO

-- Add foreign key constraint to vehicle_types table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_NAME = 'FK_orders_vehicle_type_id')
BEGIN
    ALTER TABLE orders
    ADD CONSTRAINT FK_orders_vehicle_type_id 
    FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_types(id);
    
    PRINT 'Foreign key constraint added to orders.vehicle_type_id successfully';
END
ELSE
BEGIN
    PRINT 'Foreign key constraint already exists for orders.vehicle_type_id';
END
GO

-- Create index for better performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_orders_vehicle_type_id')
BEGIN
    CREATE INDEX IX_orders_vehicle_type_id ON orders(vehicle_type_id);
    PRINT 'Index created for orders.vehicle_type_id successfully';
END
ELSE
BEGIN
    PRINT 'Index already exists for orders.vehicle_type_id';
END
GO

PRINT 'Migration completed: vehicle_type_id column added to orders table';