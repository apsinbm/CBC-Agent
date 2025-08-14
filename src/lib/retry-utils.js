/**
 * Retry utilities with exponential backoff
 */

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after delay
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} - Result of successful call or final error
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    onRetry = null,
    shouldRetry = (error) => true
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelay * Math.pow(factor, attempt) + Math.random() * 1000,
        maxDelay
      );
      
      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, delay, error);
      }
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Retry with circuit breaker pattern
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 120000; // 2 minutes
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.nextAttempt = Date.now();
    this.successCount = 0;
    this.requestCount = 0;
    this.lastFailure = null;
  }
  
  async execute(fn) {
    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker is OPEN. Retry after ${new Date(this.nextAttempt).toISOString()}`);
      }
      // Move to half-open state
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }
  
  onSuccess() {
    this.failures = 0;
    this.successCount++;
    this.requestCount++;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
  }
  
  onFailure(error) {
    this.failures++;
    this.requestCount++;
    this.lastFailure = error;
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
  }
  
  getStatus() {
    return {
      state: this.state,
      failures: this.failures,
      successCount: this.successCount,
      requestCount: this.requestCount,
      successRate: this.requestCount > 0 ? this.successCount / this.requestCount : 0,
      nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt).toISOString() : null,
      lastFailure: this.lastFailure ? this.lastFailure.message : null
    };
  }
  
  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.lastFailure = null;
  }
}

/**
 * Timeout wrapper for promises
 * @param {Promise} promise - Promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @returns {Promise} - Promise that rejects on timeout
 */
export function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    )
  ]);
}

/**
 * Retry with rate limiting
 */
export class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }
  
  async acquire() {
    const now = Date.now();
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => time > now - this.windowMs);
    
    // Check if we can make a request
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = oldestRequest + this.windowMs - now;
      
      if (waitTime > 0) {
        await sleep(waitTime);
        return this.acquire(); // Recursive call after waiting
      }
    }
    
    // Add current request
    this.requests.push(now);
    return true;
  }
  
  getStatus() {
    const now = Date.now();
    const activeRequests = this.requests.filter(time => time > now - this.windowMs);
    
    return {
      current: activeRequests.length,
      max: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - activeRequests.length),
      resetIn: activeRequests.length > 0 ? 
        Math.max(0, activeRequests[0] + this.windowMs - now) : 0
    };
  }
}