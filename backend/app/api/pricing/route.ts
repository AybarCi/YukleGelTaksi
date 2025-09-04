import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../config/database';
import { authenticateSupervisorToken } from '../../../middleware/supervisorAuth';

interface PricingSettings {
  id?: number;
  base_price: number;
  price_per_km: number;
  price_per_kg: number;
  labor_price: number;
  created_at?: string;
  updated_at?: string;
}

// GET - Pricing ayarlarını getir
export async function GET(request: NextRequest) {
  try {
    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    const result = await pool.request()
      .query(`
        SELECT TOP 1 
          id, base_price, price_per_km, price_per_kg, labor_price,
          created_at, updated_at
        FROM pricing_settings 
        ORDER BY id DESC
      `);

    if (result.recordset.length === 0) {
      // Eğer hiç ayar yoksa varsayılan değerleri döndür
      const defaultSettings: PricingSettings = {
        base_price: 50.00,
        price_per_km: 5.00,
        price_per_kg: 2.00,
        labor_price: 25.00
      };
      
      const response = NextResponse.json({
        success: true,
        data: defaultSettings
      });
      
      // CORS headers ekle
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      return response;
    }

    const settings = result.recordset[0];
    const response = NextResponse.json({
      success: true,
      data: {
        id: settings.id,
        base_price: parseFloat(settings.base_price),
        price_per_km: parseFloat(settings.price_per_km),
        price_per_kg: parseFloat(settings.price_per_kg),
        labor_price: parseFloat(settings.labor_price),
        created_at: settings.created_at,
        updated_at: settings.updated_at
      }
    });
    
    // CORS headers ekle
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return response;

  } catch (error) {
    console.error('Pricing settings fetch error:', error);
    const errorResponse = NextResponse.json(
      { error: 'Fiyatlandırma ayarları alınırken hata oluştu' },
      { status: 500 }
    );
    
    // CORS headers ekle
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return errorResponse;
  }
}

// OPTIONS - CORS preflight request için
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  
  // CORS headers ekle
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');
  
  return response;
}

// PUT - Pricing ayarlarını güncelle
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
      authErrorResponse.headers.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
      authErrorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      return authErrorResponse;
    }

    const body = await request.json();
    const { base_price, price_per_km, price_per_kg, labor_price } = body;

    // Validation
    if (!base_price || !price_per_km || !price_per_kg || !labor_price) {
      const validationErrorResponse = NextResponse.json(
        { error: 'Tüm fiyatlandırma parametreleri gereklidir' },
        { status: 400 }
      );
      
      // CORS headers ekle
      validationErrorResponse.headers.set('Access-Control-Allow-Origin', '*');
      validationErrorResponse.headers.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
      validationErrorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      return validationErrorResponse;
    }

    if (base_price < 0 || price_per_km < 0 || price_per_kg < 0 || labor_price < 0) {
      const negativeErrorResponse = NextResponse.json(
        { error: 'Fiyatlandırma parametreleri negatif olamaz' },
        { status: 400 }
      );
      
      // CORS headers ekle
      negativeErrorResponse.headers.set('Access-Control-Allow-Origin', '*');
      negativeErrorResponse.headers.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
      negativeErrorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      return negativeErrorResponse;
    }

    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    // Mevcut ayar var mı kontrol et
    const existingResult = await pool.request()
      .query('SELECT TOP 1 id FROM pricing_settings ORDER BY id DESC');

    let result;
    
    if (existingResult.recordset.length > 0) {
      // Güncelle
      const settingId = existingResult.recordset[0].id;
      result = await pool.request()
        .input('id', settingId)
        .input('base_price', base_price)
        .input('price_per_km', price_per_km)
        .input('price_per_kg', price_per_kg)
        .input('labor_price', labor_price)
        .query(`
          UPDATE pricing_settings 
          SET 
            base_price = @base_price,
            price_per_km = @price_per_km,
            price_per_kg = @price_per_kg,
            labor_price = @labor_price,
            updated_at = GETDATE()
          OUTPUT INSERTED.*
          WHERE id = @id
        `);
    } else {
      // Yeni kayıt oluştur
      result = await pool.request()
        .input('base_price', base_price)
        .input('price_per_km', price_per_km)
        .input('price_per_kg', price_per_kg)
        .input('labor_price', labor_price)
        .query(`
          INSERT INTO pricing_settings (base_price, price_per_km, price_per_kg, labor_price)
          OUTPUT INSERTED.*
          VALUES (@base_price, @price_per_km, @price_per_kg, @labor_price)
        `);
    }

    const updatedSettings = result.recordset[0];
    
    const response = NextResponse.json({
      success: true,
      message: 'Fiyatlandırma ayarları başarıyla güncellendi',
      data: {
        id: updatedSettings.id,
        base_price: parseFloat(updatedSettings.base_price),
        price_per_km: parseFloat(updatedSettings.price_per_km),
        price_per_kg: parseFloat(updatedSettings.price_per_kg),
        labor_price: parseFloat(updatedSettings.labor_price),
        created_at: updatedSettings.created_at,
        updated_at: updatedSettings.updated_at
      }
    });
    
    // CORS headers ekle
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return response;

  } catch (error) {
    console.error('Pricing settings update error:', error);
    const errorResponse = NextResponse.json(
      { error: 'Fiyatlandırma ayarları güncellenirken hata oluştu' },
      { status: 500 }
    );
    
    // CORS headers ekle
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return errorResponse;
  }
}