import { NextRequest, NextResponse } from 'next/server';

// Bu endpoint artık kullanılmıyor - SMS tabanlı giriş sistemi kullanılıyor
// Lütfen /api/auth/send-code ve /api/auth/verify-code endpoint'lerini kullanın

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { 
      success: false, 
      message: 'Bu endpoint kullanılmıyor. SMS tabanlı giriş için /api/auth/send-code ve /api/auth/verify-code kullanın.' 
    },
    { status: 410 }
  );
}