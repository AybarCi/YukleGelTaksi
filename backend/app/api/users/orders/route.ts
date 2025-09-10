import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '../../../../middleware/auth';
import DatabaseConnection from '../../../../config/database';
import sql from 'mssql';

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
    const statusParam = searchParams.get('status') || 'all';
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Status filtresi için WHERE koşulu
      let statusCondition = '';
      if (statusParam !== 'all') {
        // Birden fazla status değerini destekle (virgülle ayrılmış)
        const statusList = statusParam.split(',').map(s => s.trim()).filter(s => s.length > 0);
        if (statusList.length > 0) {
          const statusPlaceholders = statusList.map((_, index) => `@status${index}`).join(', ');
          statusCondition = `AND o.order_status IN (${statusPlaceholders})`;
        }
      }

      // Kullanıcının siparişlerini al
      const request_db = pool.request()
        .input('userId', sql.Int, userId);
      
      if (statusParam !== 'all') {
        const statusList = statusParam.split(',').map(s => s.trim()).filter(s => s.length > 0);
        statusList.forEach((status, index) => {
          request_db.input(`status${index}`, sql.VarChar, status);
        });
      }
      
      request_db.input('limit', sql.Int, limit);

      const ordersResult = await request_db.query(`
        SELECT TOP (@limit)
          o.id,
          o.pickup_address,
          o.pickup_latitude,
          o.pickup_longitude,
          o.destination_address,
          o.destination_latitude,
          o.destination_longitude,
          o.distance_km,
          o.weight_kg,
          o.labor_count,

          o.base_price,
          o.distance_price,
          o.weight_price,
          o.labor_price,
          o.total_price,
          o.payment_method,
          o.order_status as status,
          o.customer_notes,
          o.driver_notes,
          o.cancel_reason,
          o.created_at,
          o.accepted_at,
          o.confirmed_at,
          o.started_at,
          o.completed_at,
          o.cancelled_at,
          o.updated_at,
          u.first_name as driver_first_name,
          u.last_name as driver_last_name,
          u.phone_number as driver_phone,
          d.vehicle_plate,
          d.vehicle_model,
          d.vehicle_color,
          d.rating as driver_rating
        FROM orders o
        LEFT JOIN drivers d ON o.driver_id = d.id
        LEFT JOIN users u ON d.user_id = u.id
        WHERE o.user_id = @userId ${statusCondition}
        ORDER BY o.created_at DESC
      `);

      const orders = ordersResult.recordset.map(order => ({
        id: order.id,
        pickup_address: order.pickup_address,
        pickup_latitude: order.pickup_latitude,
        pickup_longitude: order.pickup_longitude,
        destination_address: order.destination_address,
        destination_latitude: order.destination_latitude,
        destination_longitude: order.destination_longitude,
        distance_km: order.distance_km,
        weight_kg: order.weight_kg,
        labor_count: order.labor_count,

        base_price: order.base_price,
        distance_price: order.distance_price,
        weight_price: order.weight_price,
        labor_price: order.labor_price,
        total_price: order.total_price,
        payment_method: order.payment_method,
        status: order.status,
        customer_notes: order.customer_notes,
        driver_notes: order.driver_notes,
        cancel_reason: order.cancel_reason,
        created_at: order.created_at,
        accepted_at: order.accepted_at,
        confirmed_at: order.confirmed_at,
        started_at: order.started_at,
        completed_at: order.completed_at,
        cancelled_at: order.cancelled_at,
        updated_at: order.updated_at,
        driver: order.driver_first_name ? {
          first_name: order.driver_first_name,
          last_name: order.driver_last_name,
          phone: order.driver_phone,
          vehicle_plate: order.vehicle_plate,
          vehicle_model: order.vehicle_model,
          vehicle_color: order.vehicle_color,
          rating: order.driver_rating
        } : null
      }));

      return NextResponse.json({
        success: true,
        data: {
          orders,
          total: orders.length
        }
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });

    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Veritabanı hatası' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Orders fetch error:', error);
    return NextResponse.json(
      { error: 'Siparişler alınırken bir hata oluştu' },
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