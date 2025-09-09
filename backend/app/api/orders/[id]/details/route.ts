import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../../config/database.js';
import { authenticateToken } from '../../../../../middleware/auth';

interface OrderDetailsResponse {
  success: boolean;
  order?: {
    id: number;
    pickup_address: string;
    destination_address: string;
    weight_kg: number;
    labor_count: number;
    estimated_price: number;
    cargo_photo_url?: string;
    customer_name: string;
    customer_first_name: string;
    customer_last_name: string;
    customer_phone: string;
    distance_km?: number;
    created_at: string;
  };
  error?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = parseInt(params.id);
    
    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz sipariş ID' },
        { status: 400 }
      );
    }

    // Token doğrulama
    const authResult = await authenticateToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.message || 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Sipariş detaylarını al
    const result = await pool.request()
      .input('orderId', orderId)
      .query(`
        SELECT 
          o.id,
          o.pickup_address,
          o.destination_address,
          o.weight_kg,
          o.labor_count,
          o.estimated_price,
          o.cargo_photo_url,
          o.distance_km,
          o.created_at,
          u.first_name,
          u.last_name,
          u.phone_number
        FROM orders o
        INNER JOIN users u ON o.user_id = u.id
        WHERE o.id = @orderId
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Sipariş bulunamadı' },
        { status: 404 }
      );
    }

    const order = result.recordset[0];
    
    const response: OrderDetailsResponse = {
      success: true,
      order: {
        id: order.id,
        pickup_address: order.pickup_address,
        destination_address: order.destination_address,
        weight_kg: order.weight_kg,
        labor_count: order.labor_count,
        estimated_price: order.estimated_price,
        cargo_photo_url: order.cargo_photo_url,
        customer_name: `${order.first_name} ${order.last_name}`,
        customer_first_name: order.first_name,
        customer_last_name: order.last_name,
        customer_phone: order.phone_number,
        distance_km: order.distance_km,
        created_at: order.created_at
      }
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Get order details error:', error);
    return NextResponse.json(
      { success: false, error: 'Sipariş detayları alınırken hata oluştu' },
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