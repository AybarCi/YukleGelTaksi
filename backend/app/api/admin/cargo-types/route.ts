import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../config/database';
import { authenticateSupervisorToken } from '../../../../middleware/supervisorAuth';

// GET - Tüm yük tiplerini getir (Admin için)
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
        SELECT id, name, description, image_url, is_active, sort_order, labor_count, created_at, updated_at
        FROM cargo_types
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

// POST - Yeni yük tipi oluştur (Admin için)
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

    const { name, description, image_url, is_active = true, sort_order = 0, labor_count = 0 } = await request.json();

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Yük tipi adı gereklidir' },
        { status: 400 }
      );
    }

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Aynı isimde yük tipi var mı kontrol et
    const existingCheck = await pool.request()
      .input('name', name.trim())
      .query('SELECT id FROM cargo_types WHERE name = @name');

    if (existingCheck.recordset.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Bu isimde bir yük tipi zaten mevcut' },
        { status: 400 }
      );
    }

    // Yeni yük tipi oluştur
    await pool.request()
      .input('name', name.trim())
      .input('description', description || null)
      .input('image_url', image_url || null)
      .input('is_active', is_active)
      .input('sort_order', sort_order)
      .input('labor_count', labor_count)
      .query(`
        INSERT INTO cargo_types (name, description, image_url, is_active, sort_order, labor_count)
        VALUES (@name, @description, @image_url, @is_active, @sort_order, @labor_count)
      `);

    // Son eklenen kaydı getir
    const newRecord = await pool.request()
      .input('name', name.trim())
      .query(`
        SELECT id, name, description, image_url, is_active, sort_order, labor_count, created_at, updated_at
        FROM cargo_types 
        WHERE name = @name
      `);

    return NextResponse.json({
      success: true,
      message: 'Yük tipi başarıyla oluşturuldu',
      data: newRecord.recordset[0]
    });
  } catch (error) {
    console.error('Cargo type creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Yük tipi oluşturulurken hata oluştu' },
      { status: 500 }
    );
  }
}

// PUT - Yük tipi güncelle (Admin için)
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

    const { id, name, description, image_url, is_active, sort_order, labor_count } = await request.json();

    if (!id || !name || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'ID ve yük tipi adı gereklidir' },
        { status: 400 }
      );
    }

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Yük tipi var mı kontrol et
    const existingCheck = await pool.request()
      .input('id', id)
      .query('SELECT id FROM cargo_types WHERE id = @id');

    if (existingCheck.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Yük tipi bulunamadı' },
        { status: 404 }
      );
    }

    // Aynı isimde başka yük tipi var mı kontrol et
    const nameCheck = await pool.request()
      .input('name', name.trim())
      .input('id', id)
      .query('SELECT id FROM cargo_types WHERE name = @name AND id != @id');

    if (nameCheck.recordset.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Bu isimde başka bir yük tipi zaten mevcut' },
        { status: 400 }
      );
    }

    // Yük tipini güncelle
    await pool.request()
      .input('id', id)
      .input('name', name.trim())
      .input('description', description || null)
      .input('image_url', image_url || null)
      .input('is_active', is_active)
      .input('sort_order', sort_order)
      .input('labor_count', labor_count)
      .query(`
        UPDATE cargo_types 
        SET name = @name, description = @description, image_url = @image_url, 
            is_active = @is_active, sort_order = @sort_order, labor_count = @labor_count, updated_at = GETDATE()
        WHERE id = @id
      `);

    // Güncellenen kaydı getir
    const updatedRecord = await pool.request()
      .input('id', id)
      .query(`
        SELECT id, name, description, image_url, is_active, sort_order, labor_count, created_at, updated_at
        FROM cargo_types 
        WHERE id = @id
      `);

    return NextResponse.json({
      success: true,
      message: 'Yük tipi başarıyla güncellendi',
      data: updatedRecord.recordset[0]
    });
  } catch (error) {
    console.error('Cargo type update error:', error);
    return NextResponse.json(
      { success: false, error: 'Yük tipi güncellenirken hata oluştu' },
      { status: 500 }
    );
  }
}