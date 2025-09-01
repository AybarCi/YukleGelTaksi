-- Migration: Create support_tickets table
-- Date: 2024-01-21
-- Description: Create table for driver support tickets

USE yuklegeltaksidb;
GO

-- Create support_tickets table
CREATE TABLE support_tickets (
    id INT IDENTITY(1,1) PRIMARY KEY,
    driver_id INT NOT NULL,
    issue_type NVARCHAR(50) NOT NULL, -- 'technical', 'payment', 'order', 'account', 'other'
    subject NVARCHAR(200) NOT NULL,
    message NVARCHAR(MAX) NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
    priority NVARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    assigned_to INT NULL, -- Admin user ID who is handling the ticket
    admin_response NVARCHAR(MAX) NULL,
    resolved_at DATETIME2 NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);

GO

-- Create indexes for better performance
CREATE INDEX IX_support_tickets_driver_id ON support_tickets(driver_id);
CREATE INDEX IX_support_tickets_status ON support_tickets(status);
CREATE INDEX IX_support_tickets_created_at ON support_tickets(created_at DESC);
CREATE INDEX IX_support_tickets_priority ON support_tickets(priority);

GO

-- Create support_ticket_attachments table for file uploads
CREATE TABLE support_ticket_attachments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    ticket_id INT NOT NULL,
    file_name NVARCHAR(255) NOT NULL,
    file_path NVARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    mime_type NVARCHAR(100) NOT NULL,
    uploaded_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
);

GO

-- Create index for attachments
CREATE INDEX IX_support_ticket_attachments_ticket_id ON support_ticket_attachments(ticket_id);

GO

-- Create support_ticket_comments table for conversation history
CREATE TABLE support_ticket_comments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    ticket_id INT NOT NULL,
    user_id INT NOT NULL, -- Can be driver or admin
    user_type NVARCHAR(20) NOT NULL, -- 'driver' or 'admin'
    comment NVARCHAR(MAX) NOT NULL,
    is_internal BIT DEFAULT 0, -- Internal admin notes
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

GO

-- Create index for comments
CREATE INDEX IX_support_ticket_comments_ticket_id ON support_ticket_comments(ticket_id);
CREATE INDEX IX_support_ticket_comments_created_at ON support_ticket_comments(created_at DESC);

GO

PRINT 'Support tickets tables created successfully!';
GO