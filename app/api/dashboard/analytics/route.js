import { NextResponse } from 'next/server';
import { getInsights } from '@/src/lib/analytics/logEvent';

export async function GET(request) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);
    const timeRange = searchParams.get('timeRange') || '7d';
    
    // Map timeRange to days
    let analysisDays = 7;
    switch (timeRange) {
      case '24h':
        analysisDays = 1;
        break;
      case '7d':
        analysisDays = 7;
        break;
      case '30d':
        analysisDays = 30;
        break;
      default:
        analysisDays = days;
    }
    
    const insights = await getInsights(analysisDays);
    
    // If there's an error in insights, return it
    if (insights.error) {
      return NextResponse.json(insights, { status: 500 });
    }
    
    // Format response for dashboard compatibility
    const dashboardData = {
      sessions: insights.sessions || 0,
      pageViews: insights.pageViews || 0,
      searches: insights.searches || 0,
      faqViews: insights.faqViews || 0,
      avgSessionDuration: insights.avgSessionDuration || 0,
      chatSessions: insights.chatSessions || 0,
      serviceRequests: insights.serviceRequests || 0,
      deflectionRate: insights.deflectionRate || 0,
      
      topPages: insights.topPages || [
        { page: '/chat', views: insights.chatSessions || 0 },
        { page: '/faq', views: insights.faqViews || 0 }
      ],
      
      searchTrends: insights.searchTrends || [],
      
      faqCategories: insights.faqCategories || [],
      
      hourlyActivity: insights.hourlyActivity || Array.from({ length: 24 }, (_, hour) => ({
        hour: `${hour}:00`,
        activity: 0
      })),
      
      // Metadata
      _metadata: {
        timeRange,
        analysisDays,
        totalEvents: insights.totalEvents || 0,
        dateRange: insights.dateRange,
        lastUpdated: new Date().toISOString(),
        dataSource: 'live'
      }
    };
    
    return NextResponse.json(dashboardData);
    
  } catch (error) {
    console.error('Dashboard analytics API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch analytics data',
        detail: error.message,
        _metadata: {
          dataSource: 'error',
          lastUpdated: new Date().toISOString()
        }
      },
      { status: 500 }
    );
  }
}