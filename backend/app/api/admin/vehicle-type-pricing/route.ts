import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../config/database';
import { authenticateSupervisorToken } from '../../../../middleware/supervisorAuth';

interface VehicleTypePricing {
  id?: number;
  vehicle_type_id: number;
  vehicle_type_name?: string;
  base_price: number;
  price_per_km: number;
  labor_price: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// GET - Tüm araç tipi fiyatlandırmalarını getir (Admin)
export async function GET(request: NextRequest) {
  try {
    // Supervisor authentication kontrolü
    const authResult = await authenticateSupervisorToken(request);
    if (!authResult.success) {
      const authErrorResponse = NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
      
      // CORS headers ekle
      authErrorResponse.headers.set('Access-Control-Allow-Origin', '*');
      authErrorResponse.headers.set('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
      authErrorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      return authErrorResponse;
    }

    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    const result = await pool.request()
      .query(`
        SELECT 
          COALESCE(vtp.id, 0) as id,
          vt.id as vehicle_type_id,
          vt.name as vehicle_type_name,
          COALESCE(vtp.base_price, 50.00) as base_price,
          COALESCE(vtp.price_per_km, 5.00) as price_per_km,
          COALESCE(vtp.labor_price, 25.00) as labor_price,
          COALESCE(vtp.is_active, 1) as is_active,
          vtp.created_at,
          vtp.updated_at
        FROM vehicle_types vt
        LEFT JOIN vehicle_type_pricing vtp ON vt.id = vtp.vehicle_type_id AND vtp.is_active = 1
        WHERE vt.is_active = 1
        ORDER BY vt.name ASC
      `);

    const response = NextResponse.json({
      success: true,
      data: result.recordset
    });
    
    // CORS headers ekle
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return response;
  } catch (error) {
    console.error('Vehicle type pricing fetch error:', error);
    const errorResponse = NextResponse.json(
      { success: false, error: 'Araç tipi fiyatlandırmaları getirilirken hata oluştu' },
      { status: 500 }
    );
    
    // CORS headers ekle
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return errorResponse;
  }
}

// PUT - Araç tipi fiyatlandırmasını güncelle (Admin)
export async function PUT(request: NextRequest) {
  try {
    // Supervisor authentication kontrolü
    const authResult = await authenticateSupervisorToken(request);
    if (!authResult.success) {
      const authErrorResponse = NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
      
      // CORS headers ekle
      authErrorResponse.headers.set('Access-Control-Allow-Origin', '*');
      authErrorResponse.headers.set('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
      authErrorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      return authErrorResponse;
    }

    const body = await request.json();
    const { vehicle_type_id, base_price, price_per_km, labor_price } = body;

    // Validation
    if (!vehicle_type_id || !base_price || !price_per_km || !labor_price) {
      const validationErrorResponse = NextResponse.json(
        { error: 'Araç tipi, temel ücret, km başına ücret ve hammaliye ücreti gereklidir' },
        { status: 400 }
      );
      
      // CORS headers ekle
      validationErrorResponse.headers.set('Access-Control-Allow-Origin', '*');
      validationErrorResponse.headers.set('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
      validationErrorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      return validationErrorResponse;
    }

    // Negatif değer kontrolü
    if (base_price < 0 || price_per_km < 0 || labor_price < 0) {
      const negativeErrorResponse = NextResponse.json(
        { error: 'Fiyat değerleri negatif olamaz' },
        { status: 400 }
      );
      
      // CORS headers ekle
      negativeErrorResponse.headers.set('Access-Control-Allow-Origin', '*');
      negativeErrorResponse.headers.set('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
      negativeErrorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      return negativeErrorResponse;
    }

    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    // Önce mevcut kaydı kontrol et
    const existingResult = await pool.request()
      .input('vehicle_type_id', vehicle_type_id)
      .query('SELECT id FROM vehicle_type_pricing WHERE vehicle_type_id = @vehicle_type_id');
    
    if (existingResult.recordset.length > 0) {
      // Güncelle
      await pool.request()
        .input('vehicle_type_id', vehicle_type_id)
        .input('base_price', base_price)
        .input('price_per_km', price_per_km)
        .input('labor_price', labor_price)
        .query(`
          UPDATE vehicle_type_pricing 
          SET base_price = @base_price, 
              price_per_km = @price_per_km, 
              labor_price = @labor_price,
              updated_at = GETDATE()
          WHERE vehicle_type_id = @vehicle_type_id
        `);
    } else {
      // Yeni kayıt oluştur
      await pool.request()
        .input('vehicle_type_id', vehicle_type_id)
        .input('base_price', base_price)
        .input('price_per_km', price_per_km)
        .input('labor_price', labor_price)
        .query(`
          INSERT INTO vehicle_type_pricing (vehicle_type_id, base_price, price_per_km, labor_price)
          VALUES (@vehicle_type_id, @base_price, @price_per_km, @labor_price)
        `);
    }

    const response = NextResponse.json({
      success: true,
      message: 'Fiyatlandırma başarıyla güncellendi'
    });
    
    // CORS headers ekle
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return response;
  } catch (error) {
    console.error('Vehicle type pricing update error:', error);
    const errorResponse = NextResponse.json(
      { success: false, error: 'Fiyatlandırma güncellenirken hata oluştu' },
      { status: 500 }
    );
    
    // CORS headers ekle
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return errorResponse;
  }
}

// OPTIONS - CORS preflight
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}