import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../config/database';
import { authenticateSupervisorToken } from '../../../middleware/supervisorAuth';
import { CacheManager, CacheKeys, CacheTTL } from '../../../lib/redis';

export async function GET(request: NextRequest) {
  try {
    // Token doğrulama
    const authResult = await authenticateSupervisorToken(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { 
          status: 401,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        }
      );
    }

    // URL parametrelerini al
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';
    const cursor = searchParams.get('cursor'); // Cursor-based pagination için
    const useCursor = searchParams.get('use_cursor') === 'true'; // Cursor kullanımı kontrolü
    const offset = (page - 1) * limit;

    // Initialize cache manager
    const cache = new CacheManager();
    
    // Generate cache keys
    const cacheKey = useCursor 
      ? `orders:cursor:${cursor}:${limit}:${status}:${search}`
      : CacheKeys.ordersList(page, limit, status, search);
    const countCacheKey = CacheKeys.ordersCount(status, search);

    try {
        // Try to get from cache first
        const cachedData = await cache.get(cacheKey);
        if (cachedData) {
          return NextResponse.json({
            success: true,
            data: cachedData,
            cached: true
          }, {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
          });
        }

        const db = DatabaseConnection.getInstance();
        const pool = await db.connect();

      // Status filtresi için WHERE koşulu
      let statusCondition = '';
      let searchCondition = '';

      if (status !== 'all') {
        statusCondition = `AND o.status = '${status}'`;
      }

      if (search) {
        searchCondition = `AND (
          o.pickup_address LIKE '%${search}%' OR 
          o.destination_address LIKE '%${search}%' OR
          CONCAT(cu.first_name, ' ', cu.last_name) LIKE '%${search}%' OR
          CONCAT(du.first_name, ' ', du.last_name) LIKE '%${search}%' OR
          o.id LIKE '%${search}%'
        )`;
      }

      // Cursor-based pagination için WHERE koşulu
      let cursorCondition = '';
      if (useCursor && cursor) {
        try {
          const decodedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString());
          cursorCondition = `AND (o.created_at < '${decodedCursor.created_at}' OR (o.created_at = '${decodedCursor.created_at}' AND o.id < ${decodedCursor.id}))`;
        } catch (e) {
          console.error('Invalid cursor:', e);
        }
      }

      // Toplam kayıt sayısını al (sadece offset pagination için)
      let total = 0;
      let totalPages = 0;
      if (!useCursor) {
        const countResult = await pool.request()
          .query(`
            SELECT COUNT(*) as total
            FROM orders o
            LEFT JOIN users cu ON o.user_id = cu.id
            LEFT JOIN drivers d ON o.driver_id = d.id
            LEFT JOIN users du ON d.user_id = du.id
            WHERE 1=1 ${statusCondition} ${searchCondition}
          `);
        total = countResult.recordset[0].total;
        totalPages = Math.ceil(total / limit);
      }

      // Siparişleri al - Cursor veya Offset pagination
      let ordersQuery;
      let queryParams: any = { limit };
      
      if (useCursor) {
        // Cursor-based pagination query
        ordersQuery = `
          SELECT TOP (@limit)
            o.id,
            o.user_id,
            o.driver_id,
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
            o.status,
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
            -- Müşteri bilgileri
            cu.first_name as customer_first_name,
            cu.last_name as customer_last_name,
            cu.phone_number as customer_phone,
            cu.email as customer_email,
            -- Sürücü bilgileri
            du.first_name as driver_first_name,
            du.last_name as driver_last_name,
            du.phone_number as driver_phone,
            du.email as driver_email,
            d.vehicle_plate,
            d.vehicle_model,
            d.vehicle_color,
            d.rating as driver_rating
          FROM orders o
          LEFT JOIN users cu ON o.user_id = cu.id
          LEFT JOIN drivers d ON o.driver_id = d.id
          LEFT JOIN users du ON d.user_id = du.id
          WHERE 1=1 ${statusCondition} ${searchCondition} ${cursorCondition}
          ORDER BY o.created_at DESC, o.id DESC
        `;
      } else {
        // Offset-based pagination query (mevcut sistem)
        ordersQuery = `
          SELECT 
            o.id,
            o.user_id,
            o.driver_id,
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
            o.status,
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
            -- Müşteri bilgileri
            cu.first_name as customer_first_name,
            cu.last_name as customer_last_name,
            cu.phone_number as customer_phone,
            cu.email as customer_email,
            -- Sürücü bilgileri
            du.first_name as driver_first_name,
            du.last_name as driver_last_name,
            du.phone_number as driver_phone,
            du.email as driver_email,
            d.vehicle_plate,
            d.vehicle_model,
            d.vehicle_color,
            d.rating as driver_rating
          FROM orders o
          LEFT JOIN users cu ON o.user_id = cu.id
          LEFT JOIN drivers d ON o.driver_id = d.id
          LEFT JOIN users du ON d.user_id = du.id
          WHERE 1=1 ${statusCondition} ${searchCondition}
          ORDER BY o.created_at DESC
          OFFSET @offset ROWS
          FETCH NEXT @limit ROWS ONLY
        `;
        queryParams = { ...queryParams, offset };
      }

      const ordersRequest = pool.request();
      Object.keys(queryParams).forEach(key => {
        ordersRequest.input(key, queryParams[key]);
      });
      const ordersResult = await ordersRequest.query(ordersQuery);

      const orders = ordersResult.recordset.map((order: any) => ({
        id: order.id,
        user_id: order.user_id,
        driver_id: order.driver_id,
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
        customer: {
          first_name: order.customer_first_name,
          last_name: order.customer_last_name,
          phone: order.customer_phone,
          email: order.customer_email
        },
        driver: order.driver_id ? {
          first_name: order.driver_first_name,
          last_name: order.driver_last_name,
          phone: order.driver_phone,
          email: order.driver_email,
          vehicle_plate: order.vehicle_plate,
          vehicle_model: order.vehicle_model,
          vehicle_color: order.vehicle_color,
          rating: order.driver_rating
        } : null
      }));

      // Pagination bilgilerini hazırla
      let paginationInfo: any = {
        limit,
        count: orders.length
      };

      if (useCursor) {
        // Cursor-based pagination bilgileri
        paginationInfo.use_cursor = true;
        paginationInfo.has_next = orders.length === limit;
        
        if (orders.length > 0) {
          const lastOrder = orders[orders.length - 1];
          const nextCursor = {
            created_at: lastOrder.created_at,
            id: lastOrder.id
          };
          paginationInfo.next_cursor = Buffer.from(JSON.stringify(nextCursor)).toString('base64');
        }
      } else {
        // Offset-based pagination bilgileri (mevcut sistem)
        paginationInfo = {
          ...paginationInfo,
          page,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          use_cursor: false
        };
      }

      // Prepare response data
      const responseData = {
        orders,
        pagination: paginationInfo
      };

      // Cache the result
      await cache.set(cacheKey, responseData, CacheTTL.LIST);
      
      // Also cache count separately for faster access
      if (!useCursor && total !== undefined) {
        await cache.set(countCacheKey, { total, totalPages }, CacheTTL.MEDIUM);
      }

      return NextResponse.json({
        success: true,
        data: responseData
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
        { error: 'Veritabanı hatası oluştu' },
        { 
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        }
      );
    }

  } catch (error) {
    console.error('Orders fetch error:', error);
    return NextResponse.json(
      { error: 'Siparişler alınırken bir hata oluştu' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
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