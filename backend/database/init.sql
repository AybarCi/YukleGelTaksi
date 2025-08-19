-- YükleGel Taksi Database Schema
-- Azure SQL Edge için tasarlanmıştır

-- Users table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    phone_number NVARCHAR(20) UNIQUE NOT NULL,
    first_name NVARCHAR(50),
    last_name NVARCHAR(50),
    email NVARCHAR(100) UNIQUE,
    date_of_birth DATE,
    gender NVARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    profile_picture_url NVARCHAR(255),
    user_type NVARCHAR(20) DEFAULT 'customer' CHECK (user_type IN ('customer', 'driver')),
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

-- User addresses table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_addresses' AND xtype='U')
CREATE TABLE user_addresses (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    title NVARCHAR(50) NOT NULL,
    address NVARCHAR(MAX) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_default BIT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
GO

-- Drivers table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='drivers' AND xtype='U')
CREATE TABLE drivers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT,
    tc_number NVARCHAR(11) UNIQUE,
    first_name NVARCHAR(50) NOT NULL,
    last_name NVARCHAR(50) NOT NULL,
    phone_number NVARCHAR(20) UNIQUE NOT NULL,
    email NVARCHAR(100) UNIQUE,
    tax_number NVARCHAR(20),
    tax_office NVARCHAR(100),
    license_number NVARCHAR(50) UNIQUE NOT NULL,
    license_expiry_date DATE,
    vehicle_type NVARCHAR(50),
    vehicle_plate NVARCHAR(20) NOT NULL,
    vehicle_model NVARCHAR(100) NOT NULL,
    vehicle_color NVARCHAR(30),
    vehicle_year INT,
    driver_photo NVARCHAR(255),
    license_photo NVARCHAR(255),
    eligibility_certificate NVARCHAR(255),
    current_latitude DECIMAL(10, 8),
    current_longitude DECIMAL(11, 8),
    is_available BIT DEFAULT 1,
    is_active BIT DEFAULT 1,
    rating DECIMAL(3, 2) DEFAULT 5.00,
    total_trips INT DEFAULT 0,
    current_trip_id INT,
    last_location_update DATETIME2,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
GO

-- Trips table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='trips' AND xtype='U')
CREATE TABLE trips (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    driver_id INT,
    pickup_address NVARCHAR(MAX) NOT NULL,
    pickup_latitude DECIMAL(10, 8) NOT NULL,
    pickup_longitude DECIMAL(11, 8) NOT NULL,
    destination_address NVARCHAR(MAX) NOT NULL,
    destination_latitude DECIMAL(10, 8) NOT NULL,
    destination_longitude DECIMAL(11, 8) NOT NULL,
    estimated_price DECIMAL(10, 2) NOT NULL,
    final_price DECIMAL(10, 2),
    distance_km DECIMAL(8, 2),
    duration_minutes INT,
    payment_method NVARCHAR(20) CHECK (payment_method IN ('cash', 'card', 'wallet')) NOT NULL,
    trip_status NVARCHAR(20) DEFAULT 'requested' CHECK (trip_status IN ('requested', 'accepted', 'started', 'completed', 'cancelled')),
    requested_at DATETIME2 DEFAULT GETDATE(),
    accepted_at DATETIME2,
    started_at DATETIME2,
    completed_at DATETIME2,
    cancelled_at DATETIME2,
    cancel_reason NVARCHAR(MAX),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL
);
GO

-- Trip ratings table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='trip_ratings' AND xtype='U')
CREATE TABLE trip_ratings (
    id INT IDENTITY(1,1) PRIMARY KEY,
    trip_id INT NOT NULL,
    user_id INT NOT NULL,
    driver_id INT NOT NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE NO ACTION,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION,
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE NO ACTION
);
GO

-- Payment methods table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='payment_methods' AND xtype='U')
CREATE TABLE payment_methods (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    method_type NVARCHAR(20) CHECK (method_type IN ('card', 'wallet')) NOT NULL,
    card_last_four NVARCHAR(4),
    card_brand NVARCHAR(20),
    is_default BIT DEFAULT 0,
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
GO

-- User wallet table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_wallets' AND xtype='U')
CREATE TABLE user_wallets (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    balance DECIMAL(10, 2) DEFAULT 0.00,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
GO

-- Wallet transactions table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='wallet_transactions' AND xtype='U')
CREATE TABLE wallet_transactions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    wallet_id INT NOT NULL,
    transaction_type NVARCHAR(20) CHECK (transaction_type IN ('deposit', 'withdrawal', 'payment', 'refund')) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    description NVARCHAR(MAX),
    trip_id INT,
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (wallet_id) REFERENCES user_wallets(id) ON DELETE CASCADE,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE NO ACTION
);
GO

-- SMS verification codes table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='sms_verification_codes' AND xtype='U')
CREATE TABLE sms_verification_codes (
    id INT IDENTITY(1,1) PRIMARY KEY,
    phone_number NVARCHAR(20) NOT NULL,
    code NVARCHAR(6) NOT NULL,
    expires_at DATETIME2 NOT NULL,
    is_used BIT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETDATE()
);
GO

-- User sessions table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_sessions' AND xtype='U')
CREATE TABLE user_sessions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash NVARCHAR(255) NOT NULL,
    device_info NVARCHAR(MAX),
    ip_address NVARCHAR(45),
    expires_at DATETIME2 NOT NULL,
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
GO

-- Notifications table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='notifications' AND xtype='U')
CREATE TABLE notifications (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    title NVARCHAR(100) NOT NULL,
    message NVARCHAR(MAX) NOT NULL,
    notification_type NVARCHAR(30) NOT NULL,
    is_read BIT DEFAULT 0,
    trip_id INT,
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE NO ACTION
);
GO

-- Promotion codes table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='promotion_codes' AND xtype='U')
CREATE TABLE promotion_codes (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(20) UNIQUE NOT NULL,
    description NVARCHAR(MAX),
    discount_type NVARCHAR(20) CHECK (discount_type IN ('percentage', 'fixed')) NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    min_trip_amount DECIMAL(10, 2) DEFAULT 0,
    max_discount DECIMAL(10, 2),
    usage_limit INT,
    used_count INT DEFAULT 0,
    is_active BIT DEFAULT 1,
    valid_from DATETIME2 NOT NULL,
    valid_until DATETIME2 NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE()
);
GO

-- User promotion usage table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_promotion_usage' AND xtype='U')
CREATE TABLE user_promotion_usage (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    promotion_id INT NOT NULL,
    trip_id INT NOT NULL,
    discount_amount DECIMAL(10, 2) NOT NULL,
    used_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (promotion_id) REFERENCES promotion_codes(id) ON DELETE CASCADE,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE NO ACTION
);
GO

-- Create indexes for better performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_users_phone')
CREATE INDEX idx_users_phone ON users(phone_number);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_users_email')
CREATE INDEX idx_users_email ON users(email);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_user_addresses_user_id')
CREATE INDEX idx_user_addresses_user_id ON user_addresses(user_id);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_drivers_phone')
CREATE INDEX idx_drivers_phone ON drivers(phone_number);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_drivers_location')
CREATE INDEX idx_drivers_location ON drivers(current_latitude, current_longitude);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_drivers_available')
CREATE INDEX idx_drivers_available ON drivers(is_available, is_active);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_trips_user_id')
CREATE INDEX idx_trips_user_id ON trips(user_id);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_trips_driver_id')
CREATE INDEX idx_trips_driver_id ON trips(driver_id);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_trips_status')
CREATE INDEX idx_trips_status ON trips(trip_status);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_trips_requested_at')
CREATE INDEX idx_trips_requested_at ON trips(requested_at);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_sms_codes_phone')
CREATE INDEX idx_sms_codes_phone ON sms_verification_codes(phone_number);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_sms_codes_expires')
CREATE INDEX idx_sms_codes_expires ON sms_verification_codes(expires_at);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_user_sessions_user_id')
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_user_sessions_token')
CREATE INDEX idx_user_sessions_token ON user_sessions(token_hash);
GO

-- Sample drivers removed - phone_number column no longer exists in drivers table
-- Phone numbers are now stored in users table and linked via user_id
GO

-- Update last_location_update for sample drivers
UPDATE drivers SET last_location_update = GETDATE() WHERE id <= 5;
GO

-- Supervisors table for backoffice access
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='supervisors' AND xtype='U')
CREATE TABLE supervisors (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(50) UNIQUE NOT NULL,
    email NVARCHAR(100) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    first_name NVARCHAR(50) NOT NULL,
    last_name NVARCHAR(50) NOT NULL,
    role NVARCHAR(20) DEFAULT 'supervisor' CHECK (role IN ('supervisor', 'admin')),
    is_active BIT DEFAULT 1,
    last_login DATETIME2,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Supervisor sessions table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='supervisor_sessions' AND xtype='U')
CREATE TABLE supervisor_sessions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    supervisor_id INT NOT NULL,
    token_hash NVARCHAR(255) NOT NULL,
    expires_at DATETIME2 NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (supervisor_id) REFERENCES supervisors(id) ON DELETE CASCADE
);
GO

-- Create indexes for supervisor tables
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_supervisors_username')
CREATE INDEX idx_supervisors_username ON supervisors(username);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_supervisors_email')
CREATE INDEX idx_supervisors_email ON supervisors(email);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_supervisor_sessions_token')
CREATE INDEX idx_supervisor_sessions_token ON supervisor_sessions(token_hash);
GO

-- Insert sample supervisor (password: admin123)
IF NOT EXISTS (SELECT * FROM supervisors WHERE username = 'admin')
INSERT INTO supervisors (username, email, password_hash, first_name, last_name, role)
VALUES ('admin', 'admin@yuklegeltaksi.com', '$2b$10$rOvHPGp8WqHQakwjTEXT7.vQs5qJ5FZXqAoQJYhYzKqGzJ5YzKqGz', 'Admin', 'User', 'admin');
GO

-- Add user_type column to existing users table if it doesn't exist
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'user_type')
BEGIN
    ALTER TABLE users ADD user_type NVARCHAR(20) DEFAULT 'customer' CHECK (user_type IN ('customer', 'driver'));
END
GO

-- Add new columns to existing drivers table if they don't exist
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'drivers' AND COLUMN_NAME = 'tc_number')
BEGIN
    ALTER TABLE drivers ADD tc_number NVARCHAR(11);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'drivers' AND COLUMN_NAME = 'tax_number')
BEGIN
    ALTER TABLE drivers ADD tax_number NVARCHAR(20);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'drivers' AND COLUMN_NAME = 'tax_office')
BEGIN
    ALTER TABLE drivers ADD tax_office NVARCHAR(100);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'drivers' AND COLUMN_NAME = 'license_expiry_date')
BEGIN
    ALTER TABLE drivers ADD license_expiry_date DATE;
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'drivers' AND COLUMN_NAME = 'vehicle_type')
BEGIN
    ALTER TABLE drivers ADD vehicle_type NVARCHAR(50);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'drivers' AND COLUMN_NAME = 'driver_photo')
BEGIN
    ALTER TABLE drivers ADD driver_photo NVARCHAR(255);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'drivers' AND COLUMN_NAME = 'license_photo')
BEGIN
    ALTER TABLE drivers ADD license_photo NVARCHAR(255);
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'drivers' AND COLUMN_NAME = 'eligibility_certificate')
BEGIN
    ALTER TABLE drivers ADD eligibility_certificate NVARCHAR(255);
END
GO
GO