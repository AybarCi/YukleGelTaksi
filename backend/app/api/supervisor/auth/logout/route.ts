import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupervisorToken, logoutSupervisor } from '../../../../../middleware/supervisorAuth';

// CORS headers for supervisor endpoints
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate supervisor
    const authResult = await authenticateSupervisorToken(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { 
          status: 401,
          headers: corsHeaders
        }
      );
    }

    // Logout supervisor (delete all sessions)
    const logoutSuccess = await logoutSupervisor(authResult.supervisor!.id);
    
    if (!logoutSuccess) {
      return NextResponse.json(
        { error: 'Logout işlemi başarısız' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Başarıyla çıkış yapıldı'
    }, {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Supervisor logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
}