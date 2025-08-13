/**
 * Session Management for Analytics
 * 
 * Tracks user sessions and automatically logs session events.
 * Uses cookies/headers to maintain session state across requests.
 */

import { randomUUID } from 'crypto';
import { logEvent } from './logEvent';

interface SessionData {
  sessionId: string;
  startTime: number;
  lastActivity: number;
  pageViews: number;
  interactions: number;
}

// In-memory session store (for development)
// In production, this should use Redis or database
const sessions = new Map<string, SessionData>();

// Session timeout: 30 minutes of inactivity
const SESSION_TIMEOUT = 30 * 60 * 1000;

/**
 * Get or create session ID from request headers
 */
export function getSessionId(request: Request): string {
  // Try to get session ID from cookie or custom header
  const cookies = request.headers.get('cookie') || '';
  const sessionCookie = cookies.split(';')
    .find(c => c.trim().startsWith('cbc-session='));
  
  if (sessionCookie) {
    return sessionCookie.split('=')[1].trim();
  }
  
  // Generate new session ID
  return randomUUID();
}

/**
 * Start or update a session
 */
export async function trackSession(sessionId: string, ip?: string): Promise<SessionData> {
  const now = Date.now();
  
  let session = sessions.get(sessionId);
  
  if (!session) {
    // New session
    session = {
      sessionId,
      startTime: now,
      lastActivity: now,
      pageViews: 0,
      interactions: 0
    };
    
    sessions.set(sessionId, session);
    
    // Log session start event
    await logEvent('SESSION_START', {
      userAgent: 'web',
      platform: 'chat'
    }, { sessionId, ip });
    
  } else {
    // Check if session has timed out
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      // End old session
      await endSession(sessionId, ip);
      
      // Start new session
      session = {
        sessionId,
        startTime: now,
        lastActivity: now,
        pageViews: 0,
        interactions: 0
      };
      sessions.set(sessionId, session);
      
      await logEvent('SESSION_START', {
        userAgent: 'web',
        platform: 'chat',
        reason: 'timeout_restart'
      }, { sessionId, ip });
    } else {
      // Update existing session
      session.lastActivity = now;
    }
  }
  
  return session;
}

/**
 * Track a page view
 */
export async function trackPageView(sessionId: string, page: string = '/chat', ip?: string): Promise<void> {
  const session = sessions.get(sessionId);
  
  if (session) {
    session.pageViews++;
    session.lastActivity = Date.now();
  }
  
  await logEvent('PAGE_VIEW', {
    page,
    referrer: '/chat'
  }, { sessionId, ip });
}

/**
 * Track user interaction
 */
export async function trackInteraction(sessionId: string, action: string, data: Record<string, any> = {}, ip?: string): Promise<void> {
  const session = sessions.get(sessionId);
  
  if (session) {
    session.interactions++;
    session.lastActivity = Date.now();
  }
  
  await logEvent('USER_INTERACTION', {
    action,
    ...data
  }, { sessionId, ip });
}

/**
 * Track search query
 */
export async function trackSearch(sessionId: string, query: string, results: number = 0, ip?: string): Promise<void> {
  const session = sessions.get(sessionId);
  
  if (session) {
    session.interactions++;
    session.lastActivity = Date.now();
  }
  
  await logEvent('SEARCH_QUERY', {
    query, // Will be hashed by logEvent
    resultCount: results,
    hasResults: results > 0
  }, { sessionId, ip });
}

/**
 * End a session
 */
export async function endSession(sessionId: string, ip?: string): Promise<void> {
  const session = sessions.get(sessionId);
  
  if (session) {
    const duration = Math.round((Date.now() - session.startTime) / 1000); // seconds
    
    await logEvent('SESSION_END', {
      duration,
      pageViews: session.pageViews,
      interactions: session.interactions
    }, { sessionId, ip });
    
    sessions.delete(sessionId);
  }
}

/**
 * Cleanup expired sessions (should be called periodically)
 */
export async function cleanupSessions(): Promise<void> {
  const now = Date.now();
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      await endSession(sessionId);
    }
  }
}

/**
 * Get session headers for response (sets cookie)
 */
export function getSessionHeaders(sessionId: string): Record<string, string> {
  return {
    'Set-Cookie': `cbc-session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
  };
}