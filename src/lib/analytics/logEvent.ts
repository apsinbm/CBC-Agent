/**
 * Lightweight Analytics Logging System
 * 
 * Logs events to JSON lines files, rotated by day.
 * Masks PII (emails, phones) and never stores raw IPs or API keys.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Event types
export type EventType = 
  | 'CHAT_MESSAGE'
  | 'FAQ_HIT'
  | 'FAQ_MISS'
  | 'HANDOFF_REQUESTED'
  | 'EMAIL_SENT'
  | 'SESSION_START'
  | 'SESSION_END'
  | 'PAGE_VIEW'
  | 'SEARCH_QUERY'
  | 'USER_INTERACTION';

export interface LogEvent {
  type: EventType;
  timestamp: string;
  data: Record<string, any>;
  sessionId?: string;
}

// Get analytics directory from env or default
const ANALYTICS_DIR = process.env.ANALYTICS_DIR || 'server/data/analytics';
const ENABLE_LOGGING = process.env.FAQ_ENABLE_LOGGING !== 'false';

/**
 * Hash sensitive data for privacy
 */
function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

/**
 * Mask email addresses (keep domain and last 2-3 chars)
 */
function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  
  const username = parts[0];
  const domain = parts[1];
  
  if (username.length <= 3) {
    return `***@${domain}`;
  }
  
  return `***${username.slice(-2)}@${domain}`;
}

/**
 * Mask phone numbers (keep last 3 digits)
 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***-***-${digits.slice(-3)}`;
}

/**
 * Ensure directory exists
 */
function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get log file path for current date
 */
function getLogFilePath(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  const monthDir = path.join(ANALYTICS_DIR, `${year}-${month}`);
  ensureDirectoryExists(monthDir);
  
  return path.join(monthDir, `${year}-${month}-${day}.log`);
}

/**
 * Log an analytics event
 */
export async function logEvent(
  type: EventType,
  data: Record<string, any>,
  options: { sessionId?: string; ip?: string } = {}
): Promise<void> {
  if (!ENABLE_LOGGING) return;
  
  try {
    // Sanitize data
    const sanitizedData = { ...data };
    
    // Hash IP if provided (never store raw IP)
    if (options.ip) {
      sanitizedData.ipHash = hashData(options.ip);
    }
    
    // Mask emails
    if (sanitizedData.email) {
      sanitizedData.email = maskEmail(sanitizedData.email);
    }
    
    // Mask phones
    if (sanitizedData.phone) {
      sanitizedData.phone = maskPhone(sanitizedData.phone);
    }
    
    // Hash query text for FAQ_MISS and SEARCH_QUERY events
    if ((type === 'FAQ_MISS' || type === 'SEARCH_QUERY') && sanitizedData.query) {
      sanitizedData.queryHash = hashData(sanitizedData.query.toLowerCase());
      delete sanitizedData.query; // Remove raw query
    }
    
    // Add hour of day for temporal analysis
    sanitizedData.hour = new Date().getHours();
    
    // Create log event
    const event: LogEvent = {
      type,
      timestamp: new Date().toISOString(),
      data: sanitizedData,
      sessionId: options.sessionId
    };
    
    // Write to log file (append)
    const logPath = getLogFilePath();
    const logLine = JSON.stringify(event) + '\n';
    
    fs.appendFileSync(logPath, logLine);
    
  } catch (error) {
    // Silently fail - don't break app for analytics
    console.error('Analytics logging error:', error);
  }
}

/**
 * Get aggregated insights (dev only)
 */
export async function getInsights(days: number = 7): Promise<any> {
  if (process.env.NODE_ENV === 'production') {
    return { error: 'Insights only available in development' };
  }
  
  const insights = {
    // Existing metrics
    topQueries: new Map<string, number>(),
    faqHits: new Map<string, number>(),
    faqMisses: new Map<string, number>(),
    handoffRequests: 0,
    emailsSent: 0,
    totalEvents: 0,
    
    // New dashboard metrics
    sessions: new Set<string>(),
    sessionStarts: 0,
    sessionEnds: 0,
    pageViews: 0,
    chatMessages: 0,
    searchQueries: 0,
    userInteractions: 0,
    hourlyActivity: new Array(24).fill(0),
    dailyActivity: new Map<string, number>(),
    
    // Calculated metrics
    totalSessionTime: 0,
    avgSessionDuration: 0,
    deflectionRate: 0,
    
    dateRange: {
      from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
      to: new Date().toISOString()
    }
  };
  
  try {
    // Read logs from last N days
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      const logPath = path.join(
        ANALYTICS_DIR,
        `${year}-${month}`,
        `${year}-${month}-${day}.log`
      );
      
      if (!fs.existsSync(logPath)) continue;
      
      const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(l => l);
      
      for (const line of lines) {
        try {
          const event = JSON.parse(line) as LogEvent;
          insights.totalEvents++;
          
          // Track sessions
          if (event.sessionId) {
            insights.sessions.add(event.sessionId);
          }
          
          // Track hourly activity
          const hour = event.data.hour || new Date(event.timestamp).getHours();
          insights.hourlyActivity[hour]++;
          
          // Track daily activity
          const day = event.timestamp.split('T')[0];
          insights.dailyActivity.set(day, (insights.dailyActivity.get(day) || 0) + 1);
          
          switch (event.type) {
            case 'FAQ_HIT':
              const faqId = event.data.faqId;
              insights.faqHits.set(faqId, (insights.faqHits.get(faqId) || 0) + 1);
              break;
              
            case 'FAQ_MISS':
              const queryHash = event.data.queryHash;
              insights.faqMisses.set(queryHash, (insights.faqMisses.get(queryHash) || 0) + 1);
              break;
              
            case 'HANDOFF_REQUESTED':
              insights.handoffRequests++;
              break;
              
            case 'EMAIL_SENT':
              insights.emailsSent++;
              break;
              
            case 'SESSION_START':
              insights.sessionStarts++;
              break;
              
            case 'SESSION_END':
              insights.sessionEnds++;
              if (event.data.duration) {
                insights.totalSessionTime += event.data.duration;
              }
              break;
              
            case 'PAGE_VIEW':
              insights.pageViews++;
              break;
              
            case 'CHAT_MESSAGE':
              insights.chatMessages++;
              break;
              
            case 'SEARCH_QUERY':
              insights.searchQueries++;
              break;
              
            case 'USER_INTERACTION':
              insights.userInteractions++;
              break;
          }
        } catch (e) {
          // Skip malformed lines
        }
      }
    }
    
    // Calculate derived metrics
    insights.avgSessionDuration = insights.sessionEnds > 0 
      ? Math.round(insights.totalSessionTime / insights.sessionEnds)
      : 0;
    
    // Deflection rate: (FAQ hits + resolved chats) / (total questions)
    const totalQuestions = insights.chatMessages + insights.faqHits.size + insights.faqMisses.size;
    insights.deflectionRate = totalQuestions > 0 
      ? Math.round(((insights.faqHits.size + (insights.chatMessages - insights.handoffRequests)) / totalQuestions) * 100)
      : 0;
    
    // Convert maps to sorted arrays and format for dashboard
    return {
      // Dashboard metrics matching expected interface
      sessions: insights.sessions.size,
      pageViews: insights.pageViews,
      searches: insights.searchQueries,
      faqViews: Array.from(insights.faqHits.values()).reduce((a, b) => a + b, 0),
      avgSessionDuration: insights.avgSessionDuration,
      chatSessions: insights.chatMessages,
      serviceRequests: insights.handoffRequests,
      deflectionRate: insights.deflectionRate,
      
      // Chart data
      topPages: [
        { page: '/chat', views: insights.chatMessages },
        { page: '/faq', views: Array.from(insights.faqHits.values()).reduce((a, b) => a + b, 0) },
        { page: '/search', views: insights.searchQueries },
        { page: '/handoff', views: insights.handoffRequests }
      ].sort((a, b) => b.views - a.views),
      
      searchTrends: Array.from(insights.dailyActivity.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-7)
        .map(([date, count]) => ({ 
          date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
          searches: count 
        })),
      
      faqCategories: Array.from(insights.faqHits.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => ({ category: `FAQ-${id}`, views: count })),
      
      hourlyActivity: insights.hourlyActivity.map((activity, hour) => ({
        hour: `${hour}:00`,
        activity
      })),
      
      // Detailed insights for analytics
      topFAQHits: Array.from(insights.faqHits.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      topFAQMisses: Array.from(insights.faqMisses.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
        
      dateRange: insights.dateRange,
      totalEvents: insights.totalEvents
    };
    
  } catch (error) {
    console.error('Error generating insights:', error);
    return { error: 'Failed to generate insights' };
  }
}