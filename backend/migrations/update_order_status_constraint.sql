-- Migration: Update order_status CHECK constraint to include new status values
-- Date: 2024-12-19
-- Description: Add new status values for price approval and navigation states

USE yuklegeltaksidb;
GO

-- Drop existing CHECK constraint first (we need to find the constraint name)
-- Note: The constraint name might be different, so we need to check sys.check_constraints
DECLARE @constraintName NVARCHAR(200);
SELECT @constraintName = name 
FROM sys.check_constraints 
WHERE OBJECT_NAME(parent_object_id) = 'orders' 
  AND name LIKE '%order_status%';

IF @constraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE orders DROP CONSTRAINT ' + @constraintName);
    PRINT 'Dropped existing CHECK constraint: ' + @constraintName;
END
ELSE
BEGIN
    PRINT 'No existing CHECK constraint found for order_status';
END
GO

-- Add new CHECK constraint with expanded status values
ALTER TABLE orders 
ADD CONSTRAINT CK_orders_order_status 
CHECK (order_status IN (
    'pending', 
    'accepted', 
    'pickup_started', 
    'cargo_picked', 
    'delivery_started', 
    'delivered', 
    'completed', 
    'cancelled',
    'customer_price_approved',
    'customer_price_rejected',
    'driver_navigating',
    'inspecting',
    'driver_accepted_awaiting_customer'
));

PRINT 'Updated CHECK constraint for order_status with new values';
GO