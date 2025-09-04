import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupervisorToken } from '../../../middleware/supervisorAuth';
import DatabaseConnection from '../../../config/database';
import { CacheManager, CacheKeys, CacheTTL } from '../../../lib/redis';

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
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    // Initialize cache manager
    const cache = new CacheManager();
    const cacheKey = CacheKeys.usersList(page, limit, search);
    const countCacheKey = CacheKeys.usersCount(search);

    try {
      // Try to get from cache first
      const cachedData = await cache.get(cacheKey);
      if (cachedData) {
        return new Response(JSON.stringify({
          success: true,
          data: cachedData,
          cached: true
        }), {
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        });
      }

      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Search condition - Optimized for better performance
      let whereClause = 'WHERE 1=1';
      const params: any = {};
      
      if (search) {
        const searchTerm = search.trim();
        
        // Exact phone number match (most common search)
        if (/^\+?[0-9\s\-\(\)]+$/.test(searchTerm)) {
          whereClause += ` AND phone_number LIKE @phoneSearch`;
          params.phoneSearch = `%${searchTerm.replace(/[\s\-\(\)]/g, '')}%`;
        }
        // Email search (exact domain or username)
        else if (searchTerm.includes('@')) {
          whereClause += ` AND email LIKE @emailSearch`;
          params.emailSearch = `%${searchTerm}%`;
        }
        // Name search - optimized with separate conditions
        else {
          // Split search term for better name matching
          const nameParts = searchTerm.split(' ').filter(part => part.length > 0);
          
          if (nameParts.length === 1) {
            // Single word - search in both first and last name
            whereClause += ` AND (
              first_name LIKE @nameSearch OR 
              last_name LIKE @nameSearch
            )`;
            params.nameSearch = `${nameParts[0]}%`; // Prefix search is faster
          } else if (nameParts.length >= 2) {
            // Multiple words - assume first name + last name
            whereClause += ` AND (
              (first_name LIKE @firstNameSearch AND last_name LIKE @lastNameSearch) OR
              (first_name LIKE @fullNameSearch OR last_name LIKE @fullNameSearch)
            )`;
            params.firstNameSearch = `${nameParts[0]}%`;
            params.lastNameSearch = `${nameParts[1]}%`;
            params.fullNameSearch = `%${searchTerm}%`;
          }
        }
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

      // Prepare response data
      const responseData = {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

      // Cache the result
      await cache.set(cacheKey, responseData, CacheTTL.LIST);
      await cache.set(countCacheKey, { total, totalPages: Math.ceil(total / limit) }, CacheTTL.MEDIUM);

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
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
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
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
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