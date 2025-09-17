import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const minutes = parseInt(searchParams.get('minutes') || '60');
    const eventName = searchParams.get('eventName');

    if (!global.socketServer || !global.socketServer.eventMonitor) {
      return NextResponse.json({ 
        error: 'Event monitor not available' 
      }, { status: 503 });
    }

    const eventMonitor = global.socketServer.eventMonitor;

    switch (type) {
      case 'events':
        if (eventName) {
          const eventStats = eventMonitor.getEventStats(eventName, minutes);
          return NextResponse.json({
            success: true,
            data: {
              eventName,
              stats: eventStats,
              minutes
            }
          });
        } else {
          // Tüm event'lerin listesi
          const allEvents = eventMonitor.getAllEventNames();
          return NextResponse.json({
            success: true,
            data: {
              events: allEvents,
              minutes
            }
          });
        }

      case 'errors':
        if (eventName) {
          const errorStats = eventMonitor.getErrorStats(eventName, minutes);
          return NextResponse.json({
            success: true,
            data: {
              eventName,
              errorStats,
              minutes
            }
          });
        } else {
          const allErrors = eventMonitor.getAllErrorStats(minutes);
          return NextResponse.json({
            success: true,
            data: {
              errors: allErrors,
              minutes
            }
          });
        }

      case 'performance':
        const performanceStats = eventMonitor.getPerformanceStats(minutes);
        return NextResponse.json({
          success: true,
          data: {
            performance: performanceStats,
            minutes
          }
        });

      case 'summary':
        const summary = eventMonitor.getSummary(minutes);
        return NextResponse.json({
          success: true,
          data: summary
        });

      case 'realtime':
        // Son 5 dakikanın özeti
        const realtimeData = {
          connections: {
            drivers: global.socketServer.getConnectedDriversCount(),
            customers: global.socketServer.getConnectedCustomersCount(),
            total: global.socketServer.getConnectedDriversCount() + global.socketServer.getConnectedCustomersCount()
          },
          events: eventMonitor.getRecentEvents(5),
          errors: eventMonitor.getRecentErrors(5),
          performance: eventMonitor.getRecentPerformance(5),
          thresholds: eventMonitor.thresholds,
          timestamp: new Date().toISOString()
        };
        
        return NextResponse.json({
          success: true,
          data: realtimeData
        });

      default:
        // Genel özet
        const generalData = {
          connections: {
            drivers: global.socketServer.getConnectedDriversCount(),
            customers: global.socketServer.getConnectedCustomersCount(),
            total: global.socketServer.getConnectedDriversCount() + global.socketServer.getConnectedCustomersCount(),
            details: global.socketServer.getConnectionDetails ? global.socketServer.getConnectionDetails() : null
          },
          monitoring: {
            isActive: eventMonitor.isMonitoring,
            thresholds: eventMonitor.thresholds,
            uptime: Date.now() - (eventMonitor.startTime || Date.now())
          },
          summary: eventMonitor.getSummary(minutes),
          timestamp: new Date().toISOString()
        };

        return NextResponse.json({
          success: true,
          data: generalData
        });
    }

  } catch (error) {
    console.error('Monitoring API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Threshold'ları güncelleme
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { thresholds } = body;

    if (!global.socketServer || !global.socketServer.eventMonitor) {
      return NextResponse.json({ 
        error: 'Event monitor not available' 
      }, { status: 503 });
    }

    const eventMonitor = global.socketServer.eventMonitor;
    eventMonitor.setThresholds(thresholds);

    return NextResponse.json({
      success: true,
      message: 'Thresholds updated successfully',
      data: {
        thresholds: eventMonitor.thresholds
      }
    });

  } catch (error) {
    console.error('Monitoring threshold update error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}