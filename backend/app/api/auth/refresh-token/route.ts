import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, generateToken } from '../../../../middleware/auth';
import { validateRequest, refreshTokenSchema } from '../../../../middleware/validation';
import DatabaseConnection from '../../../../config/database';

export async function POST(request: NextRequest) {
  try {
    // Validate request
    const validation = await validateRequest(request, refreshTokenSchema);
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        message: 'Validation hatası',
        errors: validation.errors
      }, { status: 400 });
    }

    const { refreshToken } = validation.data;

    // Verify refresh token
    const tokenVerification = verifyRefreshToken(refreshToken);
    if (!tokenVerification.success) {
      return NextResponse.json({
        success: false,
        message: tokenVerification.message || 'Geçersiz refresh token'
      }, { status: 401 });
    }

    const { decoded } = tokenVerification;

    // Get user from database
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    const userResult = await pool.request()
      .input('userId', decoded.userId)
      .query('SELECT * FROM users WHERE id = @userId AND is_active = 1');

    const user = userResult.recordset[0];
    if (!user) {
      return NextResponse.json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      }, { status: 404 });
    }

    // Generate new access token
    const newToken = generateToken({
      userId: user.id,
      phone: user.phone_number,
      userType: user.user_type || 'passenger'
    });

    // Return new token
    return NextResponse.json({
      success: true,
      message: 'Token yenilendi',
      data: {
        token: newToken,
        user: {
          id: user.id,
          phone: user.phone_number,
          full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          email: user.email,
          user_type: user.user_type || 'passenger',
          is_verified: true,
          profile_picture_url: user.profile_picture_url
        }
      }
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json({
      success: false,
      message: 'Sunucu hatası'
    }, { status: 500 });
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