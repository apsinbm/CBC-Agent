/**
 * Security middleware for CORS, CSRF, and rate limiting
 */

import { NextResponse } from 'next/server';

/**
 * Allowed origins for CORS
 */
const ALLOWED_ORIGINS = [
  'https://www.coralbeachclub.com',
  'https://coralbeachclub.com',
  process.env.NEXT_PUBLIC_URL,
  // Development
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
].filter(Boolean);

/**
 * CORS configuration
 */
export function corsHeaders(origin) {
  const headers = new Headers();
  
  // Check if origin is allowed
  if (ALLOWED_ORIGINS.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  } else if (process.env.NODE_ENV === 'development') {
    // More permissive in development
    headers.set('Access-Control-Allow-Origin', '*');
  }
  
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
  headers.set('Access-Control-Max-Age', '86400');
  
  return headers;
}

/**
 * Generate CSRF token
 */
export function generateCSRFToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify CSRF token
 */
export function verifyCSRFToken(token, sessionToken) {
  if (!token || !sessionToken) return false;
  
  // In production, use timing-safe comparison
  return token === sessionToken;
}

/**
 * Security headers for all responses
 */
export function securityHeaders() {
  return {
    'X-DNS-Prefetch-Control': 'on',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-XSS-Protection': '1; mode=block',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://api.anthropic.com https://api.openai.com https://worldtimeapi.org https://api.open-meteo.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  };
}

/**
 * Rate limiting configuration
 */
const rateLimitStore = new Map();

export function checkRateLimit(identifier, limits = {}) {
  const { 
    windowMs = 60000, // 1 minute
    maxRequests = 10 
  } = limits;
  
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Get or create request log
  if (!rateLimitStore.has(identifier)) {
    rateLimitStore.set(identifier, []);
  }
  
  const requests = rateLimitStore.get(identifier);
  
  // Filter out old requests
  const recentRequests = requests.filter(time => time > windowStart);
  
  // Check if limit exceeded
  if (recentRequests.length >= maxRequests) {
    return {
      allowed: false,
      retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000),
      remaining: 0
    };
  }
  
  // Add current request
  recentRequests.push(now);
  rateLimitStore.set(identifier, recentRequests);
  
  return {
    allowed: true,
    remaining: maxRequests - recentRequests.length,
    retryAfter: 0
  };
}

/**
 * Clean up old rate limit data
 */
setInterval(() => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  
  for (const [key, requests] of rateLimitStore.entries()) {
    const recentRequests = requests.filter(time => time > now - maxAge);
    
    if (recentRequests.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, recentRequests);
    }
  }
}, 60000); // Clean up every minute

/**
 * Validate request origin
 */
export function validateOrigin(request) {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  // Allow requests without origin in development
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  // Check origin
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return false;
  }
  
  // Check referer as fallback
  if (referer) {
    const refererUrl = new URL(referer);
    if (!ALLOWED_ORIGINS.some(allowed => refererUrl.origin === allowed)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Main security middleware
 */
export async function securityMiddleware(request) {
  const response = NextResponse.next();
  
  // Add security headers
  Object.entries(securityHeaders()).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  // Handle CORS
  const origin = request.headers.get('origin');
  if (origin) {
    const corsHeadersMap = corsHeaders(origin);
    corsHeadersMap.forEach((value, key) => {
      response.headers.set(key, value);
    });
  }
  
  // Validate origin for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    if (!validateOrigin(request)) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }
  
  return response;
}