import { NextRequest, NextResponse } from 'next/server';
import * as jwt from 'jsonwebtoken';
import sql from 'mssql';
import DatabaseConnection from '../config/database';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: number;
    phone_number: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export async function authenticateToken(request: NextRequest): Promise<{ success: boolean; message?: string; user?: any }> {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return {
        success: false,
        message: 'Access token gerekli'
      };
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
    
    // Veritabanından kullanıcı bilgilerini al
    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    const userResult = await pool.request()
      .input('userId', sql.Int, decoded.userId)
      .query('SELECT * FROM users WHERE id = @userId AND is_active = 1');

    const user = userResult.recordset[0];

    if (!user) {
      return {
        success: false,
        message: 'Geçersiz token veya kullanıcı bulunamadı'
      };
    }
    
    return {
      success: true,
      user: {
        id: user.id,
        phone_number: user.phone_number,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        user_type: user.user_type
      }
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      message: 'Token doğrulama hatası'
    };
  }
}

export function generateToken(data: { userId: number; phone: string; userType?: string }): string {
  const payload = {
    userId: data.userId,
    phone: data.phone,
    userType: data.userType || 'passenger',
    iat: Math.floor(Date.now() / 1000)
  };
  
  const options: jwt.SignOptions = {
    expiresIn: '24h' // 24 saat
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET || 'default-secret', options);
}

export function generateRefreshToken(data: { userId: number; phone: string }): string {
  const payload = {
    userId: data.userId,
    phone: data.phone,
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000)
  };
  
  const options: jwt.SignOptions = {
    expiresIn: '90d' // 90 gün
  };
  
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'refresh-secret', options);
}

export function verifyRefreshToken(token: string): { success: boolean; decoded?: any; message?: string } {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'refresh-secret') as any;
    
    if (decoded.type !== 'refresh') {
      return {
        success: false,
        message: 'Geçersiz refresh token'
      };
    }
    
    return {
      success: true,
      decoded
    };
  } catch (error) {
    return {
      success: false,
      message: 'Refresh token doğrulama hatası'
    };
  }
}

export function hashToken(token: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
}