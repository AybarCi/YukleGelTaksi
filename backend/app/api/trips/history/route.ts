import DatabaseConnection from '../../../../config/database';

interface ApiResponse {
  message?: string;
  error?: string;
  trips?: any[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
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

    // URL parametrelerini al
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50); // Max 50
    const status = url.searchParams.get('status'); // completed, cancelled, all
    const offset = (page - 1) * limit;

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Status filtresi için WHERE koşulu
      let statusCondition = '';
      if (status === 'completed') {
        statusCondition = "AND t.trip_status = 'completed'";
      } else if (status === 'cancelled') {
        statusCondition = "AND t.trip_status = 'cancelled'";
      } else {
        // Varsayılan olarak sadece tamamlanmış ve iptal edilmiş yolculukları göster
        statusCondition = "AND t.trip_status IN ('completed', 'cancelled')";
      }

      // Toplam kayıt sayısını al
      const countResult = await pool.request()
        .input('user_id', authUser.userId)
        .query(`
          SELECT COUNT(*) as total
          FROM trips t
          WHERE t.user_id = @user_id ${statusCondition}
        `);

      const total = countResult.recordset[0].total;
      const totalPages = Math.ceil(total / limit);

      // Yolculuk geçmişini al
      const tripsResult = await pool.request()
        .input('user_id', authUser.userId)
        .input('offset', offset)
        .input('limit', limit)
        .query(`
          SELECT 
            t.*,
            d.first_name as driver_first_name,
            d.last_name as driver_last_name,
            d.phone_number as driver_phone,
            d.vehicle_plate as driver_plate,
            d.vehicle_model as driver_vehicle,
            d.rating as driver_rating,
            tr.rating as trip_rating,
            tr.comment as trip_comment
          FROM trips t
          LEFT JOIN drivers d ON t.driver_id = d.id
          LEFT JOIN trip_ratings tr ON t.id = tr.trip_id
          WHERE t.user_id = @user_id ${statusCondition}
          ORDER BY t.requested_at DESC
          OFFSET @offset ROWS
          FETCH NEXT @limit ROWS ONLY
        `);

      const trips = tripsResult.recordset.map((trip: any) => ({
        id: trip.id,
        pickupAddress: trip.pickup_address,
        destinationAddress: trip.destination_address,
        estimatedPrice: trip.estimated_price,
        finalPrice: trip.final_price,
        distanceKm: trip.distance_km,
        durationMinutes: trip.duration_minutes,
        paymentMethod: trip.payment_method,
        status: trip.trip_status,
        requestedAt: trip.requested_at,
        acceptedAt: trip.accepted_at,
        startedAt: trip.started_at,
        completedAt: trip.completed_at,
        cancelledAt: trip.cancelled_at,
        cancelReason: trip.cancel_reason,
        driver: trip.driver_id ? {
          id: trip.driver_id,
          firstName: trip.driver_first_name,
          lastName: trip.driver_last_name,
          phone: trip.driver_phone,
          vehiclePlate: trip.driver_plate,
          vehicleModel: trip.driver_vehicle,
          rating: trip.driver_rating
        } : null,
        rating: {
          rating: trip.trip_rating,
          comment: trip.trip_comment
        }
      }));

      const response: ApiResponse = {
        message: 'Yolculuk geçmişi alındı',
        trips,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
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
    console.error('Yolculuk geçmişi alma hatası:', error);
    const response: ApiResponse = { error: 'Yolculuk geçmişi alınırken bir hata oluştu' };
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