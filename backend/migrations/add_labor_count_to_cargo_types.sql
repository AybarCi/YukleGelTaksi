-- Migration: Add labor_count to cargo_types table
-- Date: 2024-01-21
-- Description: Add labor_count field to cargo_types table for hammaliye management

-- Add labor_count column to cargo_types table
IF NOT EXISTS (SELECT * FROM syscolumns WHERE id = OBJECT_ID('cargo_types') AND name = 'labor_count')
BEGIN
    ALTER TABLE cargo_types
    ADD labor_count INT DEFAULT 0; -- Default 0 means no labor required
    
    PRINT 'labor_count column added to cargo_types table';
END
ELSE
BEGIN
    PRINT 'labor_count column already exists in cargo_types table';
END

-- Update existing cargo types with appropriate labor counts
UPDATE cargo_types 
SET labor_count = CASE 
    WHEN name = 'Mobilya' THEN 2
    WHEN name = 'Beyaz Eşya' THEN 2
    WHEN name = 'Koli/Paket' THEN 1
    WHEN name = 'Diğer' THEN 1
    ELSE 1
END
WHERE labor_count = 0;

PRINT 'Labor counts updated for existing cargo types';