/**
 * Weather Metrics API Route
 * Prometheus-compatible metrics endpoint for weather service monitoring
 */

import { NextResponse } from 'next/server';
import WeatherMetrics from '@/src/lib/weather/metrics';
import weatherService from '@/src/lib/weather';

/**
 * GET /api/weather/metrics
 * 
 * Prometheus-compatible metrics endpoint
 * Returns weather service metrics in Prometheus format
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'prometheus';
    
    if (format === 'prometheus') {
      // Return Prometheus-formatted metrics
      const metricsOutput = WeatherMetrics.exportPrometheusMetrics();
      
      return new Response(metricsOutput, {
        headers: {
          'Content-Type': 'text/plain; version=0.0.4',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    } else if (format === 'json') {
      // Return JSON format for debugging
      const summary = WeatherMetrics.getMetricsSummary();
      let serviceMetrics = {};
      
      try {
        if (weatherService.initialized) {
          serviceMetrics = weatherService.getMetrics();
        }
      } catch (error) {
        console.error('[Weather] Error getting service metrics:', error);
      }
      
      return NextResponse.json({
        prometheus_metrics: summary,
        service_metrics: serviceMetrics
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid format. Use ?format=prometheus or ?format=json' },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('[Weather] Metrics endpoint error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to export metrics',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/weather/metrics/reset
 * 
 * Reset metrics (for testing/development only)
 */
export async function POST(request) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Metrics reset only available in development' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    if (action === 'reset') {
      WeatherMetrics.resetMetrics();
      
      return NextResponse.json({
        success: true,
        message: 'Weather metrics reset',
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use ?action=reset' },
        { status: 400 }
      );
    }
    
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}