/**
 * Weather Configuration Tests
 */

import { jest } from '@jest/globals';
import { 
  getWeatherConfig, 
  validateWeatherConfig, 
  checkTimeSync,
  WEATHER_PROVIDERS,
  DEFAULT_CONFIG 
} from '../config.js';

// Mock environment variables
const mockEnv = (env) => {
  const original = process.env;
  process.env = { ...original, ...env };
  return () => { process.env = original; };
};

// Mock fetch for time sync check
global.fetch = jest.fn();

describe('Weather Configuration', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getWeatherConfig', () => {
    it('returns default configuration when no env vars set', () => {
      const restore = mockEnv({});
      const config = getWeatherConfig();
      
      expect(config.provider).toBe(DEFAULT_CONFIG.provider);
      expect(config.timeout).toEqual(DEFAULT_CONFIG.timeout);
      expect(config.retries).toEqual(DEFAULT_CONFIG.retries);
      
      restore();
    });

    it('uses environment variables when provided', () => {
      const restore = mockEnv({
        WEATHER_PROVIDER: WEATHER_PROVIDERS.WEATHER_KIT,
        WEATHERKIT_TEAM_ID: 'TEST123',
        WEATHERKIT_KEY_ID: 'KEY456',
        WEATHERKIT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nMIIG...\\n-----END PRIVATE KEY-----'
      });
      
      const config = getWeatherConfig();
      
      expect(config.provider).toBe(WEATHER_PROVIDERS.WEATHER_KIT);
      expect(config.weatherKit.teamId).toBe('TEST123');
      expect(config.weatherKit.keyId).toBe('KEY456');
      
      restore();
    });

    it('configures OpenWeather when provider is set', () => {
      const restore = mockEnv({
        WEATHER_PROVIDER: WEATHER_PROVIDERS.OPEN_WEATHER,
        WEATHER_API_KEY: 'test_key_123'
      });
      
      const config = getWeatherConfig();
      
      expect(config.provider).toBe(WEATHER_PROVIDERS.OPEN_WEATHER);
      expect(config.openWeather.apiKey).toBe('test_key_123');
      
      restore();
    });
  });

  describe('validateWeatherConfig', () => {
    it('validates successfully with Open-Meteo (no credentials needed)', () => {
      const restore = mockEnv({
        WEATHER_PROVIDER: WEATHER_PROVIDERS.OPEN_METEO
      });
      
      expect(() => validateWeatherConfig()).not.toThrow();
      
      restore();
    });

    it('throws error for invalid provider', () => {
      const restore = mockEnv({
        WEATHER_PROVIDER: 'invalid_provider'
      });
      
      expect(() => validateWeatherConfig()).toThrow(/Invalid WEATHER_PROVIDER/);
      
      restore();
    });

    it('validates WeatherKit credentials', () => {
      const restore = mockEnv({
        WEATHER_PROVIDER: WEATHER_PROVIDERS.WEATHER_KIT
      });
      
      expect(() => validateWeatherConfig()).toThrow(/WEATHERKIT_TEAM_ID is required/);
      
      restore();
    });

    it('validates WeatherKit private key format', () => {
      const restore = mockEnv({
        WEATHER_PROVIDER: WEATHER_PROVIDERS.WEATHER_KIT,
        WEATHERKIT_TEAM_ID: 'TEST123',
        WEATHERKIT_KEY_ID: 'KEY456',
        WEATHERKIT_PRIVATE_KEY: 'invalid_key_format'
      });
      
      expect(() => validateWeatherConfig()).toThrow(/must be in PEM format/);
      
      restore();
    });

    it('validates OpenWeather API key', () => {
      const restore = mockEnv({
        WEATHER_PROVIDER: WEATHER_PROVIDERS.OPEN_WEATHER
      });
      
      expect(() => validateWeatherConfig()).toThrow(/WEATHER_API_KEY.*is required/);
      
      restore();
    });

    it('validates coordinates', () => {
      const restore = mockEnv({
        WEATHER_PROVIDER: WEATHER_PROVIDERS.OPEN_METEO
      });
      
      const config = validateWeatherConfig();
      expect(config.coordinates.lat).toBeGreaterThanOrEqual(-90);
      expect(config.coordinates.lat).toBeLessThanOrEqual(90);
      expect(config.coordinates.lon).toBeGreaterThanOrEqual(-180);
      expect(config.coordinates.lon).toBeLessThanOrEqual(180);
      
      restore();
    });
  });

  describe('checkTimeSync', () => {
    it('returns synced when time difference is small', async () => {
      const now = new Date();
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          datetime: now.toISOString()
        })
      });
      
      const result = await checkTimeSync();
      
      expect(result.synced).toBe(true);
      expect(result.drift).toBeLessThan(2);
    });

    it('detects time drift', async () => {
      const now = new Date();
      const driftedTime = new Date(now.getTime() + 5000); // 5 second drift
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          datetime: driftedTime.toISOString()
        })
      });
      
      const result = await checkTimeSync();
      
      expect(result.synced).toBe(false);
      expect(result.drift).toBeGreaterThan(2);
      expect(result.warning).toMatch(/Time drift/);
    });

    it('handles API failures gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await checkTimeSync();
      
      expect(result.synced).toBe(true); // Default to true on error
      expect(result.warning).toMatch(/Could not verify/);
    });
  });
});