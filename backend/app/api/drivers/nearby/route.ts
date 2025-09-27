import DatabaseConnection from '../../../../config/database';
import SystemSettingsService from '../../../../services/systemSettingsService';

interface NearbyDriversRequest {
  latitude: number;
  longitude: number;
  radius?: number; // km cinsinden, varsayılan 10km
}

interface ApiResponse {
  message?: string;
  error?: string;
  drivers?: any[];
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

    const body: NearbyDriversRequest = await request.json();
    const { latitude, longitude, radius = 10 } = body;

    // Validasyon
    if (!latitude || !longitude) {
      const response: ApiResponse = { error: 'Konum bilgileri gerekli' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      const response: ApiResponse = { error: 'Geçersiz konum bilgileri' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Sistem ayarlarından değerleri al
      const systemSettings = SystemSettingsService.getInstance();
      const locationUpdateInterval = await systemSettings.getSetting('driver_location_update_interval_minutes', 10);
      const maxDriversPerRequest = await systemSettings.getSetting('max_drivers_per_request', 20);

      // Müsait sürücüleri al
      const driversResult = await pool.request()
        .input('locationUpdateInterval', locationUpdateInterval)
        .query(`
          SELECT 
            d.id, u.first_name, u.last_name, u.phone_number,
            u.current_latitude, u.current_longitude,
            d.vehicle_plate, d.vehicle_model, d.vehicle_color,
            d.rating, d.is_available, u.last_location_update
          FROM drivers d
          INNER JOIN users u ON d.user_id = u.id
          WHERE d.is_available = 1 
            AND u.current_latitude IS NOT NULL 
            AND u.current_longitude IS NOT NULL
            AND ABS(DATEDIFF(minute, u.last_location_update, DATEADD(hour, 3, GETDATE()))) <= @locationUpdateInterval
        `);

      const allDrivers = driversResult.recordset;
      
      // Mesafe hesapla ve filtrele
      const nearbyDrivers = allDrivers
        .map((driver: any) => {
          const distance = calculateDistance(
            latitude,
            longitude,
            driver.current_latitude,
            driver.current_longitude
          );
          
          return {
            ...driver,
            distance: Math.round(distance * 100) / 100 // 2 ondalık basamak
          };
        })
        .filter((driver: any) => driver.distance <= radius)
        .sort((a: any, b: any) => a.distance - b.distance) // Mesafeye göre sırala
        .slice(0, maxDriversPerRequest); // Sistem ayarından maksimum sürücü sayısı

      const drivers = nearbyDrivers.map((driver: any) => ({
        id: driver.id,
        firstName: driver.first_name,
        lastName: driver.last_name,
        phone: driver.phone_number,
        location: {
          latitude: driver.current_latitude,
          longitude: driver.current_longitude
        },
        vehicle: {
          plate: driver.vehicle_plate,
          model: driver.vehicle_model,
          color: driver.vehicle_color
        },
        rating: driver.rating,
        distance: driver.distance,
        lastLocationUpdate: driver.last_location_update
      }));

      const response: ApiResponse = {
        message: `${drivers.length} yakın sürücü bulundu`,
        drivers
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
    console.error('Yakın sürücü arama hatası:', error);
    const response: ApiResponse = { error: 'Yakın sürücüler aranırken bir hata oluştu' };
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