const sql = require('mssql');
const config = require('../db-config');

class DatabaseHelper {
    constructor() {
        this.pool = null;
    }

    // Veritabanı bağlantısını başlat
    async connect() {
        try {
            if (!this.pool) {
                this.pool = await sql.connect(config);
                console.log('Veritabanı bağlantısı başarılı!');
            }
            return this.pool;
        } catch (error) {
            console.error('Veritabanı bağlantı hatası:', error);
            throw error;
        }
    }

    // Bağlantıyı kapat
    async disconnect() {
        try {
            if (this.pool) {
                await this.pool.close();
                this.pool = null;
                console.log('Veritabanı bağlantısı kapatıldı.');
            }
        } catch (error) {
            console.error('Veritabanı bağlantısı kapatma hatası:', error);
        }
    }

    // SQL sorgusu çalıştır
    async executeQuery(query, params = {}) {
        try {
            await this.connect();
            const request = this.pool.request();
            
            // Parametreleri ekle
            Object.keys(params).forEach(key => {
                request.input(key, params[key]);
            });

            const result = await request.query(query);
            return result;
        } catch (error) {
            console.error('SQL sorgu hatası:', error);
            throw error;
        }
    }

    // Stored procedure çalıştır
    async executeStoredProcedure(procedureName, params = {}) {
        try {
            await this.connect();
            const request = this.pool.request();
            
            // Parametreleri ekle
            Object.keys(params).forEach(key => {
                request.input(key, params[key]);
            });

            const result = await request.execute(procedureName);
            return result;
        } catch (error) {
            console.error('Stored procedure hatası:', error);
            throw error;
        }
    }

    // Transaction başlat
    async beginTransaction() {
        try {
            await this.connect();
            const transaction = new sql.Transaction(this.pool);
            await transaction.begin();
            return transaction;
        } catch (error) {
            console.error('Transaction başlatma hatası:', error);
            throw error;
        }
    }

    // Kullanıcı işlemleri
    async createUser(userData) {
        const query = `
            INSERT INTO users (phone_number, first_name, last_name, email, is_verified)
            OUTPUT INSERTED.id
            VALUES (@phone_number, @first_name, @last_name, @email, @is_verified)
        `;
        
        const params = {
            phone_number: userData.phoneNumber,
            first_name: userData.firstName,
            last_name: userData.lastName,
            email: userData.email,
            is_verified: userData.isVerified || false
        };

        const result = await this.executeQuery(query, params);
        return result.recordset[0];
    }

    async getUserByPhone(phoneNumber) {
        const query = `
            SELECT * FROM users 
            WHERE phone_number = @phone_number AND is_active = 1
        `;
        
        const result = await this.executeQuery(query, { phone_number: phoneNumber });
        return result.recordset[0];
    }

    async getUserById(userId) {
        const query = `
            SELECT * FROM users 
            WHERE id = @user_id AND is_active = 1
        `;
        
        const result = await this.executeQuery(query, { user_id: userId });
        return result.recordset[0];
    }

    async updateUser(userId, userData) {
        const query = `
            UPDATE users 
            SET first_name = @first_name, 
                last_name = @last_name, 
                email = @email,
                profile_image_url = @profile_image_url,
                updated_at = GETDATE()
            WHERE id = @user_id
        `;
        
        const params = {
            user_id: userId,
            first_name: userData.firstName,
            last_name: userData.lastName,
            email: userData.email,
            profile_image_url: userData.profileImageUrl
        };

        await this.executeQuery(query, params);
    }

    // SMS doğrulama kodu işlemleri
    async saveVerificationCode(phoneNumber, code, expiresAt) {
        const query = `
            INSERT INTO verification_codes (phone_number, code, expires_at)
            VALUES (@phone_number, @code, @expires_at)
        `;
        
        const params = {
            phone_number: phoneNumber,
            code: code,
            expires_at: expiresAt
        };

        await this.executeQuery(query, params);
    }

    async verifyCode(phoneNumber, code) {
        const query = `
            SELECT * FROM verification_codes 
            WHERE phone_number = @phone_number 
                AND code = @code 
                AND is_used = 0 
                AND expires_at > GETDATE()
        `;
        
        const result = await this.executeQuery(query, { 
            phone_number: phoneNumber, 
            code: code 
        });
        
        if (result.recordset.length > 0) {
            // Kodu kullanıldı olarak işaretle
            const updateQuery = `
                UPDATE verification_codes 
                SET is_used = 1 
                WHERE id = @id
            `;
            await this.executeQuery(updateQuery, { id: result.recordset[0].id });
            return true;
        }
        
        return false;
    }

    // Yolculuk işlemleri
    async createTrip(tripData) {
        const query = `
            INSERT INTO trips (
                user_id, pickup_address, pickup_latitude, pickup_longitude,
                destination_address, destination_latitude, destination_longitude,
                estimated_price, payment_method
            )
            OUTPUT INSERTED.id
            VALUES (
                @user_id, @pickup_address, @pickup_latitude, @pickup_longitude,
                @destination_address, @destination_latitude, @destination_longitude,
                @estimated_price, @payment_method
            )
        `;
        
        const result = await this.executeQuery(query, tripData);
        return result.recordset[0];
    }

    async getUserTrips(userId, limit = 10) {
        const query = `
            SELECT TOP (@limit) t.*, d.vehicle_model, d.vehicle_plate, u.first_name as driver_name
            FROM trips t
            LEFT JOIN drivers d ON t.driver_id = d.id
            LEFT JOIN users u ON d.user_id = u.id
            WHERE t.user_id = @user_id
            ORDER BY t.requested_at DESC
        `;
        
        const result = await this.executeQuery(query, { 
            user_id: userId, 
            limit: limit 
        });
        return result.recordset;
    }

    // Sürücü işlemleri
    async getAvailableDrivers(latitude, longitude, radiusKm = 5) {
        const query = `
            SELECT d.*, u.first_name, u.last_name
            FROM drivers d
            INNER JOIN users u ON d.user_id = u.id
            WHERE d.is_online = 1 AND d.is_approved = 1
                AND (
                    6371 * ACOS(
                        COS(RADIANS(@latitude)) * COS(RADIANS(d.current_latitude)) *
                        COS(RADIANS(d.current_longitude) - RADIANS(@longitude)) +
                        SIN(RADIANS(@latitude)) * SIN(RADIANS(d.current_latitude))
                    )
                ) <= @radius
        `;
        
        const result = await this.executeQuery(query, {
            latitude: latitude,
            longitude: longitude,
            radius: radiusKm
        });
        return result.recordset;
    }

    // Kullanıcı oturum işlemleri
    async createUserSession(userId, tokenHash, deviceInfo, ipAddress, expiresAt) {
        const query = `
            INSERT INTO user_sessions (user_id, token_hash, device_info, ip_address, expires_at)
            VALUES (@user_id, @token_hash, @device_info, @ip_address, @expires_at)
        `;
        
        const params = {
            user_id: userId,
            token_hash: tokenHash,
            device_info: deviceInfo,
            ip_address: ipAddress,
            expires_at: expiresAt
        };

        await this.executeQuery(query, params);
    }

    async validateUserSession(tokenHash) {
        const query = `
            SELECT s.*, u.phone_number, u.first_name, u.last_name, u.email
            FROM user_sessions s
            INNER JOIN users u ON s.user_id = u.id
            WHERE s.token_hash = @token_hash 
                AND s.is_active = 1 
                AND s.expires_at > GETDATE()
                AND u.is_active = 1
        `;
        
        const result = await this.executeQuery(query, { token_hash: tokenHash });
        return result.recordset[0];
    }

    async invalidateUserSession(tokenHash) {
        const query = `
            UPDATE user_sessions 
            SET is_active = 0 
            WHERE token_hash = @token_hash
        `;
        
        await this.executeQuery(query, { token_hash: tokenHash });
    }
}

// Singleton pattern
const dbHelper = new DatabaseHelper();

module.exports = dbHelper;