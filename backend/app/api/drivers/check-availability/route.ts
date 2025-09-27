import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../config/database';
import SocketServer from '../../../../socket/socketServer';

export async function POST(request: NextRequest) {
  try {
    const { pickupLatitude, pickupLongitude, vehicleTypeId } = await request.json();

    // Validate required parameters
    if (!pickupLatitude || !pickupLongitude) {
      return NextResponse.json(
        { error: 'Pickup latitude and longitude are required' },
        { status: 400 }
      );
    }

    // Validate coordinates
    if (
      isNaN(pickupLatitude) || isNaN(pickupLongitude) ||
      pickupLatitude < -90 || pickupLatitude > 90 ||
      pickupLongitude < -180 || pickupLongitude > 180
    ) {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    console.log(`🔍 Check availability request: lat=${pickupLatitude}, lng=${pickupLongitude}, vehicleType=${vehicleTypeId || 'any'}`);

    // HYBRID APPROACH: Try socket memory first, fallback to database
    // const socketServer = null; // Socket server instance will be available from global state
    let result;

    // For now, always use database approach
    console.log('⚠️ Using database approach');
    result = await checkAvailabilityFromDatabase(pickupLatitude, pickupLongitude, vehicleTypeId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to check driver availability' },
        { status: 500 }
      );
    }

    console.log(`✅ Availability check result: ${result.driverCount} drivers available (source: ${result.source})`);

    return NextResponse.json({
      available: result.available,
      driverCount: result.driverCount,
      searchRadius: result.searchRadius,
      source: result.source,
      timestamp: result.timestamp
    });

  } catch (error) {
    console.error('❌ Error checking driver availability:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Fallback database function for when socket server is not available
async function checkAvailabilityFromDatabase(pickupLatitude: number, pickupLongitude: number, vehicleTypeId?: number) {
  try {
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Get system settings for search radius and location update interval
    const settingsResult = await pool.request().query(`
      SELECT setting_key, setting_value 
      FROM system_settings 
      WHERE setting_key IN ('driver_search_radius_km', 'driver_location_update_interval_minutes')
    `);

    const settings: { [key: string]: number } = {};
    settingsResult.recordset.forEach((row: any) => {
      settings[row.setting_key] = parseFloat(row.setting_value);
    });

    const searchRadiusKm = settings['driver_search_radius_km'] || 5;
    const locationUpdateIntervalMinutes = settings['driver_location_update_interval_minutes'] || 10;

    console.log(`🔧 Database settings: radius=${searchRadiusKm}km, locationInterval=${locationUpdateIntervalMinutes}min`);

    // Build the query
    let query = `
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
        AND ABS(DATEDIFF(minute, u.last_location_update, DATEADD(hour, 3, GETDATE()))) <= @locationInterval
    `;

    const request = pool.request()
      .input('latitude', pickupLatitude)
      .input('longitude', pickupLongitude)
      .input('radius', searchRadiusKm)
      .input('locationInterval', locationUpdateIntervalMinutes);

    // Add vehicle type filter if specified
    if (vehicleTypeId) {
      query += ' AND d.vehicle_type_id = @vehicleTypeId';
      request.input('vehicleTypeId', vehicleTypeId);
    }

    const result = await request.query(query);
    const driverCount = result.recordset[0]?.driverCount || 0;

    return {
      success: true,
      source: 'database_only',
      available: driverCount > 0,
      driverCount: driverCount,
      searchRadius: searchRadiusKm,
      timestamp: new Date()
    };

  } catch (error: any) {
    console.error('❌ Database availability check failed:', error);
    return {
      success: false,
      error: error.message
    };
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