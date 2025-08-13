import DatabaseConnection from '../../../../config/database';

interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
}

interface ApiResponse {
  message?: string;
  error?: string;
  user?: any;
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

    const body: UpdateProfileRequest = await request.json();
    const { firstName, lastName, email, dateOfBirth, gender } = body;

    // Validasyon
    if (!firstName || !lastName) {
      const response: ApiResponse = { error: 'Ad ve soyad gerekli' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (firstName.length < 2 || lastName.length < 2) {
      const response: ApiResponse = { error: 'Ad ve soyad en az 2 karakter olmalı' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      const response: ApiResponse = { error: 'Geçerli bir email adresi girin' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Email benzersizlik kontrolü
      if (email) {
        const emailCheck = await pool.request()
          .input('email', email)
          .input('user_id', authUser.userId)
          .query(`
            SELECT id FROM users 
            WHERE email = @email AND id != @user_id AND is_active = 1
          `);

        if (emailCheck.recordset.length > 0) {
          const response: ApiResponse = { error: 'Bu email adresi zaten kullanılıyor' };
          return new Response(JSON.stringify(response), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Kullanıcı bilgilerini güncelle
      const updateResult = await pool.request()
        .input('user_id', authUser.userId)
        .input('first_name', firstName)
        .input('last_name', lastName)
        .input('email', email || null)
        .input('date_of_birth', dateOfBirth ? new Date(dateOfBirth) : null)
        .input('gender', gender || null)
        .query(`
          UPDATE users 
          SET 
            first_name = @first_name,
            last_name = @last_name,
            email = @email,
            date_of_birth = @date_of_birth,
            gender = @gender,
            updated_at = GETDATE()
          OUTPUT INSERTED.*
          WHERE id = @user_id AND is_active = 1
        `);

      if (updateResult.recordset.length === 0) {
        const response: ApiResponse = { error: 'Kullanıcı bulunamadı' };
        return new Response(JSON.stringify(response), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const updatedUser = updateResult.recordset[0];

      const response: ApiResponse = {
        message: 'Profil başarıyla güncellendi',
        user: {
          id: updatedUser.id,
          phoneNumber: updatedUser.phone_number,
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          email: updatedUser.email,
          dateOfBirth: updatedUser.date_of_birth,
          gender: updatedUser.gender
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
    console.error('Profil güncelleme hatası:', error);
    const response: ApiResponse = { error: 'Profil güncellenirken bir hata oluştu' };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Kullanıcı profil bilgilerini getir
export async function GET(request: Request): Promise<Response> {
  try {
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

    const userResult = await pool.request()
      .input('user_id', authUser.userId)
      .query(`
        SELECT * FROM users 
        WHERE id = @user_id AND is_active = 1
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
      user: {
        id: user.id,
        phoneNumber: user.phone_number,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        dateOfBirth: user.date_of_birth,
        gender: user.gender,
        profileImageUrl: user.profile_image_url,
        isVerified: user.is_verified,
        createdAt: user.created_at
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Profil getirme hatası:', error);
    const response: ApiResponse = { error: 'Profil bilgileri alınırken bir hata oluştu' };
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
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}