import { NextRequest, NextResponse } from 'next/server';
import { authenticateToken } from '../../../../middleware/auth';
import DatabaseConnection from '../../../../config/database';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateToken(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
    }

    // Get phone number from authenticated user
    const userPhoneNumber = authResult.user.phone_number;

    const db = DatabaseConnection.getInstance();
    
    // Sürücü bilgilerini getir
    const selectQuery = `
      SELECT 
        id,
        first_name,
        last_name,
        phone_number,
        is_approved,
        is_active,
        created_at,
        updated_at
      FROM drivers 
      WHERE phone_number = @phone
    `;

    const driver = await db.get(selectQuery, { phone: userPhoneNumber });

    if (!driver) {
      return NextResponse.json(
        { error: 'Sürücü kaydı bulunamadı' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: driver.id,
        first_name: driver.first_name,
        last_name: driver.last_name,
        phone: driver.phone_number,
        is_approved: driver.is_approved,
        is_active: driver.is_active,
        created_at: driver.created_at,
        updated_at: driver.updated_at,
        status: driver.is_approved ? 'approved' : 'pending'
      }
    });

  } catch (error) {
    console.error('Sürücü durumu getirme hatası:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}