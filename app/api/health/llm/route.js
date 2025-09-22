/**
 * LLM Health Check Endpoint
 * Returns provider configuration status without exposing sensitive data
 */

import { NextRequest, NextResponse } from 'next/server';
import { safeLog } from '@/src/lib/pii-protection';

export async function GET(request) {
  try {
    // Check primary provider (Anthropic)
    const hasAnthropicKey = process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 10;
    const claudeModel = process.env.CLAUDE_API_MODEL || 'claude-sonnet-4-20250514';
    
    // Check fallback provider (OpenAI)
    const hasOpenAIKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 10;
    const openaiModel = process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini';
    
    // Check configuration
    const primaryProvider = process.env.PRIMARY_PROVIDER || 'anthropic';
    const fallbackProvider = process.env.FALLBACK_PROVIDER || 'openai';
    const fallbackEnabled = process.env.FALLBACK_ENABLED !== 'false';
    
    // Calculate status
    const primaryReady = primaryProvider === 'anthropic' && hasAnthropicKey;
    const fallbackReady = fallbackProvider === 'openai' && hasOpenAIKey && fallbackEnabled;
    
    const healthStatus = {
      primary: primaryProvider,
      primaryReady,
      fallback: fallbackProvider,
      fallbackEnabled,
      fallbackReady,
      timestamp: new Date().toISOString()
    };
    
    // Log health check (dev only)
    if (process.env.NODE_ENV === 'development') {
      const anthropicKeyStatus = hasAnthropicKey ? 'configured' : 'missing';
      const openaiKeyStatus = hasOpenAIKey ? 'configured' : 'missing';
      
      safeLog('LLM Health', `Primary: ${primaryProvider} (${anthropicKeyStatus}), Fallback: ${fallbackProvider} (${openaiKeyStatus}, enabled: ${fallbackEnabled})`);
    }
    
    return NextResponse.json(healthStatus, { status: 200 });
    
  } catch (error) {
    safeLog('LLM Health Error', error.message);
    return NextResponse.json(
      { error: 'Health check failed', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}