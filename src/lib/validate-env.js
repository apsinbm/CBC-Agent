/**
 * Environment Variable Validation
 * Validates required environment variables at startup
 * Now includes cloud deployment feature flag validation
 */

// Valid Anthropic model IDs (primary: Sonnet only)
const VALID_CLAUDE_MODELS = [
  'claude-3-5-sonnet-20240620',
  'claude-3-5-sonnet-20241022',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307'
];

// Valid OpenAI fallback models
const VALID_OPENAI_MODELS = [
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4-turbo',
  'gpt-4'
];

/**
 * Validate environment variables on startup
 * @returns {Object} Validation result with warnings and errors
 */
export function validateEnvironment() {
  const errors = [];
  const warnings = [];
  
  // Check for Anthropic API key
  if (!process.env.ANTHROPIC_API_KEY) {
    errors.push('ANTHROPIC_API_KEY is not set. Chat functionality will not work.');
  } else if (process.env.ANTHROPIC_API_KEY.length < 10) {
    errors.push('ANTHROPIC_API_KEY appears to be invalid (too short).');
  }
  
  // Check for Claude model
  const claudeModel = process.env.CLAUDE_API_MODEL;
  if (!claudeModel) {
    warnings.push('CLAUDE_API_MODEL not set. Using default: claude-3-5-sonnet-20240620');
  } else if (!VALID_CLAUDE_MODELS.includes(claudeModel)) {
    warnings.push(`CLAUDE_API_MODEL "${claudeModel}" may not be valid. Known models: ${VALID_CLAUDE_MODELS.join(', ')}`);
  }
  
  // Check for OpenAI fallback (optional but recommended)
  const fallbackEnabled = process.env.FALLBACK_ENABLED !== 'false';
  if (fallbackEnabled) {
    if (!process.env.OPENAI_API_KEY) {
      warnings.push('OPENAI_API_KEY not set. Fallback to OpenAI will be disabled automatically.');
    } else if (process.env.OPENAI_API_KEY.length < 10) {
      warnings.push('OPENAI_API_KEY appears to be invalid (too short). Fallback may not work.');
    }
    
    // Check OpenAI fallback model
    const openaiModel = process.env.OPENAI_FALLBACK_MODEL;
    if (openaiModel && !VALID_OPENAI_MODELS.includes(openaiModel)) {
      warnings.push(`OPENAI_FALLBACK_MODEL "${openaiModel}" may not be valid. Known models: ${VALID_OPENAI_MODELS.join(', ')}`);
    }
  }
  
  // Validate provider configuration
  const primaryProvider = process.env.PRIMARY_PROVIDER || 'anthropic';
  const fallbackProvider = process.env.FALLBACK_PROVIDER || 'openai';
  
  if (primaryProvider !== 'anthropic') {
    warnings.push(`PRIMARY_PROVIDER should be 'anthropic'. Current: ${primaryProvider}`);
  }
  
  if (fallbackProvider !== 'openai') {
    warnings.push(`FALLBACK_PROVIDER should be 'openai'. Current: ${fallbackProvider}`);
  }
  
  // Check email configuration (optional but recommended)
  if (!process.env.SMTP_HOST && !process.env.SENDGRID_API_KEY && !process.env.AWS_SES_REGION) {
    warnings.push('No email provider configured. Form submissions will not send emails.');
  }
  
  // Check front desk email
  if (!process.env.FRONT_DESK_EMAIL && !process.env.FRONTDESK_EMAIL) {
    warnings.push('FRONT_DESK_EMAIL not set. Using default: frontdesk@coralbeach.bm');
  }
  
  // Development/Production specific checks
  if (process.env.NODE_ENV === 'production') {
    // Production-specific validations
    if (!process.env.NEXT_PUBLIC_URL) {
      warnings.push('NEXT_PUBLIC_URL not set. Some features may not work correctly in production.');
    }
  }
  
  // Feature flag validation (cloud deployment features)
  validateFeatureFlags(warnings);
  
  // Log results
  if (errors.length > 0) {
    console.error('🚨 Environment Validation Errors:');
    errors.forEach(err => console.error(`  ❌ ${err}`));
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️  Environment Validation Warnings:');
    warnings.forEach(warn => console.warn(`  ⚠️  ${warn}`));
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ Environment validation passed');
  }
  
  return { errors, warnings, isValid: errors.length === 0 };
}

/**
 * Validate feature flag configurations
 * @param {string[]} warnings - Array to push warnings to
 */
function validateFeatureFlags(warnings) {
  // Helper function to check if feature flag is enabled
  const isFeatureEnabled = (flag) => {
    const envValue = process.env[`FEATURE_${flag}`];
    if (!envValue) return false;
    const normalized = envValue.toLowerCase().trim();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  };
  
  // Email notifications validation
  if (isFeatureEnabled('EMAIL_NOTIFICATIONS')) {
    const provider = process.env.EMAIL_PROVIDER;
    if (!provider) {
      warnings.push('FEATURE_EMAIL_NOTIFICATIONS enabled but EMAIL_PROVIDER not set');
    } else {
      switch (provider) {
        case 'smtp':
          if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
            warnings.push('EMAIL_PROVIDER=smtp but SMTP_HOST or SMTP_USER not configured');
          }
          break;
        case 'sendgrid':
          if (!process.env.SENDGRID_API_KEY) {
            warnings.push('EMAIL_PROVIDER=sendgrid but SENDGRID_API_KEY not configured');
          }
          break;
        case 'mailgun':
          if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
            warnings.push('EMAIL_PROVIDER=mailgun but MAILGUN_API_KEY or MAILGUN_DOMAIN not configured');
          }
          break;
        default:
          warnings.push(`Unknown EMAIL_PROVIDER: ${provider}. Valid options: smtp, sendgrid, mailgun`);
      }
    }
    
    if (!process.env.RECEPTION_EMAILS) {
      warnings.push('FEATURE_EMAIL_NOTIFICATIONS enabled but RECEPTION_EMAILS not configured');
    }
    
    // Warn about dry run mode in production
    if (process.env.NODE_ENV === 'production' && process.env.EMAIL_DRY_RUN === 'true') {
      warnings.push('EMAIL_DRY_RUN=true in production - emails will not be sent');
    }
  }
  
  // Calendar ingestion validation
  if (isFeatureEnabled('CALENDAR_INGEST')) {
    if (!process.env.KB_PATH) {
      warnings.push('FEATURE_CALENDAR_INGEST enabled but KB_PATH not set');
    }
    if (!process.env.CALENDAR_BACKUP_DIR) {
      warnings.push('FEATURE_CALENDAR_INGEST enabled but CALENDAR_BACKUP_DIR not set');
    }
    if (!process.env.KB_BACKUP_DIR) {
      warnings.push('FEATURE_CALENDAR_INGEST enabled but KB_BACKUP_DIR not set');
    }
  }
  
  // Analytics validation
  if (isFeatureEnabled('ANALYTICS')) {
    const provider = process.env.ANALYTICS_PROVIDER;
    if (!provider || provider === 'none') {
      warnings.push('FEATURE_ANALYTICS enabled but ANALYTICS_PROVIDER not set or set to "none"');
    } else if (provider !== 'existing' && !process.env.ANALYTICS_DSN) {
      warnings.push(`FEATURE_ANALYTICS enabled with provider "${provider}" but ANALYTICS_DSN not configured`);
    }
  }
  
  // General cloud deployment checks
  const anyCloudFeatureEnabled = isFeatureEnabled('EMAIL_NOTIFICATIONS') || 
                                  isFeatureEnabled('CALENDAR_INGEST') || 
                                  isFeatureEnabled('ANALYTICS');
  
  if (anyCloudFeatureEnabled && process.env.NODE_ENV === 'production') {
    if (!process.env.NEXT_PUBLIC_URL) {
      warnings.push('Cloud features enabled in production but NEXT_PUBLIC_URL not set');
    }
  }
}

/**
 * Run validation on module load in development
 */
if (process.env.NODE_ENV === 'development') {
  validateEnvironment();
}