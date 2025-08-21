-- YükleGel Taksi Database Schema
-- SQLite için tasarlanmıştır

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT UNIQUE,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    profile_picture_url TEXT,
    user_type TEXT DEFAULT 'customer' CHECK (user_type IN ('customer', 'driver')),
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User addresses table
CREATE TABLE IF NOT EXISTS user_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    tc_number TEXT UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone_number TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    tax_number TEXT,
    tax_office TEXT,
    license_number TEXT UNIQUE NOT NULL,
    license_expiry_date DATE,
    vehicle_type TEXT,
    vehicle_plate TEXT NOT NULL,
    vehicle_model TEXT NOT NULL,
    vehicle_color TEXT,
    vehicle_year INTEGER,
    driver_photo TEXT,
    license_photo TEXT,
    eligibility_certificate TEXT,
    
    is_available INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    rating REAL DEFAULT 5.00,
    total_trips INTEGER DEFAULT 0,
    current_trip_id INTEGER,
    last_location_update DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Supervisors table for backoffice
CREATE TABLE IF NOT EXISTS supervisors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT DEFAULT 'supervisor' CHECK (role IN ('admin', 'supervisor', 'support')),
    is_active INTEGER DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin user (password: admin123)
INSERT OR IGNORE INTO supervisors (username, email, password_hash, first_name, last_name, role) VALUES
('admin', 'admin@yuklegeltaksi.com', '$2b$10$rOzJqKqKqKqKqKqKqKqKqOzJqKqKqKqKqKqKqKqKqKqKqKqKqKqKq', 'Admin', 'User', 'admin');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
-- CREATE INDEX IF NOT EXISTS idx_drivers_phone ON drivers(phone_number); -- phone_number alanı artık users tablosunda
CREATE INDEX IF NOT EXISTS idx_drivers_license ON drivers(license_number);
-- Removed idx_drivers_location index as location fields moved to users table