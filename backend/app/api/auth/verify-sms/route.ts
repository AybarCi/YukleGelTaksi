import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '../../../../middleware/validation';
import { generateToken, generateRefreshToken } from '../../../../middleware/auth';
import DatabaseConnection from '../../../../config/database';
import * as Joi from 'joi';

// SMS verification schema
const verifySchema = Joi.object({
  phone: Joi.string().pattern(/^[0-9]{10,11}$/).required().messages({
    'string.pattern.base': 'Telefon numarası 10-11 haneli olmalıdır',
    'any.required': 'Telefon numarası gereklidir'
  }),
  code: Joi.string().length(6).pattern(/^[0-9]+$/).required().messages({
    'string.length': 'Doğrulama kodu 6 haneli olmalıdır',
    'string.pattern.base': 'Doğrulama kodu sadece rakamlardan oluşmalıdır',
    'any.required': 'Doğrulama kodu gereklidir'
  }),
  user_type: Joi.string().valid('customer', 'driver').default('customer').messages({
    'any.only': 'Kullanıcı tipi customer veya driver olmalıdır'
  })
});

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const validation = await validateRequest(request, verifySchema);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, message: 'Geçersiz veri', errors: validation.errors },
        { status: 400 }
      );
    }

    const { phone, code, user_type } = validation.data;
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Find verification code
    const verificationResult = await pool.request()
      .input('phone_number', phone)
      .input('code', code)
      .query(`SELECT TOP 1 * FROM sms_verification_codes 
              WHERE phone_number = @phone_number AND code = @code AND is_used = 0 AND expires_at > GETDATE()
              ORDER BY created_at DESC`);

    const verification = verificationResult.recordset[0];

    if (!verification) {
      return NextResponse.json(
        { success: false, message: 'Geçersiz veya süresi dolmuş doğrulama kodu' },
        { status: 400 }
      );
    }

    // Mark verification code as used
    await pool.request()
      .input('id', verification.id)
      .query('UPDATE sms_verification_codes SET is_used = 1 WHERE id = @id');

    // Find or create user
    const userResult = await pool.request()
      .input('phone_number', phone)
      .query('SELECT * FROM users WHERE phone_number = @phone_number');
    
    let user = userResult.recordset[0];

    if (!user) {
      // Create new user if doesn't exist
      const insertResult = await pool.request()
        .input('phone_number', phone)
        .input('first_name', '')
        .input('last_name', '')
        .input('email', `user_${phone}@yuklegeltaksi.com`)
        .input('user_type', user_type)
        .input('is_active', 1)
        .query(`INSERT INTO users (phone_number, first_name, last_name, email, user_type, is_active, created_at, updated_at)
                OUTPUT INSERTED.id
                VALUES (@phone_number, @first_name, @last_name, @email, @user_type, @is_active, GETDATE(), GETDATE())`);

      const userId = insertResult.recordset[0].id;

      // Create wallet for the user
      await pool.request()
        .input('user_id', userId)
        .input('balance', 0.00)
        .query('INSERT INTO user_wallets (user_id, balance, created_at, updated_at) VALUES (@user_id, @balance, GETDATE(), GETDATE())');

      // Get the created user
      const newUserResult = await pool.request()
        .input('id', userId)
        .query('SELECT * FROM users WHERE id = @id');
      user = newUserResult.recordset[0];
    } else {
      // Update user last login time
      await pool.request()
        .input('id', user.id)
        .query('UPDATE users SET updated_at = GETDATE() WHERE id = @id');
    }

    // Generate JWT token and refresh token
    const token = generateToken({
      userId: user.id,
      phone: user.phone_number,
      userType: 'passenger'
    });
    
    const refreshToken = generateRefreshToken({
      userId: user.id,
      phone: user.phone_number
    });

    // Return user data (excluding password)
    const userData = {
      id: user.id,
      phone: user.phone_number,
      full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      email: user.email,
      user_type: user.user_type || user_type,
      is_verified: true, // SMS verified users are considered verified
      profile_image: user.profile_picture_url,
      created_at: user.created_at
    };

    return NextResponse.json({
      success: true,
      message: 'SMS doğrulama başarılı',
      data: {
        user: userData,
        token,
        refreshToken
      }
    });

  } catch (error) {
    console.error('SMS verification error:', error);
    return NextResponse.json(
      { success: false, message: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}