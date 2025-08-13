import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '../../../../middleware/validation';
import { generateToken } from '../../../../middleware/auth';
import DatabaseConnection from '../../../../config/database';
import bcrypt from 'bcryptjs';
import * as Joi from 'joi';

// Register validation schema
const registerSchema = Joi.object({
  phone: Joi.string().pattern(/^[0-9]{10,11}$/).required().messages({
    'string.pattern.base': 'Telefon numarası 10-11 haneli olmalıdır',
    'any.required': 'Telefon numarası gereklidir'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Şifre en az 6 karakter olmalıdır',
    'any.required': 'Şifre gereklidir'
  }),
  full_name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Ad soyad en az 2 karakter olmalıdır',
    'string.max': 'Ad soyad en fazla 100 karakter olmalıdır',
    'any.required': 'Ad soyad gereklidir'
  }),
  email: Joi.string().email().optional().messages({
    'string.email': 'Geçerli bir email adresi giriniz'
  }),
  user_type: Joi.string().valid('passenger', 'driver').default('passenger')
});

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const validation = await validateRequest(request, registerSchema);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, message: 'Geçersiz veri', errors: validation.errors },
        { status: 400 }
      );
    }

    const { phone, password, full_name, email, user_type } = validation.data;
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Check if user already exists
    const existingUserResult = await pool.request()
      .input('phone_number', phone)
      .query('SELECT id FROM users WHERE phone_number = @phone_number');

    if (existingUserResult.recordset.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Bu telefon numarası ile kayıtlı kullanıcı zaten mevcut' },
        { status: 409 }
      );
    }

    // Check email if provided
    if (email) {
      const existingEmailResult = await pool.request()
        .input('email', email)
        .query('SELECT id FROM users WHERE email = @email');

      if (existingEmailResult.recordset.length > 0) {
        return NextResponse.json(
          { success: false, message: 'Bu email adresi ile kayıtlı kullanıcı zaten mevcut' },
          { status: 409 }
        );
      }
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const nameParts = full_name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    const insertResult = await pool.request()
      .input('phone_number', phone)
      .input('first_name', firstName)
      .input('last_name', lastName)
      .input('email', email || null)
      .input('is_active', 1)
      .query(`INSERT INTO users (phone_number, first_name, last_name, email, is_active, created_at, updated_at)
              OUTPUT INSERTED.id
              VALUES (@phone_number, @first_name, @last_name, @email, @is_active, GETDATE(), GETDATE())`);

    const userId = insertResult.recordset[0].id;

    // Create wallet for the user
    await pool.request()
      .input('user_id', userId)
      .input('balance', 0.00)
      .query('INSERT INTO user_wallets (user_id, balance, created_at, updated_at) VALUES (@user_id, @balance, GETDATE(), GETDATE())');

    // Generate JWT token
    const token = generateToken({
      userId: userId,
      phone: phone,
      userType: user_type
    });

    // Return user data (excluding password)
    const userData = {
      id: userId,
      phone: phone,
      full_name: full_name,
      email: email,
      user_type: user_type,
      is_verified: false,
      profile_image: null,
      created_at: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      message: 'Kayıt başarılı',
      data: {
        user: userData,
        token
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Register error:', error);
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