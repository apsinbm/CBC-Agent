/**
 * Simple in-memory rate limiter
 * Limits requests per IP or session
 */

// Store request counts by identifier
const requestCounts = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.resetTime > 60000) { // Remove entries older than 1 minute
      requestCounts.delete(key);
    }
  }
}, 300000); // 5 minutes

/**
 * Check if request should be rate limited
 * @param {string} identifier - IP address or session ID
 * @param {Object} options - Rate limit options
 * @returns {Object} Rate limit status
 */
export function checkRateLimit(identifier, options = {}) {
  const {
    maxRequests = 10,  // Maximum requests
    windowMs = 60000,   // Time window (1 minute default)
  } = options;
  
  const now = Date.now();
  const data = requestCounts.get(identifier);
  
  if (!data || now - data.resetTime > windowMs) {
    // First request or window expired
    requestCounts.set(identifier, {
      count: 1,
      resetTime: now,
      firstRequest: now
    });
    
    return {
      limited: false,
      remaining: maxRequests - 1,
      resetIn: windowMs
    };
  }
  
  // Increment count
  data.count++;
  
  if (data.count > maxRequests) {
    const resetIn = windowMs - (now - data.resetTime);
    return {
      limited: true,
      remaining: 0,
      resetIn: Math.max(0, resetIn),
      retryAfter: Math.ceil(resetIn / 1000) // seconds
    };
  }
  
  return {
    limited: false,
    remaining: maxRequests - data.count,
    resetIn: windowMs - (now - data.resetTime)
  };
}

/**
 * Get identifier for rate limiting
 * Uses IP address with session as fallback
 */
export function getRateLimitId(request) {
  // Try to get IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || real || 'unknown';
  
  // Get session from cookie as fallback
  const cookie = request.headers.get('cookie');
  const sessionMatch = cookie?.match(/session=([^;]+)/);
  const session = sessionMatch?.[1] || '';
  
  // Combine IP and session for unique identifier
  return `${ip}-${session}`.substring(0, 64); // Limit length
}