import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../config/database';
import { authenticateSupervisorToken } from '../../../middleware/supervisorAuth';

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

// GET - Tüm araç tipi fiyatlandırmalarını getir
export async function GET(request: NextRequest) {
  try {
    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    const result = await pool.request()
      .query(`
        SELECT 
          vtp.id,
          vtp.vehicle_type_id,
          vt.name as vehicle_type_name,
          vtp.base_price,
          vtp.price_per_km,
          vtp.labor_price,
          vtp.is_active,
          vtp.created_at,
          vtp.updated_at
        FROM vehicle_type_pricing vtp
        INNER JOIN vehicle_types vt ON vtp.vehicle_type_id = vt.id
        WHERE vt.is_active = 1
        ORDER BY vt.name
      `);

    const response = NextResponse.json({
      success: true,
      message: 'Araç tipi fiyatlandırmaları başarıyla getirildi',
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
      { error: 'Araç tipi fiyatlandırmaları getirilirken hata oluştu' },
      { status: 500 }
    );
    
    // CORS headers ekle
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return errorResponse;
  }
}

// PUT - Araç tipi fiyatlandırmasını güncelle
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

    if (base_price < 0 || price_per_km < 0 || labor_price < 0) {
      const negativeErrorResponse = NextResponse.json(
        { error: 'Fiyatlandırma parametreleri negatif olamaz' },
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
    
    // Mevcut ayar var mı kontrol et
    const existingResult = await pool.request()
      .input('vehicle_type_id', vehicle_type_id)
      .query('SELECT id FROM vehicle_type_pricing WHERE vehicle_type_id = @vehicle_type_id');

    let result;
    
    if (existingResult.recordset.length > 0) {
      // Güncelle
      const pricingId = existingResult.recordset[0].id;
      result = await pool.request()
        .input('id', pricingId)
        .input('base_price', base_price)
        .input('price_per_km', price_per_km)
        .input('labor_price', labor_price)
        .query(`
          UPDATE vehicle_type_pricing 
          SET 
            base_price = @base_price,
            price_per_km = @price_per_km,
            labor_price = @labor_price,
            updated_at = GETDATE()
          OUTPUT INSERTED.*
          WHERE id = @id
        `);
    } else {
      // Yeni kayıt oluştur
      result = await pool.request()
        .input('vehicle_type_id', vehicle_type_id)
        .input('base_price', base_price)
        .input('price_per_km', price_per_km)
        .input('labor_price', labor_price)
        .query(`
          INSERT INTO vehicle_type_pricing (vehicle_type_id, base_price, price_per_km, labor_price)
          OUTPUT INSERTED.*
          VALUES (@vehicle_type_id, @base_price, @price_per_km, @labor_price)
        `);
    }

    const updatedSettings = result.recordset[0];
    
    const response = NextResponse.json({
      success: true,
      message: 'Araç tipi fiyatlandırması başarıyla güncellendi',
      data: updatedSettings
    });

    // CORS headers ekle
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;

  } catch (error) {
    console.error('Vehicle type pricing update error:', error);
    const errorResponse = NextResponse.json(
      { error: 'Araç tipi fiyatlandırması güncellenirken hata oluştu' },
      { status: 500 }
    );
    
    // CORS headers ekle
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return errorResponse;
  }
}

// OPTIONS method for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}