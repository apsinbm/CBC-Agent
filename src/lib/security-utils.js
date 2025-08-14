/**
 * Security utilities for data sanitization and safe logging
 */

/**
 * Masks sensitive data patterns in strings
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 */
export function maskSensitiveData(str) {
  if (!str) return str;
  
  // Convert to string if not already
  const text = typeof str === 'string' ? str : JSON.stringify(str);
  
  // Mask API keys (various patterns)
  let masked = text
    .replace(/sk-[A-Za-z0-9\-_]{20,}/g, 'sk-***MASKED***')
    .replace(/pk_[A-Za-z0-9\-_]{20,}/g, 'pk_***MASKED***')
    .replace(/api[_-]?key["\s:=]+["']?[A-Za-z0-9\-_]{20,}/gi, 'api_key: ***MASKED***')
    .replace(/bearer\s+[A-Za-z0-9\-_.]{20,}/gi, 'Bearer ***MASKED***');
  
  // Mask email addresses
  masked = masked.replace(
    /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    (match, local, domain) => {
      const maskedLocal = local.length > 2 
        ? local.substring(0, 2) + '***' 
        : '***';
      return `${maskedLocal}@${domain}`;
    }
  );
  
  // Mask phone numbers
  masked = masked.replace(
    /(\+?1?\s?\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/g,
    '***-***-****'
  );
  
  // Mask credit card numbers
  masked = masked.replace(
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    '****-****-****-****'
  );
  
  // Mask passwords in JSON-like structures
  masked = masked.replace(
    /"password"\s*:\s*"[^"]+"/gi,
    '"password": "***MASKED***"'
  );
  
  // Mask tokens
  masked = masked.replace(
    /"token"\s*:\s*"[^"]+"/gi,
    '"token": "***MASKED***"'
  );
  
  return masked;
}

/**
 * Safe console.log that masks sensitive data
 * @param  {...any} args - Arguments to log
 */
export function safeLog(...args) {
  if (process.env.NODE_ENV === 'production') {
    // In production, only log if explicitly enabled
    if (process.env.ENABLE_PRODUCTION_LOGS !== 'true') {
      return;
    }
  }
  
  const sanitizedArgs = args.map(arg => {
    if (typeof arg === 'string') {
      return maskSensitiveData(arg);
    } else if (typeof arg === 'object' && arg !== null) {
      try {
        const stringified = JSON.stringify(arg);
        const masked = maskSensitiveData(stringified);
        return JSON.parse(masked);
      } catch {
        return '[Object - Could not sanitize]';
      }
    }
    return arg;
  });
  
  console.log(...sanitizedArgs);
}

/**
 * Safe error logging
 * @param {string} context - Context where error occurred
 * @param {Error} error - Error object
 */
export function safeError(context, error) {
  const sanitizedMessage = maskSensitiveData(error.message || '');
  const sanitizedStack = maskSensitiveData(error.stack || '');
  
  if (process.env.NODE_ENV === 'production') {
    // In production, log minimal info
    console.error(`[${context}] Error:`, sanitizedMessage);
  } else {
    // In development, log full stack
    console.error(`[${context}] Error:`, sanitizedMessage, '\nStack:', sanitizedStack);
  }
}

/**
 * Validates environment variables are not exposed
 * @returns {boolean} - True if safe, false if issues detected
 */
export function validateEnvSecurity() {
  const sensitiveKeys = [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'DATABASE_URL',
    'JWT_SECRET',
    'SESSION_SECRET',
    'SMTP_PASS',
    'AWS_SECRET_ACCESS_KEY'
  ];
  
  const exposedKeys = [];
  
  // Check if sensitive keys are exposed to client
  if (typeof window !== 'undefined') {
    sensitiveKeys.forEach(key => {
      if (process.env[key] || process.env[`NEXT_PUBLIC_${key}`]) {
        exposedKeys.push(key);
      }
    });
    
    if (exposedKeys.length > 0) {
      console.error('SECURITY WARNING: Sensitive keys exposed to client:', exposedKeys);
      return false;
    }
  }
  
  return true;
}

/**
 * Sanitizes user input to prevent XSS
 * @param {string} input - User input
 * @returns {string} - Sanitized input
 */
export function sanitizeInput(input) {
  if (!input) return '';
  
  return String(input)
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Creates a redacted version of an object for logging
 * @param {object} obj - Object to redact
 * @param {string[]} keysToRedact - Keys to redact
 * @returns {object} - Redacted object
 */
export function redactObject(obj, keysToRedact = []) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const defaultRedactKeys = [
    'password', 'token', 'apiKey', 'api_key', 'secret',
    'authorization', 'auth', 'key', 'credential'
  ];
  
  const allRedactKeys = [...defaultRedactKeys, ...keysToRedact];
  
  const redacted = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    if (allRedactKeys.some(redactKey => lowerKey.includes(redactKey.toLowerCase()))) {
      redacted[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactObject(value, keysToRedact);
    } else {
      redacted[key] = value;
    }
  }
  
  return redacted;
}