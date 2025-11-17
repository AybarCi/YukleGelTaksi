import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import DatabaseConnection from '../../../../../config/database';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    // Find supervisor by username
    const result = await pool.request()
      .input('username', username)
      .query('SELECT * FROM supervisors WHERE username = @username AND is_active = 1');
    
    const supervisor = result.recordset[0];

    if (!supervisor) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, supervisor.password_hash);
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate JWT token (10 hours)
    const token = jwt.sign(
      { 
        supervisorId: supervisor.id,
        username: supervisor.username,
        role: supervisor.role
      },
      JWT_SECRET,
      { expiresIn: '10h' }
    );

    // Update last login
    await pool.request()
      .input('supervisorId', supervisor.id)
      .query('UPDATE supervisors SET last_login = GETDATE() WHERE id = @supervisorId');

    // Store session
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 60 * 1000); // 10 hours
    
    await pool.request()
      .input('supervisorId', supervisor.id)
      .input('tokenHash', tokenHash)
      .input('expiresAt', expiresAt)
      .query('INSERT INTO supervisor_sessions (supervisor_id, token_hash, expires_at) VALUES (@supervisorId, @tokenHash, @expiresAt)');

    return NextResponse.json({
      success: true,
      token,
      supervisor: {
        id: supervisor.id,
        username: supervisor.username,
        email: supervisor.email,
        firstName: supervisor.first_name,
        lastName: supervisor.last_name,
        role: supervisor.role
      }
    });

  } catch (error) {
    console.error('Supervisor login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// OPTIONS method for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200 });
}