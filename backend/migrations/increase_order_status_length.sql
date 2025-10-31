-- Migration to increase order_status column length
-- This allows for longer status names like 'customer_price_approved'

-- First, let's increase the column size to accommodate longer status names
ALTER TABLE orders
ALTER COLUMN order_status NVARCHAR(30) NOT NULL;

-- Verify the constraint still works with the new column size
-- (The CHECK constraint should automatically adapt to the new column size)

-- Test the new column size
-- SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'order_status';