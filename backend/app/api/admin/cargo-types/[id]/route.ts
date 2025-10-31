import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../../config/database';
import { authenticateSupervisorToken } from '../../../../../middleware/supervisorAuth';

// GET - Tek bir yük tipini getir (Admin için)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Supervisor token doğrulaması
  const authResult = await authenticateSupervisorToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { success: false, error: authResult.message },
      { status: 401 }
    );
  }

  try {
    const { id } = params;
    
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz yük tipi ID' },
        { status: 400 }
      );
    }

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    const result = await pool.request()
      .input('id', parseInt(id))
      .query(`
        SELECT id, name, description, image_url, is_active, sort_order, created_at, updated_at
        FROM cargo_types
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Yük tipi bulunamadı' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Cargo type fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Yük tipi getirilirken hata oluştu' },
      { status: 500 }
    );
  }
}

// DELETE - Yük tipi sil (Admin için)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Supervisor yetkisi kontrolü
    const authResult = await authenticateSupervisorToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: 'Yetkisiz erişim' },
        { status: 401 }
      );
    }

    const { id } = params;
    
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz yük tipi ID' },
        { status: 400 }
      );
    }

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Yük tipi var mı kontrol et
    const existingCheck = await pool.request()
      .input('id', parseInt(id))
      .query('SELECT id FROM cargo_types WHERE id = @id');

    if (existingCheck.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Yük tipi bulunamadı' },
        { status: 404 }
      );
    }

    // Yük tipini sil
    await pool.request()
      .input('id', parseInt(id))
      .query('DELETE FROM cargo_types WHERE id = @id');

    return NextResponse.json({
      success: true,
      message: 'Yük tipi başarıyla silindi'
    });
  } catch (error) {
    console.error('Cargo type deletion error:', error);
    return NextResponse.json(
      { success: false, error: 'Yük tipi silinirken hata oluştu' },
      { status: 500 }
    );
  }
}