import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '../../../../../middleware/auth';
import DatabaseConnection from '../../../../../config/database';
const SocketServer = require('../../../../../socket/socketServer');
import sql from 'mssql';

interface CancelWithCodeRequest {
  confirmCode: string;
}

interface CancelWithCodeResponse {
  success: boolean;
  message: string;
  orderId?: string;
  cancellationFee?: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<CancelWithCodeResponse>> {
  try {
    // Token doğrulama
    const authResult = await authenticateToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { 
          success: false, 
          message: authResult.message || 'Yetkilendirme hatası' 
        },
        { status: 401 }
      );
    }

    const orderId = params.id;
    const userId = authResult.user.id;

    // Request body'yi parse et
    const body: CancelWithCodeRequest = await request.json();
    const { confirmCode } = body;

    if (!confirmCode) {
      return NextResponse.json(
        { success: false, message: 'Doğrulama kodu gerekli' },
        { status: 400 }
      );
    }

    // Veritabanı bağlantısı
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Sipariş bilgilerini ve confirm code'u kontrol et
    const orderResult = await pool.request()
      .input('orderId', sql.Int, parseInt(orderId))
      .input('userId', sql.Int, userId)
      .input('confirmCode', sql.VarChar(4), confirmCode)
      .query(`
        SELECT id, order_status, total_price, cancellation_confirm_code, cancellation_fee, driver_id
        FROM orders 
        WHERE id = @orderId AND user_id = @userId AND cancellation_confirm_code = @confirmCode
      `);

    if (orderResult.recordset.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Sipariş bulunamadı veya doğrulama kodu yanlış' },
        { status: 404 }
      );
    }

    const order = orderResult.recordset[0];

    // Siparişi iptal et
    await pool.request()
      .input('orderId', sql.Int, parseInt(orderId))
      .input('cancelReason', sql.NVarChar, 'Müşteri tarafından iptal edildi')
      .query(`
        UPDATE orders 
        SET order_status = 'cancelled',
            cancelled_at = DATEADD(hour, 3, GETDATE()),
            updated_at = DATEADD(hour, 3, GETDATE()),
            cancel_reason = @cancelReason
        WHERE id = @orderId
      `);

    // Socket server'a bildirim gönder (sadece sürücülere)
    try {
      const socketServer = (global as any).socketServer;
      if (socketServer) {
        // Eğer sürücü atanmışsa, sürücüye bildir
        if (order.driver_id) {
          const driverData = socketServer.connectedDrivers.get(order.driver_id);
          if (driverData) {
            socketServer.io.to(driverData.socketId).emit('order_cancelled_by_customer', {
              orderId: parseInt(orderId),
              message: 'Müşteri siparişi iptal etti.'
            });
          }
        }

        // Sadece ilgili sürücülere order_cancelled event'i gönder
        socketServer.broadcastToOrderRelatedDrivers(parseInt(orderId), 'order_cancelled', parseInt(orderId));
        
        // Eğer sipariş inspecting durumundaysa, inspectingOrders Map'inden kaldır
        if (order.order_status === 'inspecting') {
          socketServer.inspectingOrders.delete(parseInt(orderId));
        }
      }
    } catch (socketError) {
      console.error('Socket notification error:', socketError);
      // Socket hatası HTTP response'u etkilemez
    }

    const response: CancelWithCodeResponse = {
      success: true,
      message: order.cancellation_fee > 0 
        ? `Sipariş başarıyla iptal edildi. Cezai tutar: ${order.cancellation_fee} TL`
        : 'Sipariş başarıyla iptal edildi.',
      orderId,
      cancellationFee: order.cancellation_fee
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Cancel order with code error:', error);
    return NextResponse.json(
      { success: false, message: 'Sipariş iptal edilirken bir hata oluştu' },
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