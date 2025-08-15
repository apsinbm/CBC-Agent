/**
 * Knowledge Base Topic Router
 * Intelligently selects relevant KB sections based on query topics
 * Part of KB restructuring for improved knowledge retention
 */

const { safeLog } = require('./pii-protection.js');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Cache for kb_index.yml
let kbIndexCache = null;
let kbIndexCacheTime = 0;
const KB_INDEX_CACHE_TTL = 60000; // 1 minute cache

/**
 * Load and parse kb_index.yml
 */
function loadKBIndex() {
  const now = Date.now();
  
  // Use cache if still fresh
  if (kbIndexCache && (now - kbIndexCacheTime) < KB_INDEX_CACHE_TTL) {
    return kbIndexCache;
  }
  
  try {
    const indexPath = path.join(process.cwd(), 'data', 'kb_index.yml');
    const content = fs.readFileSync(indexPath, 'utf-8');
    kbIndexCache = yaml.load(content);
    kbIndexCacheTime = now;
    return kbIndexCache;
  } catch (error) {
    safeLog('KB Router', 'Error loading kb_index.yml:', error.message);
    return null;
  }
}

/**
 * Detect the primary topic(s) from a user query
 */
function detectKBTopic(query) {
  if (!query || typeof query !== 'string') {
    return null;
  }
  
  const queryLower = query.toLowerCase();
  
  // Exclusion patterns - queries that should bypass KB topic detection
  const exclusionPatterns = [
    // Time queries
    /^what\s+time\s+is\s+it\??$/,
    /^what\s+is\s+the\s+time\??$/,
    /^what.?s?\s+the\s+time\??$/,
    /^time\??$/,
    /^current\s+time\??$/,
    
    // Weather queries  
    /^what.?s?\s+the\s+weather\??$/,
    /^weather\??$/,
    /^how.?s?\s+the\s+weather\??$/,
    /^weather\s+today\??$/,
    /^current\s+weather\??$/,
    /^temperature\??$/,
    
    // News queries
    /^news\??$/,
    /^what.?s?\s+the\s+news\??$/,
    /^latest\s+news\??$/,
    /^current\s+news\??$/,
    
    // Simple greetings (should use greeting system)
    /^(hi|hello|hey|good\s+morning|good\s+afternoon|good\s+evening)!?\??$/
  ];
  
  // Check if query matches any exclusion pattern
  for (const pattern of exclusionPatterns) {
    if (pattern.test(queryLower)) {
      safeLog('KB Router', `Query excluded from topic detection: "${query}"`);
      return null;
    }
  }
  const detectedTopics = [];
  
  // Accommodations
  if (queryLower.includes('room') || queryLower.includes('cottage') || 
      queryLower.includes('suite') || queryLower.includes('stay') ||
      queryLower.includes('accommodation') || queryLower.includes('check-in') ||
      queryLower.includes('check-out') || queryLower.includes('reservation')) {
    detectedTopics.push('accommodations');
  }
  
  // Dining
  if (queryLower.includes('dining') || queryLower.includes('eat') || 
      queryLower.includes('restaurant') || queryLower.includes('menu') ||
      queryLower.includes('food') || queryLower.includes('meal') ||
      queryLower.includes('breakfast') || queryLower.includes('lunch') ||
      queryLower.includes('dinner') || queryLower.includes('coral room') ||
      queryLower.includes('beach terrace') || queryLower.includes('frozen hut')) {
    detectedTopics.push('dining');
  }
  
  // Spa
  if (queryLower.includes('spa') || queryLower.includes('massage') || 
      queryLower.includes('wellness') || queryLower.includes('treatment') ||
      queryLower.includes('facial') || queryLower.includes('body wrap') ||
      queryLower.includes('salon')) {
    detectedTopics.push('spa');
  }
  
  // Tennis
  if (queryLower.includes('tennis') || queryLower.includes('court') ||
      queryLower.includes('har-tru') || queryLower.includes('clay court') ||
      queryLower.includes('racquet') || queryLower.includes('racket')) {
    detectedTopics.push('tennis');
  }
  
  // Pickleball
  if (queryLower.includes('pickle')) {
    detectedTopics.push('pickleball');
  }
  
  // Squash
  if (queryLower.includes('squash')) {
    detectedTopics.push('squash');
  }
  
  // Activities
  if (queryLower.includes('beach') || queryLower.includes('swim') || 
      queryLower.includes('water') || queryLower.includes('snorkel') ||
      queryLower.includes('garden') || queryLower.includes('tour') ||
      queryLower.includes('fitness') || queryLower.includes('gym') ||
      queryLower.includes('yoga') || queryLower.includes('croquet') ||
      queryLower.includes('putting') || queryLower.includes('golf') ||
      queryLower.includes('shop') || queryLower.includes('boutique')) {
    detectedTopics.push('activities');
  }
  
  // Weddings
  if (queryLower.includes('wedding') || queryLower.includes('ceremony') ||
      queryLower.includes('reception') || queryLower.includes('bride') ||
      queryLower.includes('valerie mesto')) {
    detectedTopics.push('weddings');
  }
  
  // Venues/Events
  if (queryLower.includes('event') || queryLower.includes('venue') ||
      queryLower.includes('meeting') || queryLower.includes('corporate') ||
      queryLower.includes('celebration') || queryLower.includes('party') ||
      queryLower.includes('private dining') || queryLower.includes('the cave')) {
    detectedTopics.push('venues');
  }
  
  // Bermuda Basics (excluding simple weather queries)
  if (queryLower.includes('bermuda') || queryLower.includes('location') ||
      queryLower.includes('transport') || queryLower.includes('taxi') ||
      queryLower.includes('airport') || queryLower.includes('heritage') ||
      queryLower.includes('history')) {
    detectedTopics.push('bermuda-basics');
  }
  
  // Weather/climate info (only for detailed/contextual queries)
  if ((queryLower.includes('weather') || queryLower.includes('climate')) &&
      (queryLower.includes('bermuda') || queryLower.includes('season') || 
       queryLower.includes('year') || queryLower.includes('month') ||
       queryLower.includes('best time') || queryLower.includes('when to'))) {
    detectedTopics.push('bermuda-basics');
  }
  
  // Policies & Hours (excluding simple time queries)
  if (queryLower.includes('open') || queryLower.includes('close') ||
      queryLower.includes('policy') || queryLower.includes('cancel') ||
      queryLower.includes('payment') || queryLower.includes('fee') ||
      queryLower.includes('rate') || queryLower.includes('guest card') ||
      queryLower.includes('member')) {
    detectedTopics.push('policies-hours');
  }
  
  // Hours info (only for facility/service hours, not time queries)
  if (queryLower.includes('hour') && 
      (queryLower.includes('open') || queryLower.includes('close') ||
       queryLower.includes('spa') || queryLower.includes('tennis') ||
       queryLower.includes('dining') || queryLower.includes('shop') ||
       queryLower.includes('front desk') || queryLower.includes('service'))) {
    detectedTopics.push('policies-hours');
  }
  
  // Contact
  if (queryLower.includes('contact') || queryLower.includes('phone') ||
      queryLower.includes('email') || queryLower.includes('call') ||
      queryLower.includes('manager') || queryLower.includes('front desk')) {
    detectedTopics.push('contact');
  }
  
  // Return primary topic or null if ambiguous
  if (detectedTopics.length === 1) {
    return detectedTopics[0];
  } else if (detectedTopics.length > 1) {
    // Priority order for multiple matches
    const priorityOrder = [
      'accommodations', 'dining', 'spa', 'tennis', 'weddings',
      'activities', 'venues', 'policies-hours', 'contact', 'bermuda-basics'
    ];
    
    for (const topic of priorityOrder) {
      if (detectedTopics.includes(topic)) {
        return topic;
      }
    }
  }
  
  return null; // No clear topic detected
}

/**
 * Get relevant KB sections for a detected topic
 */
function getTopicSections(topic) {
  const kbIndex = loadKBIndex();
  
  if (!kbIndex || !kbIndex.topics || !topic) {
    return [];
  }
  
  const topicData = kbIndex.topics[topic];
  if (!topicData || !topicData.sections) {
    return [];
  }
  
  return topicData.sections;
}

/**
 * Load relevant KB content based on detected topic
 */
function loadRelevantKBContent(query) {
  try {
    // Always load canonical facts
    const sections = [];
    const canonicalPath = path.join(process.cwd(), 'data', 'canonical_facts.md');
    
    try {
      const canonicalContent = fs.readFileSync(canonicalPath, 'utf-8');
      sections.push({
        source: 'canonical_facts',
        content: canonicalContent
      });
    } catch (error) {
      safeLog('KB Router', 'Error loading canonical facts:', error.message);
    }
    
    // Detect topic and load relevant sections
    const topic = detectKBTopic(query);
    
    if (topic) {
      const topicSections = getTopicSections(topic);
      
      // Load up to 3 most relevant sections
      for (const section of topicSections.slice(0, 3)) {
        try {
          // Parse source reference (e.g., "cbc_dining.md#venues")
          const [filename] = section.source.split('#');
          const filePath = path.join(process.cwd(), 'data', filename);
          
          // Check if we've already loaded this file
          const alreadyLoaded = sections.some(s => s.source.includes(filename));
          if (!alreadyLoaded) {
            const content = fs.readFileSync(filePath, 'utf-8');
            sections.push({
              source: section.source,
              topic: topic,
              sectionId: section.id,
              content: content
            });
          }
        } catch (error) {
          safeLog('KB Router', `Error loading section ${section.id}:`, error.message);
        }
      }
      
      safeLog('KB Router', `Topic detected: ${topic}, loaded ${sections.length} sections`);
    } else {
      safeLog('KB Router', 'No clear topic detected, using canonical facts only');
    }
    
    return sections;
    
  } catch (error) {
    safeLog('KB Router', 'Error in loadRelevantKBContent:', error.message);
    return [];
  }
}

/**
 * Generate clarifying question for ambiguous queries
 */
function getClarifyingQuestion(query) {
  const queryLower = query.toLowerCase();
  
  // Check for ambiguous terms
  if (queryLower.includes('treatment')) {
    return "Are you interested in spa treatments or medical services?";
  }
  
  if (queryLower.includes('book')) {
    return "Would you like to book accommodations, dining, tennis courts, or spa services?";
  }
  
  if (queryLower.includes('service')) {
    return "Which service are you interested in - room service, beach service, or spa services?";
  }
  
  if (queryLower.includes('hour')) {
    return "Which hours would you like to know - dining, spa, tennis shop, or general club hours?";
  }
  
  return null;
}

/**
 * Get debug trace of which KB sections were loaded
 */
function getKBTrace(sections) {
  if (!sections || sections.length === 0) {
    return "kb:none";
  }
  
  const traces = sections.map(s => {
    if (s.source === 'canonical_facts') {
      return 'canonical';
    }
    return s.sectionId || s.source;
  });
  
  return `kb:${traces.join(',')}`;
}

// Export all functions for CommonJS
module.exports = {
  detectKBTopic,
  getTopicSections,
  loadRelevantKBContent,
  getClarifyingQuestion,
  getKBTrace
};