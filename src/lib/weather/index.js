/**
 * Weather Service
 * Main entry point for weather functionality with provider management,
 * resilience features, and unified API
 */

import { 
  getWeatherConfig, 
  validateWeatherConfig, 
  checkTimeSync,
  logConfigStatus,
  WEATHER_PROVIDERS,
  WEATHER_ERROR_CODES,
  WEATHER_UNITS
} from './config.js';
import { WeatherResilience } from './resilience.js';
import { OpenMeteoProvider } from './providers/openmeteo.js';
import { WeatherKitProvider } from './providers/weatherkit.js';
import { OpenWeatherProvider } from './providers/openweather.js';
import { createErrorResponse } from './mapper.js';
import WeatherMetrics from './metrics.js';

class WeatherService {
  constructor() {
    this.config = null;
    this.primaryProvider = null;
    this.fallbackProvider = null;
    this.resilience = null;
    this.initialized = false;
    this.metrics = {
      requests_total: 0,
      errors_total: 0,
      fallback_used: 0,
      latency_ms: []
    };
  }

  /**
   * Initialize weather service
   * Must be called before using the service
   */
  async initialize() {
    try {
      console.log('[Weather] Initializing service...');
      
      // Validate configuration
      this.config = validateWeatherConfig();
      
      // Log configuration (without secrets)
      logConfigStatus();
      
      // Check time synchronization for WeatherKit
      if (this.config.provider === WEATHER_PROVIDERS.WEATHER_KIT) {
        const timeCheck = await checkTimeSync();
        if (!timeCheck.synced) {
          console.warn(`[Weather] ${timeCheck.warning}`);
        }
      }
      
      // Initialize providers
      this.primaryProvider = this.createProvider(this.config.provider);
      this.fallbackProvider = this.createProvider(this.config.fallbackProvider);
      
      // Initialize resilience features
      this.resilience = new WeatherResilience(this.config);
      
      // Validate providers
      await this.validateProviders();
      
      this.initialized = true;
      console.log('[Weather] Service initialized successfully');
      
    } catch (error) {
      console.error('[Weather] Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Create provider instance based on type
   */
  createProvider(providerType) {
    switch (providerType) {
      case WEATHER_PROVIDERS.OPEN_METEO:
        return new OpenMeteoProvider(this.config);
      
      case WEATHER_PROVIDERS.WEATHER_KIT:
        return new WeatherKitProvider(this.config);
      
      case WEATHER_PROVIDERS.OPEN_WEATHER:
        return new OpenWeatherProvider(this.config);
      
      default:
        throw new Error(`Unknown provider type: ${providerType}`);
    }
  }

  /**
   * Validate that providers can be used
   */
  async validateProviders() {
    const validations = [];
    
    // Validate primary provider
    if (this.primaryProvider) {
      try {
        // Check provider-specific validation
        if (this.primaryProvider.validateJWT) {
          const jwtValidation = this.primaryProvider.validateJWT();
          if (!jwtValidation.valid) {
            throw new Error(`JWT validation failed: ${jwtValidation.error}`);
          }
        }
        
        if (this.primaryProvider.validateApiKey) {
          const keyValidation = await this.primaryProvider.validateApiKey();
          if (!keyValidation.valid) {
            throw new Error(`API key validation failed: ${keyValidation.error}`);
          }
        }
        
        console.log(`[Weather] Primary provider ${this.primaryProvider.name} validated`);
      } catch (error) {
        console.warn(`[Weather] Primary provider validation failed: ${error.message}`);
      }
    }
    
    // Always validate fallback (Open-Meteo) if different from primary
    if (this.fallbackProvider && this.fallbackProvider.name !== this.primaryProvider?.name) {
      console.log(`[Weather] Fallback provider ${this.fallbackProvider.name} ready`);
    }
  }

  /**
   * Ensure service is initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('Weather service not initialized. Call initialize() first.');
    }
  }

  /**
   * Get current weather for given coordinates
   */
  async getCurrentWeather({ lat, lon, units = WEATHER_UNITS.METRIC } = {}) {
    this.ensureInitialized();
    
    // Use default coordinates if not provided
    lat = lat ?? this.config.coordinates.lat;
    lon = lon ?? this.config.coordinates.lon;
    
    this.metrics.requests_total++;
    const startTime = Date.now();
    
    const logData = {
      lat,
      lon,
      units,
      primary_provider: this.primaryProvider.name,
      fallback_provider: this.fallbackProvider.name
    };

    try {
      // Try primary provider first
      const result = await this.resilience.fetchWeatherWithResilience(
        this.primaryProvider, 
        { lat, lon, units }
      );
      
      const duration = Date.now() - startTime;
      this.recordLatency(duration);
      
      // Record metrics
      WeatherMetrics.recordRequest(
        this.primaryProvider.name, 
        'success', 
        duration, 
        result.is_stale
      );
      
      logData.success = true;
      logData.provider_used = this.primaryProvider.name;
      logData.duration_ms = duration;
      logData.is_stale = result.is_stale;
      
      console.log('[Weather] Request completed:', logData);
      
      return result;

    } catch (primaryError) {
      console.warn(`[Weather] Primary provider failed: ${primaryError.message}`);
      
      // Try fallback provider if different from primary
      if (this.fallbackProvider.name !== this.primaryProvider.name) {
        try {
          this.metrics.fallback_used++;
          
          const fallbackResult = await this.resilience.fetchWeatherWithResilience(
            this.fallbackProvider,
            { lat, lon, units }
          );
          
          const duration = Date.now() - startTime;
          this.recordLatency(duration);
          
          // Record metrics for fallback success
          WeatherMetrics.recordRequest(
            this.fallbackProvider.name, 
            'success', 
            duration, 
            fallbackResult.is_stale
          );
          WeatherMetrics.recordError(this.primaryProvider.name, 'fallback_used');
          
          logData.success = true;
          logData.provider_used = this.fallbackProvider.name;
          logData.fallback_used = true;
          logData.duration_ms = duration;
          logData.primary_error = primaryError.message;
          logData.is_stale = fallbackResult.is_stale;
          
          console.log('[Weather] Fallback succeeded:', logData);
          
          return fallbackResult;

        } catch (fallbackError) {
          console.error(`[Weather] Fallback provider failed: ${fallbackError.message}`);
          logData.primary_error = primaryError.message;
          logData.fallback_error = fallbackError.message;
        }
      }

      // Both providers failed
      this.metrics.errors_total++;
      const duration = Date.now() - startTime;
      this.recordLatency(duration);
      
      // Record error metrics
      WeatherMetrics.recordRequest(this.primaryProvider.name, 'error', duration);
      WeatherMetrics.recordError(this.primaryProvider.name, 'total_failure');
      
      logData.success = false;
      logData.duration_ms = duration;
      logData.error = primaryError.message;
      
      console.log('[Weather] All providers failed:', logData);
      
      throw primaryError;
    }
  }

  /**
   * Record latency metric
   */
  recordLatency(duration) {
    this.metrics.latency_ms.push(duration);
    
    // Keep only last 1000 measurements
    if (this.metrics.latency_ms.length > 1000) {
      this.metrics.latency_ms = this.metrics.latency_ms.slice(-1000);
    }
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    const latencies = this.metrics.latency_ms;
    const latencyStats = latencies.length > 0 ? {
      p50: this.percentile(latencies, 0.5),
      p95: this.percentile(latencies, 0.95),
      p99: this.percentile(latencies, 0.99),
      avg: latencies.reduce((a, b) => a + b, 0) / latencies.length
    } : { p50: 0, p95: 0, p99: 0, avg: 0 };

    return {
      requests_total: this.metrics.requests_total,
      errors_total: this.metrics.errors_total,
      fallback_used: this.metrics.fallback_used,
      error_rate: this.metrics.requests_total > 0 
        ? (this.metrics.errors_total / this.metrics.requests_total * 100).toFixed(1) 
        : '0.0',
      latency_ms: latencyStats,
      resilience: this.resilience?.getMetrics() || {}
    };
  }

  /**
   * Calculate percentile from array
   */
  percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return Math.round(sorted[index] || 0);
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.initialized) {
      return {
        healthy: false,
        error: 'Service not initialized'
      };
    }

    try {
      // Quick health check with default coordinates
      const result = await this.getCurrentWeather();
      const metrics = this.getMetrics();
      const resilience = this.resilience.healthCheck();
      
      return {
        healthy: true,
        provider: result.provider,
        is_stale: result.is_stale,
        response_time_ms: this.metrics.latency_ms.slice(-1)[0] || 0,
        metrics: {
          requests_total: metrics.requests_total,
          error_rate: metrics.error_rate,
          cache_hit_rate: resilience.cache_hit_rate,
          circuit_breaker_state: resilience.circuit_breaker_state
        }
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        metrics: this.getMetrics()
      };
    }
  }

  /**
   * Get provider capabilities
   */
  getProviderCapabilities() {
    return {
      primary: this.primaryProvider?.getCapabilities(),
      fallback: this.fallbackProvider?.getCapabilities()
    };
  }

  /**
   * Clear cache (for maintenance)
   */
  clearCache() {
    this.resilience?.clearCache();
  }

  /**
   * Reset circuit breaker (for maintenance)
   */
  resetCircuitBreaker() {
    this.resilience?.resetCircuitBreaker();
  }
}

// Create singleton instance
const weatherService = new WeatherService();

// Auto-initialize on first import in development
if (process.env.NODE_ENV === 'development') {
  // Initialize asynchronously, don't block import
  weatherService.initialize().catch(error => {
    console.warn('[Weather] Auto-initialization failed:', error.message);
  });
}

export default weatherService;
export { WeatherService, WEATHER_PROVIDERS, WEATHER_UNITS, WEATHER_ERROR_CODES };