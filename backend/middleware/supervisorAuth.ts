import { NextRequest, NextResponse } from 'next/server';
import * as jwt from 'jsonwebtoken';
import DatabaseConnection from '../config/database';

export interface AuthenticatedSupervisorRequest extends NextRequest {
  supervisor?: {
    id: number;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export async function authenticateSupervisorToken(request: NextRequest): Promise<{ success: boolean; message?: string; supervisor?: any }> {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader && authHeader.split(' ')[1];

    console.log('Supervisor Auth Debug - Auth Header:', authHeader);
    console.log('Supervisor Auth Debug - Token:', token ? 'Token var' : 'Token yok');

    if (!token) {
      return {
        success: false,
        message: 'Access token gerekli'
      };
    }

    console.log('Supervisor Auth Debug - JWT_SECRET:', process.env.JWT_SECRET ? 'Secret var' : 'Secret yok');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
    console.log('Supervisor Auth Debug - Decoded:', decoded);
    
    // Veritabanından supervisor bilgilerini al
    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    // Check if supervisor exists and is active
    console.log('Supervisor Auth Debug - Looking for supervisorId:', decoded.supervisorId);
    const supervisorResult = await pool.request()
      .input('supervisorId', decoded.supervisorId)
      .query('SELECT * FROM supervisors WHERE id = @supervisorId AND is_active = 1');
    
    const supervisor = supervisorResult.recordset[0];
    console.log('Supervisor Auth Debug - Supervisor found:', supervisor ? 'Evet' : 'Hayır');

    if (!supervisor) {
      return {
        success: false,
        message: 'Geçersiz token veya supervisor bulunamadı'
      };
    }

    // Check if session exists and is not expired
    const sessionResult = await pool.request()
      .input('supervisorId', decoded.supervisorId)
      .query('SELECT * FROM supervisor_sessions WHERE supervisor_id = @supervisorId AND expires_at > GETDATE() ORDER BY created_at DESC');
    
    console.log('Supervisor Auth Debug - Active sessions found:', sessionResult.recordset.length);
    if (sessionResult.recordset.length === 0) {
      return {
        success: false,
        message: 'Session süresi dolmuş, lütfen tekrar giriş yapın'
      };
    }
    
    return {
      success: true,
      supervisor: {
        id: supervisor.id,
        username: supervisor.username,
        email: supervisor.email,
        firstName: supervisor.first_name,
        lastName: supervisor.last_name,
        role: supervisor.role
      }
    };
    
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return {
        success: false,
        message: 'Token süresi dolmuş, lütfen tekrar giriş yapın'
      };
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      return {
        success: false,
        message: 'Geçersiz token'
      };
    }
    
    console.error('Supervisor authentication error:', error);
    return {
      success: false,
      message: 'Authentication hatası'
    };
  }
}

export function generateSupervisorToken(data: { supervisorId: number; username: string; role: string }): string {
  return jwt.sign(
    {
      supervisorId: data.supervisorId,
      username: data.username,
      role: data.role,
      userType: 'supervisor'
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '10h' }
  );
}

export async function logoutSupervisor(supervisorId: number): Promise<boolean> {
  try {
    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    // Delete all sessions for this supervisor
    await pool.request()
      .input('supervisorId', supervisorId)
      .query('DELETE FROM supervisor_sessions WHERE supervisor_id = @supervisorId');
    
    return true;
  } catch (error) {
    console.error('Supervisor logout error:', error);
    return false;
  }
}

export async function cleanExpiredSupervisorSessions(): Promise<void> {
  try {
    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    // Delete expired sessions
    await pool.request()
      .query('DELETE FROM supervisor_sessions WHERE expires_at < GETDATE()');
  } catch (error) {
    console.error('Clean expired sessions error:', error);
  }
}