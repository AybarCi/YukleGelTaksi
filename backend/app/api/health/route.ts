import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'yuklegeltaksi-backend',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
      redis: process.env.REDIS_HOST && process.env.REDIS_PORT ? 'configured' : 'not configured'
    };
    
    return NextResponse.json(health);
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({ 
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}