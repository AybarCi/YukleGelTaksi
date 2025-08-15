import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '../../../../middleware/auth';
import { validateRequest } from '../../../../middleware/validation';
import DatabaseConnection from '../../../../config/database';
import * as Joi from 'joi';

// Profile update schema
const updateProfileSchema = Joi.object({
  full_name: Joi.string().min(2).max(100).optional().messages({
    'string.min': 'Ad soyad en az 2 karakter olmalıdır',
    'string.max': 'Ad soyad en fazla 100 karakter olmalıdır'
  }),
  email: Joi.string().email().optional().messages({
    'string.email': 'Geçerli bir email adresi giriniz'
  }),
  date_of_birth: Joi.date().max('now').optional().messages({
    'date.max': 'Doğum tarihi bugünden ileri olamaz'
  }),
  gender: Joi.string().valid('male', 'female', 'other').optional()
});

// Get user profile
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, message: authResult.message },
        { status: 401 }
      );
    }

    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();
    
    // Get user profile with wallet info
    const userResult = await pool.request()
      .input('userId', authResult.user.id)
      .query(`
        SELECT u.*, w.balance as wallet_balance
        FROM users u
        LEFT JOIN wallets w ON u.id = w.user_id
        WHERE u.id = @userId
      `);
    
    const user = userResult.recordset[0];

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Kullanıcı bulunamadı' },
        { status: 404 }
      );
    }

    // Return user data (excluding password)
    const userData = {
      id: user.id,
      phone: user.phone,
      full_name: user.full_name,
      email: user.email,
      user_type: user.user_type,
      is_verified: user.is_verified,
      profile_image: user.profile_image,
      date_of_birth: user.date_of_birth,
      gender: user.gender,
      wallet_balance: user.wallet_balance || 0,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    return NextResponse.json({
      success: true,
      message: 'Profil bilgileri getirildi',
      data: userData
    });

  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { success: false, message: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}

// Update user profile
export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateToken(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, message: authResult.message },
        { status: 401 }
      );
    }

    // Validate request body
    const validation = await validateRequest(request, updateProfileSchema);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, message: 'Geçersiz veri', errors: validation.errors },
        { status: 400 }
      );
    }

    const updateData = validation.data;
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Check if email is already taken by another user
    if (updateData.email) {
      const existingUserResult = await pool.request()
        .input('email', updateData.email)
        .input('userId', authResult.user.id)
        .query('SELECT id FROM users WHERE email = @email AND id != @userId');

      if (existingUserResult.recordset.length > 0) {
        return NextResponse.json(
          { success: false, message: 'Bu email adresi başka bir kullanıcı tarafından kullanılıyor' },
          { status: 409 }
        );
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const updateRequest = pool.request();
    
    for (const [key, value] of Object.entries(updateData)) {
      if (value !== undefined) {
        updateFields.push(`${key} = @${key}`);
        updateRequest.input(key, value);
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Güncellenecek veri bulunamadı' },
        { status: 400 }
      );
    }

    updateFields.push('updated_at = GETDATE()');
    updateRequest.input('userId', authResult.user.id);

    // Update user profile
    await updateRequest.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = @userId`
    );

    // Get updated user data
    const updatedUserResult = await pool.request()
      .input('userId', authResult.user.id)
      .query(`
        SELECT u.*, w.balance as wallet_balance
        FROM users u
        LEFT JOIN wallets w ON u.id = w.user_id
        WHERE u.id = @userId
      `);
    
    const updatedUser = updatedUserResult.recordset[0];

    // Return updated user data (excluding password)
    const userData = {
      id: updatedUser.id,
      phone: updatedUser.phone,
      full_name: updatedUser.full_name,
      email: updatedUser.email,
      user_type: updatedUser.user_type,
      is_verified: updatedUser.is_verified,
      profile_image: updatedUser.profile_image,
      date_of_birth: updatedUser.date_of_birth,
      gender: updatedUser.gender,
      wallet_balance: updatedUser.wallet_balance || 0,
      created_at: updatedUser.created_at,
      updated_at: updatedUser.updated_at
    };

    return NextResponse.json({
      success: true,
      message: 'Profil başarıyla güncellendi',
      data: userData
    });

  } catch (error) {
    console.error('Update profile error:', error);
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
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}