/**
 * OpenWeather Provider
 * Uses One Call API 3.0 for comprehensive weather data
 */

import { WEATHER_ERROR_CODES, WEATHER_UNITS } from '../config.js';
import { mapOpenWeatherResponse } from '../mapper.js';

export class OpenWeatherProvider {
  constructor(config = {}) {
    this.name = 'OpenWeather';
    this.config = config;
    this.baseUrl = 'https://api.openweathermap.org/data/3.0';
    
    // Validate API key
    const { apiKey } = config.openWeather || {};
    if (!apiKey) {
      throw new Error('OpenWeather requires API key');
    }
    
    this.apiKey = apiKey;
  }

  /**
   * Fetch weather data from OpenWeather One Call API 3.0
   */
  async fetchWeather({ lat, lon, units = WEATHER_UNITS.METRIC }) {
    const startTime = Date.now();
    
    // Map units to OpenWeather format
    const owUnits = units === WEATHER_UNITS.IMPERIAL ? 'imperial' : 'metric';
    
    // Build API URL
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
      appid: this.apiKey,
      units: owUnits,
      exclude: 'minutely,alerts' // Focus on current + hourly + daily
    });
    
    const url = `${this.baseUrl}/onecall?${params.toString()}`;
    
    const logData = {
      provider: this.name,
      url: url.replace(/appid=[^&]+/, 'appid=[REDACTED]'), // Redact API key
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
          'User-Agent': 'CBC-Agent/1.0'
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
          errorMessage = 'Invalid coordinates or parameters';
        } else if (status === 401) {
          errorCode = WEATHER_ERROR_CODES.BAD_REQUEST;
          errorMessage = 'Invalid OpenWeather API key';
        } else if (status === 403) {
          errorCode = WEATHER_ERROR_CODES.BAD_REQUEST;
          errorMessage = 'OpenWeather API key lacks required permissions';
        } else if (status === 429) {
          errorCode = WEATHER_ERROR_CODES.RATE_LIMIT;
          errorMessage = 'OpenWeather rate limit exceeded';
        } else if (status >= 500) {
          errorCode = WEATHER_ERROR_CODES.UPSTREAM_ERROR;
          errorMessage = 'OpenWeather service unavailable';
        } else {
          errorCode = WEATHER_ERROR_CODES.UPSTREAM_ERROR;
        }

        // Try to parse error details from response
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.message) {
            errorMessage += ` - ${errorData.message}`;
          }
        } catch {
          // Response not JSON, use status text
        }

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
      const mappedResponse = mapOpenWeatherResponse(data, units);
      
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
   * Health check for OpenWeather service
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
      max_forecast_days: 8,
      rate_limits: {
        requests_per_day: 1000, // Free tier
        requests_per_minute: 60
      }
    };
  }

  /**
   * Validate API key (for testing)
   */
  async validateApiKey() {
    try {
      // Use current weather endpoint for quick validation
      const params = new URLSearchParams({
        lat: '32.2949',
        lon: '-64.7814',
        appid: this.apiKey
      });
      
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?${params.toString()}`,
        { signal: AbortSignal.timeout(5000) }
      );
      
      if (response.status === 401) {
        return { valid: false, error: 'Invalid API key' };
      }
      
      if (response.status === 403) {
        return { valid: false, error: 'API key lacks permissions' };
      }
      
      return { valid: response.ok, error: response.ok ? null : `HTTP ${response.status}` };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}