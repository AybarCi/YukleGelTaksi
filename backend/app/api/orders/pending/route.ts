import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../config/database';
import { authenticateToken } from '../../../../middleware/auth';
import SystemSettingsService from '../../../../services/systemSettingsService';

interface PendingOrdersResponse {
  success: boolean;
  orders?: any[];
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Sürücü kimlik doğrulaması
    const authResult = await authenticateToken(request);
    if (!authResult.success || !authResult.user || authResult.user.user_type !== 'driver') {
      return NextResponse.json(
        { success: false, error: 'Yetkisiz erişim' },
        { status: 401 }
      );
    }

    const driverId = authResult.user.id;
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Sürücünün mevcut konumunu al
    const driverResult = await pool.request()
      .input('driverId', driverId)
      .query(`
        SELECT u.current_latitude, u.current_longitude
        FROM drivers d
        INNER JOIN users u ON d.user_id = u.id
        WHERE d.user_id = @driverId
          AND d.is_available = 1
          AND d.is_active = 1
          AND d.is_approved = 1
          AND u.current_latitude IS NOT NULL
          AND u.current_longitude IS NOT NULL
      `);

    if (driverResult.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Sürücü konumu bulunamadı veya sürücü aktif değil' },
        { status: 400 }
      );
    }

    const driverLocation = driverResult.recordset[0];
    
    // Sistem ayarlarından arama yarıçapını al
    const systemSettings = SystemSettingsService.getInstance();
    const searchRadius = await systemSettings.getSetting('driver_search_radius_km', 15);
    const maxOrders = await systemSettings.getSetting('max_orders_per_driver', 10);

    // Yarıçap içindeki bekleyen siparişleri getir
    const ordersResult = await pool.request()
      .input('driverLatitude', driverLocation.current_latitude)
      .input('driverLongitude', driverLocation.current_longitude)
      .input('radius', searchRadius)
      .input('maxOrders', maxOrders)
      .query(`
        SELECT TOP (@maxOrders)
          o.id,
          o.pickup_address,
          o.pickup_latitude,
          o.pickup_longitude,
          o.destination_address,
          o.destination_latitude,
          o.destination_longitude,
          o.distance_km,
          o.estimated_time_minutes,
          o.total_price,
          o.weight_kg,
          o.labor_count,
          o.order_status,
          o.created_at,
          u.first_name as customer_first_name,
          u.last_name as customer_last_name,
          u.phone_number as customer_phone,
          (
            6371 * acos(
              cos(radians(@driverLatitude)) * cos(radians(o.pickup_latitude)) *
              cos(radians(o.pickup_longitude) - radians(@driverLongitude)) +
              sin(radians(@driverLatitude)) * sin(radians(o.pickup_latitude))
            )
          ) AS distance_to_pickup
        FROM orders o
        INNER JOIN users u ON o.user_id = u.id
        WHERE o.order_status IN ('pending', 'inspecting')
          AND o.pickup_latitude IS NOT NULL
          AND o.pickup_longitude IS NOT NULL
          AND (
            6371 * acos(
              cos(radians(@driverLatitude)) * cos(radians(o.pickup_latitude)) *
              cos(radians(o.pickup_longitude) - radians(@driverLongitude)) +
              sin(radians(@driverLatitude)) * sin(radians(o.pickup_latitude))
            )
          ) <= @radius
        ORDER BY 
          distance_to_pickup ASC,
          o.created_at ASC
      `);

    const orders = ordersResult.recordset.map(order => ({
      id: order.id,
      pickupAddress: order.pickup_address,
      pickupLatitude: order.pickup_latitude,
      pickupLongitude: order.pickup_longitude,
      destinationAddress: order.destination_address,
      destinationLatitude: order.destination_latitude,
      destinationLongitude: order.destination_longitude,
      distance: order.distance_km,
      estimatedTime: order.estimated_time_minutes,
      estimatedPrice: order.total_price,
      weight_kg: order.weight_kg,
      laborCount: order.labor_count,
      order_status: order.order_status,
      createdAt: order.created_at,
      customer: {
        firstName: order.customer_first_name,
        lastName: order.customer_last_name,
        phone: order.customer_phone
      },
      distanceToPickup: parseFloat(order.distance_to_pickup.toFixed(2)),
      estimatedArrival: Math.round(order.distance_to_pickup * 2) // Tahmini varış süresi (dakika)
    }));

    const response: PendingOrdersResponse = {
      success: true,
      orders
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Get pending orders error:', error);
    return NextResponse.json(
      { success: false, error: 'Bekleyen siparişler getirilirken hata oluştu' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}