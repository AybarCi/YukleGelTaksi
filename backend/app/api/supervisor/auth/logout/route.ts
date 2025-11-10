import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupervisorToken, logoutSupervisor } from '../../../../../middleware/supervisorAuth';

export async function POST(request: NextRequest) {
  try {
    // Authenticate supervisor
    const authResult = await authenticateSupervisorToken(request);
    
    if (!authResult.success) {
      const response = NextResponse.json(
        { error: authResult.message },
        { status: 401 }
      );
      
      // Add CORS headers
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      return response;
    }

    // Logout supervisor (delete all sessions)
    const logoutSuccess = await logoutSupervisor(authResult.supervisor!.id);
    
    if (!logoutSuccess) {
      const response = NextResponse.json(
        { error: 'Logout işlemi başarısız' },
        { status: 500 }
      );
      
      // Add CORS headers
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      return response;
    }

    const response = NextResponse.json({
      success: true,
      message: 'Başarıyla çıkış yapıldı'
    });
    
    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return response;

  } catch (error) {
    console.error('Supervisor logout error:', error);
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    
    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return response;
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