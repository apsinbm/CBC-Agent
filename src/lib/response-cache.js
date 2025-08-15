/**
 * Simple response caching for CBC-Agent
 * Caches common responses for 1 hour to improve response times
 */

import { safeLog } from './pii-protection.js';

// In-memory cache with TTL
const responseCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Cache keys for common queries
const CACHEABLE_PATTERNS = [
  { key: 'hours_frontdesk', patterns: [/front\s*desk\s*hours?/, /reception\s*hours?/] },
  { key: 'hours_tennis', patterns: [/tennis\s*shop\s*hours?/, /tennis.*hours?/] },
  { key: 'hours_dining', patterns: [/dining\s*hours?/, /restaurant\s*hours?/] },
  { key: 'contact_tennis', patterns: [/tennis\s*shop\s*contact/, /tennis.*phone/, /tennis.*email/] },
  { key: 'dress_code', patterns: [/dress\s*code/, /what.*wear/, /attire/] },
  { key: 'beach_amenities', patterns: [/beach\s*service/, /beach.*amenities/, /beach.*hours?/] },
  { key: 'location', patterns: [/address/, /location/, /where.*club/] },
  { key: 'accommodations_overview', patterns: [/how\s*many\s*rooms/, /types?\s*of\s*rooms/, /cottages\s*suites/] }
];

/**
 * Generate cache key from user message
 */
function getCacheKey(message) {
  if (!message || typeof message !== 'string') return null;
  
  const content = message.toLowerCase();
  
  for (const { key, patterns } of CACHEABLE_PATTERNS) {
    if (patterns.some(pattern => pattern.test(content))) {
      return key;
    }
  }
  
  return null;
}

/**
 * Get cached response if available and not expired
 */
export function getCachedResponse(message) {
  try {
    const cacheKey = getCacheKey(message);
    if (!cacheKey) return null;
    
    const cached = responseCache.get(cacheKey);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > CACHE_TTL) {
      responseCache.delete(cacheKey);
      return null;
    }
    
    safeLog('Cache', `Cache hit for key: ${cacheKey}`);
    return cached.response;
    
  } catch (error) {
    safeLog('Cache', 'Error getting cached response:', error.message);
    return null;
  }
}

/**
 * Store response in cache
 */
export function setCachedResponse(message, response) {
  try {
    const cacheKey = getCacheKey(message);
    if (!cacheKey) return false;
    
    // Don't cache responses that contain personal information
    if (typeof response === 'string' && (
      response.includes('@') || // emails
      /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(response) || // phone numbers
      response.toLowerCase().includes('your name') ||
      response.toLowerCase().includes('your email')
    )) {
      return false;
    }
    
    responseCache.set(cacheKey, {
      response: response,
      timestamp: Date.now()
    });
    
    safeLog('Cache', `Cached response for key: ${cacheKey}`);
    return true;
    
  } catch (error) {
    safeLog('Cache', 'Error setting cached response:', error.message);
    return false;
  }
}

/**
 * Clear expired cache entries
 */
export function cleanupCache() {
  try {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, cached] of responseCache.entries()) {
      if (now - cached.timestamp > CACHE_TTL) {
        responseCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      safeLog('Cache', `Cleaned up ${cleaned} expired cache entries`);
    }
    
  } catch (error) {
    safeLog('Cache', 'Error cleaning up cache:', error.message);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: responseCache.size,
    keys: Array.from(responseCache.keys())
  };
}

// Clean up cache every 15 minutes
setInterval(cleanupCache, 15 * 60 * 1000);