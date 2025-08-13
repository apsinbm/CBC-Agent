/**
 * Weather Service Integration Tests
 */

import { jest } from '@jest/globals';
import weatherService from '../index.js';
import { WEATHER_PROVIDERS, WEATHER_UNITS, WEATHER_ERROR_CODES } from '../config.js';
import WeatherMetrics from '../metrics.js';

// Mock environment for testing
const mockEnv = (env) => {
  const original = process.env;
  process.env = { ...original, ...env };
  return () => { process.env = original; };
};

// Mock fetch globally
global.fetch = jest.fn();

describe('Weather Service Integration', () => {
  let restoreEnv;

  beforeEach(() => {
    // Reset service state
    weatherService.initialized = false;
    weatherService.config = null;
    weatherService.primaryProvider = null;
    weatherService.fallbackProvider = null;
    weatherService.resilience = null;
    weatherService.metrics = {
      requests_total: 0,
      errors_total: 0,
      fallback_used: 0,
      latency_ms: []
    };

    // Reset metrics
    WeatherMetrics.resetMetrics();

    // Setup test environment
    restoreEnv = mockEnv({
      WEATHER_PROVIDER: WEATHER_PROVIDERS.OPEN_METEO,
      WEATHER_FALLBACK_PROVIDER: WEATHER_PROVIDERS.OPEN_METEO
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    restoreEnv?.();
  });

  describe('Service Initialization', () => {
    it('initializes successfully with Open-Meteo', async () => {
      const timeApiResponse = {
        ok: true,
        json: () => Promise.resolve({
          datetime: new Date().toISOString()
        })
      };
      
      fetch.mockResolvedValueOnce(timeApiResponse);

      await weatherService.initialize();

      expect(weatherService.initialized).toBe(true);
      expect(weatherService.primaryProvider.name).toBe('Open-Meteo');
      expect(weatherService.fallbackProvider.name).toBe('Open-Meteo');
    });

    it('fails initialization with invalid configuration', async () => {
      const restoreBadEnv = mockEnv({
        WEATHER_PROVIDER: 'invalid_provider'
      });

      await expect(weatherService.initialize()).rejects.toThrow(/Invalid WEATHER_PROVIDER/);

      restoreBadEnv();
    });
  });

  describe('Weather Data Fetching', () => {
    const validOpenMeteoResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        current: {
          temperature_2m: 22.5,
          relative_humidity_2m: 65,
          wind_speed_10m: 15.2,
          wind_direction_10m: 180,
          weather_code: 1
        }
      })
    };

    beforeEach(async () => {
      // Mock time sync check
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          datetime: new Date().toISOString()
        })
      });

      await weatherService.initialize();
      jest.clearAllMocks();
    });

    it('fetches weather data successfully', async () => {
      fetch.mockResolvedValueOnce(validOpenMeteoResponse);

      const result = await weatherService.getCurrentWeather();

      expect(result.current.temp).toMatch(/23°C/);
      expect(result.provider).toBe('Open-Meteo');
      expect(result.is_stale).toBe(false);
    });

    it('handles metric and imperial units', async () => {
      fetch
        .mockResolvedValueOnce(validOpenMeteoResponse)
        .mockResolvedValueOnce(validOpenMeteoResponse);

      const metricResult = await weatherService.getCurrentWeather({
        units: WEATHER_UNITS.METRIC
      });
      const imperialResult = await weatherService.getCurrentWeather({
        units: WEATHER_UNITS.IMPERIAL
      });

      expect(metricResult.current.temp).toMatch(/°C/);
      expect(imperialResult.current.temp).toMatch(/°F/);
    });

    it('uses cache for subsequent requests', async () => {
      fetch.mockResolvedValueOnce(validOpenMeteoResponse);

      // First request - cache miss
      const result1 = await weatherService.getCurrentWeather();
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second request - cache hit
      const result2 = await weatherService.getCurrentWeather();
      expect(fetch).toHaveBeenCalledTimes(1); // No additional fetch

      expect(result1.current.temp).toBe(result2.current.temp);
    });

    it('records metrics correctly', async () => {
      fetch.mockResolvedValueOnce(validOpenMeteoResponse);

      await weatherService.getCurrentWeather();

      const metrics = weatherService.getMetrics();
      expect(metrics.requests_total).toBe(1);
      expect(metrics.errors_total).toBe(0);
      expect(metrics.latency_ms.avg).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Resilience', () => {
    beforeEach(async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ datetime: new Date().toISOString() })
      });
      await weatherService.initialize();
      jest.clearAllMocks();
    });

    it('handles provider timeouts', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      fetch.mockRejectedValueOnce(timeoutError);

      await expect(weatherService.getCurrentWeather()).rejects.toThrow(WEATHER_ERROR_CODES.UPSTREAM_ERROR);

      const metrics = weatherService.getMetrics();
      expect(metrics.errors_total).toBe(1);
    });

    it('handles provider 5xx errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Service Unavailable')
      });

      await expect(weatherService.getCurrentWeather()).rejects.toThrow(WEATHER_ERROR_CODES.UPSTREAM_ERROR);
    });

    it('handles provider 4xx errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request')
      });

      await expect(weatherService.getCurrentWeather()).rejects.toThrow(WEATHER_ERROR_CODES.BAD_REQUEST);
    });

    it('handles rate limiting', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Too Many Requests')
      });

      await expect(weatherService.getCurrentWeather()).rejects.toThrow(WEATHER_ERROR_CODES.RATE_LIMIT);
    });

    it('serves stale data when provider fails', async () => {
      const validResponse = {
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          current: {
            temperature_2m: 22.5,
            relative_humidity_2m: 65,
            wind_speed_10m: 15.2,
            wind_direction_10m: 180,
            weather_code: 1
          }
        })
      };

      // First request succeeds and populates cache
      fetch.mockResolvedValueOnce(validResponse);
      const freshResult = await weatherService.getCurrentWeather();
      expect(freshResult.is_stale).toBe(false);

      // Second request fails, should serve stale data
      fetch.mockRejectedValueOnce(new Error('Service unavailable'));
      const staleResult = await weatherService.getCurrentWeather();
      
      expect(staleResult.is_stale).toBe(true);
      expect(staleResult.current.temp).toBe(freshResult.current.temp);
    });
  });

  describe('Circuit Breaker', () => {
    beforeEach(async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ datetime: new Date().toISOString() })
      });
      await weatherService.initialize();
      jest.clearAllMocks();
    });

    it('opens circuit breaker after multiple failures', async () => {
      const error = new Error('Service unavailable');
      
      // Trigger failures to open circuit breaker (threshold is 5)
      for (let i = 0; i < 5; i++) {
        fetch.mockRejectedValueOnce(error);
        try {
          await weatherService.getCurrentWeather();
        } catch (e) {
          // Expected to fail
        }
      }

      const cbStatus = weatherService.resilience.getCircuitBreakerStatus();
      expect(cbStatus.state).toBe('OPEN');
    });
  });

  describe('Health Check', () => {
    it('returns healthy status when service is working', async () => {
      // Mock time sync
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ datetime: new Date().toISOString() })
      });
      
      await weatherService.initialize();
      
      // Mock weather data
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          current: {
            temperature_2m: 22.5,
            relative_humidity_2m: 65,
            wind_speed_10m: 15.2,
            wind_direction_10m: 180,
            weather_code: 1
          }
        })
      });

      const health = await weatherService.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.provider).toBe('Open-Meteo');
      expect(health.response_time_ms).toBeGreaterThan(0);
    });

    it('returns unhealthy status when not initialized', async () => {
      // Don't initialize service
      const health = await weatherService.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toMatch(/not initialized/);
    });
  });

  describe('Provider Capabilities', () => {
    beforeEach(async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ datetime: new Date().toISOString() })
      });
      await weatherService.initialize();
    });

    it('returns provider capabilities', () => {
      const capabilities = weatherService.getProviderCapabilities();

      expect(capabilities.primary).toBeDefined();
      expect(capabilities.primary.provider).toBe('Open-Meteo');
      expect(capabilities.primary.requires_api_key).toBe(false);
      expect(capabilities.fallback).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ datetime: new Date().toISOString() })
      });
      await weatherService.initialize();
      jest.clearAllMocks();
    });

    it('clears cache successfully', async () => {
      // Populate cache
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          current: { temperature_2m: 22.5, relative_humidity_2m: 65, wind_speed_10m: 15.2, wind_direction_10m: 180, weather_code: 1 }
        })
      });
      
      await weatherService.getCurrentWeather();

      // Clear cache
      weatherService.clearCache();

      // Next request should fetch fresh data
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          current: { temperature_2m: 25.0, relative_humidity_2m: 70, wind_speed_10m: 10.0, wind_direction_10m: 90, weather_code: 0 }
        })
      });

      const result = await weatherService.getCurrentWeather();
      expect(fetch).toHaveBeenCalledTimes(2); // Both requests hit the API
    });

    it('resets circuit breaker successfully', async () => {
      // Trigger circuit breaker
      const error = new Error('Service unavailable');
      for (let i = 0; i < 5; i++) {
        fetch.mockRejectedValueOnce(error);
        try {
          await weatherService.getCurrentWeather();
        } catch (e) {
          // Expected
        }
      }

      expect(weatherService.resilience.getCircuitBreakerStatus().state).toBe('OPEN');

      // Reset circuit breaker
      weatherService.resetCircuitBreaker();

      expect(weatherService.resilience.getCircuitBreakerStatus().state).toBe('CLOSED');
    });
  });
});