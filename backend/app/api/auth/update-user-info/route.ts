import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '../../../../middleware/auth';
import DatabaseConnection from '../../../../config/database';

// Manual validation function
function validateUserInfo(data: any) {
  const errors: string[] = [];
  
  if (!data.first_name || typeof data.first_name !== 'string' || data.first_name.trim().length === 0) {
    errors.push('Ad gerekli');
  } else if (data.first_name.length > 50) {
    errors.push('Ad çok uzun');
  }
  
  if (!data.last_name || typeof data.last_name !== 'string' || data.last_name.trim().length === 0) {
    errors.push('Soyad gerekli');
  } else if (data.last_name.length > 50) {
    errors.push('Soyad çok uzun');
  }
  
  if (data.email && typeof data.email === 'string' && data.email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Geçersiz email formatı');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    data: {
      first_name: data.first_name?.trim(),
      last_name: data.last_name?.trim(),
      email: data.email?.trim() || ''
    }
  };
}

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

    // Parse and validate request body
    const body = await request.json();
    const validation = validateUserInfo(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, message: 'Geçersiz veri', errors: validation.errors },
        { status: 400 }
      );
    }

    const { first_name, last_name, email } = validation.data;
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Check if email is already taken by another user (if email is provided)
    if (email && email.trim() !== '') {
      const existingUser = await pool.request()
        .input('email', email)
        .input('user_id', authResult.user.id)
        .query('SELECT id FROM users WHERE email = @email AND id != @user_id');

      if (existingUser.recordset.length > 0) {
        return NextResponse.json(
          { success: false, message: 'Bu email adresi başka bir kullanıcı tarafından kullanılıyor' },
          { status: 409 }
        );
      }
    }

    // Update user info
    const updateQuery = `
      UPDATE users 
      SET 
        first_name = @first_name,
        last_name = @last_name,
        ${email && email.trim() !== '' ? 'email = @email,' : ''}
        updated_at = GETDATE()
      WHERE id = @user_id
    `;

    const request_obj = pool.request()
      .input('first_name', first_name)
      .input('last_name', last_name)
      .input('user_id', authResult.user.id);

    if (email && email.trim() !== '') {
      request_obj.input('email', email);
    }

    await request_obj.query(updateQuery);

    // Get updated user data
    const updatedUserResult = await pool.request()
      .input('user_id', authResult.user.id)
      .query(`
        SELECT u.*, w.balance as wallet_balance
        FROM users u
        LEFT JOIN user_wallets w ON u.id = w.user_id
        WHERE u.id = @user_id
      `);

    const updatedUser = updatedUserResult.recordset[0];

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, message: 'Kullanıcı bulunamadı' },
        { status: 404 }
      );
    }

    // Return updated user data
    const userData = {
      id: updatedUser.id,
      phone: updatedUser.phone_number,
      full_name: `${updatedUser.first_name || ''} ${updatedUser.last_name || ''}`.trim(),
      email: updatedUser.email,
      user_type: updatedUser.user_type,
      is_verified: updatedUser.is_verified,
      profile_image: updatedUser.profile_picture_url,
      wallet_balance: updatedUser.wallet_balance || 0,
      created_at: updatedUser.created_at,
      updated_at: updatedUser.updated_at
    };

    return NextResponse.json({
      success: true,
      message: 'Kullanıcı bilgileri başarıyla güncellendi',
      data: userData
    });

  } catch (error) {
    console.error('Update user info error:', error);
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
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}