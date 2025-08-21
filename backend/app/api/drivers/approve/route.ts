import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../config/database';
import { authenticateSupervisorToken } from '../../../../middleware/supervisorAuth';

export async function POST(request: NextRequest) {
  try {
    // Authenticate supervisor
    const authResult = await authenticateSupervisorToken(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    const { driverId, isApproved } = await request.json();

    if (!driverId || typeof isApproved !== 'boolean') {
      return NextResponse.json(
        { error: 'Driver ID ve onay durumu gerekli' },
        { status: 400 }
      );
    }

    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();

    // Update driver approval status
    const result = await pool.request()
      .input('driverId', driverId)
      .input('isApproved', isApproved ? 1 : 0)
      .query(`
        UPDATE drivers 
        SET is_approved = @isApproved,
            updated_at = GETDATE()
        WHERE id = @driverId
      `);

    if (result.rowsAffected[0] === 0) {
      return NextResponse.json(
        { error: 'Sürücü bulunamadı' },
        { status: 404 }
      );
    }

    // Get updated driver info
    const selectQuery = `
      SELECT 
        d.id,
        d.first_name,
        d.last_name,
        d.phone_number,
        d.is_approved,
        d.is_active,
        d.created_at,
        d.updated_at
      FROM drivers d
      WHERE d.id = @driverId
    `;

    const driverResult = await pool.request()
      .input('driverId', driverId)
      .query(`
        SELECT 
          d.id,
          d.first_name,
          d.last_name,
          d.is_approved,
          d.is_active,
          d.created_at,
          d.updated_at
        FROM drivers d
        WHERE d.id = @driverId
      `);

    const driver = driverResult.recordset[0];

    return NextResponse.json({
      success: true,
      message: isApproved ? 'Sürücü onaylandı' : 'Sürücü onayı kaldırıldı',
      driver: driver
    });

  } catch (error) {
    console.error('Sürücü onaylama hatası:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}

// GET endpoint to check approval status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driverId');

    if (!driverId) {
      return NextResponse.json(
        { error: 'Driver ID gerekli' },
        { status: 400 }
      );
    }

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    const driverResult = await pool.request()
      .input('driverId', driverId)
      .query(`
        SELECT 
          d.id,
          d.first_name,
          d.last_name,
          u.phone_number,
          d.is_approved,
          d.is_active,
          d.created_at,
          d.updated_at
        FROM drivers d
        INNER JOIN users u ON d.user_id = u.id
        WHERE d.id = @driverId
      `);

    const driver = driverResult.recordset[0];

    if (!driver) {
      return NextResponse.json(
        { error: 'Sürücü bulunamadı' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      driver: driver
    });

  } catch (error) {
    console.error('Sürücü bilgisi alma hatası:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}