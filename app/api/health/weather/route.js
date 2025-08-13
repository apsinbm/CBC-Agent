import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Bermuda coordinates
    const lat = 32.2949;
    const lon = -64.7814;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,weather_code,relative_humidity_2m&temperature_unit=celsius&wind_speed_unit=kmh&timezone=America%2FHalifax`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for health check
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Weather API returned ${response.status}`);
    }
    
    const data = await response.json();
    const current = data.current;
    
    // Weather code descriptions
    const weatherDescriptions = {
      0: 'clear sky',
      1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
      45: 'foggy', 48: 'depositing rime fog',
      51: 'light drizzle', 53: 'moderate drizzle', 55: 'dense drizzle',
      61: 'light rain', 63: 'moderate rain', 65: 'heavy rain',
      71: 'light snow', 73: 'moderate snow', 75: 'heavy snow',
      80: 'light showers', 81: 'moderate showers', 82: 'heavy showers',
      95: 'thunderstorm', 96: 'thunderstorm with light hail', 99: 'thunderstorm with heavy hail'
    };
    
    const weatherCode = current.weather_code || 0;
    const description = weatherDescriptions[weatherCode] || 'unknown conditions';
    
    return NextResponse.json({
      status: 'healthy',
      endpoint: '/api/health/weather',
      data: {
        location: 'Bermuda (Coral Beach & Tennis Club)',
        coordinates: { latitude: lat, longitude: lon },
        temperature: `${Math.round(current.temperature_2m)}°C`,
        windSpeed: `${Math.round(current.wind_speed_10m)} km/h`,
        humidity: `${current.relative_humidity_2m}%`,
        conditions: description,
        weatherCode: weatherCode,
        timestamp: current.time,
        source: 'Open-Meteo'
      }
    });
  } catch (error) {
    console.error('Health check weather error:', error);
    
    const errorMessage = error.name === 'AbortError' 
      ? 'Request timeout (5s)' 
      : error.message;
    
    return NextResponse.json(
      { 
        status: 'error',
        endpoint: '/api/health/weather',
        error: errorMessage,
        suggestion: 'Weather service may be temporarily unavailable'
      },
      { status: 503 }
    );
  }
}