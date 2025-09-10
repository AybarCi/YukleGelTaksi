-- Migration to remove cargo_photo_url column from orders table
-- This column is no longer needed as we now use cargo_photo_urls for multiple photos

-- Check if the column exists before dropping it
IF EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'orders' 
    AND COLUMN_NAME = 'cargo_photo_url'
)
BEGIN
    PRINT 'Dropping cargo_photo_url column from orders table...';
    
    ALTER TABLE orders 
    DROP COLUMN cargo_photo_url;
    
    PRINT 'cargo_photo_url column successfully removed from orders table';
END
ELSE
BEGIN
    PRINT 'cargo_photo_url column does not exist in orders table';
END
GO

-- Verify the column has been removed
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'orders' 
    AND COLUMN_NAME = 'cargo_photo_url'
)
BEGIN
    PRINT 'Verification: cargo_photo_url column successfully removed';
END
ELSE
BEGIN
    PRINT 'ERROR: cargo_photo_url column still exists';
END
GO