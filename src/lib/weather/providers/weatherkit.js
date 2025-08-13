/**
 * Apple WeatherKit Provider  
 * Requires Apple Developer account and WeatherKit subscription
 */

import { WEATHER_ERROR_CODES, WEATHER_UNITS } from '../config.js';
import { mapWeatherKitResponse } from '../mapper.js';
import crypto from 'crypto';

export class WeatherKitProvider {
  constructor(config = {}) {
    this.name = 'WeatherKit';
    this.config = config;
    this.baseUrl = 'https://weatherkit.apple.com/api/v1';
    
    // Validate required config
    const { teamId, keyId, privateKey, bundleId } = config.weatherKit || {};
    if (!teamId || !keyId || !privateKey) {
      throw new Error('WeatherKit requires teamId, keyId, and privateKey');
    }
    
    this.teamId = teamId;
    this.keyId = keyId;
    this.bundleId = bundleId || 'bm.cbc.agent';
    
    // Parse private key
    try {
      this.privateKey = crypto.createPrivateKey(privateKey);
    } catch (error) {
      throw new Error(`Invalid WeatherKit private key: ${error.message}`);
    }
  }

  /**
   * Generate JWT token for WeatherKit authentication
   * Uses ES256 algorithm as required by Apple
   */
  generateJWT() {
    const now = Math.floor(Date.now() / 1000);
    
    const header = {
      alg: 'ES256',
      typ: 'JWT',
      kid: this.keyId
    };
    
    const payload = {
      iss: this.teamId,
      sub: this.bundleId,
      aud: 'weatherkit.apple.com',
      iat: now,
      exp: now + (50 * 60) // 50 minutes (max allowed)
    };
    
    // Encode header and payload
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    // Create signature
    const data = `${headerB64}.${payloadB64}`;
    const signature = crypto.sign('sha256', Buffer.from(data), this.privateKey);
    const signatureB64 = signature.toString('base64url');
    
    return `${data}.${signatureB64}`;
  }

  /**
   * Fetch weather data from WeatherKit API
   */
  async fetchWeather({ lat, lon, units = WEATHER_UNITS.METRIC }) {
    const startTime = Date.now();
    
    // Generate JWT token
    let jwt;
    try {
      jwt = this.generateJWT();
    } catch (error) {
      throw new Error(`${WEATHER_ERROR_CODES.BAD_REQUEST}: Failed to generate JWT - ${error.message}`);
    }
    
    // Build API URL
    const params = new URLSearchParams({
      dataSets: 'currentWeather',
      timezone: 'America/Halifax'
    });
    
    const url = `${this.baseUrl}/weather/en/${lat}/${lon}?${params.toString()}`;
    
    const logData = {
      provider: this.name,
      url: url.replace(/\/weather\/en\/[^?]+/, '/weather/en/[LAT]/[LON]'), // Redact coordinates
      lat,
      lon,
      units,
      attempt: 1
    };

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout?.read || 3000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'User-Agent': 'CBC-Agent/1.0',
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);
      
      const duration = Date.now() - startTime;
      const status = response.status;
      
      logData.status = status;
      logData.duration_ms = duration;

      if (!response.ok) {
        let errorCode;
        let errorMessage = `HTTP ${status}`;
        
        const responseText = await response.text().catch(() => '');
        
        if (status === 400) {
          errorCode = WEATHER_ERROR_CODES.BAD_REQUEST;
          errorMessage = 'Invalid request parameters';
        } else if (status === 401) {
          errorCode = WEATHER_ERROR_CODES.BAD_REQUEST;
          errorMessage = 'WeatherKit authentication failed - check credentials';
        } else if (status === 403) {
          errorCode = WEATHER_ERROR_CODES.BAD_REQUEST;
          errorMessage = 'WeatherKit access denied - check subscription';
        } else if (status === 429) {
          errorCode = WEATHER_ERROR_CODES.RATE_LIMIT;
          errorMessage = 'WeatherKit rate limit exceeded';
        } else if (status >= 500) {
          errorCode = WEATHER_ERROR_CODES.UPSTREAM_ERROR;
          errorMessage = 'WeatherKit service unavailable';
        } else {
          errorCode = WEATHER_ERROR_CODES.UPSTREAM_ERROR;
        }

        // Log response body for debugging (redacted)
        logData.error = errorMessage;
        logData.response_body = responseText.substring(0, 1024);
        console.log('[Weather]', logData);
        
        throw new Error(`${errorCode}: ${errorMessage}`);
      }

      const data = await response.json();
      
      // Log response body (redacted, up to 1KB)
      const responseBody = JSON.stringify(data).substring(0, 1024);
      logData.response_body = responseBody;
      
      console.log('[Weather]', logData);

      // Map to unified format
      const mappedResponse = mapWeatherKitResponse(data, units);
      
      return {
        success: true,
        data: mappedResponse,
        provider: this.name,
        duration: duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logData.duration_ms = duration;
      logData.error = error.message;
      
      if (error.name === 'AbortError') {
        logData.error = 'Request timeout';
        console.log('[Weather]', logData);
        throw new Error(`${WEATHER_ERROR_CODES.UPSTREAM_ERROR}: Request timeout`);
      }
      
      console.log('[Weather]', logData);
      throw error;
    }
  }

  /**
   * Health check for WeatherKit service
   */
  async healthCheck() {
    try {
      const result = await this.fetchWeather({
        lat: 32.2949,
        lon: -64.7814,
        units: WEATHER_UNITS.METRIC
      });
      
      return {
        healthy: true,
        provider: this.name,
        response_time: result.duration
      };
    } catch (error) {
      return {
        healthy: false,
        provider: this.name,
        error: error.message
      };
    }
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    return {
      provider: this.name,
      requires_api_key: true,
      supports_hourly: true,
      supports_daily: true,
      supports_alerts: true,
      max_forecast_days: 10,
      rate_limits: {
        requests_per_day: 500000, // Depends on subscription
        requests_per_minute: 1000
      }
    };
  }

  /**
   * Validate JWT generation (for testing)
   */
  validateJWT() {
    try {
      const jwt = this.generateJWT();
      const parts = jwt.split('.');
      
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      
      // Decode and validate payload
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      const now = Math.floor(Date.now() / 1000);
      
      if (payload.exp <= now) {
        throw new Error('JWT expired');
      }
      
      if (payload.iat > now + 60) { // Allow 1 minute clock skew
        throw new Error('JWT issued in future');
      }
      
      return {
        valid: true,
        expires_at: new Date(payload.exp * 1000).toISOString(),
        issued_at: new Date(payload.iat * 1000).toISOString()
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}