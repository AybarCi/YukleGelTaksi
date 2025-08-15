import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupervisorToken } from '../../../middleware/supervisorAuth';
import DatabaseConnection from '../../../config/database';

interface ApiResponse {
  success?: boolean;
  message?: string;
  error?: string;
  data?: any[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// GET - Tüm kullanıcıları listele (Supervisor için)
export async function GET(request: NextRequest): Promise<Response> {
  try {
    // Supervisor auth kontrolü
    const authResult = await authenticateSupervisorToken(request);
    if (!authResult.success) {
      const response: ApiResponse = { 
        success: false, 
        error: authResult.message || 'Yetkilendirme gerekli' 
      };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Search condition
      let whereClause = 'WHERE 1=1';
      const params: any = {};
      
      if (search) {
        whereClause += ` AND (
          first_name LIKE @search OR 
          last_name LIKE @search OR 
          phone_number LIKE @search OR 
          email LIKE @search
        )`;
        params.search = `%${search}%`;
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM users 
        ${whereClause}
      `;
      
      const countRequest = pool.request();
      Object.keys(params).forEach(key => {
        countRequest.input(key, params[key]);
      });
      const countResult = await countRequest.query(countQuery);
      const total = countResult.recordset[0].total;

      // Get users with pagination
      const usersQuery = `
        SELECT 
          id,
          phone_number,
          first_name,
          last_name,
          email,
          date_of_birth,
          gender,
          is_active,
          profile_picture_url,
          user_type,
          created_at,
          updated_at
        FROM users 
        ${whereClause}
        ORDER BY created_at DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `;

      const usersRequest = pool.request()
        .input('offset', offset)
        .input('limit', limit);
      
      Object.keys(params).forEach(key => {
        usersRequest.input(key, params[key]);
      });
      
      const usersResult = await usersRequest.query(usersQuery);
      const users = usersResult.recordset;

      const response: ApiResponse = {
        success: true,
        message: 'Kullanıcılar başarıyla alındı',
        data: users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (dbError) {
      console.error('Veritabanı hatası:', dbError);
      const response: ApiResponse = { 
        success: false, 
        error: 'Veritabanı hatası oluştu' 
      };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Kullanıcılar listesi hatası:', error);
    const response: ApiResponse = { 
      success: false, 
      error: 'Kullanıcılar listelenirken bir hata oluştu' 
    };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
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