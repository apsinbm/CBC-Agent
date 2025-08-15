/**
 * Enhanced Alonso Features - Weather-aware suggestions, follow-ups, and persona
 * Modular enhancements that don't break existing functionality
 */

import { safeLog } from './pii-protection.js';

// Follow-up question library organized by topic
const FOLLOW_UP_LIBRARY = {
  dining: [
    "Would you like me to help you make a reservation?",
    "Would you like to see tonight's menu?",
    "Shall I tell you about our signature dishes?",
    "Would you like dining recommendations for later today?"
  ],
  activities: [
    "Would you like suggestions for things to do this evening?",
    "Shall I share tomorrow's activity schedule?",
    "Would you like to know about our upcoming events?",
    "Should I recommend some peaceful spots around the grounds?"
  ],
  accommodation: [
    "Would you like me to tell you about our available rooms or suites?",
    "Do you need help arranging in-room amenities?",
    "Should I share details about cottage amenities?",
    "Would you like information about our room service options?"
  ],
  transport: [
    "Would you like me to arrange a taxi or car service for you?",
    "Do you need directions to your destination?",
    "Should I help coordinate airport transfers?",
    "Would you like information about getting around the island?"
  ],
  spa: [
    "Would you like me to check availability for spa treatments today?",
    "Should I tell you about our most popular therapies?",
    "Would you like to know about our wellness packages?",
    "Shall I share information about our fitness facilities?"
  ],
  sports: [
    "Would you like to book a court for tennis or pickleball?",
    "Shall I share the upcoming sports schedule?",
    "Would you like information about our golf arrangements?",
    "Should I tell you about our water sports options?"
  ],
  weather: [
    "Would you like me to recommend activities for this kind of weather?",
    "Shall I check tomorrow's forecast for you?",
    "Would you like indoor alternatives if the weather changes?",
    "Should I suggest some covered areas to enjoy?"
  ],
  general: [
    "Would you like to know what's happening at the Club later today?",
    "Do you need any assistance with your plans?",
    "Should I tell you about our other amenities?",
    "Would you like recommendations for this time of day?"
  ]
};

// Parrot persona snippets (used sparingly)
const PARROT_SNIPPETS = [
  "Would you like me to tell you about tonight's music? I might even sing along!",
  "The gardens are lovely today — I just had a little fly-around earlier.",
  "From my perch in the Main Lounge, I see guests enjoying themselves all day long.",
  "I've been welcoming guests here for years — it never gets old!",
  "The view from up here is spectacular — you should see what I see!",
  "I love chatting with our wonderful guests — it's the best part of my day!"
];

/**
 * Check if current weather/time conditions are suitable for outdoor activities
 */
export function isOutdoorWeatherSuitable(weatherData, timeData) {
  try {
    // Safety check - if we don't have data, assume unsuitable
    if (!weatherData || !weatherData.success || !timeData || !timeData.success) {
      return {
        suitable: false,
        reason: 'data_unavailable',
        safeToRecommend: false
      };
    }

    const temp = weatherData.temperature || weatherData.temperatureC;
    const condition = (weatherData.description || '').toLowerCase();
    
    // Temperature check (too cold)
    if (temp < 18) {
      return {
        suitable: false,
        reason: 'too_cold',
        safeToRecommend: true,
        message: `It's quite cool out at ${temp}°C — perhaps some indoor activities would be more comfortable?`
      };
    }

    // Weather condition checks
    const badWeatherPatterns = [
      /rain/i, /storm/i, /thunder/i, /shower/i, /drizzle/i,
      /heavy/i, /severe/i, /extreme/i
    ];
    
    if (badWeatherPatterns.some(pattern => pattern.test(condition))) {
      return {
        suitable: false,
        reason: 'bad_weather',
        safeToRecommend: true,
        message: `With ${condition} conditions, indoor activities might be more enjoyable right now.`
      };
    }

    // Wind check (if available)
    if (weatherData.windSpeed && weatherData.windSpeed > 25) {
      return {
        suitable: false,
        reason: 'too_windy',
        safeToRecommend: true,
        message: `It's quite breezy today — some sheltered activities might be preferable.`
      };
    }

    // Basic daylight check (simplified - between 6 AM and 8 PM)
    if (timeData.time) {
      const timeStr = timeData.time.toLowerCase();
      const isPM = timeStr.includes('pm');
      const hour = parseInt(timeStr.split(':')[0]);
      
      let hour24 = hour;
      if (isPM && hour !== 12) hour24 += 12;
      if (!isPM && hour === 12) hour24 = 0;
      
      if (hour24 < 6 || hour24 > 20) {
        return {
          suitable: false,
          reason: 'nighttime',
          safeToRecommend: true,
          message: `Since it's evening, you might enjoy our indoor venues or covered terraces.`
        };
      }
    }

    return {
      suitable: true,
      reason: 'conditions_good',
      safeToRecommend: true
    };

  } catch (error) {
    safeLog('Weather Check', 'Error checking outdoor suitability:', error.message);
    return {
      suitable: false,
      reason: 'error',
      safeToRecommend: false
    };
  }
}

/**
 * Detect the main topic from a user message for follow-up selection
 */
export function detectMessageTopic(message) {
  const content = message.toLowerCase();
  
  // Topic detection patterns (in priority order)
  const topics = [
    { name: 'dining', patterns: [/restaurant|dining|food|meal|breakfast|lunch|dinner|menu|coral room|beach terrace|frozen hut/] },
    { name: 'spa', patterns: [/spa|massage|wellness|treatment|therapy|fitness|relaxation/] },
    { name: 'sports', patterns: [/tennis|pickleball|golf|court|sports|game|play|racquet/] },
    { name: 'accommodation', patterns: [/room|cottage|suite|accommodation|stay|bed|bedroom|check.?in/] },
    { name: 'transport', patterns: [/taxi|transport|airport|transfer|car|ride|direction|uber/] },
    { name: 'activities', patterns: [/activity|activities|do|fun|entertainment|event|beach|garden|walk/] },
    { name: 'weather', patterns: [/weather|temperature|rain|sunny|wind|forecast|climate/] },
    { name: 'general', patterns: [/.*/] } // Catch-all
  ];
  
  for (const topic of topics) {
    if (topic.patterns.some(pattern => pattern.test(content))) {
      return topic.name;
    }
  }
  
  return 'general';
}

/**
 * Generate a relevant follow-up question (avoiding recent ones)
 */
export function generateFollowUp(topic, recentFollowUps = []) {
  try {
    const topicFollowUps = FOLLOW_UP_LIBRARY[topic] || FOLLOW_UP_LIBRARY.general;
    
    // Filter out recently used follow-ups
    const availableFollowUps = topicFollowUps.filter(
      followUp => !recentFollowUps.includes(followUp)
    );
    
    // If we've used all follow-ups for this topic, reset and use any
    const optionsToUse = availableFollowUps.length > 0 ? availableFollowUps : topicFollowUps;
    
    // Return random selection
    const randomIndex = Math.floor(Math.random() * optionsToUse.length);
    return optionsToUse[randomIndex];
    
  } catch (error) {
    safeLog('Follow-up', 'Error generating follow-up:', error.message);
    return "Is there anything else I can help you with?";
  }
}

/**
 * Get a parrot personality snippet (used occasionally)
 */
export function getParrotSnippet(context = {}) {
  try {
    // Only show parrot snippet occasionally (30% chance)
    if (Math.random() > 0.3) {
      return null;
    }
    
    // Don't use parrot snippets for critical/formal interactions
    if (context.isCriticalTask || context.isFormSubmission) {
      return null;
    }
    
    // Select random parrot snippet
    const randomIndex = Math.floor(Math.random() * PARROT_SNIPPETS.length);
    return PARROT_SNIPPETS[randomIndex];
    
  } catch (error) {
    safeLog('Parrot Snippet', 'Error generating snippet:', error.message);
    return null;
  }
}

/**
 * Generate safe fallback message when weather/time data unavailable
 */
export function getSafeActivityFallback() {
  return "I'm not able to confirm the current conditions right now, but I can still recommend some great options based on the time of year. Our dining rooms, spa, library, and indoor social areas are always wonderful choices.";
}

/**
 * Get indoor alternatives when outdoor conditions aren't suitable
 */
export function getIndoorAlternatives(reason) {
  const alternatives = {
    too_cold: "Perhaps you'd enjoy our cozy Main Lounge with the fireplace, a spa treatment, or dining at the Coral Room?",
    bad_weather: "Perfect weather for our spa services, browsing the boutique, or enjoying a leisurely meal indoors!",
    too_windy: "How about exploring our covered terraces, the library, or treating yourself to some indoor wellness time?",
    nighttime: "Evening is perfect for dining at the Coral Room, enjoying drinks in the Main Lounge, or stargazing from our covered areas.",
    default: "Our indoor venues offer wonderful alternatives — the spa, dining rooms, library, and social areas are all delightful options."
  };
  
  return alternatives[reason] || alternatives.default;
}