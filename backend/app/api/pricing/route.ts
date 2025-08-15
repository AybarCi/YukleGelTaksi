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
      
      return NextResponse.json({
        success: true,
        data: defaultSettings
      });
    }

    const settings = result.recordset[0];
    return NextResponse.json({
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

  } catch (error) {
    console.error('Pricing settings fetch error:', error);
    return NextResponse.json(
      { error: 'Fiyatlandırma ayarları alınırken hata oluştu' },
      { status: 500 }
    );
  }
}

// PUT - Pricing ayarlarını güncelle
export async function PUT(request: NextRequest) {
  try {
    // Supervisor authentication kontrolü
    const authResult = await authenticateSupervisorToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { base_price, price_per_km, price_per_kg, labor_price } = body;

    // Validation
    if (!base_price || !price_per_km || !price_per_kg || !labor_price) {
      return NextResponse.json(
        { error: 'Tüm fiyatlandırma parametreleri gereklidir' },
        { status: 400 }
      );
    }

    if (base_price < 0 || price_per_km < 0 || price_per_kg < 0 || labor_price < 0) {
      return NextResponse.json(
        { error: 'Fiyatlandırma parametreleri negatif olamaz' },
        { status: 400 }
      );
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
    
    return NextResponse.json({
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

  } catch (error) {
    console.error('Pricing settings update error:', error);
    return NextResponse.json(
      { error: 'Fiyatlandırma ayarları güncellenirken hata oluştu' },
      { status: 500 }
    );
  }
}