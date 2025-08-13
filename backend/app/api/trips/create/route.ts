import DatabaseConnection from '../../../../config/database';

interface CreateTripRequest {
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  paymentMethod: 'cash' | 'card' | 'wallet';
}

interface ApiResponse {
  message?: string;
  error?: string;
  trip?: any;
  estimatedPrice?: number;
  estimatedDuration?: number;
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

// Mesafe hesaplama (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Dünya'nın yarıçapı (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Fiyat hesaplama
function calculatePrice(distanceKm: number): number {
  const basePrice = 15; // Başlangıç ücreti (TL)
  const pricePerKm = 3.5; // Km başına ücret (TL)
  const minPrice = 20; // Minimum ücret (TL)
  
  const calculatedPrice = basePrice + (distanceKm * pricePerKm);
  return Math.max(calculatedPrice, minPrice);
}

// Süre hesaplama (basit)
function calculateDuration(distanceKm: number): number {
  const avgSpeedKmh = 30; // Ortalama hız (km/h)
  return Math.ceil((distanceKm / avgSpeedKmh) * 60); // Dakika cinsinden
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

    const body: CreateTripRequest = await request.json();
    const {
      pickupAddress,
      pickupLatitude,
      pickupLongitude,
      destinationAddress,
      destinationLatitude,
      destinationLongitude,
      paymentMethod
    } = body;

    // Validasyon
    if (!pickupAddress || !destinationAddress) {
      const response: ApiResponse = { error: 'Başlangıç ve varış adresleri gerekli' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!pickupLatitude || !pickupLongitude || !destinationLatitude || !destinationLongitude) {
      const response: ApiResponse = { error: 'Konum bilgileri gerekli' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!['cash', 'card', 'wallet'].includes(paymentMethod)) {
      const response: ApiResponse = { error: 'Geçerli bir ödeme yöntemi seçin' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mesafe ve fiyat hesaplama
    const distanceKm = calculateDistance(
      pickupLatitude,
      pickupLongitude,
      destinationLatitude,
      destinationLongitude
    );
    
    const estimatedPrice = calculatePrice(distanceKm);
    const estimatedDuration = calculateDuration(distanceKm);

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Kullanıcının aktif bir yolculuğu var mı kontrol et
      const activeTrip = await pool.request()
        .input('user_id', authUser.userId)
        .query(`
          SELECT id FROM trips 
          WHERE user_id = @user_id 
            AND trip_status IN ('requested', 'accepted', 'started')
        `);

      if (activeTrip.recordset.length > 0) {
        const response: ApiResponse = { error: 'Zaten aktif bir yolculuğunuz var' };
        return new Response(JSON.stringify(response), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Yeni yolculuk oluştur
      const createResult = await pool.request()
        .input('user_id', authUser.userId)
        .input('pickup_address', pickupAddress)
        .input('pickup_latitude', pickupLatitude)
        .input('pickup_longitude', pickupLongitude)
        .input('destination_address', destinationAddress)
        .input('destination_latitude', destinationLatitude)
        .input('destination_longitude', destinationLongitude)
        .input('estimated_price', estimatedPrice)
        .input('distance_km', distanceKm)
        .input('duration_minutes', estimatedDuration)
        .input('payment_method', paymentMethod)
        .query(`
          INSERT INTO trips (
            user_id, pickup_address, pickup_latitude, pickup_longitude,
            destination_address, destination_latitude, destination_longitude,
            estimated_price, distance_km, duration_minutes, payment_method
          )
          OUTPUT INSERTED.*
          VALUES (
            @user_id, @pickup_address, @pickup_latitude, @pickup_longitude,
            @destination_address, @destination_latitude, @destination_longitude,
            @estimated_price, @distance_km, @duration_minutes, @payment_method
          )
        `);

      const trip = createResult.recordset[0];

      const response: ApiResponse = {
        message: 'Yolculuk talebi oluşturuldu',
        trip: {
          id: trip.id,
          pickupAddress: trip.pickup_address,
          destinationAddress: trip.destination_address,
          estimatedPrice: trip.estimated_price,
          distanceKm: trip.distance_km,
          durationMinutes: trip.duration_minutes,
          paymentMethod: trip.payment_method,
          status: trip.trip_status,
          requestedAt: trip.requested_at
        },
        estimatedPrice,
        estimatedDuration
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
    console.error('Yolculuk oluşturma hatası:', error);
    const response: ApiResponse = { error: 'Yolculuk oluşturulurken bir hata oluştu' };
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