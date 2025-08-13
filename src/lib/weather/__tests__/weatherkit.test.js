/**
 * WeatherKit Provider Tests
 */

import { jest } from '@jest/globals';
import crypto from 'crypto';
import { WeatherKitProvider } from '../providers/weatherkit.js';
import { WEATHER_ERROR_CODES, WEATHER_UNITS } from '../config.js';

// Mock crypto module
jest.mock('crypto', () => ({
  createPrivateKey: jest.fn(),
  sign: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

describe('WeatherKitProvider', () => {
  let provider;
  let mockPrivateKey;
  
  const validConfig = {
    weatherKit: {
      teamId: 'TEST123',
      keyId: 'KEY456', 
      privateKey: '-----BEGIN PRIVATE KEY-----\nMIIG...\n-----END PRIVATE KEY-----',
      bundleId: 'com.test.app'
    },
    timeout: { read: 3000 }
  };

  beforeEach(() => {
    mockPrivateKey = { type: 'private' };
    crypto.createPrivateKey.mockReturnValue(mockPrivateKey);
    crypto.sign.mockReturnValue(Buffer.from('mock_signature'));
    
    provider = new WeatherKitProvider(validConfig);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    it('creates provider with valid configuration', () => {
      expect(provider.name).toBe('WeatherKit');
      expect(provider.teamId).toBe('TEST123');
      expect(provider.keyId).toBe('KEY456');
      expect(provider.bundleId).toBe('com.test.app');
    });

    it('throws error for missing credentials', () => {
      const invalidConfig = {
        weatherKit: {
          teamId: 'TEST123'
          // Missing keyId and privateKey
        }
      };

      expect(() => new WeatherKitProvider(invalidConfig))
        .toThrow('WeatherKit requires teamId, keyId, and privateKey');
    });

    it('throws error for invalid private key', () => {
      crypto.createPrivateKey.mockImplementation(() => {
        throw new Error('Invalid key format');
      });

      expect(() => new WeatherKitProvider(validConfig))
        .toThrow('Invalid WeatherKit private key');
    });
  });

  describe('generateJWT', () => {
    beforeEach(() => {
      // Mock Date.now to make tests deterministic
      jest.spyOn(Date, 'now').mockReturnValue(1640995200000); // 2022-01-01 00:00:00 UTC
    });

    afterEach(() => {
      Date.now.mockRestore();
    });

    it('generates valid JWT with correct structure', () => {
      const jwt = provider.generateJWT();
      const parts = jwt.split('.');
      
      expect(parts).toHaveLength(3);
      
      // Decode header
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      expect(header).toEqual({
        alg: 'ES256',
        typ: 'JWT',
        kid: 'KEY456'
      });
      
      // Decode payload
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      expect(payload.iss).toBe('TEST123');
      expect(payload.sub).toBe('com.test.app');
      expect(payload.aud).toBe('weatherkit.apple.com');
      expect(payload.exp - payload.iat).toBe(3000); // 50 minutes
    });

    it('calls crypto.sign with correct parameters', () => {
      provider.generateJWT();
      
      expect(crypto.sign).toHaveBeenCalledWith(
        'sha256',
        expect.any(Buffer),
        mockPrivateKey
      );
    });
  });

  describe('validateJWT', () => {
    it('validates successfully generated JWT', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1640995200000);
      
      const validation = provider.validateJWT();
      
      expect(validation.valid).toBe(true);
      expect(validation.expires_at).toBeDefined();
      expect(validation.issued_at).toBeDefined();
      
      Date.now.mockRestore();
    });

    it('detects invalid JWT format', () => {
      // Mock generateJWT to return invalid format
      jest.spyOn(provider, 'generateJWT').mockReturnValue('invalid.jwt');
      
      const validation = provider.validateJWT();
      
      expect(validation.valid).toBe(false);
      expect(validation.error).toMatch(/Invalid JWT format/);
    });
  });

  describe('fetchWeather', () => {
    const validWeatherResponse = {
      currentWeather: {
        temperature: 22.5,
        temperatureApparent: 24.0,
        humidity: 0.65,
        windSpeed: 3.2,
        windDirection: 180,
        conditionCode: 'PartlyCloudy',
        asOf: '2022-01-01T12:00:00Z'
      }
    };

    it('fetches weather successfully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(validWeatherResponse)
      });

      const result = await provider.fetchWeather({
        lat: 32.2949,
        lon: -64.7814,
        units: WEATHER_UNITS.METRIC
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('WeatherKit');
      expect(result.data.current.temp).toContain('23°C'); // Rounded
      expect(result.data.provider).toBe('WeatherKit');
    });

    it('handles authentication errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      });

      await expect(provider.fetchWeather({
        lat: 32.2949,
        lon: -64.7814,
        units: WEATHER_UNITS.METRIC
      })).rejects.toThrow(WEATHER_ERROR_CODES.BAD_REQUEST);
    });

    it('handles rate limiting', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Too Many Requests')
      });

      await expect(provider.fetchWeather({
        lat: 32.2949,
        lon: -64.7814,
        units: WEATHER_UNITS.METRIC
      })).rejects.toThrow(WEATHER_ERROR_CODES.RATE_LIMIT);
    });

    it('handles server errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Service Unavailable')
      });

      await expect(provider.fetchWeather({
        lat: 32.2949,
        lon: -64.7814,
        units: WEATHER_UNITS.METRIC
      })).rejects.toThrow(WEATHER_ERROR_CODES.UPSTREAM_ERROR);
    });

    it('handles network timeouts', async () => {
      // Mock AbortError
      const abortError = new Error('Request timeout');
      abortError.name = 'AbortError';
      fetch.mockRejectedValueOnce(abortError);

      await expect(provider.fetchWeather({
        lat: 32.2949,
        lon: -64.7814,
        units: WEATHER_UNITS.METRIC
      })).rejects.toThrow(WEATHER_ERROR_CODES.UPSTREAM_ERROR);
    });
  });

  describe('healthCheck', () => {
    it('returns healthy status on success', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          currentWeather: {
            temperature: 22.5,
            conditionCode: 'Clear'
          }
        })
      });

      const health = await provider.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.provider).toBe('WeatherKit');
      expect(health.response_time).toBeDefined();
    });

    it('returns unhealthy status on error', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const health = await provider.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
    });
  });

  describe('getCapabilities', () => {
    it('returns correct capabilities', () => {
      const capabilities = provider.getCapabilities();

      expect(capabilities.provider).toBe('WeatherKit');
      expect(capabilities.requires_api_key).toBe(true);
      expect(capabilities.supports_hourly).toBe(true);
      expect(capabilities.supports_daily).toBe(true);
      expect(capabilities.supports_alerts).toBe(true);
    });
  });
});