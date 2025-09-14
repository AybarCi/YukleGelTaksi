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
        SELECT 
          vt.id, 
          vt.name, 
          vt.description, 
          vt.is_active, 
          vt.image_url, 
          vt.created_at, 
          vt.updated_at,
          COALESCE(vtp.base_price, 50.00) as base_price,
          COALESCE(vtp.price_per_km, 5.00) as price_per_km,
          COALESCE(vtp.labor_price, 25.00) as price_per_minute,
          1000 as capacity_kg,
          'car' as icon
        FROM vehicle_types vt
        LEFT JOIN vehicle_type_pricing vtp ON vt.id = vtp.vehicle_type_id AND vtp.is_active = 1
        WHERE vt.is_active = 1
        ORDER BY vt.name ASC
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