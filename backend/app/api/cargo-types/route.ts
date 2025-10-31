import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../config/database';
import { authenticateToken } from '../../../middleware/auth';

// GET - Tüm yük tiplerini getir (Auth gerektirir)
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
          id, 
          name, 
          description, 
          image_url, 
          is_active, 
          sort_order, 
          labor_count,
          created_at, 
          updated_at
        FROM cargo_types
        WHERE is_active = 1
        ORDER BY sort_order ASC, name ASC
      `);

    return NextResponse.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Cargo types fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Yük tipleri getirilirken hata oluştu' },
      { status: 500 }
    );
  }
}

// POST - Yeni yük tipi oluştur (Admin işlemi - /api/admin/cargo-types kullanın)
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'Bu endpoint sadece okuma için kullanılır. Admin işlemleri için /api/admin/cargo-types kullanın.' },
    { status: 403 }
  );
}

// PUT - Yük tipi güncelle (Admin işlemi - /api/admin/cargo-types kullanın)
export async function PUT(request: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'Bu endpoint sadece okuma için kullanılır. Admin işlemleri için /api/admin/cargo-types kullanın.' },
    { status: 403 }
  );
}