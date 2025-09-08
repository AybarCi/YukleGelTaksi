import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../config/database';
import { authenticateToken } from '../../../../middleware/auth';
import SocketServer from '../../../../socket/socketServer';

// Global socketServer tip tanımı
declare global {
  var socketServer: SocketServer | undefined;
}

interface UpdateLaborRequest {
  orderId: number;
  laborCount: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate driver
    const authResult = await authenticateToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: 'Yetkisiz erişim' },
        { status: 401 }
      );
    }

    // Check if user is a driver
    if (authResult.user.user_type !== 'driver') {
      return NextResponse.json(
        { success: false, error: 'Sadece sürücüler hammaliye bilgisini güncelleyebilir' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { orderId, laborCount } = body as UpdateLaborRequest;

    // Validate required fields
    if (!orderId || laborCount === undefined || laborCount < 0) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz sipariş ID veya hammaliye sayısı' },
        { status: 400 }
      );
    }

    // Connect to database
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Get current order details
    const orderResult = await pool.request()
      .input('order_id', orderId)
      .input('driver_id', authResult.user.id)
      .query(`
        SELECT id, user_id, distance_km, weight_kg, labor_count, 
               base_price, distance_price, weight_price, labor_price, total_price,
               status
        FROM orders 
        WHERE id = @order_id AND driver_id = @driver_id AND status IN ('accepted', 'in_progress')
      `);

    if (orderResult.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Sipariş bulunamadı veya güncelleme yetkisi yok' },
        { status: 404 }
      );
    }

    const order = orderResult.recordset[0];

    // Calculate new labor price using the pricing API
    let newPriceCalculation;
    try {
      const priceResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/calculate-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('Authorization') || ''
        },
        body: JSON.stringify({
          distance_km: order.distance_km,
          weight_kg: order.weight_kg,
          labor_count: laborCount
        })
      });
      
      if (!priceResponse.ok) {
        throw new Error('Price calculation failed');
      }
      
      const priceData = await priceResponse.json();
      newPriceCalculation = priceData.data;
    } catch (priceError) {
      console.error('Price calculation error:', priceError);
      return NextResponse.json(
        { success: false, error: 'Fiyat hesaplama sırasında hata oluştu' },
        { status: 500 }
      );
    }

    // Update order with new labor information
    await pool.request()
      .input('order_id', orderId)
      .input('labor_count', laborCount)
      .input('labor_price', newPriceCalculation.labor_price)
      .input('total_price', newPriceCalculation.total_price)
      .query(`
        UPDATE orders 
        SET labor_count = @labor_count,
            labor_price = @labor_price,
            total_price = @total_price,
            updated_at = GETDATE()
        WHERE id = @order_id
      `);

    // Log order update
    try {
      await pool.request()
        .input('order_id', orderId)
        .input('changed_by_user_id', authResult.user.id)
        .input('change_description', `Hammaliye sayısı güncellendi: ${laborCount}. Yeni toplam fiyat: ${newPriceCalculation.total_price} TL`)
        .query(`
          INSERT INTO order_status_history (
            order_id, old_status, new_status, changed_by_user_id, change_description, created_at
          )
          VALUES (
            @order_id, 'labor_updated', 'labor_updated', @changed_by_user_id, @change_description, GETDATE()
          )
        `);
    } catch (historyError) {
      console.log('Order status history table not found, skipping history log');
    }

    // Send real-time update to customer via Socket.IO
    try {
      const socketServer = global.socketServer as SocketServer;
      if (socketServer) {
        const updateData = {
          orderId,
          laborCount,
          laborPrice: newPriceCalculation.labor_price,
          totalPrice: newPriceCalculation.total_price,
          message: `Hammaliye sayısı ${laborCount} olarak güncellendi. Yeni toplam fiyat: ${newPriceCalculation.total_price} TL`
        };
        
        // Send to customer
        socketServer.sendToCustomer(order.user_id, 'laborUpdated', updateData);
        console.log(`Labor update sent to customer ${order.user_id} for order ${orderId}`);
      }
    } catch (socketError) {
      console.error('Socket notification error:', socketError);
      // Socket hatası güncellemeyi engellemez
    }

    return NextResponse.json({
      success: true,
      message: 'Hammaliye bilgisi başarıyla güncellendi',
      data: {
        orderId,
        laborCount,
        laborPrice: newPriceCalculation.labor_price,
        totalPrice: newPriceCalculation.total_price
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Update labor error:', error);
    return NextResponse.json(
      { success: false, error: 'Hammaliye bilgisi güncellenirken hata oluştu' },
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