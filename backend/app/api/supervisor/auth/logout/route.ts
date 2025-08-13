import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupervisorToken, logoutSupervisor } from '../../../../../middleware/supervisorAuth';

export async function POST(request: NextRequest) {
  try {
    // Authenticate supervisor
    const authResult = await authenticateSupervisorToken(request);
    
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.message },
        { status: 401 }
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
    });

  } catch (error) {
    console.error('Supervisor logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}