import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupervisorToken } from '../../../../../middleware/supervisorAuth';

// CORS headers for supervisor endpoints
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

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
        { 
          status: 401,
          headers: corsHeaders
        }
      );
    }

    return NextResponse.json({
      valid: true,
      supervisor: authResult.supervisor
    }, {
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Supervisor token verification error:', error);
    return NextResponse.json(
      { 
        valid: false, 
        error: 'Token doğrulama hatası' 
      },
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}