import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../config/database';
import { authenticateToken } from '../../../middleware/auth';
import * as Joi from 'joi';
import sql from 'mssql';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// Sipariş oluşturma
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const {
      pickup_address,
      pickup_latitude,
      pickup_longitude,
      destination_address,
      destination_latitude,
      destination_longitude,
      distance_km,
      weight_kg,
      labor_count = 0,
      cargo_photo_url,
      base_price,
      distance_price,
      weight_price,
      labor_price,
      total_price,
      payment_method = 'cash',
      customer_notes
    } = body;

    // Veri doğrulama
    const orderSchema = Joi.object({
      pickup_address: Joi.string().min(10).max(500).required(),
      pickup_latitude: Joi.number().min(-90).max(90).required(),
      pickup_longitude: Joi.number().min(-180).max(180).required(),
      destination_address: Joi.string().min(10).max(500).required(),
      destination_latitude: Joi.number().min(-90).max(90).required(),
      destination_longitude: Joi.number().min(-180).max(180).required(),
      distance_km: Joi.number().min(0).required(),
      weight_kg: Joi.number().min(0).required(),
      labor_count: Joi.number().integer().min(0).default(0),
      cargo_photo_url: Joi.string().uri().optional(),
      base_price: Joi.number().min(0).required(),
      distance_price: Joi.number().min(0).required(),
      weight_price: Joi.number().min(0).required(),
      labor_price: Joi.number().min(0).required(),
      total_price: Joi.number().min(0).required(),
      payment_method: Joi.string().valid('cash', 'card', 'wallet').default('cash'),
      customer_notes: Joi.string().max(1000).optional()
    });

    const { error } = orderSchema.validate(body);
    if (error) {
      return NextResponse.json(
        { error: 'Geçersiz veri', details: error.details },
        { status: 400, headers: corsHeaders }
      );
    }

    // Sipariş oluştur
    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();
    
    const result = await pool.request()
      .input('user_id', sql.Int, authResult.user.id)
      .input('pickup_address', sql.NVarChar, pickup_address)
      .input('pickup_latitude', sql.Decimal(10, 8), pickup_latitude)
      .input('pickup_longitude', sql.Decimal(11, 8), pickup_longitude)
      .input('destination_address', sql.NVarChar, destination_address)
      .input('destination_latitude', sql.Decimal(10, 8), destination_latitude)
      .input('destination_longitude', sql.Decimal(11, 8), destination_longitude)
      .input('distance_km', sql.Decimal(8, 2), distance_km)
      .input('weight_kg', sql.Decimal(8, 2), weight_kg)
      .input('labor_count', sql.Int, labor_count)
      .input('cargo_photo_url', sql.NVarChar, cargo_photo_url)
      .input('base_price', sql.Decimal(10, 2), base_price)
      .input('distance_price', sql.Decimal(10, 2), distance_price)
      .input('weight_price', sql.Decimal(10, 2), weight_price)
      .input('labor_price', sql.Decimal(10, 2), labor_price)
      .input('total_price', sql.Decimal(10, 2), total_price)
      .input('payment_method', sql.NVarChar, payment_method)
      .input('customer_notes', sql.NVarChar, customer_notes)
      .query(`INSERT INTO orders (
        user_id, pickup_address, pickup_latitude, pickup_longitude,
        destination_address, destination_latitude, destination_longitude,
        distance_km, weight_kg, labor_count, cargo_photo_url,
        base_price, distance_price, weight_price, labor_price, total_price,
        payment_method, customer_notes, status
      ) OUTPUT INSERTED.id VALUES (
        @user_id, @pickup_address, @pickup_latitude, @pickup_longitude,
        @destination_address, @destination_latitude, @destination_longitude,
        @distance_km, @weight_kg, @labor_count, @cargo_photo_url,
        @base_price, @distance_price, @weight_price, @labor_price, @total_price,
        @payment_method, @customer_notes, 'pending'
      )`);

    const orderId = result.recordset[0].id;

    // Oluşturulan siparişi getir
    const orderResult = await pool.request()
      .input('orderId', sql.Int, orderId)
      .query('SELECT * FROM orders WHERE id = @orderId');
    
    const order = orderResult.recordset[0];

    return NextResponse.json(
      {
        success: true,
        message: 'Sipariş başarıyla oluşturuldu',
        order: order
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Sipariş oluşturma hatası:', error);
    return NextResponse.json(
      { error: 'Sipariş oluşturulamadı' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Siparişleri listeleme
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401, headers: corsHeaders }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();

    let whereClause = 'WHERE o.user_id = @user_id';
    const request_db = pool.request().input('user_id', sql.Int, authResult.user.id);

    if (status) {
      whereClause += ' AND o.status = @status';
      request_db.input('status', sql.NVarChar, status);
    }

    const ordersResult = await request_db
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset)
      .query(`SELECT 
        o.*,
        u.first_name + ' ' + u.last_name as user_name,
        u.phone_number as user_phone,
        d.name as driver_name,
        d.phone_number as driver_phone,
        d.vehicle_plate as driver_plate
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      ${whereClause}
      ORDER BY o.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);

    // Toplam sipariş sayısı
    const totalRequest = pool.request().input('user_id', sql.Int, authResult.user.id);
    if (status) {
      totalRequest.input('status', sql.NVarChar, status);
    }
    const totalResult = await totalRequest.query(`SELECT COUNT(*) as total FROM orders o ${whereClause}`);

    return NextResponse.json(
      {
        success: true,
        orders: ordersResult.recordset,
        pagination: {
          total: totalResult.recordset[0].total,
          limit,
          offset,
          hasMore: totalResult.recordset[0].total > offset + limit
        }
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Sipariş listeleme hatası:', error);
    return NextResponse.json(
      { error: 'Siparişler getirilemedi' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Sipariş güncelleme
export async function PUT(request: NextRequest) {
  try {
    const authResult = await authenticateToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { order_id, status, driver_notes, cancel_reason } = body;

    if (!order_id) {
      return NextResponse.json(
        { error: 'Sipariş ID gerekli' },
        { status: 400, headers: corsHeaders }
      );
    }

    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();

    // Siparişin varlığını ve kullanıcının yetkisini kontrol et
    const existingOrderResult = await pool.request()
      .input('order_id', sql.Int, order_id)
      .input('user_id', sql.Int, authResult.user.id)
      .query('SELECT * FROM orders WHERE id = @order_id AND user_id = @user_id');

    if (existingOrderResult.recordset.length === 0) {
      return NextResponse.json(
        { error: 'Sipariş bulunamadı veya yetkiniz yok' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Güncelleme alanlarını hazırla
    let updateFields = [];
    let updateValues = [];
    let timestampField = null;

    if (status) {
      updateFields.push('status = ?');
      updateValues.push(status);
      
      // Durum değişikliğine göre zaman damgası ekle
      switch (status) {
        case 'driver_accepted':
          timestampField = 'accepted_at';
          break;
        case 'customer_confirmed':
          timestampField = 'confirmed_at';
          break;
        case 'in_progress':
          timestampField = 'started_at';
          break;
        case 'completed':
          timestampField = 'completed_at';
          break;
        case 'cancelled':
          timestampField = 'cancelled_at';
          break;
      }
    }

    if (driver_notes) {
      updateFields.push('driver_notes = ?');
      updateValues.push(driver_notes);
    }

    if (cancel_reason) {
      updateFields.push('cancel_reason = ?');
      updateValues.push(cancel_reason);
    }

    if (timestampField) {
      updateFields.push(`${timestampField} = GETDATE()`);
    }

    updateFields.push('updated_at = GETDATE()');
    updateValues.push(order_id);

    if (updateFields.length === 1) { // Sadece updated_at varsa
      return NextResponse.json(
        { error: 'Güncellenecek alan bulunamadı' },
        { status: 400, headers: corsHeaders }
      );
    }

    const updateRequest = pool.request().input('order_id', sql.Int, order_id);
    
    if (status) {
      updateRequest.input('status', sql.NVarChar, status);
    }
    if (driver_notes) {
      updateRequest.input('driver_notes', sql.NVarChar, driver_notes);
    }
    if (cancel_reason) {
      updateRequest.input('cancel_reason', sql.NVarChar, cancel_reason);
    }

    await updateRequest.query(`UPDATE orders SET ${updateFields.join(', ')} WHERE id = @order_id`);

    // Güncellenmiş siparişi getir
    const updatedOrderResult = await pool.request()
      .input('order_id', sql.Int, order_id)
      .query(`SELECT 
        o.*,
        u.first_name + ' ' + u.last_name as user_name,
        u.phone_number as user_phone,
        d.name as driver_name,
        d.phone_number as driver_phone,
        d.vehicle_plate as driver_plate
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      WHERE o.id = @order_id`);

    return NextResponse.json(
      {
        success: true,
        message: 'Sipariş başarıyla güncellendi',
        order: updatedOrderResult.recordset[0]
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Sipariş güncelleme hatası:', error);
    return NextResponse.json(
      { error: 'Sipariş güncellenemedi' },
      { status: 500, headers: corsHeaders }
    );
  }
}