/**
 * Feature Flag System for CBC-Agent
 * 
 * Provides centralized feature flag management for cloud deployment features.
 * All features default to false to ensure zero breaking changes to local development.
 */

/**
 * Available feature flags
 */
export type FeatureFlag = 
  | 'EMAIL_NOTIFICATIONS'
  | 'CALENDAR_INGEST' 
  | 'ANALYTICS';

/**
 * Feature flag configuration interface
 */
export interface FeatureConfig {
  EMAIL_NOTIFICATIONS: boolean;
  CALENDAR_INGEST: boolean; 
  ANALYTICS: boolean;
}

/**
 * Get a feature flag value from environment variables
 * 
 * @param flag - The feature flag to check
 * @param defaultValue - Default value if not set (defaults to false for safety)
 * @returns boolean value of the feature flag
 */
export function getFeatureFlag(flag: FeatureFlag, defaultValue: boolean = false): boolean {
  const envKey = `FEATURE_${flag}`;
  const envValue = process.env[envKey];
  
  if (envValue === undefined || envValue === null) {
    return defaultValue;
  }
  
  // Parse boolean from string (case-insensitive)
  const normalizedValue = envValue.toLowerCase().trim();
  return normalizedValue === 'true' || normalizedValue === '1' || normalizedValue === 'yes';
}

/**
 * Check if email notifications are enabled
 */
export function isEmailNotificationsEnabled(): boolean {
  return getFeatureFlag('EMAIL_NOTIFICATIONS');
}

/**
 * Check if calendar ingestion is enabled  
 */
export function isCalendarIngestEnabled(): boolean {
  return getFeatureFlag('CALENDAR_INGEST');
}

/**
 * Check if enhanced analytics are enabled
 */
export function isAnalyticsEnabled(): boolean {
  return getFeatureFlag('ANALYTICS');
}

/**
 * Get all feature flags status
 * 
 * @returns Object with all feature flag statuses
 */
export function getAllFeatureFlags(): FeatureConfig {
  return {
    EMAIL_NOTIFICATIONS: isEmailNotificationsEnabled(),
    CALENDAR_INGEST: isCalendarIngestEnabled(),
    ANALYTICS: isAnalyticsEnabled()
  };
}

/**
 * Check if any cloud features are enabled
 * Useful for determining if cloud-specific monitoring/logging should be active
 */
export function hasCloudFeaturesEnabled(): boolean {
  return isEmailNotificationsEnabled() || 
         isCalendarIngestEnabled() || 
         isAnalyticsEnabled();
}

/**
 * Validate feature flag configuration
 * Returns warnings for invalid configurations (e.g., feature enabled but missing required env vars)
 */
export function validateFeatureConfiguration(): string[] {
  const warnings: string[] = [];
  
  // Email notifications validation
  if (isEmailNotificationsEnabled()) {
    const emailProvider = process.env.EMAIL_PROVIDER;
    if (!emailProvider) {
      warnings.push('EMAIL_NOTIFICATIONS enabled but EMAIL_PROVIDER not set');
    } else {
      switch (emailProvider) {
        case 'smtp':
          if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
            warnings.push('SMTP email provider selected but SMTP_HOST or SMTP_USER not configured');
          }
          break;
        case 'sendgrid':
          if (!process.env.SENDGRID_API_KEY) {
            warnings.push('SendGrid email provider selected but SENDGRID_API_KEY not configured');
          }
          break;
        case 'mailgun':
          if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
            warnings.push('Mailgun email provider selected but MAILGUN_API_KEY or MAILGUN_DOMAIN not configured');
          }
          break;
      }
    }
    
    if (!process.env.RECEPTION_EMAILS) {
      warnings.push('EMAIL_NOTIFICATIONS enabled but RECEPTION_EMAILS not configured');
    }
  }
  
  // Calendar ingestion validation
  if (isCalendarIngestEnabled()) {
    if (!process.env.KB_PATH) {
      warnings.push('CALENDAR_INGEST enabled but KB_PATH not set');
    }
    if (!process.env.CALENDAR_BACKUP_DIR) {
      warnings.push('CALENDAR_INGEST enabled but CALENDAR_BACKUP_DIR not set');
    }
  }
  
  // Analytics validation
  if (isAnalyticsEnabled()) {
    const analyticsProvider = process.env.ANALYTICS_PROVIDER;
    if (!analyticsProvider || analyticsProvider === 'none') {
      warnings.push('ANALYTICS enabled but ANALYTICS_PROVIDER not set or set to "none"');
    } else if (analyticsProvider !== 'none' && !process.env.ANALYTICS_DSN) {
      warnings.push(`ANALYTICS enabled with provider "${analyticsProvider}" but ANALYTICS_DSN not configured`);
    }
  }
  
  return warnings;
}

/**
 * Get feature flag status for health checks
 * Returns sanitized status (no sensitive information)
 */
export function getFeatureHealthStatus(): { [key: string]: boolean | string | number } {
  const config = getAllFeatureFlags();
  const warnings = validateFeatureConfiguration();
  
  return {
    email_notifications: config.EMAIL_NOTIFICATIONS,
    calendar_ingest: config.CALENDAR_INGEST,
    analytics: config.ANALYTICS,
    cloud_features_active: hasCloudFeaturesEnabled(),
    configuration_warnings: warnings.length,
    // Don't expose the actual warnings in health check for security
    status: warnings.length === 0 ? 'healthy' : 'warnings'
  };
}