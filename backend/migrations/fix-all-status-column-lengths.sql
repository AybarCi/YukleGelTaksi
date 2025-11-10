-- Migration: Fix all status column lengths to prevent future truncation issues
-- Date: 2025-01-20
-- Description: Increase status column lengths across all tables to accommodate longer status names

USE yuklegeltaksidb;
GO

-- Check current column lengths
PRINT 'Checking current status column lengths...';
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE 
    (COLUMN_NAME LIKE '%status%' AND DATA_TYPE IN ('nvarchar', 'varchar'))
    OR (COLUMN_NAME IN ('old_status', 'new_status') AND TABLE_NAME = 'order_status_history')
ORDER BY TABLE_NAME, COLUMN_NAME;
GO

-- Fix customer_support_tickets.status column (20 -> 50)
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'customer_support_tickets' AND COLUMN_NAME = 'status' AND CHARACTER_MAXIMUM_LENGTH < 50)
BEGIN
    ALTER TABLE customer_support_tickets
    ALTER COLUMN status NVARCHAR(50) NOT NULL;
    PRINT '✅ customer_support_tickets.status column length increased to 50';
END
ELSE
BEGIN
    PRINT 'ℹ️ customer_support_tickets.status column already has sufficient length';
END
GO

-- Fix support_tickets.status column (20 -> 50)
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'support_tickets' AND COLUMN_NAME = 'status' AND CHARACTER_MAXIMUM_LENGTH < 50)
BEGIN
    ALTER TABLE support_tickets
    ALTER COLUMN status NVARCHAR(50) NOT NULL;
    PRINT '✅ support_tickets.status column length increased to 50';
END
ELSE
BEGIN
    PRINT 'ℹ️ support_tickets.status column already has sufficient length';
END
GO

-- Fix trips.trip_status column (20 -> 50)
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'trips' AND COLUMN_NAME = 'trip_status' AND CHARACTER_MAXIMUM_LENGTH < 50)
BEGIN
    ALTER TABLE trips
    ALTER COLUMN trip_status NVARCHAR(50) NOT NULL;
    PRINT '✅ trips.trip_status column length increased to 50';
END
ELSE
BEGIN
    PRINT 'ℹ️ trips.trip_status column already has sufficient length';
END
GO

-- Fix orders.status column (20 -> 50) - if it exists and needs fixing
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'status' AND CHARACTER_MAXIMUM_LENGTH < 50)
BEGIN
    ALTER TABLE orders
    ALTER COLUMN status NVARCHAR(50) NOT NULL;
    PRINT '✅ orders.status column length increased to 50';
END
ELSE
BEGIN
    PRINT 'ℹ️ orders.status column already has sufficient length or does not exist';
END
GO

-- Verify all changes
PRINT '\nVerifying updated column lengths...';
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE 
    (COLUMN_NAME LIKE '%status%' AND DATA_TYPE IN ('nvarchar', 'varchar'))
    OR (COLUMN_NAME IN ('old_status', 'new_status') AND TABLE_NAME = 'order_status_history')
ORDER BY TABLE_NAME, COLUMN_NAME;
GO

PRINT '\n🎉 All status column length fixes completed successfully!';