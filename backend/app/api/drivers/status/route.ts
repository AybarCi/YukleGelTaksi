import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '../../../../middleware/auth';
import sql from 'mssql';
import DatabaseConnection from '../../../../config/database';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateToken(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    // Get user ID from authenticated user
    const userId = authResult.user.id;

    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    // Sürücü bilgilerini getir (users tablosu ile join)
    const driverResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT 
          d.id,
          u.first_name,
          u.last_name,
          u.phone_number,
          d.is_approved,
          d.is_active,
          d.created_at,
          d.updated_at
        FROM drivers d
        INNER JOIN users u ON d.user_id = u.id
        WHERE u.id = @userId
      `);

    const driver = driverResult.recordset[0];

    if (!driver) {
      return NextResponse.json({
        success: true,
        exists: false,
        message: 'Sürücü kaydı bulunamadı'
      });
    }

    return NextResponse.json({
      success: true,
      exists: true,
      data: {
        id: driver.id,
        first_name: driver.first_name,
        last_name: driver.last_name,
        phone: driver.phone_number,
        is_approved: driver.is_approved,
        is_active: driver.is_active,
        created_at: driver.created_at,
        updated_at: driver.updated_at,
        status: driver.is_approved ? 'approved' : 'pending'
      }
    });

  } catch (error) {
    console.error('Sürücü durumu getirme hatası:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}