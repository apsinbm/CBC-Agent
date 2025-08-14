/**
 * CORS & CSRF Protection
 * Implements origin validation, CSRF tokens, and CORS policies
 */

import crypto from 'crypto';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://coralbeach.bm',
  'https://www.coralbeach.bm',
  // Add production domain when deployed
];

// CSRF token store (in production, use Redis or similar)
const csrfTokens = new Map();

// Clean up old tokens every hour
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of csrfTokens.entries()) {
    if (now - data.created > 3600000) { // 1 hour
      csrfTokens.delete(token);
    }
  }
}, 3600000);

/**
 * Check if origin is allowed
 * @param {string} origin - Request origin
 * @returns {boolean} - Whether origin is allowed
 */
export function isOriginAllowed(origin) {
  if (!origin) return false;
  
  // In development, allow localhost origins
  if (process.env.NODE_ENV === 'development') {
    if (origin.startsWith('http://localhost:') || 
        origin.startsWith('http://127.0.0.1:')) {
      return true;
    }
  }
  
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Generate CSRF token
 * @param {string} sessionId - Session identifier
 * @returns {string} - CSRF token
 */
export function generateCSRFToken(sessionId) {
  const token = crypto.randomBytes(32).toString('hex');
  
  csrfTokens.set(token, {
    sessionId,
    created: Date.now(),
    used: false
  });
  
  return token;
}

/**
 * Validate CSRF token
 * @param {string} token - CSRF token
 * @param {string} sessionId - Session identifier
 * @returns {boolean} - Whether token is valid
 */
export function validateCSRFToken(token, sessionId) {
  if (!token || !sessionId) return false;
  
  const tokenData = csrfTokens.get(token);
  if (!tokenData) return false;
  
  // Check session match
  if (tokenData.sessionId !== sessionId) return false;
  
  // Check if already used (prevent replay)
  if (tokenData.used) return false;
  
  // Check age (1 hour max)
  if (Date.now() - tokenData.created > 3600000) {
    csrfTokens.delete(token);
    return false;
  }
  
  // Mark as used for single-use tokens
  tokenData.used = true;
  
  return true;
}

/**
 * Get CORS headers
 * @param {Request} req - Request object
 * @returns {object} - CORS headers
 */
export function getCORSHeaders(req) {
  const origin = req.headers.get('origin');
  const headers = {};
  
  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, X-CSRF-Token';
    headers['Access-Control-Max-Age'] = '86400'; // 24 hours
  }
  
  return headers;
}

/**
 * Security headers for all responses
 * @returns {object} - Security headers
 */
export function getSecurityHeaders() {
  return {
    // HSTS - Force HTTPS
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    
    // Prevent MIME sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // XSS Protection (legacy browsers)
    'X-XSS-Protection': '1; mode=block',
    
    // Referrer Policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Permissions Policy (restrict features)
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    
    // DNS Prefetch Control
    'X-DNS-Prefetch-Control': 'off',
    
    // Download Options (IE)
    'X-Download-Options': 'noopen',
    
    // Permitted Cross-Domain Policies
    'X-Permitted-Cross-Domain-Policies': 'none'
  };
}

/**
 * Content Security Policy
 * @param {object} options - CSP options
 * @returns {string} - CSP header value
 */
export function getCSP(options = {}) {
  const { nonce, reportUri } = options;
  
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net", // Allow Next.js
    "style-src 'self' 'unsafe-inline'", // Allow Tailwind
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.openweathermap.org https://api.weather.gov",
    "media-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ];
  
  if (nonce) {
    directives[1] = `script-src 'self' 'nonce-${nonce}'`; // Use nonce instead of unsafe-inline
  }
  
  if (reportUri) {
    directives.push(`report-uri ${reportUri}`);
  }
  
  return directives.join('; ');
}

/**
 * Validate request method
 * @param {Request} req - Request object
 * @param {string[]} allowed - Allowed methods
 * @returns {boolean} - Whether method is allowed
 */
export function validateMethod(req, allowed = ['GET', 'POST']) {
  return allowed.includes(req.method);
}

/**
 * CORS preflight handler
 * @param {Request} req - Request object
 * @returns {Response} - Preflight response
 */
export function handlePreflight(req) {
  const origin = req.headers.get('origin');
  
  if (!origin || !isOriginAllowed(origin)) {
    return new Response(null, { status: 403 });
  }
  
  return new Response(null, {
    status: 204,
    headers: getCORSHeaders(req)
  });
}

/**
 * Apply security headers to response
 * @param {Response} response - Original response
 * @param {Request} req - Request object
 * @returns {Response} - Response with security headers
 */
export function applySecurityHeaders(response, req) {
  const headers = new Headers(response.headers);
  
  // Add CORS headers if needed
  const corsHeaders = getCORSHeaders(req);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  
  // Add security headers
  const securityHeaders = getSecurityHeaders();
  for (const [key, value] of Object.entries(securityHeaders)) {
    headers.set(key, value);
  }
  
  // Add CSP
  headers.set('Content-Security-Policy', getCSP());
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Middleware to check CSRF token
 * @param {Request} req - Request object
 * @param {string} sessionId - Session ID
 * @returns {object} - { valid: boolean, error?: string }
 */
export function checkCSRF(req, sessionId) {
  // Skip CSRF for GET requests
  if (req.method === 'GET') {
    return { valid: true };
  }
  
  // Skip in development if configured
  if (process.env.NODE_ENV === 'development' && 
      process.env.SKIP_CSRF_DEV === 'true') {
    return { valid: true };
  }
  
  const token = req.headers.get('x-csrf-token');
  
  if (!token) {
    return {
      valid: false,
      error: 'CSRF token missing'
    };
  }
  
  if (!validateCSRFToken(token, sessionId)) {
    return {
      valid: false,
      error: 'Invalid CSRF token'
    };
  }
  
  return { valid: true };
}