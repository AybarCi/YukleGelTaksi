import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../../config/database';
import { authenticateSupervisorToken } from '../../../../../middleware/supervisorAuth';

// PUT - Araç tipi aktif/pasif durumunu değiştir
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Admin yetkisi kontrolü
    const authResult = await authenticateSupervisorToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: 'Yetkisiz erişim' },
        { status: 401 }
      );
    }

    const { id } = params;
    const { is_active } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Araç tipi ID gereklidir' },
        { status: 400 }
      );
    }

    if (typeof is_active !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Geçerli bir durum değeri gereklidir' },
        { status: 400 }
      );
    }

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Araç tipi var mı kontrol et
    const existingCheck = await pool.request()
      .input('id', parseInt(id))
      .query('SELECT id, name, is_active FROM vehicle_types WHERE id = @id');

    if (existingCheck.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Araç tipi bulunamadı' },
        { status: 404 }
      );
    }

    const currentVehicleType = existingCheck.recordset[0];

    // Durumu güncelle
    const result = await pool.request()
      .input('id', parseInt(id))
      .input('is_active', is_active)
      .query(`
        UPDATE vehicle_types 
        SET is_active = @is_active, updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    const statusText = is_active ? 'aktif' : 'pasif';
    
    return NextResponse.json({
      success: true,
      message: `${currentVehicleType.name} araç tipi ${statusText} duruma getirildi`,
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Vehicle type status toggle error:', error);
    return NextResponse.json(
      { success: false, error: 'Araç tipi durumu değiştirilirken hata oluştu' },
      { status: 500 }
    );
  }
}