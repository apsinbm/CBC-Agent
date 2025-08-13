/**
 * Weather API Route
 * Internal endpoint for weather data with unified response format
 */

import { NextResponse } from 'next/server';
import weatherService, { WEATHER_UNITS, WEATHER_ERROR_CODES } from '@/src/lib/weather';

/**
 * GET /api/weather?lat=...&lon=...&units=metric|imperial
 * 
 * Internal weather API with:
 * - Unified response format across all providers
 * - Resilience features (circuit breaker, caching, retries)
 * - Structured error handling
 * - Comprehensive logging
 */
export async function GET(request) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  
  // Parse query parameters
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const units = searchParams.get('units') || WEATHER_UNITS.METRIC;
  
  const logData = {
    endpoint: '/api/weather',
    lat: lat ? parseFloat(lat) : null,
    lon: lon ? parseFloat(lon) : null,
    units,
    user_agent: request.headers.get('user-agent'),
    start_time: new Date().toISOString()
  };

  try {
    // Initialize service if needed
    if (!weatherService.initialized) {
      console.log('[Weather] Lazy initialization...');
      await weatherService.initialize();
    }

    // Validate parameters
    if (lat && (isNaN(parseFloat(lat)) || Math.abs(parseFloat(lat)) > 90)) {
      logData.error = 'Invalid latitude parameter';
      logData.duration_ms = Date.now() - startTime;
      console.log('[Weather]', logData);
      
      return NextResponse.json(
        { 
          error: WEATHER_ERROR_CODES.BAD_REQUEST,
          message: 'Latitude must be between -90 and 90 degrees'
        },
        { status: 400 }
      );
    }

    if (lon && (isNaN(parseFloat(lon)) || Math.abs(parseFloat(lon)) > 180)) {
      logData.error = 'Invalid longitude parameter';
      logData.duration_ms = Date.now() - startTime;
      console.log('[Weather]', logData);
      
      return NextResponse.json(
        { 
          error: WEATHER_ERROR_CODES.BAD_REQUEST,
          message: 'Longitude must be between -180 and 180 degrees'
        },
        { status: 400 }
      );
    }

    if (!Object.values(WEATHER_UNITS).includes(units)) {
      logData.error = 'Invalid units parameter';
      logData.duration_ms = Date.now() - startTime;
      console.log('[Weather]', logData);
      
      return NextResponse.json(
        { 
          error: WEATHER_ERROR_CODES.BAD_REQUEST,
          message: `Units must be one of: ${Object.values(WEATHER_UNITS).join(', ')}`
        },
        { status: 400 }
      );
    }

    // Fetch weather data
    const weatherData = await weatherService.getCurrentWeather({
      lat: lat ? parseFloat(lat) : undefined,
      lon: lon ? parseFloat(lon) : undefined,
      units
    });

    const duration = Date.now() - startTime;
    
    logData.success = true;
    logData.provider = weatherData.provider;
    logData.is_stale = weatherData.is_stale;
    logData.duration_ms = duration;
    
    console.log('[Weather]', logData);

    // Return unified response
    return NextResponse.json(weatherData);

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logData.success = false;
    logData.error = error.message;
    logData.duration_ms = duration;
    
    console.log('[Weather]', logData);

    // Parse error code from message
    let statusCode = 500;
    let errorCode = WEATHER_ERROR_CODES.UPSTREAM_ERROR;
    
    if (error.message.includes(WEATHER_ERROR_CODES.BAD_REQUEST)) {
      statusCode = 400;
      errorCode = WEATHER_ERROR_CODES.BAD_REQUEST;
    } else if (error.message.includes(WEATHER_ERROR_CODES.RATE_LIMIT)) {
      statusCode = 429;
      errorCode = WEATHER_ERROR_CODES.RATE_LIMIT;
    }

    return NextResponse.json(
      { 
        error: errorCode,
        message: error.message,
        provider: 'N/A',
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    );
  }
}

/**
 * GET /api/weather/health
 * Internal health check endpoint
 */
export async function POST(request) {
  // Handle health check sub-route
  const { searchParams } = new URL(request.url);
  const healthCheck = searchParams.get('health') !== null;
  
  if (!healthCheck) {
    return NextResponse.json(
      { error: 'Method not allowed' },
      { status: 405 }
    );
  }

  try {
    let healthResult;
    
    if (!weatherService.initialized) {
      await weatherService.initialize();
    }
    
    healthResult = await weatherService.healthCheck();
    
    const statusCode = healthResult.healthy ? 200 : 503;
    
    return NextResponse.json(healthResult, { status: statusCode });
    
  } catch (error) {
    return NextResponse.json(
      { 
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}