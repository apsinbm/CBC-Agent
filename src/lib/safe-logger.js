/**
 * Safe Logger - Masks sensitive information
 */

/**
 * Mask sensitive string, showing only last few characters
 * @param {string} str - String to mask
 * @param {number} showLast - Number of characters to show at end
 * @returns {string} Masked string
 */
function maskString(str, showLast = 3) {
  if (!str || str.length <= showLast) return '***';
  return '*'.repeat(Math.max(3, str.length - showLast)) + str.slice(-showLast);
}

/**
 * Mask email address
 * @param {string} email - Email to mask
 * @returns {string} Masked email
 */
function maskEmail(email) {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  return maskString(local, 2) + '@' + domain;
}

/**
 * Mask phone number
 * @param {string} phone - Phone to mask
 * @returns {string} Masked phone
 */
function maskPhone(phone) {
  if (!phone) return '***';
  const cleaned = phone.replace(/\D/g, '');
  return '*'.repeat(Math.max(3, cleaned.length - 4)) + cleaned.slice(-4);
}

/**
 * Clean sensitive data from object
 * @param {Object} obj - Object to clean
 * @returns {Object} Cleaned object
 */
export function cleanSensitiveData(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const cleaned = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
    const value = obj[key];
    const lowerKey = key.toLowerCase();
    
    // Never log these keys
    if (lowerKey.includes('api_key') || 
        lowerKey.includes('apikey') ||
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('private_key')) {
      cleaned[key] = '[REDACTED]';
      continue;
    }
    
    // Mask these keys
    if (lowerKey.includes('email')) {
      cleaned[key] = typeof value === 'string' ? maskEmail(value) : value;
    } else if (lowerKey.includes('phone') || lowerKey.includes('tel')) {
      cleaned[key] = typeof value === 'string' ? maskPhone(value) : value;
    } else if (lowerKey.includes('name') && typeof value === 'string') {
      cleaned[key] = maskString(value, 3);
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = cleanSensitiveData(value);
    } else {
      cleaned[key] = value;
    }
  }
  
  return cleaned;
}

/**
 * Safe console.log that masks sensitive data
 */
export function safeLog(message, data) {
  if (data) {
    console.log(message, cleanSensitiveData(data));
  } else {
    console.log(message);
  }
}

/**
 * Safe console.error that masks sensitive data
 */
export function safeError(message, error) {
  if (error && error.stack) {
    // Clean stack trace of any API keys or secrets
    const cleanStack = error.stack
      .replace(/api[_-]?key[=:]["']?[\w-]+/gi, 'api_key=[REDACTED]')
      .replace(/password[=:]["']?[\w-]+/gi, 'password=[REDACTED]')
      .replace(/secret[=:]["']?[\w-]+/gi, 'secret=[REDACTED]');
    console.error(message, { ...error, stack: cleanStack });
  } else if (error) {
    console.error(message, cleanSensitiveData(error));
  } else {
    console.error(message);
  }
}

// Export as default for easy migration
export default {
  log: safeLog,
  error: safeError,
  warn: (msg, data) => console.warn(msg, data ? cleanSensitiveData(data) : undefined),
  info: (msg, data) => console.info(msg, data ? cleanSensitiveData(data) : undefined)
};