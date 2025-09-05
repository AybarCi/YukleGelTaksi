-- Migration: Update order statuses for improved workflow
-- Date: 2024-01-22
-- Description: Add new order statuses and update existing enum

USE yuklegeltaksidb;
GO

-- First, drop the existing CHECK constraint
ALTER TABLE orders DROP CONSTRAINT [CK__orders__order_st__*];
GO

-- Add new CHECK constraint with updated statuses
ALTER TABLE orders ADD CONSTRAINT CK_orders_order_status 
CHECK (order_status IN (
    'pending',                          -- Sipariş oluşturuldu, beklemede
    'driver_accepted_awaiting_customer', -- Sürücü kabul etti, müşteri onayı bekleniyor
    'confirmed',                        -- Müşteri onayladı
    'driver_going_to_pickup',           -- Sürücü yükü almaya gidiyor
    'pickup_completed',                 -- Yük alındı
    'in_transit',                       -- Yük taşınıyor
    'delivered',                        -- Yük varış noktasına ulaştı
    'payment_completed',                -- Ödeme tamamlandı
    'cancelled'                         -- İptal edildi
));
GO

-- Add new timestamp columns for the new statuses
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('orders') AND name = 'driver_accepted_awaiting_customer_at')
BEGIN
    ALTER TABLE orders ADD driver_accepted_awaiting_customer_at DATETIME2 NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('orders') AND name = 'confirmed_at')
BEGIN
    ALTER TABLE orders ADD confirmed_at DATETIME2 NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('orders') AND name = 'driver_going_to_pickup_at')
BEGIN
    ALTER TABLE orders ADD driver_going_to_pickup_at DATETIME2 NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('orders') AND name = 'pickup_completed_at')
BEGIN
    ALTER TABLE orders ADD pickup_completed_at DATETIME2 NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('orders') AND name = 'in_transit_at')
BEGIN
    ALTER TABLE orders ADD in_transit_at DATETIME2 NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('orders') AND name = 'payment_completed_at')
BEGIN
    ALTER TABLE orders ADD payment_completed_at DATETIME2 NULL;
END
GO

-- Create cancellation_fees table for managing cancellation rules
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='cancellation_fees' AND xtype='U')
BEGIN
    CREATE TABLE cancellation_fees (
        id INT IDENTITY(1,1) PRIMARY KEY,
        order_status NVARCHAR(50) NOT NULL UNIQUE,
        fee_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );
    
    -- Insert default cancellation fee rules
    INSERT INTO cancellation_fees (order_status, fee_percentage, is_active) VALUES
    ('pending', 0.00, 1),
    ('driver_accepted_awaiting_customer', 0.00, 1),
    ('confirmed', 25.00, 1),
    ('driver_going_to_pickup', 25.00, 1),
    ('pickup_completed', 50.00, 1),
    ('in_transit', 75.00, 1),
    ('delivered', 100.00, 1);
    
    CREATE INDEX IX_cancellation_fees_order_status ON cancellation_fees(order_status);
    CREATE INDEX IX_cancellation_fees_is_active ON cancellation_fees(is_active);
    
    PRINT 'cancellation_fees table created successfully';
END
ELSE
BEGIN
    PRINT 'cancellation_fees table already exists';
END
GO

PRINT 'Order statuses updated successfully';
GO