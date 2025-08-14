/**
 * Environment Variable Validation & Secrets Hygiene
 * Ensures all required env vars are present and valid
 */

// Required environment variables
const REQUIRED_ENV_VARS = [
  {
    name: 'ANTHROPIC_API_KEY',
    pattern: /^sk-ant-api03-[A-Za-z0-9\-_]{90,}$/,
    description: 'Anthropic API key',
    sensitive: true
  },
  {
    name: 'OPENAI_API_KEY',
    pattern: /^sk-[A-Za-z0-9]{48,}$/,
    description: 'OpenAI API key',
    sensitive: true,
    optional: true  // Fallback provider
  },
  {
    name: 'NEXT_PUBLIC_URL',
    pattern: /^https?:\/\/.+$/,
    description: 'Public URL of the application',
    sensitive: false
  }
];

// Optional but recommended env vars
const OPTIONAL_ENV_VARS = [
  {
    name: 'RATE_LIMIT_MAX',
    pattern: /^\d+$/,
    description: 'Max requests per window',
    default: '10'
  },
  {
    name: 'RATE_LIMIT_WINDOW',
    pattern: /^\d+$/,
    description: 'Rate limit window in ms',
    default: '60000'
  },
  {
    name: 'FAQ_ENABLED',
    pattern: /^(true|false)$/,
    description: 'Enable FAQ system',
    default: 'true'
  },
  {
    name: 'ALONSO_PERSONA_ENABLED',
    pattern: /^(true|false)$/,
    description: 'Enable Alonso personality',
    default: 'true'
  },
  {
    name: 'NODE_ENV',
    pattern: /^(development|production|test)$/,
    description: 'Node environment',
    default: 'production'
  }
];

/**
 * Validate a single environment variable
 * @param {object} envVar - Environment variable config
 * @param {string} value - Actual value
 * @returns {object} - { valid: boolean, error?: string }
 */
function validateEnvVar(envVar, value) {
  // Check if required and missing
  if (!value && !envVar.optional) {
    return {
      valid: false,
      error: `Missing required environment variable: ${envVar.name}`
    };
  }
  
  // Skip validation if optional and not provided
  if (!value && envVar.optional) {
    return { valid: true };
  }
  
  // Validate pattern
  if (envVar.pattern && !envVar.pattern.test(value)) {
    return {
      valid: false,
      error: `Invalid format for ${envVar.name}: ${envVar.description}`
    };
  }
  
  // Check for common mistakes
  if (envVar.sensitive) {
    // Check for placeholder values
    if (value.includes('YOUR_') || value.includes('REPLACE_') || 
        value === 'xxx' || value === 'placeholder') {
      return {
        valid: false,
        error: `${envVar.name} contains a placeholder value`
      };
    }
    
    // Check for exposed secrets in value
    if (value.includes(' ') || value.includes('\n')) {
      return {
        valid: false,
        error: `${envVar.name} contains whitespace - may be incorrectly formatted`
      };
    }
  }
  
  return { valid: true };
}

/**
 * Validate all environment variables
 * @returns {object} - { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateEnvironment() {
  const errors = [];
  const warnings = [];
  
  // Check required variables
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar.name];
    const result = validateEnvVar(envVar, value);
    
    if (!result.valid) {
      errors.push(result.error);
    }
  }
  
  // Check optional variables
  for (const envVar of OPTIONAL_ENV_VARS) {
    const value = process.env[envVar.name];
    
    if (!value && envVar.default) {
      // Set default value
      process.env[envVar.name] = envVar.default;
      warnings.push(`Using default value for ${envVar.name}: ${envVar.default}`);
    } else if (value) {
      const result = validateEnvVar(envVar, value);
      if (!result.valid) {
        warnings.push(result.error);
      }
    }
  }
  
  // Security checks
  if (process.env.NODE_ENV === 'production') {
    // Check for debug flags in production
    const debugVars = ['DEBUG', 'VERBOSE', 'LOG_LEVEL'];
    for (const debugVar of debugVars) {
      if (process.env[debugVar] && process.env[debugVar] !== 'error') {
        warnings.push(`${debugVar} is enabled in production - consider disabling`);
      }
    }
    
    // Check for development URLs in production
    if (process.env.NEXT_PUBLIC_URL?.includes('localhost')) {
      errors.push('NEXT_PUBLIC_URL contains localhost in production');
    }
  }
  
  // Check for leaked secrets in common places
  const secretPatterns = [
    /sk-[A-Za-z0-9]{20,}/,
    /api[_-]?key/i,
    /secret/i,
    /password/i,
    /token/i
  ];
  
  // Check if any non-sensitive env vars contain secrets
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.includes('KEY') && !key.includes('TOKEN') && 
        !key.includes('SECRET') && !key.includes('PASSWORD')) {
      for (const pattern of secretPatterns) {
        if (pattern.test(value)) {
          warnings.push(`Potential secret in non-secret variable ${key}`);
          break;
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Mask sensitive values for logging
 * @param {string} value - Value to mask
 * @returns {string} - Masked value
 */
export function maskSecret(value) {
  if (!value) return '[empty]';
  if (value.length <= 8) return '***';
  return value.substring(0, 4) + '***' + value.substring(value.length - 4);
}

/**
 * Get safe environment info for logging
 * @returns {object} - Safe env info
 */
export function getSafeEnvInfo() {
  const info = {};
  
  // Include non-sensitive vars
  const safeVars = [
    'NODE_ENV',
    'NEXT_PUBLIC_URL',
    'RATE_LIMIT_MAX',
    'RATE_LIMIT_WINDOW',
    'FAQ_ENABLED',
    'ALONSO_PERSONA_ENABLED'
  ];
  
  for (const varName of safeVars) {
    info[varName] = process.env[varName] || '[not set]';
  }
  
  // Include masked sensitive vars
  const sensitiveVars = REQUIRED_ENV_VARS.filter(v => v.sensitive);
  for (const envVar of sensitiveVars) {
    const value = process.env[envVar.name];
    info[envVar.name] = value ? maskSecret(value) : '[not set]';
  }
  
  return info;
}

/**
 * Initialize environment with validation
 * @param {boolean} throwOnError - Whether to throw on validation errors
 * @returns {boolean} - Whether environment is valid
 */
export function initializeEnvironment(throwOnError = true) {
  const validation = validateEnvironment();
  
  // Log warnings
  if (validation.warnings.length > 0) {
    console.warn('[ENV] Warnings:', validation.warnings);
  }
  
  // Handle errors
  if (!validation.valid) {
    const errorMessage = `Environment validation failed:\n${validation.errors.join('\n')}`;
    
    if (throwOnError) {
      throw new Error(errorMessage);
    } else {
      console.error('[ENV]', errorMessage);
      return false;
    }
  }
  
  // Log success
  if (process.env.NODE_ENV !== 'test') {
    console.log('[ENV] Environment validated successfully');
    if (process.env.NODE_ENV === 'development') {
      console.log('[ENV] Config:', getSafeEnvInfo());
    }
  }
  
  return true;
}

/**
 * Rotate a secret (placeholder for actual implementation)
 * @param {string} secretName - Name of the secret
 * @returns {Promise<boolean>} - Whether rotation succeeded
 */
export async function rotateSecret(secretName) {
  console.log(`[ENV] Secret rotation requested for ${secretName}`);
  
  // In production, this would:
  // 1. Generate new secret
  // 2. Update secret manager (AWS, Vault, etc.)
  // 3. Update local env
  // 4. Verify new secret works
  // 5. Invalidate old secret
  
  return false; // Not implemented
}

/**
 * Check if secrets need rotation
 * @returns {object} - { needsRotation: string[] }
 */
export function checkSecretRotation() {
  const needsRotation = [];
  
  // In production, check:
  // - Age of secrets
  // - Last rotation date
  // - Compliance requirements
  
  // For now, just warn about static secrets
  const staticSecretAge = 90; // days
  const warning = `Consider rotating secrets every ${staticSecretAge} days`;
  
  return {
    needsRotation,
    warning
  };
}