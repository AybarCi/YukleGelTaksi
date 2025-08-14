import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '../../../../config/database';

interface SendCodeRequest {
  phoneNumber: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SendCodeRequest = await request.json();
    const { phoneNumber } = body;

    // Telefon numarası validasyonu
    if (!phoneNumber || !phoneNumber.match(/^\+90[0-9]{10}$/)) {
      return NextResponse.json(
        { error: 'Geçerli bir Türkiye telefon numarası girin (+905XXXXXXXXX)' },
        { status: 400 }
      );
    }

    // 6 haneli rastgele kod oluştur
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Kodun geçerlilik süresi (1 dakika)
    const expiresAt = new Date(Date.now() + 1 * 60 * 1000);

    try {
      // Veritabanı bağlantısı
      const db = DatabaseConnection.getInstance();
      const pool = await db.connect();

      // Eski kodları temizle
      await pool.request()
        .input('phone_number', phoneNumber)
        .query(`
          UPDATE verification_codes 
          SET is_used = 1 
          WHERE phone_number = @phone_number AND is_used = 0
        `);

      // Yeni kodu kaydet
      await pool.request()
        .input('phone_number', phoneNumber)
        .input('code', verificationCode)
        .input('expires_at', expiresAt)
        .query(`
          INSERT INTO verification_codes (phone_number, code, expires_at)
          VALUES (@phone_number, @code, @expires_at)
        `);

      // TODO: Gerçek SMS gönderimi (Twilio entegrasyonu)
      console.log(`SMS Kodu ${phoneNumber} numarasına gönderildi: ${verificationCode}`);
      
      // Development ortamında kodu response'da döndür
      const responseData = process.env.NODE_ENV === 'development' 
        ? { message: 'Doğrulama kodu gönderildi', code: verificationCode }
        : { message: 'Doğrulama kodu gönderildi' };

      return NextResponse.json(responseData, { status: 200 });

    } catch (dbError) {
      console.error('Veritabanı hatası:', dbError);
      return NextResponse.json(
        { error: 'Veritabanı hatası oluştu' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('SMS gönderme hatası:', error);
    return NextResponse.json(
      { error: 'SMS gönderilirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

// OPTIONS method for CORS
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