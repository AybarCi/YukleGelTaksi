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
          d.is_available,
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
        is_available: driver.is_available,
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

export async function PUT(request: NextRequest) {
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
    const body = await request.json();
    const { is_active, is_available } = body;

    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    // Sürücü durumunu güncelle
    const updateResult = await pool.request()
      .input('userId', sql.Int, userId)
      .input('isActive', sql.Bit, is_active)
      .input('isAvailable', sql.Bit, is_available)
      .query(`
        UPDATE drivers 
        SET is_active = @isActive, 
            is_available = @isAvailable,
            updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE user_id = @userId
      `);

    const updatedDriver = updateResult.recordset[0];

    if (!updatedDriver) {
      return NextResponse.json({
        success: false,
        message: 'Sürücü kaydı bulunamadı'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Sürücü durumu başarıyla güncellendi',
      data: {
        id: updatedDriver.id,
        is_active: updatedDriver.is_active,
        is_available: updatedDriver.is_available,
        updated_at: updatedDriver.updated_at
      }
    });
  } catch (error) {
    console.error('Driver status update error:', error);
    return NextResponse.json(
      { success: false, error: 'Sürücü durumu güncellenirken hata oluştu' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}