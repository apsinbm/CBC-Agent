# CBC-Agent Weather Service

## Overview

The CBC-Agent Weather Service provides robust, reliable weather data with multiple provider support, caching, retries, and graceful fallback mechanisms. The service is designed for high availability and includes comprehensive monitoring and observability features.

## Features

- **Multiple Providers**: Open-Meteo (free), WeatherKit (Apple), OpenWeather API
- **Automatic Fallback**: Seamless failover between providers
- **Circuit Breaker**: Prevents cascade failures during outages
- **Smart Caching**: Stale-while-revalidate with 3h fresh / 6h stale windows
- **Retry Logic**: Exponential backoff with jitter for transient errors
- **Structured Logging**: Comprehensive logging with error codes and performance metrics
- **Prometheus Metrics**: Production-ready monitoring and alerting
- **Graceful Degradation**: Never crashes the UI, shows staleness indicators

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Chat Client   │───▶│  Weather API    │───▶│ Weather Service │
└─────────────────┘    │  /api/weather   │    └─────────────────┘
                       └─────────────────┘             │
                                                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Resilience     │◀───│   Provider      │
                       │  (Cache/CB)     │    │   Adapters      │
                       └─────────────────┘    └─────────────────┘
                                                       │
                     ┌──────────────┬──────────────────┼──────────────────┐
                     ▼              ▼                  ▼                  ▼
               ┌──────────┐   ┌──────────┐   ┌─────────────┐   ┌─────────────┐
               │Open-Meteo│   │WeatherKit│   │ OpenWeather │   │ [Future]    │
               │  (Free)  │   │ (Apple)  │   │    API      │   │ Providers   │
               └──────────┘   └──────────┘   └─────────────┘   └─────────────┘
```

## Configuration

### Environment Variables

```bash
# Primary provider (required)
WEATHER_PROVIDER=openmeteo|weatherkit|openweather

# Fallback provider (optional, defaults to openmeteo)
WEATHER_FALLBACK_PROVIDER=openmeteo

# WeatherKit (Apple) - requires Apple Developer account
WEATHERKIT_TEAM_ID=ABC123DEF4
WEATHERKIT_KEY_ID=XYZ789GHI0
WEATHERKIT_BUNDLE_ID=bm.cbc.agent
WEATHERKIT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# OpenWeather API
OPENWEATHER_API_KEY=your_api_key_here
# Or alternatively:
WEATHER_API_KEY=your_api_key_here
```

### Provider Setup

#### Open-Meteo (Recommended Default)
- ✅ **No API key required**
- ✅ **Free tier: 10,000 requests/day**
- ✅ **Reliable and fast**
- ❌ Limited commercial features

#### WeatherKit (Apple)
- ❌ **Requires Apple Developer account ($99/year)**
- ❌ **Complex setup with JWT authentication**
- ✅ **High-quality data and forecasts**
- ✅ **500K requests/month on paid plans**

**Setup Steps:**
1. Apple Developer account required
2. Create App ID in developer portal
3. Generate WeatherKit private key
4. Configure environment variables
5. Test JWT generation with `npm run weather:smoketest`

#### OpenWeather API
- ❌ **API key required (free tier available)**
- ✅ **1,000 requests/day on free tier**
- ✅ **Well-documented API**
- ✅ **Comprehensive weather data**

## API Endpoints

### Internal Weather API
```
GET /api/weather?lat=32.294&lon=-64.783&units=metric
```

**Parameters:**
- `lat`: Latitude (-90 to 90)
- `lon`: Longitude (-180 to 180) 
- `units`: `metric` (default) or `imperial`

**Response:**
```json
{
  "current": {
    "temp": "23°C",
    "feels_like": "25°C", 
    "humidity": 65,
    "wind_speed": "15 km/h from the NE",
    "condition": "partly cloudy"
  },
  "hourly": [],
  "daily": [],
  "issued_at": "2025-01-13T14:30:00Z",
  "provider": "Open-Meteo",
  "is_stale": false
}
```

### Health Check
```
GET /api/weather/health
```

**Response:**
```json
{
  "healthy": true,
  "provider": "Open-Meteo",
  "is_stale": false,
  "response_time_ms": 245,
  "metrics": {
    "requests_total": 1247,
    "error_rate": "2.1",
    "cache_hit_rate": "78.3",
    "circuit_breaker_state": "CLOSED"
  }
}
```

### Prometheus Metrics
```
GET /api/weather/metrics
GET /api/weather/metrics?format=json
```

## Error Handling

The service uses standardized error codes:

- **`WEATHER_UPSTREAM_ERROR`**: Provider service unavailable (5xx, timeouts)
- **`WEATHER_BAD_REQUEST`**: Invalid parameters or credentials (4xx)
- **`WEATHER_RATE_LIMIT`**: Rate limit exceeded (429)

Error responses include provider information and troubleshooting hints.

## Monitoring & Observability

### Prometheus Metrics

```
# Request metrics
weather_requests_total{provider="Open-Meteo",status="success",stale="false"}
weather_latency_ms_bucket{provider="Open-Meteo",le="250"}

# Cache metrics  
weather_cache_hits_total{type="fresh"}
weather_cache_hits_total{type="stale"}

# Circuit breaker
weather_circuit_opens_total{provider="Open-Meteo"}
weather_circuit_breaker_state{provider="Open-Meteo"}

# Error tracking
weather_errors_total{provider="Open-Meteo",error_type="timeout"}
```

### Structured Logging

All operations are logged with structured data:

```json
{
  "provider": "Open-Meteo",
  "url": "https://api.open-meteo.com/v1/forecast?...",
  "lat": 32.2949,
  "lon": -64.7814,
  "units": "metric", 
  "status": 200,
  "duration_ms": 245,
  "attempt": 1,
  "response_body": "{\"current\":{...}}"
}
```

## Testing

### CLI Smoke Test
```bash
# Basic test with default coordinates
npm run weather:smoketest

# Custom coordinates  
npm run weather:smoketest -- --lat 40.7128 --lon -74.0060

# Test with imperial units
npm run weather:smoketest -- --units imperial --verbose

# Health check only
npm run weather:smoketest -- --health-only
```

### Unit Tests
```bash
npm test src/lib/weather/
```

### Integration Tests
```bash
npm run test:integration
```

## Troubleshooting

### Common Issues

#### "Configuration errors" on startup

**Problem**: Missing or invalid environment variables

**Solution**: 
1. Check `.env.local` file exists
2. Verify required variables for your provider
3. Test with: `npm run weather:smoketest`

#### "WeatherKit authentication failed"

**Problem**: Invalid JWT or expired credentials

**Solutions**:
1. Verify `WEATHERKIT_TEAM_ID`, `WEATHERKIT_KEY_ID` are correct
2. Check private key format (must include `-----BEGIN PRIVATE KEY-----`)
3. Ensure system time is synchronized (< 2s drift)
4. Test JWT generation: `npm run weather:smoketest -- --verbose`

#### "Rate limit exceeded" errors

**Problem**: Too many API requests

**Solutions**:
1. Check circuit breaker metrics: `GET /api/weather/metrics?format=json`
2. Verify cache is working (should see cache hits in metrics)
3. Consider upgrading API plan or switching providers
4. Reset circuit breaker if needed (development only)

#### "Time drift detected" warnings

**Problem**: System clock out of sync (affects WeatherKit JWT)

**Solutions**:
1. Sync system time: `sudo sntp -sS time.apple.com`
2. Enable NTP: `sudo systemsetup -setusingnetworktime on`
3. Check again: `npm run weather:smoketest`

#### Weather data is always "stale"

**Problem**: All providers failing, serving cached data

**Solutions**:
1. Check provider status pages
2. Verify API credentials
3. Test network connectivity
4. Check circuit breaker state in metrics

### Provider Status Pages

- **Open-Meteo**: https://status.open-meteo.com/
- **WeatherKit**: https://developer.apple.com/system-status/
- **OpenWeather**: https://status.openweathermap.org/

### Key Rotation

#### WeatherKit
1. Generate new private key in Apple Developer portal
2. Update `WEATHERKIT_PRIVATE_KEY` environment variable  
3. Restart service
4. Test: `npm run weather:smoketest`

#### OpenWeather
1. Generate new API key in OpenWeather dashboard
2. Update `OPENWEATHER_API_KEY` environment variable
3. Restart service
4. Test: `npm run weather:smoketest`

### Switching Providers

To switch from Open-Meteo to WeatherKit:

1. **Setup credentials** (see Provider Setup above)
2. **Update environment**:
   ```bash
   WEATHER_PROVIDER=weatherkit
   WEATHER_FALLBACK_PROVIDER=openmeteo
   ```
3. **Restart service**
4. **Test configuration**: `npm run weather:smoketest`
5. **Monitor metrics** for success rate

### Emergency Fallback

If all providers are failing:

1. **Check service health**: `curl http://localhost:3000/api/weather/health`
2. **Clear cache** (development): `POST /api/weather/metrics/reset?action=reset`
3. **Switch to Open-Meteo** (most reliable):
   ```bash
   WEATHER_PROVIDER=openmeteo
   WEATHER_FALLBACK_PROVIDER=openmeteo
   ```
4. **Restart and test**

## Performance Tuning

### Cache Configuration

Default cache settings are optimized for typical usage:

- **Fresh TTL**: 3 hours (weather changes slowly)
- **Stale TTL**: 6 hours (better than no data)
- **Cache key**: Provider + coordinates (rounded to 2 decimal places)

### Circuit Breaker Tuning

- **Failure threshold**: 5 failures in 2 minutes
- **Open duration**: 60 seconds  
- **Retry strategy**: 2 retries with exponential backoff

### Request Timeouts

- **Connect timeout**: 2 seconds
- **Read timeout**: 3 seconds
- **Total timeout**: 5 seconds (including retries)

## Security Considerations

- **API keys**: Never expose in client-side code or logs
- **Private keys**: WeatherKit private key must be kept secure
- **Rate limiting**: Implement application-level rate limiting if needed
- **IP filtering**: Consider restricting API access by IP in production
- **Monitoring**: Set up alerts for unusual request patterns

## Development

### Adding New Providers

1. Create provider adapter in `src/lib/weather/providers/`
2. Implement required interface methods
3. Add configuration validation in `config.js`
4. Update mapper for unified response format
5. Add provider to service factory
6. Write unit tests
7. Update documentation

### Testing Against Real APIs

Use environment variables for testing:

```bash
# Test WeatherKit
WEATHER_PROVIDER=weatherkit npm run weather:smoketest

# Test OpenWeather  
WEATHER_PROVIDER=openweather npm run weather:smoketest

# Test fallback scenario (simulate primary failure)
# [Temporarily break primary credentials and run test]
```

### Local Development

```bash
# Start development server
npm run dev

# Run smoke test in another terminal
npm run weather:smoketest -- --verbose

# Monitor logs for structured output
tail -f logs/weather.log

# Check metrics
curl "http://localhost:3000/api/weather/metrics?format=json"
```

## Production Deployment

### Monitoring Setup

1. **Prometheus scraping**: Add `/api/weather/metrics` to Prometheus config
2. **Grafana dashboard**: Import weather service dashboard
3. **Alerting rules**: Configure alerts for error rates, response times, circuit breaker state
4. **Log aggregation**: Ensure structured logs are collected (ELK, Splunk, etc.)

### Scaling Considerations

- **Memory usage**: In-memory cache grows with unique coordinate requests
- **Request volume**: Monitor rate limits and consider Redis caching for high volume
- **Geographic distribution**: Consider regional API endpoints for better latency
- **Load balancing**: Weather service is stateless except for in-memory cache

### Health Checks

Configure container/load balancer health checks:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/weather/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```