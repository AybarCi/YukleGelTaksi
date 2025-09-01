-- Create verification_codes table for SMS authentication
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='verification_codes' AND xtype='U')
CREATE TABLE verification_codes (
    id INT IDENTITY(1,1) PRIMARY KEY,
    phone_number NVARCHAR(20) NOT NULL,
    code NVARCHAR(6) NOT NULL,
    expires_at DATETIME2 NOT NULL,
    is_used BIT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Create index for phone_number
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_verification_codes_phone')
CREATE INDEX idx_verification_codes_phone ON verification_codes(phone_number);
GO

-- Create index for expires_at
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_verification_codes_expires')
CREATE INDEX idx_verification_codes_expires ON verification_codes(expires_at);
GO