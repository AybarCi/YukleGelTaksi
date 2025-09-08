import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../config/database';
import { authenticateToken } from '../../../middleware/auth';

interface CalculatePriceRequest {
  distance_km: number;
  weight_kg: number;
  labor_count: number;
  pickup_latitude?: number;
  pickup_longitude?: number;
  destination_latitude?: number;
  destination_longitude?: number;
}

interface PriceCalculationResult {
  base_price: number;
  distance_price: number;
  weight_price: number;
  labor_price: number;
  total_price: number;
  breakdown: {
    base_fee: string;
    distance_fee: string;
    weight_fee: string;
    labor_fee: string;
    total: string;
  };
  distance_km: number;
  weight_kg: number;
  labor_count: number;
}

// POST - Fiyat hesaplama
export async function POST(request: NextRequest) {
  try {
    // Kullanıcı authentication kontrolü
    const authResult = await authenticateToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    const body: CalculatePriceRequest = await request.json();
    const { distance_km, weight_kg, labor_count } = body;

    // Validation
    if (distance_km === undefined || weight_kg === undefined || labor_count === undefined) {
      return NextResponse.json(
        { error: 'Mesafe (km), ağırlık (kg) ve hammal sayısı gereklidir' },
        { status: 400 }
      );
    }

    if (distance_km < 0 || weight_kg < 0 || labor_count < 0) {
      return NextResponse.json(
        { error: 'Mesafe, ağırlık ve hammal sayısı negatif olamaz' },
        { status: 400 }
      );
    }

    if (distance_km > 1000) {
      return NextResponse.json(
        { error: 'Maksimum mesafe 1000 km olabilir' },
        { status: 400 }
      );
    }

    if (weight_kg > 10000) {
      return NextResponse.json(
        { error: 'Maksimum ağırlık 10000 kg olabilir' },
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
    
    // Pricing ayarlarını al
    const pricingResult = await pool.request()
      .query(`
        SELECT TOP 1 
          base_price, price_per_km, price_per_kg, labor_price
        FROM pricing_settings 
        ORDER BY id DESC
      `);

    let pricingSettings;
    if (pricingResult.recordset.length === 0) {
      // Varsayılan değerler - backoffice ile uyumlu
      pricingSettings = {
        base_price: 2500.00,
        price_per_km: 100.00,
        price_per_kg: 20.00,
        labor_price: 800.00
      };
    } else {
      const settings = pricingResult.recordset[0];
      pricingSettings = {
        base_price: parseFloat(settings.base_price),
        price_per_km: parseFloat(settings.price_per_km),
        price_per_kg: parseFloat(settings.price_per_kg),
        labor_price: parseFloat(settings.labor_price)
      };
    }

    // Fiyat hesaplama - Backoffice kurallarına göre
    // Her zaman tüm parametreleri hesapla, sonra base ücret ile karşılaştır
    
    let basePrice, distancePrice, weightPrice, laborPrice, totalPrice;
    
    // Tüm parametreleri hesapla
    distancePrice = distance_km * pricingSettings.price_per_km;
    weightPrice = weight_kg * pricingSettings.price_per_kg;
    laborPrice = labor_count * pricingSettings.labor_price;
    
    // Hesaplanan toplam ücret
    const calculatedPrice = distancePrice + weightPrice + laborPrice;
    
    // Base ücret + hammaliye
    const baseWithLabor = pricingSettings.base_price + laborPrice;
    
    // Hangisi yüksekse onu kullan
    if (baseWithLabor > calculatedPrice) {
      // Base ücret daha yüksek - base ücret + hammaliye kullan
      basePrice = pricingSettings.base_price;
      distancePrice = 0;
      weightPrice = 0;
      totalPrice = baseWithLabor;
    } else {
      // Hesaplanan ücret daha yüksek - hesaplanan değerleri kullan
      basePrice = 0;
      totalPrice = calculatedPrice;
    }

    const result: PriceCalculationResult = {
      base_price: basePrice,
      distance_price: distancePrice,
      weight_price: weightPrice,
      labor_price: laborPrice,
      total_price: totalPrice,
      breakdown: {
        base_fee: `Temel Ücret: ${basePrice.toFixed(2)} TL`,
        distance_fee: `Mesafe Ücreti (${distance_km} km): ${distancePrice.toFixed(2)} TL`,
        weight_fee: `Ağırlık Ücreti (${weight_kg} kg): ${weightPrice.toFixed(2)} TL`,
        labor_fee: `Hammaliye Ücreti (${labor_count} hammal): ${laborPrice.toFixed(2)} TL`,
        total: `Toplam: ${totalPrice.toFixed(2)} TL`
      },
      distance_km,
      weight_kg,
      labor_count
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