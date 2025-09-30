import DatabaseConnection from '../../../../config/database';

interface CancelTripRequest {
  tripId: number;
  reason?: string;
}

interface ApiResponse {
  message?: string;
  error?: string;
  trip?: any;
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

export async function POST(request: Request): Promise<Response> {
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

    const body: CancelTripRequest = await request.json();
    const { tripId, reason } = body;

    // Validasyon
    if (!tripId) {
      const response: ApiResponse = { error: 'Yolculuk ID gerekli' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Yolculuğun var olduğunu ve kullanıcıya ait olduğunu kontrol et
      const tripCheck = await pool.request()
        .input('trip_id', tripId)
        .input('user_id', authUser.userId)
        .query(`
          SELECT id, trip_status, driver_id, started_at
          FROM trips 
          WHERE id = @trip_id AND user_id = @user_id
        `);

      if (tripCheck.recordset.length === 0) {
        const response: ApiResponse = { error: 'Yolculuk bulunamadı' };
        return new Response(JSON.stringify(response), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const trip = tripCheck.recordset[0];

      // Yolculuk durumu kontrolü
      if (!['requested', 'accepted'].includes(trip.trip_status)) {
        let errorMessage = 'Bu yolculuk iptal edilemez';
        
        if (trip.trip_status === 'started') {
          errorMessage = 'Başlamış yolculuk iptal edilemez';
        } else if (trip.trip_status === 'completed') {
          errorMessage = 'Tamamlanmış yolculuk iptal edilemez';
        } else if (trip.trip_status === 'cancelled') {
          errorMessage = 'Yolculuk zaten iptal edilmiş';
        }

        const response: ApiResponse = { error: errorMessage };
        return new Response(JSON.stringify(response), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Yolculuğu iptal et
      const cancelResult = await pool.request()
        .input('trip_id', tripId)
        .input('cancel_reason', reason || 'Kullanıcı tarafından iptal edildi')
        .query(`
          UPDATE trips 
          SET 
            trip_status = 'cancelled',
            cancelled_at = DATEADD(hour, 3, GETDATE()),
            cancel_reason = @cancel_reason
          OUTPUT INSERTED.*
          WHERE id = @trip_id
        `);

      const cancelledTrip = cancelResult.recordset[0];

      // Eğer sürücü atanmışsa, sürücüyü müsait yap
      if (trip.driver_id) {
        await pool.request()
          .input('driver_id', trip.driver_id)
          .query(`
            UPDATE drivers 
            SET is_available = 1, current_trip_id = NULL
            WHERE id = @driver_id
          `);
      }

      const response: ApiResponse = {
        message: 'Yolculuk başarıyla iptal edildi',
        trip: {
          id: cancelledTrip.id,
          status: cancelledTrip.trip_status,
          cancelledAt: cancelledTrip.cancelled_at,
          cancelReason: cancelledTrip.cancel_reason
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
    console.error('Yolculuk iptal etme hatası:', error);
    const response: ApiResponse = { error: 'Yolculuk iptal edilirken bir hata oluştu' };
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}