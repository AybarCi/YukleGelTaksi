import DatabaseConnection from '../../../../config/database';

interface RateTripRequest {
  tripId: number;
  rating: number;
  comment?: string;
}

interface ApiResponse {
  message?: string;
  error?: string;
  rating?: any;
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

    const body: RateTripRequest = await request.json();
    const { tripId, rating, comment } = body;

    // Validasyon
    if (!tripId) {
      const response: ApiResponse = { error: 'Yolculuk ID gerekli' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!rating || rating < 1 || rating > 5) {
      const response: ApiResponse = { error: 'Geçerli bir puan verin (1-5 arası)' };
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
          SELECT id, trip_status, driver_id, completed_at
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

      // Yolculuk tamamlanmış mı kontrol et
      if (trip.trip_status !== 'completed') {
        const response: ApiResponse = { error: 'Sadece tamamlanmış yolculuklar değerlendirilebilir' };
        return new Response(JSON.stringify(response), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Daha önce değerlendirilmiş mi kontrol et
      const existingRating = await pool.request()
        .input('trip_id', tripId)
        .query(`
          SELECT id FROM trip_ratings WHERE trip_id = @trip_id
        `);

      if (existingRating.recordset.length > 0) {
        const response: ApiResponse = { error: 'Bu yolculuk zaten değerlendirilmiş' };
        return new Response(JSON.stringify(response), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Değerlendirmeyi kaydet
      const ratingResult = await pool.request()
        .input('trip_id', tripId)
        .input('user_id', authUser.userId)
        .input('driver_id', trip.driver_id)
        .input('rating', rating)
        .input('comment', comment || '')
        .query(`
          INSERT INTO trip_ratings (
            trip_id, user_id, driver_id, rating, comment
          )
          OUTPUT INSERTED.*
          VALUES (
            @trip_id, @user_id, @driver_id, @rating, @comment
          )
        `);

      const savedRating = ratingResult.recordset[0];

      // Sürücünün ortalama puanını güncelle
      if (trip.driver_id) {
        const avgRatingResult = await pool.request()
          .input('driver_id', trip.driver_id)
          .query(`
            SELECT AVG(CAST(rating as FLOAT)) as avg_rating
            FROM trip_ratings 
            WHERE driver_id = @driver_id
          `);

        const avgRating = avgRatingResult.recordset[0].avg_rating;

        await pool.request()
          .input('driver_id', trip.driver_id)
          .input('avg_rating', Math.round(avgRating * 10) / 10) // 1 ondalık basamak
          .query(`
            UPDATE drivers 
            SET rating = @avg_rating
            WHERE id = @driver_id
          `);
      }

      const response: ApiResponse = {
        message: 'Değerlendirme başarıyla kaydedildi',
        rating: {
          id: savedRating.id,
          tripId: savedRating.trip_id,
          rating: savedRating.rating,
          comment: savedRating.comment,
          createdAt: savedRating.created_at
        }
      };

      return new Response(JSON.stringify(response), {
        status: 201,
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
    console.error('Değerlendirme kaydetme hatası:', error);
    const response: ApiResponse = { error: 'Değerlendirme kaydedilirken bir hata oluştu' };
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