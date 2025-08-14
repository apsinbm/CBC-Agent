/**
 * Tiered Rate Limiting System
 * Different limits for different endpoint types
 */

// Store for tracking requests by identifier
const requestStore = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestStore.entries()) {
    // Remove entries older than 1 hour
    if (now - data.oldestRequest > 3600000) {
      requestStore.delete(key);
    }
  }
}, 300000);

/**
 * Rate limit configurations by tier
 */
export const RATE_LIMIT_TIERS = {
  chat: {
    maxRequests: 10,
    windowMs: 60000, // 1 minute
    message: "Please wait a moment before sending another message."
  },
  form: {
    maxRequests: 5,
    windowMs: 600000, // 10 minutes
    message: "You've submitted several forms recently. Please wait a few minutes before trying again."
  },
  global: {
    maxRequests: 30,
    windowMs: 60000, // 1 minute burst protection
    message: "You're making requests too quickly. Please slow down."
  },
  api: {
    maxRequests: 50,
    windowMs: 60000, // 1 minute for general API
    message: "Too many requests. Please try again shortly."
  }
};

/**
 * Get identifier from request (IP + email if available)
 * @param {Request} req - Request object
 * @param {string} email - Optional email for form submissions
 * @returns {string} - Unique identifier
 */
function getIdentifier(req, email = null) {
  const forwarded = req.headers.get('x-forwarded-for');
  const real = req.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || real || 'unknown';
  
  // For forms, combine IP and email for stricter limits
  if (email) {
    const emailHash = Buffer.from(email).toString('base64').substring(0, 10);
    return `${ip}-${emailHash}`;
  }
  
  return ip;
}

/**
 * Check rate limit for a specific tier
 * @param {Request} req - Request object
 * @param {string} tier - Rate limit tier
 * @param {string} email - Optional email for form tracking
 * @returns {object} - { allowed: boolean, retryAfter?: number, message?: string }
 */
export function checkRateLimitTier(req, tier = 'api', email = null) {
  const config = RATE_LIMIT_TIERS[tier] || RATE_LIMIT_TIERS.api;
  const identifier = getIdentifier(req, email);
  const now = Date.now();
  
  // Get or create request history
  const key = `${tier}:${identifier}`;
  let history = requestStore.get(key);
  
  if (!history) {
    history = {
      requests: [],
      oldestRequest: now
    };
    requestStore.set(key, history);
  }
  
  // Remove old requests outside window
  history.requests = history.requests.filter(
    time => now - time < config.windowMs
  );
  
  // Check if limit exceeded
  if (history.requests.length >= config.maxRequests) {
    const oldestInWindow = history.requests[0];
    const retryAfter = Math.ceil((oldestInWindow + config.windowMs - now) / 1000);
    
    return {
      allowed: false,
      retryAfter,
      message: config.message
    };
  }
  
  // Add current request
  history.requests.push(now);
  
  // Also check global burst limit
  if (tier !== 'global') {
    const globalCheck = checkRateLimitTier(req, 'global');
    if (!globalCheck.allowed) {
      return globalCheck;
    }
  }
  
  return {
    allowed: true,
    remaining: config.maxRequests - history.requests.length,
    resetIn: config.windowMs
  };
}

/**
 * Express/Next.js middleware for rate limiting
 * @param {string} tier - Rate limit tier
 * @returns {function} - Middleware function
 */
export function rateLimitMiddleware(tier = 'api') {
  return async (req) => {
    // Extract email if it's a form submission
    let email = null;
    if (tier === 'form' && req.body) {
      try {
        const body = typeof req.body === 'string' ? 
          JSON.parse(req.body) : req.body;
        email = body.email || body.formData?.email;
      } catch {}
    }
    
    const check = checkRateLimitTier(req, tier, email);
    
    if (!check.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          message: check.message,
          retryAfter: check.retryAfter
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(check.retryAfter),
            'X-RateLimit-Limit': String(RATE_LIMIT_TIERS[tier].maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Date.now() + check.retryAfter * 1000)
          }
        }
      );
    }
    
    // Add rate limit headers to successful responses
    return {
      headers: {
        'X-RateLimit-Limit': String(RATE_LIMIT_TIERS[tier].maxRequests),
        'X-RateLimit-Remaining': String(check.remaining),
        'X-RateLimit-Reset': String(Date.now() + check.resetIn)
      }
    };
  };
}

/**
 * Get current rate limit status for monitoring
 * @returns {object} - Status of all rate limit stores
 */
export function getRateLimitStatus() {
  const status = {};
  const now = Date.now();
  
  for (const [key, history] of requestStore.entries()) {
    const [tier, identifier] = key.split(':');
    const config = RATE_LIMIT_TIERS[tier];
    
    if (!status[tier]) {
      status[tier] = {
        total: 0,
        active: 0,
        blocked: 0
      };
    }
    
    const recentRequests = history.requests.filter(
      time => now - time < config.windowMs
    );
    
    status[tier].total++;
    if (recentRequests.length > 0) {
      status[tier].active++;
    }
    if (recentRequests.length >= config.maxRequests) {
      status[tier].blocked++;
    }
  }
  
  return status;
}