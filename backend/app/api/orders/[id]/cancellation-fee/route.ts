import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '../../../../../middleware/auth';
import DatabaseConnection from '../../../../../config/database';
import sql from 'mssql';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const orderId = parseInt(params.id);

    if (isNaN(orderId)) {
      return NextResponse.json(
        { error: 'Geçersiz sipariş ID' },
        { status: 400 }
      );
    }

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Siparişin kullanıcıya ait olup olmadığını ve durumunu kontrol et
      const orderResult = await pool.request()
        .input('orderId', sql.Int, orderId)
        .input('userId', sql.Int, userId)
        .query(`
          SELECT 
            id,
            order_status,
            total_price,
            user_id
          FROM orders 
          WHERE id = @orderId AND user_id = @userId
        `);

      if (orderResult.recordset.length === 0) {
        return NextResponse.json(
          { error: 'Sipariş bulunamadı' },
          { status: 404 }
        );
      }

      const order = orderResult.recordset[0];
      const orderStatus = order.order_status;

      // Cezai şart hesaplama
      let cancellationFee = 0;
      let feePercentage = 0;

      // Pending ve driver_accepted_awaiting_customer durumlarında cezai şart yok
      if (orderStatus === 'pending' || orderStatus === 'driver_accepted_awaiting_customer') {
        cancellationFee = 0;
        feePercentage = 0;
      } else {
        // Diğer durumlar için cancellation_fees tablosundan yüzdeyi al
        const feeResult = await pool.request()
          .input('status', sql.VarChar, orderStatus)
          .query(`
            SELECT fee_percentage 
            FROM cancellation_fees 
            WHERE order_status = @status
          `);

        if (feeResult.recordset.length > 0) {
          feePercentage = feeResult.recordset[0].fee_percentage;
        } else {
          // Varsayılan %25
          feePercentage = 25;
        }

        // Cezai tutarı hesapla
        cancellationFee = (order.total_price * feePercentage) / 100;
      }

      return NextResponse.json({
        success: true,
        data: {
          orderId: order.id,
          orderStatus: orderStatus,
          totalPrice: order.total_price,
          cancellationFee: cancellationFee,
          feePercentage: feePercentage,
          hasFee: cancellationFee > 0
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
    console.error('Cancellation fee check error:', error);
    return NextResponse.json(
      { error: 'Cezai şart kontrolü sırasında bir hata oluştu' },
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