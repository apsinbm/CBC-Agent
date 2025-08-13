import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Use America/Halifax timezone (same as Bermuda)
    const tz = 'America/Halifax';
    const now = new Date();
    
    const time = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(now);
    
    const date = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(now);
    
    return NextResponse.json({
      status: 'healthy',
      endpoint: '/api/health/time',
      data: {
        timeZone: 'Atlantic/Bermuda (America/Halifax)',
        currentTime: time,
        currentDate: date,
        timestamp: now.toISOString(),
        offsetMinutes: -240
      }
    });
  } catch (error) {
    console.error('Health check time error:', error);
    return NextResponse.json(
      { 
        status: 'error',
        endpoint: '/api/health/time',
        error: error.message 
      },
      { status: 500 }
    );
  }
}