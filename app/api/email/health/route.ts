/**
 * Dedicated Email Service Health Check Endpoint
 * 
 * Provides detailed status of email service configuration and capabilities.
 * Safe for monitoring and operational visibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isEmailNotificationsEnabled } from '@/src/lib/feature-flags';
import { safeLog } from '@/src/lib/pii-protection';

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Feature flag status
    const emailNotificationsEnabled = isEmailNotificationsEnabled();
    const isDryRun = process.env.EMAIL_DRY_RUN === 'true';
    
    // Provider configuration
    const emailProvider = process.env.EMAIL_PROVIDER?.toLowerCase() || 'smtp';
    
    // Reception emails configuration
    const receptionEmails = getReceptionEmails();
    
    // Provider readiness checks
    const providerStatus = {
      smtp: checkSMTPReadiness(),
      sendgrid: checkSendGridReadiness(),
      mailgun: checkMailgunReadiness()
    };
    
    // Overall email readiness
    const currentProviderReady = providerStatus[emailProvider as keyof typeof providerStatus] || false;
    const fallbackProvidersReady = Object.entries(providerStatus)
      .filter(([provider]) => provider !== emailProvider)
      .map(([, ready]) => ready)
      .some(ready => ready);
    
    // Email configuration status
    const configuration = {
      provider: emailProvider,
      reception_emails_count: receptionEmails.length,
      reception_emails_configured: receptionEmails.length > 0,
      from_address: !!(process.env.EMAIL_FROM || process.env.SMTP_USER),
      subject_prefix: process.env.EMAIL_SUBJECT_PREFIX || '[CBC Concierge] ',
      bcc_configured: !!(process.env.EMAIL_BCC && process.env.EMAIL_BCC.length > 0),
      guest_copy_enabled: process.env.EMAIL_SEND_GUEST_COPY === 'true',
      dry_run_mode: isDryRun
    };
    
    // Service capabilities
    const capabilities = {
      intake_notifications: emailNotificationsEnabled,
      reservation_notifications: emailNotificationsEnabled,
      guest_confirmations: emailNotificationsEnabled && (configuration.guest_copy_enabled || !isDryRun),
      fallback_providers: fallbackProvidersReady,
      attachment_support: true,
      html_email_support: true
    };
    
    // Overall status determination
    const isOperational = emailNotificationsEnabled && currentProviderReady && receptionEmails.length > 0;
    const hasBackup = fallbackProvidersReady;
    
    let status: 'healthy' | 'degraded' | 'error' | 'disabled';
    if (!emailNotificationsEnabled) {
      status = 'disabled';
    } else if (isOperational && hasBackup) {
      status = 'healthy';
    } else if (isOperational) {
      status = 'degraded'; // Working but no backup
    } else {
      status = 'error';
    }
    
    const responseTime = Date.now() - startTime;
    
    const healthResponse = {
      status,
      timestamp: new Date().toISOString(),
      response_time_ms: responseTime,
      feature_enabled: emailNotificationsEnabled,
      dry_run_mode: isDryRun,
      configuration,
      providers: {
        current: emailProvider,
        current_ready: currentProviderReady,
        available: providerStatus,
        fallback_available: fallbackProvidersReady
      },
      capabilities,
      warnings: generateEmailWarnings(emailNotificationsEnabled, configuration, providerStatus, emailProvider)
    };
    
    // Log health check in development
    if (process.env.NODE_ENV === 'development') {
      safeLog('Email Health Check', `Status: ${status}, Provider: ${emailProvider}, Enabled: ${emailNotificationsEnabled}`);
    }
    
    return NextResponse.json(healthResponse, { 
      status: status === 'error' ? 503 : 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    safeLog('Email Health Check Error', error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Email health check failed',
      message: 'Internal server error during email health check'
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
  }
}

/**
 * Check SMTP provider readiness
 */
function checkSMTPReadiness(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Check SendGrid provider readiness
 */
function checkSendGridReadiness(): boolean {
  return !!(process.env.SENDGRID_API_KEY);
}

/**
 * Check Mailgun provider readiness
 */
function checkMailgunReadiness(): boolean {
  return !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
}

/**
 * Get reception email addresses
 */
function getReceptionEmails(): string[] {
  const receptionEmails = process.env.RECEPTION_EMAILS || 
                         process.env.FRONTDESK_EMAIL || 
                         process.env.FRONT_DESK_EMAIL || 
                         '';
  
  return receptionEmails.split(',').map(email => email.trim()).filter(email => email.length > 0);
}

/**
 * Generate warnings about email configuration
 */
function generateEmailWarnings(
  enabled: boolean, 
  config: any, 
  providers: any, 
  currentProvider: string
): string[] {
  const warnings: string[] = [];
  
  if (!enabled) {
    warnings.push('Email notifications are disabled via feature flag');
    return warnings;
  }
  
  if (!config.reception_emails_configured) {
    warnings.push('No reception email addresses configured');
  }
  
  if (!providers[currentProvider]) {
    warnings.push(`Current email provider '${currentProvider}' is not properly configured`);
  }
  
  const readyProviders = Object.entries(providers).filter(([, ready]) => ready).length;
  if (readyProviders === 0) {
    warnings.push('No email providers are properly configured');
  } else if (readyProviders === 1) {
    warnings.push('Only one email provider configured - consider adding backup providers');
  }
  
  if (config.dry_run_mode && process.env.NODE_ENV === 'production') {
    warnings.push('Dry run mode is enabled in production - emails will not be sent');
  }
  
  if (!config.from_address) {
    warnings.push('No from address configured - emails may be rejected');
  }
  
  return warnings;
}