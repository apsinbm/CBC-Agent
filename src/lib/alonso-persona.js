/**
 * Alonso Parrot Persona - Lightweight Snippet Rotation System
 * 
 * DEVNOTE: Session-scoped personality system with caps and cooldowns
 * 
 * Caps & Limits:
 * - Max 2 mentions per session (3 if >25 messages)
 * - 3-turn cooldown between mentions
 * - 20% base probability (60% for first greeting, 0% for critical/opt-out)
 * - No immediate snippet repeats
 * - 30min idle reset allows new greeting
 * 
 * Adding Snippets:
 * - Add to SNIPPET_POOL below, organized by category
 * - Update SNIPPET_CATEGORIES to include new categories
 * - Ensure each snippet has: id, text, category, isGreeting flag
 */

// In-memory session storage (simple Map for lightweight implementation)
const sessionState = new Map();

// Snippet pool organized by category
const SNIPPET_POOL = [
  // General greetings (use sparingly)
  { id: 1, text: "I'm Alonso, the Club's resident Amazon parrot—here to help and say hello.", category: 'greeting', isGreeting: true },
  { id: 2, text: "If you hear a friendly squawk from the lounge later, that's probably me.", category: 'greeting', isGreeting: true },
  { id: 3, text: "You'll spot me near the Main Lounge windows, keeping an eye on the ocean—and our guests.", category: 'greeting', isGreeting: true },
  
  // Lounge/ambience moments
  { id: 4, text: "The view from the lounge is perfect—I like to sit where the breeze ruffles my feathers.", category: 'lounge', isGreeting: false },
  { id: 5, text: "Some guests come for the beach, others for a cocktail—I like to think a few come to say hi to me.", category: 'lounge', isGreeting: false },
  
  // Light humor and warmth
  { id: 6, text: "I've been here longer than some of the furniture—happy to help you settle in.", category: 'humor', isGreeting: false },
  { id: 7, text: "If a flash of green and gold catches your eye, that's just me doing a style check.", category: 'humor', isGreeting: false },
  { id: 8, text: "I promise only helpful squawks and timely answers today.", category: 'humor', isGreeting: false },
  
  // Additional variants
  { id: 9, text: "Between you and me, I have the best perch on the island.", category: 'humor', isGreeting: false },
  { id: 10, text: "I may be a parrot, but I never repeat gossip—only helpful information.", category: 'humor', isGreeting: false },
  { id: 11, text: "The staff here takes good care of me, so I like to return the favor by helping guests.", category: 'humor', isGreeting: false },
  { id: 12, text: "My favorite time is sunset from the lounge—the colors almost match my plumage.", category: 'lounge', isGreeting: false },
  
  // Follow-up snippets
  { id: 13, text: "Did that answer everything you wanted to know, or would you like me to elaborate?", category: 'followup', isGreeting: false },
  { id: 14, text: "Is there anything else about this I can help clarify?", category: 'followup', isGreeting: false },
  { id: 15, text: "Does that cover what you were looking for, or shall I dig a bit deeper?", category: 'followup', isGreeting: false },
  { id: 16, text: "Was that helpful, or would you like more details about any part?", category: 'followup', isGreeting: false },
  { id: 17, text: "I hope that helps—let me know if you'd like me to expand on anything.", category: 'followup', isGreeting: false },
  { id: 18, text: "Would you like suggestions for today or tomorrow as well?", category: 'followup_time', isGreeting: false },
  { id: 19, text: "Shall I suggest options for both this evening and tomorrow?", category: 'followup_time', isGreeting: false },
];

const SNIPPET_CATEGORIES = {
  GREETING: 'greeting',
  LOUNGE: 'lounge', 
  HUMOR: 'humor',
  BIRDS: 'birds', // Future category for animal/bird mentions
  IDENTITY: 'identity', // Future category for identity questions
  FOLLOWUP: 'followup', // Follow-up questions after answering
  FOLLOWUP_TIME: 'followup_time' // Time-aware follow-up suggestions
};

// Clean up old session data (runs every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const CLEANUP_THRESHOLD = 60 * 60 * 1000; // 1 hour
  
  for (const [sessionId, data] of sessionState.entries()) {
    if (now - data.lastActiveAt > CLEANUP_THRESHOLD) {
      sessionState.delete(sessionId);
    }
  }
}, 5 * 60 * 1000); // 5 minutes

/**
 * Get session state for a given session ID
 */
function getSessionState(sessionId) {
  if (!sessionState.has(sessionId)) {
    sessionState.set(sessionId, {
      lastSnippetId: null,
      lastMentionTurn: -1,
      mentionCount: 0,
      optOut: false,
      lastActiveAt: Date.now()
    });
  }
  
  const state = sessionState.get(sessionId);
  state.lastActiveAt = Date.now(); // Update activity timestamp
  return state;
}

/**
 * Check if user has opted out of persona
 */
function detectOptOut(userMessage) {
  if (!userMessage) return false;
  
  const optOutPhrases = [
    'no jokes',
    'stop the parrot thing', 
    'just the facts',
    'please be direct',
    'don\'t do the parrot thing',
    'be direct only',
    'no personality'
  ];
  
  const message = userMessage.toLowerCase();
  return optOutPhrases.some(phrase => message.includes(phrase));
}

/**
 * Check if user wants to re-enable persona
 */
function detectOptIn(userMessage) {
  if (!userMessage) return false;
  
  const optInPhrases = [
    'it\'s okay to be chatty again',
    'say hi, alonso',
    'you can be funny again',
    'be yourself alonso'
  ];
  
  const message = userMessage.toLowerCase();
  return optInPhrases.some(phrase => message.includes(phrase));
}

/**
 * Detect trigger conditions from user message
 */
function detectTriggers(userMessage, context = {}) {
  if (!userMessage) return [];
  
  const message = userMessage.toLowerCase();
  const triggers = [];
  
  // Identity trigger
  if (message.includes('who are you') || 
      message.includes('are you a person') || 
      message.includes('alonso') ||
      message.includes('what are you')) {
    triggers.push('identity');
  }
  
  // Lounge/ambience trigger
  if (message.includes('main lounge') ||
      message.includes('gardens') ||
      message.includes('view') ||
      message.includes('beach terrace') ||
      message.includes('club atmosphere') ||
      message.includes('terrace') ||
      message.includes('lounge')) {
    triggers.push('lounge');
  }
  
  // Animals/birds trigger
  if (message.includes('bird') ||
      message.includes('parrot') ||
      message.includes('animal') ||
      message.includes('pet') ||
      message.includes('feather')) {
    triggers.push('birds');
  }
  
  // Light humor trigger (casual conversation)
  if (!context.isCriticalTask && 
      (message.includes('hello') ||
       message.includes('hi ') ||
       message.includes('how are you') ||
       message.length < 50)) {
    triggers.push('humor');
  }
  
  // Follow-up trigger (after providing substantial information)
  if (!context.isCriticalTask && 
      !context.isFirstTurn && 
      context.responseLength && context.responseLength > 100 &&
      !context.wasGreeting) {
    
    // Check if response mentions time-sensitive topics
    const responseText = context.responseText || '';
    const hasTimeRelevance = (
      responseText.includes('weather') ||
      responseText.includes('dining') ||
      responseText.includes('activities') ||
      responseText.includes('evening') ||
      responseText.includes('today') ||
      responseText.includes('hours') ||
      responseText.includes('schedule')
    );
    
    if (hasTimeRelevance) {
      triggers.push('followup_time');
    } else {
      triggers.push('followup');
    }
  }
  
  return triggers;
}

/**
 * Check if this is a critical task that should not have personality
 */
function isCriticalTask(context = {}) {
  return context.isCriticalTask || 
         context.isFormSubmission || 
         context.isPayment ||
         context.isSensitiveDetail;
}

/**
 * Get appropriate snippets for triggers and context
 */
function getSnippetsForTriggers(triggers, context = {}) {
  // If it's a greeting context, prioritize greeting snippets
  if (context.isFirstTurn || context.isIdleReturn) {
    return SNIPPET_POOL.filter(s => s.isGreeting);
  }
  
  // Match snippets to triggers
  let candidates = [];
  
  for (const trigger of triggers) {
    switch (trigger) {
      case 'identity':
      case 'greeting':
        candidates.push(...SNIPPET_POOL.filter(s => s.category === 'greeting'));
        break;
      case 'lounge':
        candidates.push(...SNIPPET_POOL.filter(s => s.category === 'lounge'));
        break;
      case 'humor':
      case 'birds':
        candidates.push(...SNIPPET_POOL.filter(s => s.category === 'humor'));
        break;
      case 'followup':
        candidates.push(...SNIPPET_POOL.filter(s => s.category === 'followup'));
        break;
      case 'followup_time':
        candidates.push(...SNIPPET_POOL.filter(s => s.category === 'followup_time'));
        break;
    }
  }
  
  // Remove duplicates by id
  const seen = new Set();
  return candidates.filter(snippet => {
    if (seen.has(snippet.id)) return false;
    seen.add(snippet.id);
    return true;
  });
}

/**
 * Main function: Maybe get an Alonso snippet for the current context
 * 
 * @param {string} sessionId - Session identifier
 * @param {Object} context - Context information
 * @returns {string|null} - Snippet text to append, or null
 */
export function maybeGetAlonsoSnippet(sessionId, context = {}) {
  try {
    // Get session state
    const state = getSessionState(sessionId);
    
    // Check for opt-out/opt-in
    if (context.userMessage) {
      if (detectOptOut(context.userMessage)) {
        state.optOut = true;
        return null;
      }
      if (detectOptIn(context.userMessage)) {
        state.optOut = false;
      }
    }
    
    // If opted out, return nothing
    if (state.optOut) {
      return null;
    }
    
    // If critical task, return nothing
    if (isCriticalTask(context)) {
      return null;
    }
    
    // Check cooldown (at least 3 turns between mentions)
    const turnIndex = context.turnIndex || 0;
    if (turnIndex - state.lastMentionTurn < 3) {
      return null;
    }
    
    // Check frequency cap
    const messageCount = context.messageCount || 0;
    const maxMentions = messageCount > 25 ? 3 : 2;
    if (state.mentionCount >= maxMentions) {
      return null;
    }
    
    // Check for idle reset (>30 min allows new greeting)
    const now = Date.now();
    const isIdleReturn = (now - state.lastActiveAt) > (30 * 60 * 1000);
    
    // Detect triggers
    const triggers = detectTriggers(context.userMessage, context);
    
    // Add greeting trigger for first turn or idle return
    if (context.isFirstTurn || isIdleReturn) {
      triggers.push('greeting');
    }
    
    // If no triggers, return nothing
    if (triggers.length === 0) {
      return null;
    }
    
    // Calculate probability
    let probability = 0.2; // 20% base
    if (context.isFirstTurn && state.mentionCount === 0) {
      probability = 0.6; // 60% for first greeting
    } else if (isIdleReturn) {
      probability = 0.4; // 40% for idle return
    }
    
    // Roll the dice
    if (Math.random() > probability) {
      return null;
    }
    
    // Get candidate snippets
    const candidates = getSnippetsForTriggers(triggers, {
      ...context,
      isFirstTurn: context.isFirstTurn,
      isIdleReturn
    });
    
    if (candidates.length === 0) {
      return null;
    }
    
    // Filter out the last used snippet to avoid immediate repeats
    const availableSnippets = candidates.filter(s => s.id !== state.lastSnippetId);
    const finalCandidates = availableSnippets.length > 0 ? availableSnippets : candidates;
    
    // Pick random snippet
    const selectedSnippet = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
    
    // Update state
    state.lastSnippetId = selectedSnippet.id;
    state.lastMentionTurn = turnIndex;
    state.mentionCount++;
    
    return selectedSnippet.text;
    
  } catch (error) {
    console.error('[Alonso] Error in snippet selection:', error);
    return null; // Fail gracefully
  }
}

/**
 * Reset session state (for testing or manual reset)
 */
export function resetAlonsoSession(sessionId) {
  sessionState.delete(sessionId);
}

/**
 * Get session stats (for debugging)
 */
export function getAlonsoSessionStats(sessionId) {
  return sessionState.get(sessionId) || null;
}