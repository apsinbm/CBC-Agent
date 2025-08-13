/**
 * Weather Service Configuration
 * Handles environment validation and provider configuration
 */

export const WEATHER_PROVIDERS = {
  OPEN_METEO: 'openmeteo',
  WEATHER_KIT: 'weatherkit', 
  OPEN_WEATHER: 'openweather'
};

export const WEATHER_ERROR_CODES = {
  UPSTREAM_ERROR: 'WEATHER_UPSTREAM_ERROR',
  BAD_REQUEST: 'WEATHER_BAD_REQUEST',
  RATE_LIMIT: 'WEATHER_RATE_LIMIT'
};

export const WEATHER_UNITS = {
  METRIC: 'metric',
  IMPERIAL: 'imperial'
};

// Default configuration
export const DEFAULT_CONFIG = {
  provider: WEATHER_PROVIDERS.OPEN_METEO,
  fallbackProvider: WEATHER_PROVIDERS.OPEN_METEO,
  timeout: {
    connect: 2000, // 2s
    read: 3000     // 3s
  },
  retries: {
    count: 2,
    baseDelay: 1000, // 1s
    maxDelay: 5000   // 5s
  },
  circuitBreaker: {
    failureThreshold: 5,
    timeWindow: 120000, // 2 minutes
    openDuration: 60000 // 1 minute
  },
  cache: {
    ttl: 10800,    // 3 hours in seconds
    staleWhileRevalidate: 21600 // 6 hours
  },
  coordinates: {
    // Coral Beach & Tennis Club, Bermuda
    lat: 32.2949,
    lon: -64.7814
  }
};

/**
 * Get weather service configuration from environment
 */
export function getWeatherConfig() {
  const config = {
    ...DEFAULT_CONFIG,
    provider: process.env.WEATHER_PROVIDER || DEFAULT_CONFIG.provider,
    fallbackProvider: process.env.WEATHER_FALLBACK_PROVIDER || DEFAULT_CONFIG.fallbackProvider
  };

  // Provider-specific configuration
  if (config.provider === WEATHER_PROVIDERS.WEATHER_KIT) {
    config.weatherKit = {
      teamId: process.env.WEATHERKIT_TEAM_ID,
      keyId: process.env.WEATHERKIT_KEY_ID,
      privateKey: process.env.WEATHERKIT_PRIVATE_KEY,
      bundleId: process.env.WEATHERKIT_BUNDLE_ID || 'bm.cbc.agent'
    };
  }

  if (config.provider === WEATHER_PROVIDERS.OPEN_WEATHER) {
    config.openWeather = {
      apiKey: process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY
    };
  }

  return config;
}

/**
 * Validate weather service configuration at startup
 */
export function validateWeatherConfig() {
  const config = getWeatherConfig();
  const errors = [];

  // Validate provider
  if (!Object.values(WEATHER_PROVIDERS).includes(config.provider)) {
    errors.push(`Invalid WEATHER_PROVIDER: ${config.provider}. Must be one of: ${Object.values(WEATHER_PROVIDERS).join(', ')}`);
  }

  // Provider-specific validation
  if (config.provider === WEATHER_PROVIDERS.WEATHER_KIT) {
    const { teamId, keyId, privateKey } = config.weatherKit || {};
    
    if (!teamId) {
      errors.push('WEATHERKIT_TEAM_ID is required when using WeatherKit provider');
    }
    
    if (!keyId) {
      errors.push('WEATHERKIT_KEY_ID is required when using WeatherKit provider');
    }
    
    if (!privateKey) {
      errors.push('WEATHERKIT_PRIVATE_KEY is required when using WeatherKit provider');
    }
    
    // Validate private key format
    if (privateKey && !privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      errors.push('WEATHERKIT_PRIVATE_KEY must be in PEM format');
    }
  }

  if (config.provider === WEATHER_PROVIDERS.OPEN_WEATHER) {
    const { apiKey } = config.openWeather || {};
    
    if (!apiKey) {
      errors.push('WEATHER_API_KEY or OPENWEATHER_API_KEY is required when using OpenWeather provider');
    }
  }

  // Validate coordinates
  if (typeof config.coordinates.lat !== 'number' || Math.abs(config.coordinates.lat) > 90) {
    errors.push('Invalid latitude coordinate');
  }
  
  if (typeof config.coordinates.lon !== 'number' || Math.abs(config.coordinates.lon) > 180) {
    errors.push('Invalid longitude coordinate');
  }

  if (errors.length > 0) {
    const errorMessage = `Weather service configuration errors:\n${errors.map(e => `  - ${e}`).join('\n')}`;
    throw new Error(errorMessage);
  }

  return config;
}

/**
 * Check server time synchronization
 * WeatherKit requires accurate time for JWT validation
 */
export async function checkTimeSync() {
  try {
    const start = Date.now();
    const response = await fetch('https://worldtimeapi.org/api/timezone/Atlantic/Bermuda', {
      signal: AbortSignal.timeout(3000)
    });
    
    if (!response.ok) {
      console.warn('[Weather] Could not verify time sync - worldtimeapi.org unavailable');
      return { synced: true, drift: 0, warning: 'Could not verify time sync' };
    }
    
    const data = await response.json();
    const serverTime = new Date(data.datetime).getTime();
    const localTime = Date.now();
    const drift = Math.abs(serverTime - localTime) / 1000; // seconds
    
    const synced = drift <= 2; // Allow 2 second drift
    
    if (!synced) {
      console.warn(`[Weather] Server time drift detected: ${drift.toFixed(1)}s`);
    }
    
    return { synced, drift, warning: synced ? null : `Time drift: ${drift.toFixed(1)}s` };
  } catch (error) {
    console.warn('[Weather] Could not verify time sync:', error.message);
    return { synced: true, drift: 0, warning: 'Could not verify time sync' };
  }
}

/**
 * Log configuration status (without exposing secrets)
 */
export function logConfigStatus() {
  const config = getWeatherConfig();
  
  console.log('[Weather] Configuration:', {
    provider: config.provider,
    fallbackProvider: config.fallbackProvider,
    hasWeatherKitCredentials: !!(config.weatherKit?.teamId && config.weatherKit?.keyId && config.weatherKit?.privateKey),
    hasOpenWeatherKey: !!config.openWeather?.apiKey,
    coordinates: config.coordinates,
    timeout: config.timeout,
    retries: config.retries,
    circuitBreaker: config.circuitBreaker,
    cache: config.cache
  });
}