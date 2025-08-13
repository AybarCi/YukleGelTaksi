import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupervisorToken } from '../../../../../middleware/supervisorAuth';

export async function GET(request: NextRequest) {
  try {
    // Authenticate supervisor token
    const authResult = await authenticateSupervisorToken(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { 
          valid: false, 
          error: authResult.message 
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      valid: true,
      supervisor: authResult.supervisor
    });

  } catch (error) {
    console.error('Supervisor token verification error:', error);
    return NextResponse.json(
      { 
        valid: false, 
        error: 'Token doğrulama hatası' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}