import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// CORS configuration
const corsOptions = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Credentials': 'true',
};

export function middleware(request: NextRequest) {
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: corsOptions,
    });
  }

  // Create response
  const response = NextResponse.next();

  // Add CORS headers to all responses
  Object.entries(corsOptions).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Set Access-Control-Allow-Origin based on origin
  const origin = request.headers.get('origin');
  if (origin === 'https://yuklegeltaksi.istekbilisim.com') {
    // Sadece backoffice uygulamasına izin ver
    response.headers.set('Access-Control-Allow-Origin', 'https://yuklegeltaksi.istekbilisim.com');
  } else if (process.env.NODE_ENV !== 'production' && origin) {
    // Development için localhost originlerine izin ver
    const devOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
    if (devOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }
  }
  // Diğer tüm originler için header set etme - bu çift header sorununu önler

  return response;
}

export const config = {
  matcher: [
    '/api/supervisor/:path*',
    '/api/admin/:path*',
    '/api/vehicle-types/:path*',
  ],
};