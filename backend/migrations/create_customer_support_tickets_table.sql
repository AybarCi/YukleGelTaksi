-- Migration: Create customer_support_tickets table
-- Description: Create table to store customer support tickets
-- Date: 2024-12-20

-- Create customer_support_tickets table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'customer_support_tickets')
BEGIN
    CREATE TABLE customer_support_tickets (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        issue_type NVARCHAR(50) NOT NULL CHECK (issue_type IN ('technical', 'payment', 'order', 'account', 'other')),
        subject NVARCHAR(255) NOT NULL,
        message NTEXT NOT NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
        priority NVARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        admin_response NTEXT NULL,
        resolved_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    
    -- Create indexes for better performance
    CREATE INDEX idx_customer_support_tickets_user_id ON customer_support_tickets(user_id);
    CREATE INDEX idx_customer_support_tickets_status ON customer_support_tickets(status);
    CREATE INDEX idx_customer_support_tickets_created_at ON customer_support_tickets(created_at);
    
    PRINT 'customer_support_tickets table created successfully';
END
ELSE
BEGIN
    PRINT 'customer_support_tickets table already exists';
END