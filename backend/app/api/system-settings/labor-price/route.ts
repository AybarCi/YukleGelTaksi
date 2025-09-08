import { NextRequest, NextResponse } from 'next/server';
import SystemSettingsService from '../../../../services/systemSettingsService';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const systemSettings = SystemSettingsService.getInstance();
    const laborPrice = await systemSettings.getLaborPricePerPerson();

    return NextResponse.json({
      success: true,
      laborPrice
    });
  } catch (error) {
    console.error('Labor price fetch error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Hammaliye fiyatı alınırken hata oluştu',
        laborPrice: 800 // Fallback değer pricing_settings tablosundaki varsayılan değer
      },
      { status: 500 }
    );
  }
}