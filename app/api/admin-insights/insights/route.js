import { NextResponse } from 'next/server';
import { getInsights } from '@/src/lib/analytics/logEvent';

export async function GET(request) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    );
  }
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);
    
    const insights = await getInsights(days);
    
    return NextResponse.json(insights);
  } catch (error) {
    console.error('Insights API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    );
  }
}