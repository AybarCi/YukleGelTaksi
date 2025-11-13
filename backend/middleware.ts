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
  if (origin) {
    // Allow specific origins (production)
    const allowedOrigins = [
      'https://backoffice.yuklegeltaksi.com',
      'https://yuklegeltaksi.com',
      'https://www.yuklegeltaksi.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
    ];

    if (allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    } else {
      // Development için daha geniş izin
      if (process.env.NODE_ENV !== 'production') {
        response.headers.set('Access-Control-Allow-Origin', origin);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
};