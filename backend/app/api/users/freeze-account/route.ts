import DatabaseConnection from '../../../../config/database';

interface ApiResponse {
  message?: string;
  error?: string;
  success?: boolean;
  is_active?: boolean;
  is_frozen?: boolean;
}

// Basit auth helper
function extractUserFromToken(authHeader: string | null): { userId: number } | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    const token = authHeader.substring(7);
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    // Auth kontrolü
    const authHeader = request.headers.get('authorization');
    const authUser = extractUserFromToken(authHeader);
    
    if (!authUser) {
      const response: ApiResponse = { error: 'Yetkilendirme gerekli' };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { freeze } = await request.json();

    // Validate input
    if (typeof freeze !== 'boolean') {
      const response: ApiResponse = { error: 'freeze parametresi boolean olmalıdır' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Update user's is_active status
    const updateResult = await pool.request()
      .input('user_id', authUser.userId)
      .input('is_active', !freeze)
      .query(`
        UPDATE users 
        SET is_active = @is_active, updated_at = GETDATE()
        WHERE id = @user_id
      `);

    if (updateResult.rowsAffected[0] === 0) {
      const response: ApiResponse = { error: 'Kullanıcı bulunamadı' };
      return new Response(JSON.stringify(response), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const response: ApiResponse = {
      success: true,
      message: freeze 
        ? 'Hesabınız başarıyla donduruldu'
        : 'Hesabınız başarıyla aktifleştirildi',
      is_active: !freeze
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Hesap dondurma hatası:', error);
    const response: ApiResponse = { error: 'Sunucu hatası' };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    // Auth kontrolü
    const authHeader = request.headers.get('authorization');
    const authUser = extractUserFromToken(authHeader);
    
    if (!authUser) {
      const response: ApiResponse = { error: 'Yetkilendirme gerekli' };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Get user's current status
    const userResult = await pool.request()
      .input('user_id', authUser.userId)
      .query(`
        SELECT is_active 
        FROM users 
        WHERE id = @user_id
      `);
    
    if (userResult.recordset.length === 0) {
      const response: ApiResponse = { error: 'Kullanıcı bulunamadı' };
      return new Response(JSON.stringify(response), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = userResult.recordset[0];

    const response: ApiResponse = {
      success: true,
      is_active: user.is_active,
      is_frozen: !user.is_active
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Hesap durumu sorgulama hatası:', error);
    const response: ApiResponse = { error: 'Sunucu hatası' };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}