/**
 * Request Guards - Size limits, timeouts, and payload validation
 */

/**
 * Body size limits by endpoint type
 */
export const BODY_SIZE_LIMITS = {
  chat: 100 * 1024,      // 100KB for chat
  form: 300 * 1024,      // 300KB for forms
  default: 50 * 1024     // 50KB default
};

/**
 * Timeout limits
 */
export const TIMEOUT_LIMITS = {
  external: 15000,       // 15s for external fetches
  total: 25000,          // 25s total for API route
  weather: 5000,         // 5s for weather specifically
  llm: 20000            // 20s for LLM calls
};

/**
 * Check if payload size is within limits
 * @param {object} body - Request body
 * @param {string} type - Endpoint type (chat, form, default)
 * @returns {object} - { valid: boolean, error?: string }
 */
export function checkPayloadSize(body, type = 'default') {
  const limit = BODY_SIZE_LIMITS[type] || BODY_SIZE_LIMITS.default;
  const size = JSON.stringify(body).length;
  
  if (size > limit) {
    return {
      valid: false,
      error: `Request too large. Please keep under ${Math.floor(limit / 1024)}KB.`
    };
  }
  
  return { valid: true };
}

/**
 * Check for excessively deep or array-bomb payloads
 * @param {any} obj - Object to check
 * @param {number} depth - Current depth
 * @param {number} maxDepth - Maximum allowed depth
 * @param {number} maxArrayLength - Maximum array length
 * @returns {object} - { valid: boolean, error?: string }
 */
export function checkPayloadDepth(obj, depth = 0, maxDepth = 10, maxArrayLength = 100) {
  if (depth > maxDepth) {
    return {
      valid: false,
      error: 'Request structure too complex. Please simplify your input.'
    };
  }
  
  if (Array.isArray(obj)) {
    if (obj.length > maxArrayLength) {
      return {
        valid: false,
        error: 'Too many items in request. Please reduce the amount of data.'
      };
    }
    
    for (const item of obj) {
      if (typeof item === 'object' && item !== null) {
        const result = checkPayloadDepth(item, depth + 1, maxDepth, maxArrayLength);
        if (!result.valid) return result;
      }
    }
  } else if (typeof obj === 'object' && obj !== null) {
    const keys = Object.keys(obj);
    if (keys.length > maxArrayLength) {
      return {
        valid: false,
        error: 'Request contains too many fields. Please simplify.'
      };
    }
    
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        const result = checkPayloadDepth(value, depth + 1, maxDepth, maxArrayLength);
        if (!result.valid) return result;
      }
    }
  }
  
  return { valid: true };
}

/**
 * Create a timeout wrapper for async operations
 * @param {Promise} promise - Promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} operation - Operation name for error message
 * @returns {Promise} - Promise that rejects on timeout
 */
export function withTimeout(promise, ms, operation = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => 
        reject(new Error(`${operation} timed out after ${ms}ms. Please try again.`)), 
        ms
      )
    )
  ]);
}

/**
 * Create an AbortController with timeout
 * @param {number} ms - Timeout in milliseconds
 * @returns {AbortController} - Controller that aborts after timeout
 */
export function createTimeoutController(ms) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller;
}

/**
 * Validate entire request
 * @param {object} req - Request object
 * @param {string} type - Endpoint type
 * @returns {object} - { valid: boolean, error?: string }
 */
export async function validateRequest(req, type = 'default') {
  try {
    // Parse body if needed
    const body = typeof req.body === 'string' ? 
      JSON.parse(req.body) : req.body || {};
    
    // Check payload size
    const sizeCheck = checkPayloadSize(body, type);
    if (!sizeCheck.valid) return sizeCheck;
    
    // Check payload depth
    const depthCheck = checkPayloadDepth(body);
    if (!depthCheck.valid) return depthCheck;
    
    // Check for suspicious patterns
    const bodyStr = JSON.stringify(body);
    
    // Check for potential script injection
    if (/<script|javascript:|on\w+=/i.test(bodyStr)) {
      return {
        valid: false,
        error: 'Invalid content detected. Please remove any scripts.'
      };
    }
    
    // Check for excessive repetition (potential DOS)
    const repeatedPattern = /(.)\1{100,}/;
    if (repeatedPattern.test(bodyStr)) {
      return {
        valid: false,
        error: 'Invalid input pattern detected. Please check your input.'
      };
    }
    
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid request format. Please check your input.'
    };
  }
}

/**
 * Middleware to apply request guards
 * @param {function} handler - Route handler
 * @param {object} options - Options for guards
 * @returns {function} - Wrapped handler
 */
export function withRequestGuards(handler, options = {}) {
  const { type = 'default', timeout = TIMEOUT_LIMITS.total } = options;
  
  return async function guardedHandler(req, res) {
    // Validate request
    const validation = await validateRequest(req, type);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ 
          error: validation.error,
          success: false 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Apply timeout
    try {
      return await withTimeout(
        handler(req, res),
        timeout,
        'Request processing'
      );
    } catch (error) {
      if (error.message.includes('timed out')) {
        return new Response(
          JSON.stringify({ 
            error: 'Request took too long. Please try again.',
            success: false 
          }),
          { 
            status: 504,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      throw error;
    }
  };
}