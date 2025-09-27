import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../config/database';
import { authenticateToken } from '../../../../middleware/auth';

interface UpdateLocationRequest {
  latitude: number;
  longitude: number;
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  error?: string;
  data?: any;
}

export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, message: 'Yetkisiz erişim' },
        { status: 401 }
      );
    }

    const body: UpdateLocationRequest = await request.json();
    const { latitude, longitude } = body;

    // Validate input
    if (!latitude || !longitude) {
      return NextResponse.json(
        { success: false, message: 'Latitude ve longitude gerekli' },
        { status: 400 }
      );
    }

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90) {
      return NextResponse.json(
        { success: false, message: 'Geçersiz latitude değeri (-90 ile 90 arasında olmalı)' },
        { status: 400 }
      );
    }

    if (longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { success: false, message: 'Geçersiz longitude değeri (-180 ile 180 arasında olmalı)' },
        { status: 400 }
      );
    }

    // Connect to database
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Update user location
    const result = await pool.request()
      .input('user_id', authResult.user.id)
      .input('latitude', latitude)
      .input('longitude', longitude)
      .query(`
        UPDATE users 
        SET current_latitude = @latitude,
            current_longitude = @longitude,
            last_location_update = DATEADD(hour, 3, GETDATE()),
          updated_at = DATEADD(hour, 3, GETDATE())
        WHERE id = @user_id
      `);

    if (result.rowsAffected[0] === 0) {
      return NextResponse.json(
        { success: false, message: 'Kullanıcı bulunamadı' },
        { status: 404 }
      );
    }

    // Get updated user location data
    const updatedUserResult = await pool.request()
      .input('user_id', authResult.user.id)
      .query(`
        SELECT 
          current_latitude,
          current_longitude,
          last_location_update
        FROM users 
        WHERE id = @user_id
      `);

    const updatedUser = updatedUserResult.recordset[0];

    const response: ApiResponse = {
      success: true,
      message: 'Konum bilgisi başarıyla güncellendi',
      data: {
        latitude: updatedUser.current_latitude,
        longitude: updatedUser.current_longitude,
        last_update: updatedUser.last_location_update
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Update location error:', error);
    return NextResponse.json(
      { success: false, message: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}

// Get user's current location
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, message: 'Yetkisiz erişim' },
        { status: 401 }
      );
    }

    // Connect to database
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Get user location
    const result = await pool.request()
      .input('user_id', authResult.user.id)
      .query(`
        SELECT 
          current_latitude,
          current_longitude,
          last_location_update
        FROM users 
        WHERE id = @user_id
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Kullanıcı bulunamadı' },
        { status: 404 }
      );
    }

    const user = result.recordset[0];

    const response: ApiResponse = {
      success: true,
      message: 'Konum bilgisi alındı',
      data: {
        latitude: user.current_latitude,
        longitude: user.current_longitude,
        last_update: user.last_location_update,
        has_location: user.current_latitude !== null && user.current_longitude !== null
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Get location error:', error);
    return NextResponse.json(
      { success: false, message: 'Sunucu hatası' },
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