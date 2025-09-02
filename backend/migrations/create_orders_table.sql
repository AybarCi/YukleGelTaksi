-- Migration: Create orders table for cargo delivery system
-- Date: 2024-01-21
-- Description: Create orders table with cargo photo and notes support

USE yuklegeltaksidb;
GO

-- Create orders table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='orders' AND xtype='U')
BEGIN
    CREATE TABLE orders (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        driver_id INT NULL,
        pickup_address NVARCHAR(MAX) NOT NULL,
        pickup_latitude DECIMAL(10, 8) NOT NULL,
        pickup_longitude DECIMAL(11, 8) NOT NULL,
        destination_address NVARCHAR(MAX) NOT NULL,
        destination_latitude DECIMAL(10, 8) NOT NULL,
        destination_longitude DECIMAL(11, 8) NOT NULL,
        cargo_photo_url NVARCHAR(500) NOT NULL, -- Yük fotoğrafı URL'si
        notes NVARCHAR(MAX) NULL, -- Müşteri notları
        distance_km DECIMAL(8, 2) NOT NULL,
        estimated_time_minutes INT NOT NULL,
        weight_kg DECIMAL(8, 2) DEFAULT 0, -- Yük ağırlığı
        labor_required BIT DEFAULT 0, -- Hammaliye gerekli mi?
        labor_count INT DEFAULT 0, -- Hammal sayısı
        estimated_price DECIMAL(10, 2) NOT NULL,
        final_price DECIMAL(10, 2) NULL,
        commission_rate DECIMAL(5, 2) DEFAULT 15.00, -- Komisyon oranı %
        driver_earnings DECIMAL(10, 2) NULL, -- Sürücü kazancı
        payment_method NVARCHAR(20) DEFAULT 'card' CHECK (payment_method IN ('cash', 'card', 'wallet')),
        payment_status NVARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
        order_status NVARCHAR(20) DEFAULT 'pending' CHECK (order_status IN ('pending', 'accepted', 'pickup_started', 'cargo_picked', 'delivery_started', 'delivered', 'completed', 'cancelled')),
        created_at DATETIME2 DEFAULT GETDATE(),
        accepted_at DATETIME2 NULL,
        pickup_started_at DATETIME2 NULL,
        cargo_picked_at DATETIME2 NULL,
        delivery_started_at DATETIME2 NULL,
        delivered_at DATETIME2 NULL,
        completed_at DATETIME2 NULL,
        cancelled_at DATETIME2 NULL,
        cancel_reason NVARCHAR(MAX) NULL,
        updated_at DATETIME2 DEFAULT GETDATE(),
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
    );
    
    -- Create indexes for better performance
    CREATE INDEX IX_orders_user_id ON orders(user_id);
    CREATE INDEX IX_orders_driver_id ON orders(driver_id);
    CREATE INDEX IX_orders_status ON orders(order_status);
    CREATE INDEX IX_orders_created_at ON orders(created_at DESC);
    CREATE INDEX IX_orders_payment_status ON orders(payment_status);
    
    PRINT 'orders table created successfully';
END
ELSE
BEGIN
    PRINT 'orders table already exists';
END
GO

-- Create order_status_history table to track status changes
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='order_status_history' AND xtype='U')
BEGIN
    CREATE TABLE order_status_history (
        id INT IDENTITY(1,1) PRIMARY KEY,
        order_id INT NOT NULL,
        old_status NVARCHAR(20) NULL,
        new_status NVARCHAR(20) NOT NULL,
        changed_by_user_id INT NULL,
        changed_by_driver_id INT NULL,
        notes NVARCHAR(MAX) NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (changed_by_driver_id) REFERENCES drivers(id) ON DELETE SET NULL
    );
    
    CREATE INDEX IX_order_status_history_order_id ON order_status_history(order_id);
    CREATE INDEX IX_order_status_history_created_at ON order_status_history(created_at DESC);
    
    PRINT 'order_status_history table created successfully';
END
ELSE
BEGIN
    PRINT 'order_status_history table already exists';
END
GO