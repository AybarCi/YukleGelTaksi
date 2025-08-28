import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../config/database';
import mssql from 'mssql';

// Basit token doğrulama yardımcısı
function extractUserFromToken(authHeader: string | null): { userId: number } | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Basit token parsing - gerçek uygulamada JWT verify kullanılmalı
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return { userId: decoded.userId };
  } catch (error) {
    return null;
  }
}

// Hesabı sil (DELETE)
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const userInfo = extractUserFromToken(authHeader);
    
    if (!userInfo) {
      return NextResponse.json(
        { success: false, error: 'Yetkisiz erişim' },
        { status: 401 }
      );
    }

    const db = DatabaseConnection.getInstance();
    await db.connect();

    // Kullanıcının var olup olmadığını kontrol et
    const userCheckResult = await db.query(
      'SELECT id FROM users WHERE id = @userId',
      {
        userId: { value: userInfo.userId, type: mssql.Int }
      }
    );

    if (!userCheckResult.recordset || userCheckResult.recordset.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      );
    }

    // Kullanıcıyı sil (CASCADE ile ilişkili veriler de silinecek)
    await db.query(
      'DELETE FROM users WHERE id = @userId',
      {
        userId: { value: userInfo.userId, type: mssql.Int }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Hesabınız başarıyla silindi'
    });

  } catch (error) {
    console.error('Hesap silme hatası:', error);
    return NextResponse.json(
      { success: false, error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
}