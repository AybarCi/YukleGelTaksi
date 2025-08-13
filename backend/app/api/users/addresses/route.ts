import DatabaseConnection from '../../../../config/database';

interface AddAddressRequest {
  title: string;
  address: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

interface UpdateAddressRequest {
  id: number;
  title?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

interface ApiResponse {
  message?: string;
  error?: string;
  address?: any;
  addresses?: any[];
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

// GET - Kullanıcının adreslerini getir
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

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      const addressesResult = await pool.request()
        .input('user_id', authUser.userId)
        .query(`
          SELECT id, title, address, latitude, longitude, is_default, created_at
          FROM user_addresses 
          WHERE user_id = @user_id
          ORDER BY is_default DESC, created_at DESC
        `);

      const addresses = addressesResult.recordset.map((addr: any) => ({
        id: addr.id,
        title: addr.title,
        address: addr.address,
        latitude: addr.latitude,
        longitude: addr.longitude,
        isDefault: addr.is_default,
        createdAt: addr.created_at
      }));

      const response: ApiResponse = {
        message: 'Adresler başarıyla alındı',
        addresses
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
    console.error('Adres alma hatası:', error);
    const response: ApiResponse = { error: 'Adresler alınırken bir hata oluştu' };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST - Yeni adres ekle
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

    const body: AddAddressRequest = await request.json();
    const { title, address, latitude, longitude, isDefault = false } = body;

    // Validasyon
    if (!title || !address) {
      const response: ApiResponse = { error: 'Başlık ve adres gerekli' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (title.length > 50) {
      const response: ApiResponse = { error: 'Başlık en fazla 50 karakter olabilir' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Eğer bu adres varsayılan olarak ayarlanacaksa, diğerlerini varsayılan olmaktan çıkar
      if (isDefault) {
        await pool.request()
          .input('user_id', authUser.userId)
          .query(`
            UPDATE user_addresses 
            SET is_default = 0
            WHERE user_id = @user_id
          `);
      }

      // Yeni adres ekle
      const addResult = await pool.request()
        .input('user_id', authUser.userId)
        .input('title', title)
        .input('address', address)
        .input('latitude', latitude || null)
        .input('longitude', longitude || null)
        .input('is_default', isDefault)
        .query(`
          INSERT INTO user_addresses (
            user_id, title, address, latitude, longitude, is_default
          )
          OUTPUT INSERTED.*
          VALUES (
            @user_id, @title, @address, @latitude, @longitude, @is_default
          )
        `);

      const newAddress = addResult.recordset[0];

      const response: ApiResponse = {
        message: 'Adres başarıyla eklendi',
        address: {
          id: newAddress.id,
          title: newAddress.title,
          address: newAddress.address,
          latitude: newAddress.latitude,
          longitude: newAddress.longitude,
          isDefault: newAddress.is_default,
          createdAt: newAddress.created_at
        }
      };

      return new Response(JSON.stringify(response), {
        status: 201,
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
    console.error('Adres ekleme hatası:', error);
    const response: ApiResponse = { error: 'Adres eklenirken bir hata oluştu' };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// PUT - Adres güncelle
export async function PUT(request: Request): Promise<Response> {
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

    const body: UpdateAddressRequest = await request.json();
    const { id, title, address, latitude, longitude, isDefault } = body;

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
          SELECT id FROM user_addresses 
          WHERE id = @id AND user_id = @user_id
        `);

      if (addressCheck.recordset.length === 0) {
        const response: ApiResponse = { error: 'Adres bulunamadı' };
        return new Response(JSON.stringify(response), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Eğer bu adres varsayılan olarak ayarlanacaksa, diğerlerini varsayılan olmaktan çıkar
      if (isDefault) {
        await pool.request()
          .input('user_id', authUser.userId)
          .query(`
            UPDATE user_addresses 
            SET is_default = 0
            WHERE user_id = @user_id
          `);
      }

      // Güncelleme sorgusu oluştur
      let updateQuery = 'UPDATE user_addresses SET ';
      const updateFields = [];
      const request = pool.request().input('id', id).input('user_id', authUser.userId);

      if (title !== undefined) {
        updateFields.push('title = @title');
        request.input('title', title);
      }
      if (address !== undefined) {
        updateFields.push('address = @address');
        request.input('address', address);
      }
      if (latitude !== undefined) {
        updateFields.push('latitude = @latitude');
        request.input('latitude', latitude);
      }
      if (longitude !== undefined) {
        updateFields.push('longitude = @longitude');
        request.input('longitude', longitude);
      }
      if (isDefault !== undefined) {
        updateFields.push('is_default = @is_default');
        request.input('is_default', isDefault);
      }

      if (updateFields.length === 0) {
        const response: ApiResponse = { error: 'Güncellenecek alan bulunamadı' };
        return new Response(JSON.stringify(response), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      updateQuery += updateFields.join(', ');
      updateQuery += ' OUTPUT INSERTED.* WHERE id = @id AND user_id = @user_id';

      const updateResult = await request.query(updateQuery);
      const updatedAddress = updateResult.recordset[0];

      const response: ApiResponse = {
        message: 'Adres başarıyla güncellendi',
        address: {
          id: updatedAddress.id,
          title: updatedAddress.title,
          address: updatedAddress.address,
          latitude: updatedAddress.latitude,
          longitude: updatedAddress.longitude,
          isDefault: updatedAddress.is_default,
          createdAt: updatedAddress.created_at
        }
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
    console.error('Adres güncelleme hatası:', error);
    const response: ApiResponse = { error: 'Adres güncellenirken bir hata oluştu' };
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}