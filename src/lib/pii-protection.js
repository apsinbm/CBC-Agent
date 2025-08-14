/**
 * PII Protection Helper
 * Centralizes validation, redaction, and normalization of personally identifiable information
 */

// Field length limits
const FIELD_LIMITS = {
  name: 120,
  email: 254,
  phone: 32,
  freeText: 3000,
  address: 200,
  memberNumber: 50,
  roomNumber: 20
};

/**
 * Validates and sanitizes PII fields
 * @param {string} field - Field name
 * @param {string} value - Field value
 * @returns {object} - { valid: boolean, value: sanitized value, error?: string }
 */
export function validatePII(field, value) {
  if (!value) return { valid: false, value: '', error: 'Required field' };
  
  let sanitized = String(value).trim();
  const limit = FIELD_LIMITS[field] || FIELD_LIMITS.freeText;
  
  // Enforce length limits
  if (sanitized.length > limit) {
    sanitized = sanitized.substring(0, limit);
  }
  
  // Field-specific validation
  switch (field) {
    case 'email':
      sanitized = sanitized.toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(sanitized)) {
        return { valid: false, value: sanitized, error: 'Invalid email format' };
      }
      break;
      
    case 'phone':
      // Normalize phone - keep only digits and common separators
      sanitized = sanitized.replace(/[^\d\s\-\+\(\)\.]/g, '');
      if (sanitized.replace(/\D/g, '').length < 7) {
        return { valid: false, value: sanitized, error: 'Phone number too short' };
      }
      break;
      
    case 'name':
      // Allow letters, spaces, hyphens, apostrophes, periods
      if (!/^[a-zA-Z\s\-\.']+$/.test(sanitized)) {
        return { valid: false, value: sanitized, error: 'Name contains invalid characters' };
      }
      break;
      
    case 'memberNumber':
    case 'roomNumber':
      // Alphanumeric only
      sanitized = sanitized.replace(/[^a-zA-Z0-9\-]/g, '');
      break;
  }
  
  return { valid: true, value: sanitized };
}

/**
 * Redacts PII for logging - shows only last 2-3 characters
 * @param {string} field - Field name
 * @param {string} value - Field value
 * @returns {string} - Redacted value
 */
export function redactPII(field, value) {
  if (!value) return '[empty]';
  
  const str = String(value);
  
  switch (field) {
    case 'email':
      const [local, domain] = str.split('@');
      if (!domain) return '***@***';
      const redactedLocal = local.length > 2 ? 
        '***' + local.slice(-2) : '***';
      return `${redactedLocal}@${domain}`;
      
    case 'phone':
      const digits = str.replace(/\D/g, '');
      if (digits.length <= 4) return '***';
      return '***-***-' + digits.slice(-4);
      
    case 'name':
      const parts = str.split(' ');
      return parts.map(part => 
        part.length > 2 ? part[0] + '***' : '***'
      ).join(' ');
      
    case 'memberNumber':
    case 'roomNumber':
      if (str.length <= 3) return '***';
      return '***' + str.slice(-3);
      
    default:
      // For other text, show length but not content
      return `[${str.length} chars]`;
  }
}

/**
 * Creates a safe version of an object for logging
 * @param {object} data - Data object potentially containing PII
 * @returns {object} - Safe version with PII redacted
 */
export function createSafeLogObject(data) {
  if (!data || typeof data !== 'object') return data;
  
  const safeObj = {};
  const piiFields = ['name', 'fullName', 'email', 'phone', 'address', 
                     'memberNumber', 'roomNumber', 'memberStatus'];
  
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    // Check if this is a PII field
    const isPII = piiFields.some(field => 
      lowerKey.includes(field.toLowerCase())
    );
    
    if (isPII) {
      // Determine field type for proper redaction
      let fieldType = 'freeText';
      if (lowerKey.includes('email')) fieldType = 'email';
      else if (lowerKey.includes('phone')) fieldType = 'phone';
      else if (lowerKey.includes('name')) fieldType = 'name';
      else if (lowerKey.includes('member')) fieldType = 'memberNumber';
      else if (lowerKey.includes('room')) fieldType = 'roomNumber';
      
      safeObj[key] = redactPII(fieldType, value);
    } else if (typeof value === 'object' && value !== null) {
      // Recursively handle nested objects
      safeObj[key] = createSafeLogObject(value);
    } else {
      safeObj[key] = value;
    }
  }
  
  return safeObj;
}

/**
 * Safe console.log replacement that redacts PII
 */
export function safeLog(context, ...args) {
  const safeArgs = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      return createSafeLogObject(arg);
    }
    return arg;
  });
  
  console.log(`[${context}]`, ...safeArgs);
}

/**
 * Normalizes phone number format
 * @param {string} phone - Phone number
 * @returns {string} - Normalized phone
 */
export function normalizePhone(phone) {
  if (!phone) return '';
  
  // Keep original format but clean it
  const cleaned = phone.replace(/[^\d\s\-\+\(\)\.]/g, '');
  
  // If it's a Bermuda number without country code, add it
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 7 && !cleaned.includes('+')) {
    return '+1-441-' + digits.slice(0, 3) + '-' + digits.slice(3);
  }
  
  return cleaned;
}

/**
 * Normalizes email format
 * @param {string} email - Email address
 * @returns {string} - Normalized email
 */
export function normalizeEmail(email) {
  if (!email) return '';
  return email.trim().toLowerCase();
}

/**
 * Validates and sanitizes all PII fields in an object
 * @param {object} data - Data object
 * @returns {object} - { valid: boolean, sanitized: object, errors: object }
 */
export function sanitizeAllPII(data) {
  const sanitized = {};
  const errors = {};
  let valid = true;
  
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    // Determine field type
    let fieldType = null;
    if (lowerKey.includes('email')) fieldType = 'email';
    else if (lowerKey.includes('phone')) fieldType = 'phone';
    else if (lowerKey.includes('name')) fieldType = 'name';
    else if (lowerKey.includes('member')) fieldType = 'memberNumber';
    else if (lowerKey.includes('room')) fieldType = 'roomNumber';
    else if (typeof value === 'string') fieldType = 'freeText';
    
    if (fieldType && value) {
      const result = validatePII(fieldType, value);
      if (!result.valid) {
        errors[key] = result.error;
        valid = false;
      }
      sanitized[key] = result.value;
    } else {
      sanitized[key] = value;
    }
  }
  
  return { valid, sanitized, errors };
}