import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../config/database';

export async function POST(request: NextRequest) {
  try {
    const { driverId, isApproved } = await request.json();

    if (!driverId || typeof isApproved !== 'boolean') {
      return NextResponse.json(
        { error: 'Driver ID ve onay durumu gerekli' },
        { status: 400 }
      );
    }

    const db = DatabaseConnection.getInstance();
    await db.connect();

    // Update driver approval status
    const updateQuery = `
      UPDATE drivers 
      SET is_approved = @isApproved,
          updated_at = GETDATE()
      WHERE id = @driverId
    `;

    const result = await db.run(updateQuery, {
      driverId: driverId,
      isApproved: isApproved ? 1 : 0
    });

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

    const driver = await db.get(selectQuery, { driverId });

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
    await db.connect();

    const selectQuery = `
      SELECT 
        d.id,
        d.first_name,
        d.last_name,
        d.phone,
        d.is_approved,
        d.is_active,
        d.created_at,
        d.updated_at
      FROM drivers d
      WHERE d.id = @driverId
    `;

    const driver = await db.get(selectQuery, { driverId });

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