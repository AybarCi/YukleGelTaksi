import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../config/database';
import { authenticateToken } from '../../../middleware/auth';
import { authenticateSupervisorToken } from '../../../middleware/supervisorAuth';

// GET - Tüm araç tiplerini getir
export async function GET(request: NextRequest) {
  // Token doğrulaması
  const authResult = await authenticateToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.message },
      { status: 401 }
    );
  }

  try {
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    const result = await pool.request()
      .query(`
        SELECT id, name, description, is_active, image_url, created_at, updated_at
        FROM vehicle_types
        WHERE is_active = 1
        ORDER BY name ASC
      `);

    return NextResponse.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Vehicle types fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Araç tipleri getirilirken hata oluştu' },
      { status: 500 }
    );
  }
}

// POST - Yeni araç tipi oluştur (Admin işlemi - /api/admin/vehicle-types kullanın)
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'Bu endpoint sadece okuma için kullanılır. Admin işlemleri için /api/admin/vehicle-types kullanın.' },
    { status: 403 }
  );
}

// PUT - Araç tipi güncelle (Admin işlemi - /api/admin/vehicle-types kullanın)
export async function PUT(request: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'Bu endpoint sadece okuma için kullanılır. Admin işlemleri için /api/admin/vehicle-types kullanın.' },
    { status: 403 }
  );

}