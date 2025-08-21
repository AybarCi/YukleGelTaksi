-- YükleGel Taksi Uygulaması Veritabanı Şeması
-- Veritabanı: yuklegeltaksidb

USE yuklegeltaksidb;
GO

-- Kullanıcılar tablosu
CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    phone_number NVARCHAR(20) UNIQUE NOT NULL,
    first_name NVARCHAR(50) NOT NULL,
    last_name NVARCHAR(50) NOT NULL,
    email NVARCHAR(100) UNIQUE,
    profile_image_url NVARCHAR(500),
    date_of_birth DATE,
    gender NVARCHAR(10),
    current_latitude DECIMAL(10,8),
    current_longitude DECIMAL(11,8),
    last_location_update DATETIME2,
    is_active BIT DEFAULT 1,
    is_verified BIT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);

-- Kullanıcı adresleri tablosu
CREATE TABLE user_addresses (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    address_type NVARCHAR(20) NOT NULL, -- 'home', 'work', 'other'
    title NVARCHAR(50) NOT NULL,
    address_line NVARCHAR(200) NOT NULL,
    city NVARCHAR(50) NOT NULL,
    district NVARCHAR(50) NOT NULL,
    postal_code NVARCHAR(10),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    is_default BIT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sürücüler tablosu
CREATE TABLE drivers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    license_number NVARCHAR(50) UNIQUE NOT NULL,
    vehicle_plate NVARCHAR(20) UNIQUE NOT NULL,
    vehicle_model NVARCHAR(100) NOT NULL,
    vehicle_color NVARCHAR(30) NOT NULL,
    vehicle_year INT NOT NULL,
    rating DECIMAL(3,2) DEFAULT 5.00,
    total_trips INT DEFAULT 0,
    is_online BIT DEFAULT 0,
    is_approved BIT DEFAULT 0,
    current_latitude DECIMAL(10,8),
    current_longitude DECIMAL(11,8),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Yolculuklar tablosu
CREATE TABLE trips (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    driver_id INT,
    pickup_address NVARCHAR(200) NOT NULL,
    pickup_latitude DECIMAL(10,8) NOT NULL,
    pickup_longitude DECIMAL(11,8) NOT NULL,
    destination_address NVARCHAR(200) NOT NULL,
    destination_latitude DECIMAL(10,8) NOT NULL,
    destination_longitude DECIMAL(11,8) NOT NULL,
    trip_status NVARCHAR(20) NOT NULL DEFAULT 'requested', -- 'requested', 'accepted', 'started', 'completed', 'cancelled'
    estimated_price DECIMAL(10,2),
    final_price DECIMAL(10,2),
    distance_km DECIMAL(8,2),
    duration_minutes INT,
    payment_method NVARCHAR(20), -- 'cash', 'card', 'wallet'
    payment_status NVARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    requested_at DATETIME2 DEFAULT GETDATE(),
    accepted_at DATETIME2,
    started_at DATETIME2,
    completed_at DATETIME2,
    cancelled_at DATETIME2,
    cancellation_reason NVARCHAR(200),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (driver_id) REFERENCES drivers(id)
);

-- Yolculuk değerlendirmeleri tablosu
CREATE TABLE trip_ratings (
    id INT IDENTITY(1,1) PRIMARY KEY,
    trip_id INT NOT NULL,
    user_id INT NOT NULL,
    driver_id INT NOT NULL,
    user_rating INT CHECK (user_rating >= 1 AND user_rating <= 5),
    driver_rating INT CHECK (driver_rating >= 1 AND driver_rating <= 5),
    user_comment NVARCHAR(500),
    driver_comment NVARCHAR(500),
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (driver_id) REFERENCES drivers(id)
);

-- Ödeme yöntemleri tablosu
CREATE TABLE payment_methods (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    payment_type NVARCHAR(20) NOT NULL, -- 'card', 'wallet'
    card_last_four NVARCHAR(4),
    card_brand NVARCHAR(20), -- 'visa', 'mastercard', 'amex'
    is_default BIT DEFAULT 0,
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Kullanıcı cüzdanı tablosu
CREATE TABLE user_wallets (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    balance DECIMAL(10,2) DEFAULT 0.00,
    currency NVARCHAR(3) DEFAULT 'TRY',
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Cüzdan işlemleri tablosu
CREATE TABLE wallet_transactions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    wallet_id INT NOT NULL,
    transaction_type NVARCHAR(20) NOT NULL, -- 'deposit', 'withdrawal', 'payment', 'refund'
    amount DECIMAL(10,2) NOT NULL,
    description NVARCHAR(200),
    reference_id INT, -- trip_id veya başka referans
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (wallet_id) REFERENCES user_wallets(id) ON DELETE CASCADE
);

-- SMS doğrulama kodları tablosu
CREATE TABLE verification_codes (
    id INT IDENTITY(1,1) PRIMARY KEY,
    phone_number NVARCHAR(20) NOT NULL,
    code NVARCHAR(6) NOT NULL,
    is_used BIT DEFAULT 0,
    expires_at DATETIME2 NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE()
);

-- Kullanıcı oturumları tablosu (JWT token yönetimi için)
CREATE TABLE user_sessions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash NVARCHAR(255) NOT NULL,
    device_info NVARCHAR(200),
    ip_address NVARCHAR(45),
    is_active BIT DEFAULT 1,
    expires_at DATETIME2 NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Bildirimler tablosu
CREATE TABLE notifications (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    title NVARCHAR(100) NOT NULL,
    message NVARCHAR(500) NOT NULL,
    notification_type NVARCHAR(30) NOT NULL, -- 'trip_update', 'payment', 'promotion', 'system'
    is_read BIT DEFAULT 0,
    data NVARCHAR(MAX), -- JSON formatında ek veriler
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Promosyon kodları tablosu
CREATE TABLE promotion_codes (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(20) UNIQUE NOT NULL,
    description NVARCHAR(200),
    discount_type NVARCHAR(20) NOT NULL, -- 'percentage', 'fixed_amount'
    discount_value DECIMAL(10,2) NOT NULL,
    min_trip_amount DECIMAL(10,2),
    max_discount DECIMAL(10,2),
    usage_limit INT,
    used_count INT DEFAULT 0,
    is_active BIT DEFAULT 1,
    valid_from DATETIME2 NOT NULL,
    valid_until DATETIME2 NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE()
);

-- Kullanıcı promosyon kullanımları tablosu
CREATE TABLE user_promotion_usage (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    promotion_id INT NOT NULL,
    trip_id INT NOT NULL,
    discount_amount DECIMAL(10,2) NOT NULL,
    used_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (promotion_id) REFERENCES promotion_codes(id),
    FOREIGN KEY (trip_id) REFERENCES trips(id)
);

-- Taşıma hesaplama ayarları tablosu
CREATE TABLE pricing_settings (
    id INT IDENTITY(1,1) PRIMARY KEY,
    base_price DECIMAL(10,2) NOT NULL DEFAULT 50.00,
    price_per_km DECIMAL(10,2) NOT NULL DEFAULT 5.00,
    price_per_kg DECIMAL(10,2) NOT NULL DEFAULT 2.00,
    labor_price DECIMAL(10,2) NOT NULL DEFAULT 25.00,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);

-- İndeksler
CREATE INDEX IX_users_phone_number ON users(phone_number);
CREATE INDEX IX_users_email ON users(email);
CREATE INDEX IX_trips_user_id ON trips(user_id);
CREATE INDEX IX_trips_driver_id ON trips(driver_id);
CREATE INDEX IX_trips_status ON trips(trip_status);
CREATE INDEX IX_trips_requested_at ON trips(requested_at);
CREATE INDEX IX_drivers_is_online ON drivers(is_online);
CREATE INDEX IX_verification_codes_phone ON verification_codes(phone_number);
CREATE INDEX IX_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IX_notifications_user_id ON notifications(user_id);

PRINT 'YükleGel Taksi veritabanı şeması başarıyla oluşturuldu!';
GO