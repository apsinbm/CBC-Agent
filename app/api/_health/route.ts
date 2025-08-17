/**
 * Comprehensive Health Check Endpoint for CBC-Agent
 * 
 * Returns system status, version info, and feature status without exposing secrets.
 * Safe for monitoring and operational visibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllFeatureFlags } from '@/src/lib/feature-flags';
import { safeLog } from '@/src/lib/pii-protection';
import packageJson from '@/package.json';

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Basic system info
    const systemInfo = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: packageJson.version,
      environment: process.env.NODE_ENV || 'development',
      uptime_ms: process.uptime() * 1000
    };
    
    // Feature flag status (no sensitive data)
    const features = getFeatureHealthStatus();
    
    // LLM provider status (masked keys)
    const llmStatus = {
      primary_provider: process.env.PRIMARY_PROVIDER || 'anthropic',
      primary_ready: !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 10),
      fallback_provider: process.env.FALLBACK_PROVIDER || 'openai', 
      fallback_enabled: process.env.FALLBACK_ENABLED !== 'false',
      fallback_ready: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 10),
      model: process.env.CLAUDE_API_MODEL || 'claude-3-5-sonnet-20240620'
    };
    
    // Service readiness checks
    const services = {
      weather: {
        provider: process.env.WEATHER_PROVIDER || 'openmeteo',
        ready: true // Weather service is always ready (uses free API)
      },
      email: {
        enabled: features.email_notifications,
        provider: process.env.EMAIL_PROVIDER || 'none',
        ready: checkEmailReadiness()
      },
      analytics: {
        enabled: features.analytics,
        provider: process.env.ANALYTICS_PROVIDER || 'none',
        ready: checkAnalyticsReadiness()
      },
      knowledge_base: {
        path: process.env.KB_PATH || 'data/cbc_knowledge.md',
        ingest_enabled: features.calendar_ingest,
        ready: checkKnowledgeBaseReadiness()
      }
    };
    
    // Overall health calculation
    const criticalServicesHealthy = llmStatus.primary_ready;
    const overallStatus = criticalServicesHealthy ? 'healthy' : 'degraded';
    
    const responseTime = Date.now() - startTime;
    
    const healthResponse = {
      ...systemInfo,
      status: overallStatus,
      response_time_ms: responseTime,
      features,
      llm: llmStatus,
      services
    };
    
    // Log health check in development for debugging
    if (process.env.NODE_ENV === 'development') {
      safeLog('Health Check', `Status: ${overallStatus}, Features: ${Object.keys(getAllFeatureFlags()).filter(k => features[k.toLowerCase()]).join(', ') || 'none'}`);
    }
    
    return NextResponse.json(healthResponse, { 
      status: overallStatus === 'healthy' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    safeLog('Health Check Error', error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      version: packageJson.version,
      error: 'Health check failed',
      message: 'Internal server error during health check'
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
 * Check if email service is ready when enabled
 */
function checkEmailReadiness(): boolean {
  if (!getFeatureHealthStatus().email_notifications) {
    return true; // Not enabled, so considered "ready"
  }
  
  const provider = process.env.EMAIL_PROVIDER;
  
  switch (provider) {
    case 'smtp':
      return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    case 'sendgrid':
      return !!(process.env.SENDGRID_API_KEY);
    case 'mailgun':
      return !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
    default:
      return false;
  }
}

/**
 * Check if analytics service is ready when enabled
 */
function checkAnalyticsReadiness(): boolean {
  if (!getFeatureHealthStatus().analytics) {
    return true; // Not enabled, so considered "ready"
  }
  
  const provider = process.env.ANALYTICS_PROVIDER;
  
  if (provider === 'none' || !provider) {
    return false;
  }
  
  // For external providers, check if DSN is configured
  return !!(process.env.ANALYTICS_DSN);
}

/**
 * Check if knowledge base system is ready
 */
function checkKnowledgeBaseReadiness(): boolean {
  try {
    const kbPath = process.env.KB_PATH || 'data/cbc_knowledge.md';
    const fs = require('fs');
    return fs.existsSync(kbPath);
  } catch {
    return false;
  }
}

/**
 * Import feature flag functions
 */
function getFeatureHealthStatus() {
  try {
    return require('@/src/lib/feature-flags').getFeatureHealthStatus();
  } catch {
    return {
      email_notifications: false,
      calendar_ingest: false,
      analytics: false,
      cloud_features_active: false,
      configuration_warnings: 0,
      status: 'unknown'
    };
  }
}