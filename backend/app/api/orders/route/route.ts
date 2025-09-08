import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../config/database';
import { authenticateToken } from '../../../../middleware/auth';

interface RouteRequest {
  orderId: number;
  phase: 'pickup' | 'delivery';
}

interface RouteResponse {
  success: boolean;
  route?: {
    coordinates: [number, number][];
    distance: number;
    duration: number;
    instructions: string[];
  };
  error?: string;
}

// Polyline decode function
function decodePolyline(encoded: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    coordinates.push([lat / 1e5, lng / 1e5]);
  }
  return coordinates;
}

// Google Directions API kullanarak rota hesaplama
async function calculateRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<{
  coordinates: [number, number][];
  distance: number;
  duration: number;
  instructions: string[];
} | null> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key not found');
      return null;
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${startLat},${startLng}&destination=${endLat},${endLng}&key=${apiKey}&language=tr`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
      console.error('Google Directions API error:', data.status);
      return null;
    }

    const route = data.routes[0];
    const leg = route.legs[0];
    
    const coordinates = decodePolyline(route.overview_polyline.points);
    const instructions = leg.steps.map((step: any) => 
      step.html_instructions.replace(/<[^>]*>/g, '')
    );

    return {
      coordinates,
      distance: leg.distance.value, // meters
      duration: leg.duration.value, // seconds
      instructions
    };
  } catch (error) {
    console.error('Route calculation error:', error);
    return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Sürücü kimlik doğrulaması
    const authResult = await authenticateToken(request);
    if (!authResult.success || !authResult.user || authResult.user.user_type !== 'driver') {
      return NextResponse.json(
        { success: false, error: 'Yetkisiz erişim' },
        { status: 401 }
      );
    }

    const { orderId, phase }: RouteRequest = await request.json();

    if (!orderId || !phase || !['pickup', 'delivery'].includes(phase)) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz parametreler' },
        { status: 400 }
      );
    }

    const driverId = authResult.user.id;
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Sipariş ve sürücü bilgilerini al
    const orderResult = await pool.request()
      .input('orderId', orderId)
      .input('driverId', driverId)
      .query(`
        SELECT 
          o.id,
          o.pickup_latitude,
          o.pickup_longitude,
          o.destination_latitude,
          o.destination_longitude,
          o.order_status,
          o.current_phase,
          u.current_latitude as driver_latitude,
          u.current_longitude as driver_longitude
        FROM orders o
        INNER JOIN users u ON o.driver_id = u.id
        WHERE o.id = @orderId 
          AND o.driver_id = @driverId
          AND o.order_status IN ('confirmed', 'started', 'in_progress')
      `);

    if (orderResult.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Sipariş bulunamadı veya erişim yetkiniz yok' },
        { status: 404 }
      );
    }

    const order = orderResult.recordset[0];

    // Sürücünün mevcut konumu kontrolü
    if (!order.driver_latitude || !order.driver_longitude) {
      return NextResponse.json(
        { success: false, error: 'Sürücü konumu bulunamadı' },
        { status: 400 }
      );
    }

    let startLat: number, startLng: number, endLat: number, endLng: number;

    if (phase === 'pickup') {
      // Sürücü konumundan yük alma noktasına
      startLat = order.driver_latitude;
      startLng = order.driver_longitude;
      endLat = order.pickup_latitude;
      endLng = order.pickup_longitude;
    } else {
      // Yük alma noktasından varış noktasına
      startLat = order.pickup_latitude;
      startLng = order.pickup_longitude;
      endLat = order.destination_latitude;
      endLng = order.destination_longitude;
    }

    // Rota hesapla
    const routeData = await calculateRoute(startLat, startLng, endLat, endLng);

    if (!routeData) {
      return NextResponse.json(
        { success: false, error: 'Rota hesaplanamadı' },
        { status: 500 }
      );
    }

    const response: RouteResponse = {
      success: true,
      route: routeData
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Route calculation error:', error);
    return NextResponse.json(
      { success: false, error: 'Rota hesaplanırken hata oluştu' },
      { status: 500 }
    );
  }
}

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