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
    
    // Sürücü profil bilgilerini getir (users ve drivers tablolarından)
    const driverResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT 
          d.id,
          u.first_name,
          u.last_name,
          u.phone_number,
          u.email,
          d.license_number,
          d.vehicle_plate,
          d.vehicle_model,
          d.vehicle_year,
          d.is_approved,
          d.is_active,
          d.rating,
          d.total_trips,
          d.driver_photo as profile_image,
          d.created_at,
          d.updated_at
        FROM drivers d
        INNER JOIN users u ON d.user_id = u.id
        WHERE u.id = @userId
      `);

    const driver = driverResult.recordset[0];

    if (!driver) {
      return NextResponse.json({
        success: false,
        exists: false,
        message: 'Sürücü profil bilgileri bulunamadı'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      exists: true,
      data: {
        id: driver.id,
        first_name: driver.first_name,
        last_name: driver.last_name,
        phone_number: driver.phone_number,
        email: driver.email,
        license_number: driver.license_number,
        vehicle_plate: driver.vehicle_plate,
        vehicle_model: driver.vehicle_model,
        vehicle_year: driver.vehicle_year,
        is_active: driver.is_active,
        is_approved: driver.is_approved,
        rating: driver.rating || 5.0,
        total_trips: driver.total_trips || 0,
        profile_image: driver.profile_image,
        created_at: driver.created_at,
        updated_at: driver.updated_at,
        status: driver.is_approved ? 'approved' : 'pending'
      }
    });

  } catch (error) {
    console.error('Sürücü profil bilgileri getirme hatası:', error);
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