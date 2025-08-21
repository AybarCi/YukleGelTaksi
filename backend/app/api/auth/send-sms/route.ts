import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '../../../../middleware/validation';
import DatabaseConnection from '../../../../config/database';
import * as Joi from 'joi';

// SMS send schema
const sendSmsSchema = Joi.object({
  phone: Joi.string().pattern(/^[0-9]{10,11}$/).required().messages({
    'string.pattern.base': 'Telefon numarası 10-11 haneli olmalıdır',
    'any.required': 'Telefon numarası gereklidir'
  })
});

// Generate random 6-digit code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// SMS kodu console'a yazdır (test için)
function sendSMS(phone: string, code: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Test için kodu console'a yazdır
    setTimeout(() => {
      console.log(`\n=== SMS DOĞRULAMA KODU ===`);
      console.log(`Telefon: ${phone}`);
      console.log(`Kod: ${code}`);
      console.log(`Zaman: ${new Date().toLocaleString('tr-TR')}`);
      console.log(`========================\n`);
      resolve(true);
    }, 500);
  });
}

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const validation = await validateRequest(request, sendSmsSchema);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, message: 'Geçersiz veri', errors: validation.errors },
        { status: 400 }
      );
    }

    const { phone } = validation.data;
    const db = DatabaseConnection.getInstance();
    const pool = await db.connect();

    // Check rate limiting (max 3 SMS per hour) - Skip for test number 5069384413
    if (phone !== '5069384413') {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentSmsResult = await pool.request()
        .input('phone_number', phone)
        .input('oneHourAgo', oneHourAgo)
        .query('SELECT COUNT(*) as count FROM sms_verification_codes WHERE phone_number = @phone_number AND created_at > @oneHourAgo');

      if (recentSmsResult.recordset[0]?.count >= 3) {
        return NextResponse.json(
          { success: false, message: 'Çok fazla SMS talebi. Lütfen 1 saat sonra tekrar deneyin.' },
          { status: 429 }
        );
      }
    }

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 1 * 60 * 1000); // 1 minute

    // Save verification code to database
    await pool.request()
      .input('phone_number', phone)
      .input('code', code)
      .input('expires_at', expiresAt)
      .input('is_used', 0)
      .query(`INSERT INTO sms_verification_codes (phone_number, code, expires_at, is_used, created_at)
              VALUES (@phone_number, @code, @expires_at, @is_used, GETDATE())`);

    // Send SMS (in production, use real SMS service)
    const smsSent = await sendSMS(phone, code);

    if (!smsSent) {
      return NextResponse.json(
        { success: false, message: 'SMS gönderilemedi. Lütfen tekrar deneyin.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Doğrulama kodu gönderildi',
      data: {
        phone: phone,
        expiresIn: 60 // 1 minute in seconds
      }
    });

  } catch (error) {
    console.error('Send SMS error:', error);
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