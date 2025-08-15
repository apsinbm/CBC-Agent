/**
 * Outbound Allowlist - Controls which external domains can be fetched
 * Prevents SSRF attacks and limits data exfiltration
 */

// Allowed external domains for server-side fetch
const ALLOWED_DOMAINS = [
  // Weather services
  'api.openweathermap.org',
  'api.weather.gov',
  'api.weatherapi.com',
  'api.open-meteo.com',           // Open-Meteo weather API
  'marine-api.open-meteo.com',    // Open-Meteo marine API for SST
  
  // Bermuda news (if needed for features)
  'www.royalgazette.com',
  'bernews.com',
  
  // Wikipedia (if knowledge expansion enabled)
  'en.wikipedia.org',
  'api.wikimedia.org',
  
  // Internal services
  'localhost',
  '127.0.0.1',
  
  // Club website (for potential integrations)
  'www.coralbeach.bm',
  'coralbeach.bm'
];

// Blocked patterns (even if domain is allowed)
const BLOCKED_PATTERNS = [
  /\/\.git/i,
  /\/\.env/i,
  /\/\.aws/i,
  /\/wp-admin/i,
  /\/admin/i,
  /\/api\/internal/i,
  /localhost:\d+\/api\/debug/i
];

/**
 * Check if a URL is allowed for outbound fetch
 * @param {string} url - URL to check
 * @returns {object} - { allowed: boolean, reason?: string }
 */
export function checkOutboundUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname;
    
    // Check protocol - only allow http/https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        allowed: false,
        reason: 'Invalid protocol. Only HTTP/HTTPS allowed.'
      };
    }
    
    // Check for blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(pathname)) {
        return {
          allowed: false,
          reason: 'Access to this path is not permitted.'
        };
      }
    }
    
    // Check for private IP ranges (prevent SSRF)
    if (isPrivateIP(hostname)) {
      // Allow localhost for development
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        if (process.env.NODE_ENV === 'development') {
          return { allowed: true };
        }
      }
      return {
        allowed: false,
        reason: 'Access to private network addresses is not allowed.'
      };
    }
    
    // Check against allowlist
    const isAllowed = ALLOWED_DOMAINS.some(domain => {
      // Exact match or subdomain match
      return hostname === domain || 
             hostname.endsWith('.' + domain);
    });
    
    if (!isAllowed) {
      return {
        allowed: false,
        reason: `Domain '${hostname}' is not on the allowed list.`
      };
    }
    
    return { allowed: true };
    
  } catch (error) {
    return {
      allowed: false,
      reason: 'Invalid URL format.'
    };
  }
}

/**
 * Check if an IP address is in private range
 * @param {string} hostname - Hostname or IP
 * @returns {boolean} - True if private
 */
function isPrivateIP(hostname) {
  // IPv4 private ranges
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./,  // Link-local
    /^127\./,        // Loopback
    /^0\./           // Reserved
  ];
  
  // Check if it's an IP address
  const ipv4Pattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  if (ipv4Pattern.test(hostname)) {
    return privateRanges.some(range => range.test(hostname));
  }
  
  // Check for IPv6 private addresses
  if (hostname.includes(':')) {
    const lowerHost = hostname.toLowerCase();
    return lowerHost.startsWith('fc') || 
           lowerHost.startsWith('fd') ||
           lowerHost.startsWith('fe80') ||
           lowerHost === '::1';
  }
  
  return false;
}

/**
 * Safe fetch wrapper that enforces allowlist
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise} - Fetch response or error
 */
export async function safeFetch(url, options = {}) {
  const check = checkOutboundUrl(url);
  
  if (!check.allowed) {
    throw new Error(`Blocked outbound request: ${check.reason}`);
  }
  
  // Add timeout if not specified
  const timeout = options.timeout || 10000; // 10s default
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      // Prevent following redirects to non-allowed domains
      redirect: 'manual'
    });
    
    // Check redirect location
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        const redirectCheck = checkOutboundUrl(location);
        if (!redirectCheck.allowed) {
          throw new Error(`Blocked redirect to: ${location}`);
        }
        // If redirect is allowed, follow it manually
        return safeFetch(location, options);
      }
    }
    
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get list of allowed domains (for UI/debugging)
 * @returns {string[]} - List of allowed domains
 */
export function getAllowedDomains() {
  return [...ALLOWED_DOMAINS];
}

/**
 * Add a domain to the allowlist (runtime only)
 * @param {string} domain - Domain to add
 */
export function addAllowedDomain(domain) {
  if (!ALLOWED_DOMAINS.includes(domain)) {
    ALLOWED_DOMAINS.push(domain);
    console.log(`[Security] Added '${domain}' to outbound allowlist`);
  }
}

/**
 * Remove a domain from the allowlist (runtime only)
 * @param {string} domain - Domain to remove
 */
export function removeAllowedDomain(domain) {
  const index = ALLOWED_DOMAINS.indexOf(domain);
  if (index > -1) {
    ALLOWED_DOMAINS.splice(index, 1);
    console.log(`[Security] Removed '${domain}' from outbound allowlist`);
  }
}