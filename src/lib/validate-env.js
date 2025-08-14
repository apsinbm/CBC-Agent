/**
 * Environment Variable Validation
 * Validates required environment variables at startup
 */

// Valid Anthropic model IDs
const VALID_CLAUDE_MODELS = [
  'claude-3-5-sonnet-20240620',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
  'claude-2.1',
  'claude-2.0',
  'claude-instant-1.2'
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
  
  // Check for OpenAI fallback (optional)
  if (!process.env.OPENAI_API_KEY) {
    warnings.push('OPENAI_API_KEY not set. Fallback to OpenAI will not work.');
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
 * Run validation on module load in development
 */
if (process.env.NODE_ENV === 'development') {
  validateEnvironment();
}