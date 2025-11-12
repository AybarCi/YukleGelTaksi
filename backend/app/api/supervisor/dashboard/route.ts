import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupervisorToken } from '../../../../middleware/supervisorAuth';
import DatabaseConnection from '../../../../config/database';

// CORS headers for supervisor endpoints
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate supervisor
    const authResult = await authenticateSupervisorToken(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    const dbInstance = DatabaseConnection.getInstance();
    const pool = await dbInstance.connect();

    // Get dashboard statistics
    const stats = await Promise.all([
      // Total users
      pool.request().query('SELECT COUNT(*) as count FROM users WHERE is_active = 1'),
      
      // Total drivers
      pool.request().query('SELECT COUNT(*) as count FROM drivers WHERE is_active = 1'),
      
      // Available drivers
      pool.request().query('SELECT COUNT(*) as count FROM drivers WHERE is_available = 1 AND is_active = 1'),
      
      // Total orders
      pool.request().query('SELECT COUNT(*) as count FROM orders'),
      
      // Completed orders
      pool.request().query('SELECT COUNT(*) as count FROM orders WHERE status = \'completed\''),
      
      // Today's orders
      pool.request().query(`
        SELECT COUNT(*) as count FROM orders 
        WHERE CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)
      `),
      
      // Total revenue (completed orders)
      pool.request().query(`
        SELECT ISNULL(SUM(total_price), 0) as total FROM orders 
        WHERE status = 'completed'
      `),
      
      // Today's revenue
      pool.request().query(`
        SELECT ISNULL(SUM(total_price), 0) as total FROM orders 
        WHERE status = 'completed' AND CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)
      `),
      
      // Orders by status
      pool.request().query(`
        SELECT status, COUNT(*) as count FROM orders 
        GROUP BY status
      `),
      
      // Top drivers by completed orders
      pool.request().query(`
        SELECT TOP 5 
          d.first_name + ' ' + d.last_name as driver_name,
          d.phone_number,
          COUNT(o.id) as completed_orders,
          ISNULL(AVG(CAST(d.rating AS FLOAT)), 0) as avg_rating
        FROM drivers d
        LEFT JOIN orders o ON d.id = o.driver_id AND o.status = 'completed'
        WHERE d.is_active = 1
        GROUP BY d.id, d.first_name, d.last_name, d.phone_number, d.rating
        ORDER BY completed_orders DESC
      `),
      
      // Recent orders
      pool.request().query(`
        SELECT TOP 10
          o.id,
          o.pickup_address,
          o.destination_address,
          o.status,
          o.total_price,
          o.created_at,
          u.first_name + ' ' + u.last_name as customer_name,
          d.first_name + ' ' + d.last_name as driver_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN drivers d ON o.driver_id = d.id
        ORDER BY o.created_at DESC
      `),
      
      // Monthly revenue trend (last 6 months)
      pool.request().query(`
        SELECT 
          FORMAT(created_at, 'yyyy-MM') as month,
          ISNULL(SUM(total_price), 0) as revenue,
          COUNT(*) as order_count
        FROM orders 
        WHERE status = 'completed' 
          AND created_at >= DATEADD(month, -6, GETDATE())
        GROUP BY FORMAT(created_at, 'yyyy-MM')
        ORDER BY month
      `)
    ]);

    const dashboardData = {
      totalUsers: stats[0].recordset[0].count,
      totalDrivers: stats[1].recordset[0].count,
      availableDrivers: stats[2].recordset[0].count,
      totalOrders: stats[3].recordset[0].count,
      completedOrders: stats[4].recordset[0].count,
      todayOrders: stats[5].recordset[0].count,
      totalRevenue: stats[6].recordset[0].total,
      todayRevenue: stats[7].recordset[0].total,
      ordersByStatus: stats[8].recordset,
      topDrivers: stats[9].recordset,
      recentOrders: stats[10].recordset,
      monthlyRevenue: stats[11].recordset
    };

    return NextResponse.json({
      success: true,
      data: dashboardData
    }, {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
}