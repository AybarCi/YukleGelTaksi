import DatabaseConnection from '../../../../../config/database';

interface DeleteAddressRequest {
  id: number;
}

interface ApiResponse {
  message?: string;
  error?: string;
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

export async function DELETE(request: Request): Promise<Response> {
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

    const body: DeleteAddressRequest = await request.json();
    const { id } = body;

    // Validasyon
    if (!id) {
      const response: ApiResponse = { error: 'Adres ID gerekli' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Adresin kullanıcıya ait olduğunu kontrol et
      const addressCheck = await pool.request()
        .input('id', id)
        .input('user_id', authUser.userId)
        .query(`
          SELECT id, is_default FROM user_addresses 
          WHERE id = @id AND user_id = @user_id
        `);

      if (addressCheck.recordset.length === 0) {
        const response: ApiResponse = { error: 'Adres bulunamadı' };
        return new Response(JSON.stringify(response), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const address = addressCheck.recordset[0];

      // Adresi sil
      await pool.request()
        .input('id', id)
        .input('user_id', authUser.userId)
        .query(`
          DELETE FROM user_addresses 
          WHERE id = @id AND user_id = @user_id
        `);

      // Eğer silinen adres varsayılan adres ise, başka bir adresi varsayılan yap
      if (address.is_default) {
        const remainingAddresses = await pool.request()
          .input('user_id', authUser.userId)
          .query(`
            SELECT TOP 1 id FROM user_addresses 
            WHERE user_id = @user_id
            ORDER BY created_at ASC
          `);

        if (remainingAddresses.recordset.length > 0) {
          const newDefaultId = remainingAddresses.recordset[0].id;
          await pool.request()
            .input('id', newDefaultId)
            .query(`
              UPDATE user_addresses 
              SET is_default = 1
              WHERE id = @id
            `);
        }
      }

      const response: ApiResponse = {
        message: 'Adres başarıyla silindi'
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (dbError) {
      console.error('Veritabanı hatası:', dbError);
      const response: ApiResponse = { error: 'Veritabanı hatası oluştu' };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Adres silme hatası:', error);
    const response: ApiResponse = { error: 'Adres silinirken bir hata oluştu' };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}