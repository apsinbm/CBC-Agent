/**
 * Generate Test Analytics Data
 * 
 * Creates sample analytics events to test the dashboard with real data structure.
 * This simulates user activity over the past few days.
 */

import { logEvent } from '../src/lib/analytics/logEvent.js';
import { randomUUID } from 'crypto';

const SAMPLE_QUERIES = [
  'What time is the restaurant open?',
  'How do I make a reservation?',
  'What activities are available?', 
  'What is the weather like?',
  'Where is the spa located?',
  'Can I play tennis?',
  'What are the dining options?',
  'How do I book a cottage?',
  'What time is checkout?',
  'Is there wifi?'
];

const SAMPLE_FAQ_IDS = [
  'dining-hours',
  'reservations',
  'activities',
  'weather',
  'spa-services',
  'tennis-courts',
  'dining-options',
  'cottages',
  'checkout',
  'wifi'
];

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomPastTime(daysAgo = 7) {
  const now = Date.now();
  const maxAge = daysAgo * 24 * 60 * 60 * 1000; // days in ms
  const randomAge = Math.random() * maxAge;
  return new Date(now - randomAge);
}

async function generateTestData() {
  console.log('🔄 Generating test analytics data...');
  
  // Generate sessions and events over the past 7 days
  const numSessions = randomInt(20, 50);
  
  for (let i = 0; i < numSessions; i++) {
    const sessionId = randomUUID();
    const sessionStart = getRandomPastTime(7);
    const sessionDuration = randomInt(60, 1800); // 1-30 minutes
    const sessionEnd = new Date(sessionStart.getTime() + sessionDuration * 1000);
    
    // Mock timestamp for consistent testing
    const originalDate = Date;
    global.Date = class extends Date {
      constructor(...args) {
        if (args.length === 0) {
          super(sessionStart);
        } else {
          super(...args);
        }
      }
      static now() {
        return sessionStart.getTime();
      }
    };
    
    // Session start
    await logEvent('SESSION_START', {
      userAgent: 'web',
      platform: 'chat'
    }, { sessionId });
    
    // Page view
    await logEvent('PAGE_VIEW', {
      page: '/chat',
      referrer: '/'
    }, { sessionId });
    
    // Random number of interactions
    const numInteractions = randomInt(1, 8);
    
    for (let j = 0; j < numInteractions; j++) {
      const interactionTime = new Date(sessionStart.getTime() + (j * (sessionDuration * 1000 / numInteractions)));
      
      global.Date = class extends Date {
        constructor(...args) {
          if (args.length === 0) {
            super(interactionTime);
          } else {
            super(...args);
          }
        }
        static now() {
          return interactionTime.getTime();
        }
      };
      
      // Chat message
      await logEvent('CHAT_MESSAGE', {
        messageCount: j + 1
      }, { sessionId });
      
      // Sometimes generate other events
      if (Math.random() < 0.3) {
        // Search query
        await logEvent('SEARCH_QUERY', {
          query: randomChoice(SAMPLE_QUERIES),
          resultCount: randomInt(0, 5),
          hasResults: true
        }, { sessionId });
      }
      
      if (Math.random() < 0.4) {
        // FAQ hit or miss
        if (Math.random() < 0.7) {
          await logEvent('FAQ_HIT', {
            faqId: randomChoice(SAMPLE_FAQ_IDS),
            score: Math.random() * 0.5 + 0.5 // High confidence
          }, { sessionId });
        } else {
          await logEvent('FAQ_MISS', {
            topScore: Math.random() * 0.5, // Low confidence
            queryHash: 'test_hash_' + randomInt(1, 100)
          }, { sessionId });
        }
      }
      
      if (Math.random() < 0.1) {
        // Handoff request
        await logEvent('HANDOFF_REQUESTED', {
          reason: 'complex_query'
        }, { sessionId });
      }
      
      // User interaction
      await logEvent('USER_INTERACTION', {
        action: randomChoice(['click', 'scroll', 'focus', 'input']),
        element: randomChoice(['chat-input', 'send-button', 'message', 'link'])
      }, { sessionId });
    }
    
    // Session end
    global.Date = class extends Date {
      constructor(...args) {
        if (args.length === 0) {
          super(sessionEnd);
        } else {
          super(...args);
        }
      }
      static now() {
        return sessionEnd.getTime();
      }
    };
    
    await logEvent('SESSION_END', {
      duration: sessionDuration,
      pageViews: 1,
      interactions: numInteractions
    }, { sessionId });
    
    // Restore original Date
    global.Date = originalDate;
  }
  
  // Generate a few email events
  for (let i = 0; i < randomInt(2, 8); i++) {
    const emailTime = getRandomPastTime(7);
    global.Date = class extends Date {
      constructor(...args) {
        if (args.length === 0) {
          super(emailTime);
        } else {
          super(...args);
        }
      }
      static now() {
        return emailTime.getTime();
      }
    };
    
    await logEvent('EMAIL_SENT', {
      type: 'handoff_notification',
      toMasked: '***@coralbeach.bm'
    }, { sessionId: randomUUID() });
    
    global.Date = originalDate;
  }
  
  console.log(`✅ Generated ${numSessions} test sessions with realistic analytics data`);
  console.log('📊 You can now view the dashboard with real data!');
  console.log('🔗 Dashboard API: http://localhost:3000/api/dashboard/analytics');
  console.log('🔗 Insights API: http://localhost:3000/api/admin-insights/insights');
}

// Run if called directly
if (process.argv[1].endsWith('generate-test-analytics.js')) {
  generateTestData().catch(console.error);
}

export { generateTestData };