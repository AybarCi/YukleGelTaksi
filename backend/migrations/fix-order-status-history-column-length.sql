-- Migration: Fix order_status_history column length for new_status
-- Date: 2025-01-20
-- Description: Increase new_status column length to accommodate longer status names

USE yuklegeltaksidb;
GO

-- Check current column length
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'order_status_history' AND COLUMN_NAME IN ('old_status', 'new_status');
GO

-- Increase old_status column length from 20 to 50 characters
ALTER TABLE order_status_history
ALTER COLUMN old_status NVARCHAR(50) NULL;
GO

-- Increase new_status column length from 20 to 50 characters
ALTER TABLE order_status_history
ALTER COLUMN new_status NVARCHAR(50) NOT NULL;
GO

-- Verify the changes
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'order_status_history' AND COLUMN_NAME IN ('old_status', 'new_status');
GO

-- Test with the problematic status
PRINT 'Testing with driver_accepted_awaiting_customer status...';
INSERT INTO order_status_history (order_id, old_status, new_status, changed_by_driver_id, created_at)
VALUES (999, 'pending', 'driver_accepted_awaiting_customer', 28, DATEADD(hour, 3, GETDATE()));

PRINT '✅ Migration completed successfully! Column length increased to 50 characters.';
GO