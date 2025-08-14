/**
 * Unsafe Surfaces Protection
 * Disables debug endpoints, test routes, and development-only features in production
 */

// List of unsafe endpoints that should be disabled in production
const UNSAFE_ENDPOINTS = [
  '/api/debug',
  '/api/test',
  '/api/admin',
  '/api/internal',
  '/api/health/detailed',  // Only basic health check allowed
  '/api/metrics/raw',
  '/api/logs',
  '/api/config',
  '/api/env',
  '/api/reset',
  '/api/clear-cache',
  '/_next/webpack-hmr',  // Hot reload endpoint
];

// Development-only features
const DEV_ONLY_FEATURES = [
  'debug_mode',
  'verbose_logging',
  'show_errors',
  'expose_stack_traces',
  'allow_test_users',
  'skip_validation',
  'bypass_rate_limit',
  'mock_responses'
];

/**
 * Check if an endpoint is safe to access
 * @param {string} path - Request path
 * @param {string} env - Environment (development/production)
 * @returns {object} - { allowed: boolean, reason?: string }
 */
export function checkEndpointSafety(path, env = process.env.NODE_ENV) {
  // Normalize path
  const normalizedPath = path.toLowerCase();
  
  // In development, allow everything
  if (env === 'development') {
    return { allowed: true };
  }
  
  // Check against unsafe endpoints
  for (const unsafe of UNSAFE_ENDPOINTS) {
    if (normalizedPath.startsWith(unsafe)) {
      return {
        allowed: false,
        reason: `Endpoint '${path}' is disabled in production`
      };
    }
  }
  
  // Check for common debug patterns
  const debugPatterns = [
    /\/api\/.*\/(debug|test|admin)/i,
    /\/\.well-known\/.*test/i,
    /\/__debug__/i,
    /\/phpinfo/i,
    /\/server-status/i
  ];
  
  for (const pattern of debugPatterns) {
    if (pattern.test(normalizedPath)) {
      return {
        allowed: false,
        reason: 'Debug endpoints are disabled in production'
      };
    }
  }
  
  return { allowed: true };
}

/**
 * Check if a feature is enabled
 * @param {string} feature - Feature name
 * @returns {boolean} - Whether feature is enabled
 */
export function isFeatureEnabled(feature) {
  // In production, disable all dev-only features
  if (process.env.NODE_ENV === 'production') {
    if (DEV_ONLY_FEATURES.includes(feature)) {
      return false;
    }
  }
  
  // Check environment variable
  const envKey = `ENABLE_${feature.toUpperCase()}`;
  return process.env[envKey] === 'true';
}

/**
 * Sanitize error for production
 * @param {Error} error - Original error
 * @param {object} options - Options
 * @returns {object} - Safe error object
 */
export function sanitizeError(error, options = {}) {
  const { includeType = true, includeMessage = true } = options;
  
  // In development, return full error
  if (process.env.NODE_ENV === 'development') {
    return {
      error: error.message,
      stack: error.stack,
      type: error.constructor.name,
      ...(error.code && { code: error.code })
    };
  }
  
  // In production, return safe error
  const safeError = {};
  
  if (includeType) {
    // Map error types to safe categories
    const errorType = error.constructor.name;
    const safeTypes = {
      'ValidationError': 'validation',
      'AuthenticationError': 'auth',
      'RateLimitError': 'rate_limit',
      'TimeoutError': 'timeout'
    };
    safeError.type = safeTypes[errorType] || 'error';
  }
  
  if (includeMessage) {
    // Sanitize message
    const message = error.message || 'An error occurred';
    
    // Remove sensitive patterns
    const sensitivePatterns = [
      /at\s+.*\.(js|ts|jsx|tsx):\d+:\d+/g,  // File paths
      /\/[\w\/\.\-]+/g,  // Unix paths
      /[A-Z]:\\[\w\\]+/g,  // Windows paths
      /[\w\-]+@[\w\-]+\.[\w]{2,}/g,  // Email addresses
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,  // IP addresses
      /sk-[A-Za-z0-9]+/g,  // API keys
    ];
    
    let safeMessage = message;
    for (const pattern of sensitivePatterns) {
      safeMessage = safeMessage.replace(pattern, '[redacted]');
    }
    
    safeError.message = safeMessage;
  }
  
  return safeError;
}

/**
 * Disable console methods in production
 */
export function disableConsoleInProduction() {
  if (process.env.NODE_ENV === 'production') {
    const noop = () => {};
    
    // Keep error and warn, disable others
    console.log = noop;
    console.debug = noop;
    console.info = noop;
    console.trace = noop;
    console.dir = noop;
    console.dirxml = noop;
    console.table = noop;
    console.group = noop;
    console.groupEnd = noop;
    console.time = noop;
    console.timeEnd = noop;
    console.profile = noop;
    console.profileEnd = noop;
  }
}

/**
 * Check if source maps should be enabled
 * @returns {boolean} - Whether source maps are allowed
 */
export function shouldEnableSourceMaps() {
  // Never in production unless explicitly enabled
  if (process.env.NODE_ENV === 'production') {
    return process.env.ENABLE_SOURCE_MAPS === 'true';
  }
  return true;
}

/**
 * Get safe headers for responses
 * @returns {object} - Safe headers
 */
export function getSafeResponseHeaders() {
  const headers = {};
  
  // Remove server identification
  headers['X-Powered-By'] = '';
  headers['Server'] = '';
  
  // Disable client-side caching of errors
  headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
  
  return headers;
}

/**
 * Validate API response before sending
 * @param {object} response - Response object
 * @returns {object} - Validated response
 */
export function validateApiResponse(response) {
  if (process.env.NODE_ENV === 'production') {
    // Remove any debug fields
    const debugFields = [
      'debug',
      'stack',
      'query',
      'raw',
      'internal',
      '_raw',
      '_debug',
      'sql',
      'command'
    ];
    
    const cleaned = { ...response };
    for (const field of debugFields) {
      delete cleaned[field];
    }
    
    return cleaned;
  }
  
  return response;
}

/**
 * Create middleware to block unsafe surfaces
 * @returns {function} - Middleware function
 */
export function createSafetyMiddleware() {
  return (req, res, next) => {
    const check = checkEndpointSafety(req.path);
    
    if (!check.allowed) {
      return res.status(403).json({
        error: 'Forbidden',
        message: check.reason
      });
    }
    
    // Add safety headers
    const safeHeaders = getSafeResponseHeaders();
    for (const [key, value] of Object.entries(safeHeaders)) {
      res.setHeader(key, value);
    }
    
    next();
  };
}

/**
 * Initialize production safety measures
 */
export function initializeProductionSafety() {
  if (process.env.NODE_ENV === 'production') {
    // Disable console methods
    disableConsoleInProduction();
    
    // Set up global error handler
    process.on('uncaughtException', (error) => {
      console.error('[SAFETY] Uncaught exception:', sanitizeError(error));
      // In production, attempt graceful shutdown
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[SAFETY] Unhandled rejection:', sanitizeError(reason));
    });
    
    console.warn('[SAFETY] Production safety measures initialized');
  }
}