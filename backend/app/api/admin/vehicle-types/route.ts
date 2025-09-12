import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../config/database';
import { authenticateSupervisorToken } from '../../../../middleware/supervisorAuth';

// GET - Tüm araç tiplerini getir (Admin için)
export async function GET(request: NextRequest) {
  // Supervisor token doğrulaması
  const authResult = await authenticateSupervisorToken(request);
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

// POST - Yeni araç tipi oluştur (Admin için)
export async function POST(request: NextRequest) {
  try {
    // Supervisor yetkisi kontrolü
    const authResult = await authenticateSupervisorToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: 'Yetkisiz erişim' },
        { status: 401 }
      );
    }

    const { name, description, is_active = true, image_url } = await request.json();

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Araç tipi adı gereklidir' },
        { status: 400 }
      );
    }

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Aynı isimde araç tipi var mı kontrol et
    const existingCheck = await pool.request()
      .input('name', name.trim())
      .query('SELECT id FROM vehicle_types WHERE name = @name');

    if (existingCheck.recordset.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Bu isimde bir araç tipi zaten mevcut' },
        { status: 400 }
      );
    }

    // Yeni araç tipi oluştur
    const result = await pool.request()
      .input('name', name.trim())
      .input('description', description || null)
      .input('is_active', is_active)
      .input('image_url', image_url || null)
      .query(`
        INSERT INTO vehicle_types (name, description, is_active, image_url)
        OUTPUT INSERTED.*
        VALUES (@name, @description, @is_active, @image_url)
      `);

    return NextResponse.json({
      success: true,
      message: 'Araç tipi başarıyla oluşturuldu',
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Vehicle type creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Araç tipi oluşturulurken hata oluştu' },
      { status: 500 }
    );
  }
}

// PUT - Araç tipi güncelle (Admin için)
export async function PUT(request: NextRequest) {
  try {
    // Supervisor yetkisi kontrolü
    const authResult = await authenticateSupervisorToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: 'Yetkisiz erişim' },
        { status: 401 }
      );
    }

    const { id, name, description, is_active, image_url } = await request.json();

    if (!id || !name || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'ID ve araç tipi adı gereklidir' },
        { status: 400 }
      );
    }

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Araç tipi var mı kontrol et
    const existingCheck = await pool.request()
      .input('id', id)
      .query('SELECT id FROM vehicle_types WHERE id = @id');

    if (existingCheck.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Araç tipi bulunamadı' },
        { status: 404 }
      );
    }

    // Aynı isimde başka araç tipi var mı kontrol et
    const nameCheck = await pool.request()
      .input('name', name.trim())
      .input('id', id)
      .query('SELECT id FROM vehicle_types WHERE name = @name AND id != @id');

    if (nameCheck.recordset.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Bu isimde başka bir araç tipi zaten mevcut' },
        { status: 400 }
      );
    }

    // Araç tipini güncelle
    const result = await pool.request()
      .input('id', id)
      .input('name', name.trim())
      .input('description', description || null)
      .input('is_active', is_active)
      .input('image_url', image_url || null)
      .query(`
        UPDATE vehicle_types 
        SET name = @name, description = @description, is_active = @is_active, image_url = @image_url, updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE id = @id
      `);

    return NextResponse.json({
      success: true,
      message: 'Araç tipi başarıyla güncellendi',
      data: result.recordset[0]
    });
  } catch (error) {
    console.error('Vehicle type update error:', error);
    return NextResponse.json(
      { success: false, error: 'Araç tipi güncellenirken hata oluştu' },
      { status: 500 }
    );
  }
}