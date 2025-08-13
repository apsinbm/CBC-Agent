/**
 * Weather Service Resilience
 * Circuit breaker, caching, retries with exponential backoff
 */

import { WEATHER_ERROR_CODES } from './config.js';
import { createErrorResponse } from './mapper.js';
import WeatherMetrics from './metrics.js';

/**
 * Simple in-memory cache with TTL
 * In production, consider using Redis for persistence across restarts
 */
class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  set(key, value, ttlSeconds) {
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Set value
    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      ttl: ttlSeconds * 1000
    });

    // Set expiration timer
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttlSeconds * 1000);
    
    this.timers.set(key, timer);
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    const now = Date.now();
    const age = now - item.createdAt;

    return {
      value: item.value,
      age: Math.floor(age / 1000),
      isStale: age > item.ttl
    };
  }

  delete(key) {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.cache.clear();
    this.timers.clear();
  }

  size() {
    return this.cache.size;
  }
}

/**
 * Circuit breaker implementation
 */
class CircuitBreaker {
  constructor(config = {}) {
    this.failureThreshold = config.failureThreshold || 5;
    this.timeWindow = config.timeWindow || 120000; // 2 minutes
    this.openDuration = config.openDuration || 60000; // 1 minute
    
    this.failures = [];
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.openUntil = 0;
  }

  canExecute() {
    const now = Date.now();

    // Clean old failures outside time window
    this.failures = this.failures.filter(time => (now - time) < this.timeWindow);

    if (this.state === 'OPEN') {
      if (now >= this.openUntil) {
        this.state = 'HALF_OPEN';
        console.log('[Weather] Circuit breaker: OPEN -> HALF_OPEN');
        return true;
      }
      return false;
    }

    return true;
  }

  onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failures = [];
      console.log('[Weather] Circuit breaker: HALF_OPEN -> CLOSED');
    }
  }

  onFailure() {
    const now = Date.now();
    this.failures.push(now);

    // Clean old failures
    this.failures = this.failures.filter(time => (now - time) < this.timeWindow);

    if (this.failures.length >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openUntil = now + this.openDuration;
      console.log(`[Weather] Circuit breaker: -> OPEN (${this.failures.length} failures)`);
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures.length,
      openUntil: this.openUntil > 0 ? new Date(this.openUntil).toISOString() : null
    };
  }
}

/**
 * Retry with exponential backoff and jitter
 */
async function retryWithBackoff(fn, retries = 2, baseDelay = 1000, maxDelay = 5000) {
  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    try {
      return await fn(attempt + 1); // Pass attempt number (1-indexed)
    } catch (error) {
      lastError = error;
      attempt++;

      if (attempt > retries) break;

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      const jitter = Math.random() * 0.1 * delay; // 10% jitter
      const actualDelay = delay + jitter;

      console.log(`[Weather] Retry ${attempt}/${retries} after ${Math.round(actualDelay)}ms: ${error.message}`);
      
      await new Promise(resolve => setTimeout(resolve, actualDelay));
    }
  }

  throw lastError;
}

/**
 * Resilience wrapper for weather providers
 */
export class WeatherResilience {
  constructor(config = {}) {
    this.config = config;
    this.cache = new MemoryCache();
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    this.metrics = {
      requests_total: 0,
      cache_hits_fresh: 0,
      cache_hits_stale: 0,
      cache_misses: 0,
      circuit_opens: 0
    };
  }

  /**
   * Generate cache key for weather request
   */
  getCacheKey({ lat, lon, units, provider }) {
    // Round coordinates to 2 decimal places for cache efficiency
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLon = Math.round(lon * 100) / 100;
    return `weather:${provider}:${roundedLat}:${roundedLon}:${units}`;
  }

  /**
   * Fetch weather with resilience features
   */
  async fetchWeatherWithResilience(provider, params) {
    this.metrics.requests_total++;
    
    const cacheKey = this.getCacheKey({ ...params, provider: provider.name });
    const cached = this.cache.get(cacheKey);

    // Check circuit breaker
    if (!this.circuitBreaker.canExecute()) {
      console.log('[Weather] Circuit breaker OPEN - serving cached data if available');
      
      if (cached) {
        this.metrics.cache_hits_stale++;
        WeatherMetrics.recordCacheHit('stale');
        const response = { ...cached.value };
        response.is_stale = true;
        return response;
      }
      
      // No cached data available
      throw new Error(`${WEATHER_ERROR_CODES.UPSTREAM_ERROR}: Circuit breaker open - no cached data available`);
    }

    // Return fresh cached data if available
    if (cached && !cached.isStale) {
      this.metrics.cache_hits_fresh++;
      WeatherMetrics.recordCacheHit('fresh');
      console.log(`[Weather] Cache hit (fresh) - ${cached.age}s old`);
      return cached.value;
    }

    try {
      // Attempt to fetch new data with retries
      const result = await retryWithBackoff(
        async (attempt) => {
          const updatedParams = { ...params, attempt };
          return await provider.fetchWeather(updatedParams);
        },
        this.config.retries?.count || 2,
        this.config.retries?.baseDelay || 1000,
        this.config.retries?.maxDelay || 5000
      );

      // Success - record in circuit breaker and cache
      this.circuitBreaker.onSuccess();
      
      const weatherData = result.data;
      this.cache.set(cacheKey, weatherData, this.config.cache?.ttl || 10800); // 3 hours
      
      this.metrics.cache_misses++;
      console.log(`[Weather] Fresh data cached for ${this.config.cache?.ttl || 10800}s`);
      
      return weatherData;

    } catch (error) {
      // Record failure in circuit breaker
      this.circuitBreaker.onFailure();
      
      if (this.circuitBreaker.getState().state === 'OPEN') {
        this.metrics.circuit_opens++;
      }

      // Try to serve stale cached data
      if (cached && cached.age <= (this.config.cache?.staleWhileRevalidate || 21600)) { // 6 hours
        console.log(`[Weather] Serving stale cache (${cached.age}s old) due to upstream error`);
        this.metrics.cache_hits_stale++;
        WeatherMetrics.recordCacheHit('stale');
        
        const response = { ...cached.value };
        response.is_stale = true;
        return response;
      }

      // No usable cached data - return error
      console.error('[Weather] No cached data available, upstream failed:', error.message);
      throw error;
    }
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size(),
      hits_fresh: this.metrics.cache_hits_fresh,
      hits_stale: this.metrics.cache_hits_stale,
      misses: this.metrics.cache_misses,
      hit_rate: this.metrics.requests_total > 0 
        ? ((this.metrics.cache_hits_fresh + this.metrics.cache_hits_stale) / this.metrics.requests_total * 100).toFixed(1) 
        : '0.0'
    };
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return this.circuitBreaker.getState();
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cache: this.getCacheStats(),
      circuit_breaker: this.getCircuitBreakerStatus()
    };
  }

  /**
   * Clear cache (for testing/maintenance)
   */
  clearCache() {
    this.cache.clear();
    console.log('[Weather] Cache cleared');
  }

  /**
   * Reset circuit breaker (for testing/maintenance)
   */
  resetCircuitBreaker() {
    this.circuitBreaker.failures = [];
    this.circuitBreaker.state = 'CLOSED';
    this.circuitBreaker.openUntil = 0;
    console.log('[Weather] Circuit breaker reset');
  }

  /**
   * Health check for resilience components
   */
  healthCheck() {
    const cache = this.getCacheStats();
    const breaker = this.getCircuitBreakerStatus();
    
    return {
      healthy: breaker.state !== 'OPEN',
      cache_size: cache.size,
      cache_hit_rate: cache.hit_rate,
      circuit_breaker_state: breaker.state,
      total_requests: this.metrics.requests_total
    };
  }
}