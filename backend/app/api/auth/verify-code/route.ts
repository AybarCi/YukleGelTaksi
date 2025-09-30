import DatabaseConnection from '../../../../config/database';

interface VerifyCodeRequest {
  phoneNumber: string;
  code: string;
}

interface ApiResponse {
  message?: string;
  error?: string;
  token?: string;
  user?: {
    id: number;
    phoneNumber: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    isNewUser: boolean;
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body: VerifyCodeRequest = await request.json();
    const { phoneNumber, code } = body;

    // Input validasyonu
    if (!phoneNumber || !code) {
      const response: ApiResponse = { error: 'Telefon numarası ve kod gerekli' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!phoneNumber.match(/^\+90[0-9]{10}$/)) {
      const response: ApiResponse = { error: 'Geçerli bir telefon numarası girin' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!code.match(/^[0-9]{6}$/)) {
      const response: ApiResponse = { error: 'Doğrulama kodu 6 haneli olmalı' };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Doğrulama kodunu kontrol et
      const codeResult = await pool.request()
        .input('phone_number', phoneNumber)
        .input('code', code)
        .query(`
          SELECT * FROM verification_codes 
          WHERE phone_number = @phone_number 
            AND code = @code 
            AND is_used = 0 
            AND expires_at > GETDATE()
        `);

      if (codeResult.recordset.length === 0) {
        const response: ApiResponse = { error: 'Geçersiz veya süresi dolmuş kod' };
        return new Response(JSON.stringify(response), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Kodu kullanıldı olarak işaretle
      await pool.request()
        .input('code_id', codeResult.recordset[0].id)
        .query(`
          UPDATE verification_codes 
          SET is_used = 1 
          WHERE id = @code_id
        `);

      // Kullanıcının var olup olmadığını kontrol et
      const userResult = await pool.request()
        .input('phone_number', phoneNumber)
        .query(`
          SELECT * FROM users 
          WHERE phone_number = @phone_number AND is_active = 1
        `);

      let user;
      let isNewUser = false;

      if (userResult.recordset.length === 0) {
        // Yeni kullanıcı oluştur
        const createUserResult = await pool.request()
          .input('phone_number', phoneNumber)
          .input('is_verified', true)
          .query(`
            INSERT INTO users (phone_number, is_verified, first_name, last_name, email)
            OUTPUT INSERTED.*
            VALUES (@phone_number, @is_verified, NULL, NULL, NULL)
          `);
        
        user = createUserResult.recordset[0];
        isNewUser = true;
      } else {
        // Mevcut kullanıcıyı doğrulanmış olarak işaretle
        await pool.request()
          .input('phone_number', phoneNumber)
          .query(`
            UPDATE users 
            SET is_verified = 1, updated_at = GETDATE() 
            WHERE phone_number = @phone_number
          `);
        
        user = userResult.recordset[0];
        isNewUser = false;
      }

      // JWT token oluştur (basit implementasyon)
      const tokenPayload = {
        userId: user.id,
        phoneNumber: user.phone_number,
        timestamp: Date.now()
      };
      
      // Basit token (production'da JWT kullanılmalı)
      const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

      const response: ApiResponse = {
        message: 'Doğrulama başarılı',
        token,
        user: {
          id: user.id,
          phoneNumber: user.phone_number,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          isNewUser
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
    console.error('Kod doğrulama hatası:', error);
    const response: ApiResponse = { error: 'Kod doğrulanırken bir hata oluştu' };
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}