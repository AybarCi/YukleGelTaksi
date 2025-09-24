import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../config/database';
import { authenticateToken } from '../../../middleware/auth';

interface CalculatePriceRequest {
  distance_km: number;
  labor_count: number;
  vehicle_type_id: number;
  pickup_latitude?: number;
  pickup_longitude?: number;
  destination_latitude?: number;
  destination_longitude?: number;
}

interface PriceCalculationResult {
  base_price: number;
  distance_price: number;
  labor_price: number;
  total_price: number;
  breakdown: {
    base_fee: string;
    distance_fee: string;
    labor_fee: string;
    total: string;
  };
  distance_km: number;
  labor_count: number;
  vehicle_type_id: number;
}

// POST - Fiyat hesaplama
export async function POST(request: NextRequest) {
  try {
    // Request'i clone et çünkü body sadece bir kez okunabilir
    const clonedRequest = request.clone();
    
    // Kullanıcı authentication kontrolü
    const authResult = await authenticateToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    let body: CalculatePriceRequest;
    try {
      // Clone edilmiş request'ten body'yi oku
      body = await clonedRequest.json();
    } catch (jsonError) {
      console.error('JSON parse error:', jsonError);
      console.error('Request headers:', Object.fromEntries(request.headers.entries()));
      console.error('Request method:', request.method);
      console.error('Request URL:', request.url);
      return NextResponse.json(
        { error: 'Geçersiz JSON formatı' },
        { status: 400 }
      );
    }
    const { distance_km, labor_count, vehicle_type_id } = body;

    // Validation
    if (distance_km === undefined || labor_count === undefined || vehicle_type_id === undefined) {
      return NextResponse.json(
        { error: 'Mesafe (km), hammal sayısı ve araç tipi gereklidir' },
        { status: 400 }
      );
    }

    if (distance_km < 0 || labor_count < 0 || vehicle_type_id <= 0) {
      return NextResponse.json(
        { error: 'Mesafe, hammal sayısı negatif olamaz ve araç tipi geçerli olmalıdır' },
        { status: 400 }
      );
    }

    if (distance_km > 1000) {
      return NextResponse.json(
        { error: 'Maksimum mesafe 1000 km olabilir' },
        { status: 400 }
      );
    }



    if (labor_count > 20) {
      return NextResponse.json(
        { error: 'Maksimum hammal sayısı 20 olabilir' },
        { status: 400 }
      );
    }

    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    // Araç tipi bazlı pricing ayarlarını al
    const pricingResult = await pool.request()
      .input('vehicle_type_id', vehicle_type_id)
      .query(`
        SELECT 
          vtp.base_price, 
          vtp.price_per_km, 
          vtp.labor_price,
          vt.name as vehicle_type_name
        FROM vehicle_type_pricing vtp
        INNER JOIN vehicle_types vt ON vtp.vehicle_type_id = vt.id
        WHERE vtp.vehicle_type_id = @vehicle_type_id AND vtp.is_active = 1
      `);

    let pricingSettings;
    if (pricingResult.recordset.length === 0) {
      return NextResponse.json(
        { error: 'Seçilen araç tipi için fiyatlandırma bulunamadı' },
        { status: 404 }
      );
    } else {
      const settings = pricingResult.recordset[0];
      pricingSettings = {
        base_price: parseFloat(settings.base_price),
        price_per_km: parseFloat(settings.price_per_km),
        labor_price: parseFloat(settings.labor_price),
        vehicle_type_name: settings.vehicle_type_name
      };
    }

    // Fiyat hesaplama - Araç tipi bazlı
    
    let basePrice, distancePrice, laborPrice, totalPrice;
    
    // Parametreleri hesapla
    distancePrice = distance_km * pricingSettings.price_per_km;
    laborPrice = labor_count * pricingSettings.labor_price;
    
    // Hesaplanan toplam ücret (mesafe + hammaliye)
    const calculatedPrice = distancePrice + laborPrice;
    
    // Eğer hesaplanan ücret base ücretten düşükse base ücret uygulanır
    if (calculatedPrice < pricingSettings.base_price) {
      // Base ücret daha yüksek - base ücret uygulanır
      basePrice = pricingSettings.base_price;
      distancePrice = 0;
      totalPrice = pricingSettings.base_price;
    } else {
      // Hesaplanan ücret daha yüksek - km + hammaliye kullanılır
      basePrice = 0;
      totalPrice = calculatedPrice;
    }

    const result: PriceCalculationResult = {
      base_price: basePrice,
      distance_price: distancePrice,
      labor_price: laborPrice,
      total_price: totalPrice,
      breakdown: {
        base_fee: `Temel Ücret (${pricingSettings.vehicle_type_name}): ${basePrice.toFixed(2)} TL`,
        distance_fee: `Mesafe Ücreti (${distance_km} km): ${distancePrice.toFixed(2)} TL`,
        labor_fee: `Hammaliye Ücreti (${labor_count} hammal): ${laborPrice.toFixed(2)} TL`,
        total: `Toplam: ${totalPrice.toFixed(2)} TL`
      },
      distance_km,
      labor_count,
      vehicle_type_id
    };

    return NextResponse.json({
      success: true,
      message: 'Fiyat hesaplama başarılı',
      data: result
    });

  } catch (error) {
    console.error('Price calculation error:', error);
    return NextResponse.json(
      { error: 'Fiyat hesaplama sırasında hata oluştu' },
      { status: 500 }
    );
  }
}

// OPTIONS method for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}