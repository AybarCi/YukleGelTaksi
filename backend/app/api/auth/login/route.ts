import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '../../../../middleware/validation';
import { generateToken } from '../../../../middleware/auth';
import DatabaseConnection from '../../../../config/database';
import bcrypt from 'bcryptjs';
import * as Joi from 'joi';

// Login validation schema
const loginSchema = Joi.object({
  phone: Joi.string().pattern(/^[0-9]{10,11}$/).required().messages({
    'string.pattern.base': 'Telefon numarası 10-11 haneli olmalıdır',
    'any.required': 'Telefon numarası gereklidir'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Şifre en az 6 karakter olmalıdır',
    'any.required': 'Şifre gereklidir'
  })
});

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const validation = await validateRequest(request, loginSchema);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, message: 'Geçersiz veri', errors: validation.errors },
        { status: 400 }
      );
    }

    const { phone, password } = validation.data;
    const db = DatabaseConnection.getInstance();

    // Find user by phone
    const user = await db.get(
      'SELECT * FROM users WHERE phone = ? AND is_active = 1',
      [phone]
    );

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Kullanıcı bulunamadı veya hesap aktif değil' },
        { status: 401 }
      );
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: 'Geçersiz şifre' },
        { status: 401 }
      );
    }

    // Update last login
    await db.run(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      phone: user.phone,
      userType: user.user_type
    });

    // Return user data (excluding password)
    const userData = {
      id: user.id,
      phone: user.phone,
      full_name: user.full_name,
      email: user.email,
      user_type: user.user_type,
      is_verified: user.is_verified,
      profile_image: user.profile_image,
      created_at: user.created_at
    };

    return NextResponse.json({
      success: true,
      message: 'Giriş başarılı',
      data: {
        user: userData,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
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