/**
 * Weather Health Check Route
 * Internal endpoint for weather service health monitoring
 */

import { NextResponse } from 'next/server';
import weatherService from '@/src/lib/weather';

/**
 * GET /api/weather/health
 * 
 * Internal health check that verifies weather service functionality
 * Used for monitoring and alerting
 */
export async function GET(request) {
  const startTime = Date.now();
  
  try {
    // Initialize service if needed
    if (!weatherService.initialized) {
      console.log('[Weather] Health check initializing service...');
      await weatherService.initialize();
    }

    // Perform health check with timeout
    const healthPromise = weatherService.healthCheck();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Health check timeout')), 2000) // 2s timeout
    );
    
    const healthResult = await Promise.race([healthPromise, timeoutPromise]);
    const duration = Date.now() - startTime;
    
    const response = {
      ...healthResult,
      check_duration_ms: duration,
      timestamp: new Date().toISOString()
    };
    
    const statusCode = healthResult.healthy ? 200 : 503;
    
    console.log(`[Weather] Health check completed in ${duration}ms - ${healthResult.healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    
    return NextResponse.json(response, { status: statusCode });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error(`[Weather] Health check failed in ${duration}ms:`, error.message);
    
    return NextResponse.json(
      { 
        healthy: false,
        error: error.message,
        check_duration_ms: duration,
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}

/**
 * GET /api/weather/health/metrics
 * 
 * Detailed metrics endpoint for observability
 */
export async function POST(request) {
  try {
    if (!weatherService.initialized) {
      return NextResponse.json(
        { error: 'Weather service not initialized' },
        { status: 503 }
      );
    }

    const metrics = weatherService.getMetrics();
    const capabilities = weatherService.getProviderCapabilities();
    
    return NextResponse.json({
      metrics,
      capabilities,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}