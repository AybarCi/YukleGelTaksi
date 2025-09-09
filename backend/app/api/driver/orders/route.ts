import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../config/database';
import { authenticateToken } from '../../../../middleware/auth';

interface ApiResponse {
  success?: boolean;
  message?: string;
  error?: string;
  orders?: any[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    // Token doğrulama
    const authResult = await authenticateToken(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    const userId = authResult.user.id;
    
    // URL parametrelerini al
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const status = searchParams.get('status') || 'all';
    const offset = (page - 1) * limit;

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Önce kullanıcının sürücü olup olmadığını kontrol et
      const driverResult = await pool.request()
        .input('userId', userId)
        .query(`
          SELECT id FROM drivers 
          WHERE user_id = @userId AND is_active = 1
        `);

      if (!driverResult.recordset || driverResult.recordset.length === 0) {
        return NextResponse.json(
          { error: 'Sürücü hesabı bulunamadı' },
          { status: 404 }
        );
      }

      const driverId = driverResult.recordset[0].id;

      // Status filtresi için WHERE koşulu
      let statusCondition = '';
      if (status === 'completed') {
        statusCondition = "AND o.status = 'completed'";
      } else if (status === 'cancelled') {
        statusCondition = "AND o.status = 'cancelled'";
      } else if (status === 'pending') {
        statusCondition = "AND o.status = 'pending'";
      } else if (status === 'accepted') {
        statusCondition = "AND o.status = 'accepted'";
      } else if (status === 'in_progress') {
        statusCondition = "AND o.status = 'in_progress'";
      }
      // 'all' durumunda hiç filtre eklenmez

      // Toplam kayıt sayısını al
      const countResult = await pool.request()
        .input('driverId', driverId)
        .query(`
          SELECT COUNT(*) as total
          FROM orders o
          WHERE o.driver_id = @driverId ${statusCondition}
        `);

      const total = countResult.recordset[0].total;
      const totalPages = Math.ceil(total / limit);

      // Sipariş geçmişini al
      const ordersResult = await pool.request()
        .input('driverId', driverId)
        .input('offset', offset)
        .input('limit', limit)
        .query(`
          SELECT 
            o.id,
            o.pickup_address,
            o.destination_address,
            o.pickup_latitude,
            o.pickup_longitude,
            o.destination_latitude,
            o.destination_longitude,
            o.weight_kg,
            o.labor_count,
            o.estimated_price,
            o.final_price,
            o.distance_km,
            o.duration_minutes,
            o.status,
            o.created_at,
            o.accepted_at,
            o.started_at,
            o.completed_at,
            o.cancelled_at,
            o.cancel_reason,
            u.first_name as customer_first_name,
            u.last_name as customer_last_name,
            u.phone_number as customer_phone
          FROM orders o
          LEFT JOIN users u ON o.user_id = u.id
          WHERE o.driver_id = @driverId ${statusCondition}
          ORDER BY o.created_at DESC
          OFFSET @offset ROWS
          FETCH NEXT @limit ROWS ONLY
        `);

      const orders = ordersResult.recordset.map((order: any) => ({
        id: order.id,
        pickupAddress: order.pickup_address,
        destinationAddress: order.destination_address,
        pickupLocation: {
          latitude: order.pickup_latitude,
          longitude: order.pickup_longitude
        },
        destinationLocation: {
          latitude: order.destination_latitude,
          longitude: order.destination_longitude
        },
        weight_kg: order.weight_kg,
        laborCount: order.labor_count,
        estimatedPrice: order.estimated_price,
        finalPrice: order.final_price,
        distanceKm: order.distance_km,
        durationMinutes: order.duration_minutes,
        status: order.status,
        createdAt: order.created_at,
        acceptedAt: order.accepted_at,
        startedAt: order.started_at,
        completedAt: order.completed_at,
        cancelledAt: order.cancelled_at,
        cancelReason: order.cancel_reason,
        customer: {
          firstName: order.customer_first_name,
          lastName: order.customer_last_name,
          phone: order.customer_phone
        }
      }));

      const response: ApiResponse = {
        success: true,
        message: 'Sipariş geçmişi başarıyla alındı',
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      };

      return NextResponse.json(response);

    } catch (dbError) {
      console.error('Veritabanı hatası:', dbError);
      return NextResponse.json(
        { error: 'Veritabanı hatası oluştu' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Sipariş geçmişi alma hatası:', error);
    return NextResponse.json(
      { error: 'Sipariş geçmişi alınırken bir hata oluştu' },
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}