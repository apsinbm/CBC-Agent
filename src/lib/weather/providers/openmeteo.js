/**
 * Open-Meteo Weather Provider
 * Free weather API, no key required
 */

import { WEATHER_ERROR_CODES, WEATHER_UNITS } from '../config.js';
import { mapOpenMeteoResponse } from '../mapper.js';

export class OpenMeteoProvider {
  constructor(config = {}) {
    this.name = 'Open-Meteo';
    this.config = config;
    this.baseUrl = 'https://api.open-meteo.com/v1';
  }

  /**
   * Fetch weather data from Open-Meteo API
   */
  async fetchWeather({ lat, lon, units = WEATHER_UNITS.METRIC }) {
    const startTime = Date.now();
    
    // Build API URL
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'wind_speed_10m',
        'wind_direction_10m',
        'weather_code'
      ].join(','),
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'wind_speed_10m',
        'weather_code'
      ].join(','),
      daily: [
        'temperature_2m_max',
        'temperature_2m_min',
        'weather_code'
      ].join(','),
      temperature_unit: 'celsius', // Always get Celsius, convert if needed
      wind_speed_unit: 'kmh',
      timezone: 'America/Halifax', // Bermuda timezone
      forecast_days: '3' // 3-day forecast
    });
    
    const url = `${this.baseUrl}/forecast?${params.toString()}`;
    
    const logData = {
      provider: this.name,
      url: url,
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
        
        if (status === 400 || status === 422) {
          errorCode = WEATHER_ERROR_CODES.BAD_REQUEST;
          errorMessage = 'Invalid coordinates or parameters';
        } else if (status === 429) {
          errorCode = WEATHER_ERROR_CODES.RATE_LIMIT;
          errorMessage = 'Rate limit exceeded';
        } else if (status >= 500) {
          errorCode = WEATHER_ERROR_CODES.UPSTREAM_ERROR;
          errorMessage = 'Open-Meteo service unavailable';
        } else {
          errorCode = WEATHER_ERROR_CODES.UPSTREAM_ERROR;
        }

        logData.error = errorMessage;
        console.log('[Weather]', logData);
        
        throw new Error(`${errorCode}: ${errorMessage}`);
      }

      const data = await response.json();
      
      // Log response body (redacted, up to 1KB)
      const responseBody = JSON.stringify(data).substring(0, 1024);
      logData.response_body = responseBody;
      
      console.log('[Weather]', logData);

      // Map to unified format
      const mappedResponse = mapOpenMeteoResponse(data, units);
      
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
   * Health check for Open-Meteo service
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
      requires_api_key: false,
      supports_hourly: true,
      supports_daily: true,
      supports_alerts: false,
      max_forecast_days: 16,
      rate_limits: {
        requests_per_day: 10000,
        requests_per_hour: 1000
      }
    };
  }
}