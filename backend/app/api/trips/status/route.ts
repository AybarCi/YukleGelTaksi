import DatabaseConnection from '../../../../config/database';

interface ApiResponse {
  message?: string;
  error?: string;
  trip?: any;
  driver?: any;
}

// Basit auth helper
function extractUserFromToken(authHeader: string | null): { userId: number } | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    const token = authHeader.substring(7);
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    // Auth kontrolü
    const authHeader = request.headers.get('authorization');
    const authUser = extractUserFromToken(authHeader);
    
    if (!authUser) {
      const response: ApiResponse = { error: 'Yetkilendirme gerekli' };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Kullanıcının aktif yolculuğunu bul
      const tripResult = await pool.request()
        .input('user_id', authUser.userId)
        .query(`
          SELECT 
            t.*,
            d.first_name as driver_first_name,
            d.last_name as driver_last_name,
            d.phone_number as driver_phone,
            d.vehicle_plate as driver_plate,
            d.vehicle_model as driver_vehicle,
            d.rating as driver_rating
          FROM trips t
          LEFT JOIN drivers d ON t.driver_id = d.id
          WHERE t.user_id = @user_id 
            AND t.trip_status IN ('requested', 'accepted', 'started')
          ORDER BY t.requested_at DESC
        `);

      if (tripResult.recordset.length === 0) {
        const response: ApiResponse = { message: 'Aktif yolculuk bulunamadı' };
        return new Response(JSON.stringify(response), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const trip = tripResult.recordset[0];
      
      const tripData = {
        id: trip.id,
        pickupAddress: trip.pickup_address,
        pickupLatitude: trip.pickup_latitude,
        pickupLongitude: trip.pickup_longitude,
        destinationAddress: trip.destination_address,
        destinationLatitude: trip.destination_latitude,
        destinationLongitude: trip.destination_longitude,
        estimatedPrice: trip.estimated_price,
        finalPrice: trip.final_price,
        distanceKm: trip.distance_km,
        durationMinutes: trip.duration_minutes,
        paymentMethod: trip.payment_method,
        status: trip.trip_status,
        requestedAt: trip.requested_at,
        acceptedAt: trip.accepted_at,
        startedAt: trip.started_at,
        completedAt: trip.completed_at
      };

      let driverData = null;
      if (trip.driver_id) {
        driverData = {
          id: trip.driver_id,
          firstName: trip.driver_first_name,
          lastName: trip.driver_last_name,
          phone: trip.driver_phone,
          vehiclePlate: trip.driver_plate,
          vehicleModel: trip.driver_vehicle,
          rating: trip.driver_rating
        };
      }

      const response: ApiResponse = {
        message: 'Yolculuk durumu alındı',
        trip: tripData,
        driver: driverData
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (dbError) {
      console.error('Veritabanı hatası:', dbError);
      const response: ApiResponse = { error: 'Veritabanı hatası oluştu' };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Yolculuk durumu alma hatası:', error);
    const response: ApiResponse = { error: 'Yolculuk durumu alınırken bir hata oluştu' };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}