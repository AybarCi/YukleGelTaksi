import { NextRequest, NextResponse } from 'next/server';

// Production CORS configuration
const PRODUCTION_ORIGINS = [
  'https://backoffice.yuklegeltaksi.com',
  'https://yuklegeltaksi.com',
  'https://www.yuklegeltaksi.com',
  'https://yuklegeltaksiapi.istekbilisim.com',
  'https://deneme.istekbilisim.com',
  'https://yuklegeltaksi.istekbilisim.com',
];

const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:19006', // React Native
];

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-API-Key',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400', // 24 hours
};

export function setCorsHeaders(response: NextResponse, origin: string | null) {
  // Set base CORS headers
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Set origin-specific header
  if (origin) {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const allowedOrigins = isDevelopment 
      ? [...PRODUCTION_ORIGINS, ...DEVELOPMENT_ORIGINS]
      : PRODUCTION_ORIGINS;

    if (allowedOrigins.includes(origin) || isDevelopment) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }
  }

  return response;
}

export function corsMiddleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });
    return setCorsHeaders(response, origin);
  }

  // For non-preflight requests, we'll add headers in the response
  return NextResponse.next();
}