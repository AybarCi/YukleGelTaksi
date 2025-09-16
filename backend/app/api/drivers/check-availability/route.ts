import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../config/database';
import { authenticateToken } from '../../../../middleware/auth';
import SystemSettingsService from '../../../../services/systemSettingsService';

interface CheckAvailabilityRequest {
  pickupLatitude: number;
  pickupLongitude: number;
  vehicleTypeId?: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const authResult = await authenticateToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: 'Yetkisiz erişim' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { pickupLatitude, pickupLongitude, vehicleTypeId } = body as CheckAvailabilityRequest;

    // Validate required fields
    if (!pickupLatitude || !pickupLongitude) {
      return NextResponse.json(
        { success: false, error: 'Konum bilgileri gerekli' },
        { status: 400 }
      );
    }

    if (isNaN(pickupLatitude) || isNaN(pickupLongitude)) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz konum bilgisi' },
        { status: 400 }
      );
    }

    // Get system settings
    const systemSettings = SystemSettingsService.getInstance();
    const searchRadius = await systemSettings.getSetting('driver_search_radius_km', 15);
    const locationUpdateInterval = await systemSettings.getSetting('driver_location_update_interval_minutes', 10);

    // Connect to database
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Check for nearby available drivers
    const query = `
      SELECT COUNT(*) as driverCount
      FROM drivers d
      INNER JOIN users u ON d.user_id = u.id
      WHERE d.is_available = 1 
        AND d.is_active = 1
        AND d.is_approved = 1
        AND u.current_latitude IS NOT NULL 
        AND u.current_longitude IS NOT NULL
        AND (
          6371 * acos(
            cos(radians(@latitude)) * cos(radians(u.current_latitude)) *
            cos(radians(u.current_longitude) - radians(@longitude)) +
            sin(radians(@latitude)) * sin(radians(u.current_latitude))
          )
        ) <= @radius
        AND DATEDIFF(minute, u.last_location_update, GETDATE()) <= @locationUpdateInterval
        ${vehicleTypeId ? 'AND d.vehicle_type_id = @vehicleTypeId' : ''}
    `;

    const dbRequest = pool.request()
      .input('latitude', pickupLatitude)
      .input('longitude', pickupLongitude)
      .input('radius', searchRadius)
      .input('locationUpdateInterval', locationUpdateInterval);
    
    if (vehicleTypeId) {
      dbRequest.input('vehicleTypeId', vehicleTypeId);
    }

    const result = await dbRequest.query(query);

    const driverCount = result.recordset[0]?.driverCount || 0;
    const hasAvailableDrivers = driverCount > 0;

    return NextResponse.json({
      success: true,
      available: hasAvailableDrivers,
      hasAvailableDrivers,
      nearbyDriversCount: driverCount,
      driverCount,
      estimatedWaitTime: hasAvailableDrivers ? 5 : 0, // 5 dakika tahmini bekleme süresi
      searchRadius,
      message: hasAvailableDrivers 
        ? `${driverCount} sürücü bulundu (${searchRadius}km yarıçapında)`
        : `${searchRadius}km yarıçapında müsait sürücü bulunamadı`
    });

  } catch (error) {
    console.error('Check driver availability error:', error);
    return NextResponse.json(
      { success: false, error: 'Sürücü kontrolü yapılırken hata oluştu' },
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