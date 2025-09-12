import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../config/database';

// GET - Aktif araç tiplerini getir (public endpoint - token gerektirmez)
export async function GET(request: NextRequest) {
  try {
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    const result = await pool.request()
      .query(`
        SELECT id, name, description, is_active, created_at, updated_at
        FROM vehicle_types
        WHERE is_active = 1
        ORDER BY name ASC
      `);

    const response = NextResponse.json({
      success: true,
      data: result.recordset
    });

    // CORS headers ekle
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;
  } catch (error) {
    console.error('Public vehicle types fetch error:', error);
    const errorResponse = NextResponse.json(
      { success: false, error: 'Araç tipleri getirilirken hata oluştu' },
      { status: 500 }
    );
    
    // CORS headers ekle
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return errorResponse;
  }
}

// OPTIONS - CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}