import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupervisorToken } from '../../../../../middleware/supervisorAuth';

export async function GET(request: NextRequest) {
  try {
    // Authenticate supervisor token
    const authResult = await authenticateSupervisorToken(request);
    
    if (!authResult.success) {
      const response = NextResponse.json(
        { 
          valid: false, 
          error: authResult.message 
        },
        { status: 401 }
      );
      
      // Add CORS headers
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      return response;
    }

    const response = NextResponse.json({
      valid: true,
      supervisor: authResult.supervisor
    });
    
    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return response;

  } catch (error) {
    console.error('Supervisor token verification error:', error);
    const response = NextResponse.json(
      { 
        valid: false, 
        error: 'Token doğrulama hatası' 
      },
      { status: 500 }
    );
    
    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return response;
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

// OPTIONS method for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}