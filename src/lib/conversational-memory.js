/**
 * Conversational Memory System for CBC-Agent
 * Provides short-term session memory for natural conversation flow
 * 
 * Features:
 * - Session-scoped message history (last 5-10 exchanges)
 * - Guest name detection and storage
 * - Contextual reference generation
 * - Safe PII handling with automatic cleanup
 */

import { safeLog } from './pii-protection.js';

// In-memory session storage (ephemeral, cleared on app restart)
const sessionMemory = new Map();

// Maximum conversation history to maintain
const MAX_CONVERSATION_HISTORY = 10;
const MAX_SESSION_AGE = 2 * 60 * 60 * 1000; // 2 hours

// Clean up old sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, data] of sessionMemory.entries()) {
    if (now - data.lastActiveAt > MAX_SESSION_AGE) {
      sessionMemory.delete(sessionId);
    }
  }
}, 15 * 60 * 1000); // Every 15 minutes

/**
 * Initialize or get session memory
 */
function getSessionMemory(sessionId) {
  if (!sessionMemory.has(sessionId)) {
    sessionMemory.set(sessionId, {
      conversationHistory: [],
      guestName: null,
      lastActiveAt: Date.now(),
      contextTopics: new Set() // Track discussed topics
    });
  }
  
  const memory = sessionMemory.get(sessionId);
  memory.lastActiveAt = Date.now();
  return memory;
}

/**
 * Detect guest name from message content
 * Looks for patterns like "I'm Sarah", "My name is John", "Call me Mike"
 */
export function detectGuestName(message) {
  if (!message || typeof message !== 'string') return null;
  
  const content = message.toLowerCase().trim();
  
  // Name introduction patterns
  const namePatterns = [
    // "I'm [Name]" or "I am [Name]"
    /\b(?:i'm|i am)\s+([a-z][a-z'-]*)\b/i,
    // "My name is [Name]"
    /\bmy name is\s+([a-z][a-z'-]*)\b/i,
    // "Call me [Name]"
    /\bcall me\s+([a-z][a-z'-]*)\b/i,
    // "This is [Name]"
    /\bthis is\s+([a-z][a-z'-]*)\b/i,
    // "[Name] here" 
    /^([a-z][a-z'-]*)\s+here\b/i
  ];
  
  for (const pattern of namePatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Basic validation - exclude common words that aren't names
      const excludeWords = [
        'good', 'fine', 'okay', 'great', 'sure', 'yes', 'no', 'well', 'just',
        'here', 'there', 'going', 'looking', 'wondering', 'asking', 'calling'
      ];
      
      if (!excludeWords.includes(name.toLowerCase()) && name.length >= 2) {
        // Capitalize first letter
        return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
      }
    }
  }
  
  return null;
}

/**
 * Extract topic/context from message for later reference
 */
export function extractMessageContext(message, responseText = '') {
  if (!message) return [];
  
  const content = (message + ' ' + responseText).toLowerCase();
  const contexts = [];
  
  // Topic detection patterns
  const topicPatterns = {
    weather: /\b(weather|temperature|rain|sunny|storm|forecast|climate|hot|cold|warm|cool)\b/,
    dining: /\b(restaurant|dining|food|meal|breakfast|lunch|dinner|menu|eat|hungry|reservation)\b/,
    activities: /\b(activity|activities|do|fun|entertainment|event|beach|tennis|golf|spa|walk|explore)\b/,
    accommodation: /\b(room|cottage|suite|accommodation|stay|bed|bedroom|check.?in)\b/,
    transport: /\b(taxi|transport|airport|transfer|car|ride|direction|uber|getting)\b/,
    time: /\b(time|hour|clock|schedule|when|timing)\b/,
    location: /\b(where|location|place|area|spot|here|there)\b/,
    preferences: /\b(prefer|like|love|enjoy|favorite|favourite|dietary|vegetarian|vegan|allergic)\b/
  };
  
  for (const [topic, pattern] of Object.entries(topicPatterns)) {
    if (pattern.test(content)) {
      contexts.push(topic);
    }
  }
  
  return contexts;
}

/**
 * Add a conversation exchange to session memory
 */
export function addToConversationHistory(sessionId, userMessage, assistantResponse) {
  try {
    const memory = getSessionMemory(sessionId);
    
    // Detect and store guest name if present
    const detectedName = detectGuestName(userMessage);
    if (detectedName && !memory.guestName) {
      memory.guestName = detectedName;
      safeLog('Memory', `Guest name detected and stored for session`);
    }
    
    // Extract context topics
    const contexts = extractMessageContext(userMessage, assistantResponse);
    contexts.forEach(context => memory.contextTopics.add(context));
    
    // Add to conversation history
    const exchange = {
      userMessage: userMessage,
      assistantResponse: assistantResponse,
      timestamp: Date.now(),
      contexts: contexts
    };
    
    memory.conversationHistory.push(exchange);
    
    // Keep only recent history
    if (memory.conversationHistory.length > MAX_CONVERSATION_HISTORY) {
      memory.conversationHistory = memory.conversationHistory.slice(-MAX_CONVERSATION_HISTORY);
    }
    
    // Clean up old context topics (only keep from recent messages)
    if (memory.conversationHistory.length >= 5) {
      // Rebuild context topics from recent messages only
      memory.contextTopics.clear();
      memory.conversationHistory.slice(-5).forEach(exchange => {
        exchange.contexts.forEach(context => memory.contextTopics.add(context));
      });
    }
    
  } catch (error) {
    safeLog('Memory', 'Error adding to conversation history:', error.message);
  }
}

/**
 * Get relevant context for current user message
 */
export function getRelevantContext(sessionId, currentMessage) {
  try {
    const memory = getSessionMemory(sessionId);
    
    if (memory.conversationHistory.length === 0) {
      return {
        guestName: memory.guestName,
        relevantExchanges: [],
        sharedTopics: [],
        hasContext: false
      };
    }
    
    // Extract contexts from current message
    const currentContexts = extractMessageContext(currentMessage);
    
    // Find recent exchanges that share topics with current message
    const relevantExchanges = [];
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    
    for (let i = memory.conversationHistory.length - 1; i >= 0; i--) {
      const exchange = memory.conversationHistory[i];
      
      // Skip if too old
      if (now - exchange.timestamp > maxAge) continue;
      
      // Check for shared contexts
      const sharedContexts = exchange.contexts.filter(ctx => currentContexts.includes(ctx));
      
      if (sharedContexts.length > 0) {
        relevantExchanges.push({
          ...exchange,
          sharedContexts,
          turnsAgo: memory.conversationHistory.length - 1 - i
        });
      }
      
      // Don't go back more than 5 exchanges
      if (relevantExchanges.length >= 3 || i <= memory.conversationHistory.length - 6) {
        break;
      }
    }
    
    return {
      guestName: memory.guestName,
      relevantExchanges,
      sharedTopics: currentContexts,
      hasContext: relevantExchanges.length > 0 || memory.guestName !== null,
      allTopics: Array.from(memory.contextTopics)
    };
    
  } catch (error) {
    safeLog('Memory', 'Error getting relevant context:', error.message);
    return {
      guestName: null,
      relevantExchanges: [],
      sharedTopics: [],
      hasContext: false
    };
  }
}

/**
 * Generate contextual reference text to enhance responses
 */
export function generateContextualReference(sessionId, currentMessage, proposedResponse) {
  try {
    const context = getRelevantContext(sessionId, currentMessage);
    
    if (!context.hasContext) {
      return null; // No enhancement needed
    }
    
    const { guestName, relevantExchanges, sharedTopics } = context;
    
    // Don't add context for very short responses or greetings
    if (proposedResponse.length < 50 || /^(hello|hi|good|welcome)/i.test(proposedResponse)) {
      return null;
    }
    
    // Generate contextual enhancement
    let enhancement = '';
    
    // Use relevant past context
    if (relevantExchanges.length > 0) {
      const mostRelevant = relevantExchanges[0];
      
      // Reference past context naturally
      if (sharedTopics.includes('weather') && mostRelevant.sharedContexts.includes('weather')) {
        if (mostRelevant.turnsAgo <= 2) {
          enhancement = 'Since we were just discussing the weather, ';
        }
      } else if (sharedTopics.includes('dining') && mostRelevant.sharedContexts.includes('dining')) {
        if (mostRelevant.turnsAgo <= 3) {
          enhancement = 'Regarding your dining question, ';
        }
      } else if (sharedTopics.includes('activities') && mostRelevant.sharedContexts.includes('activities')) {
        if (mostRelevant.turnsAgo <= 2) {
          enhancement = 'For activities, ';
        }
      }
    }
    
    return {
      guestName: guestName,
      contextualPrefix: enhancement,
      shouldUseName: guestName && Math.random() < 0.3 // Use name sparingly (30% chance)
    };
    
  } catch (error) {
    safeLog('Memory', 'Error generating contextual reference:', error.message);
    return null;
  }
}

/**
 * Clear session memory (for testing or manual cleanup)
 */
export function clearSessionMemory(sessionId) {
  if (sessionId) {
    sessionMemory.delete(sessionId);
  } else {
    sessionMemory.clear();
  }
}

/**
 * Get session memory stats (for debugging)
 */
export function getMemoryStats(sessionId) {
  if (!sessionId) {
    return {
      totalSessions: sessionMemory.size,
      sessions: Array.from(sessionMemory.keys())
    };
  }
  
  const memory = sessionMemory.get(sessionId);
  if (!memory) return null;
  
  return {
    conversationLength: memory.conversationHistory.length,
    guestName: memory.guestName ? '***' : null, // Mask for privacy
    topics: Array.from(memory.contextTopics),
    lastActive: new Date(memory.lastActiveAt).toISOString()
  };
}