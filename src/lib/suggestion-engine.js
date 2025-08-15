/**
 * Suggestion Engine for CBC-Agent
 * Provides contextual suggestions for time, weather, and other queries
 */

import { safeLog } from './pii-protection.js';

/**
 * Generate time-appropriate activity suggestions
 */
export function getTimeBasedSuggestions(timeData) {
  if (!timeData || !timeData.success || !timeData.time) {
    return getGenericSuggestions();
  }
  
  try {
    const timeStr = timeData.time.toLowerCase();
    const isPM = timeStr.includes('pm');
    const hour = parseInt(timeStr.split(':')[0]);
    
    let hour24 = hour;
    if (isPM && hour !== 12) hour24 += 12;
    if (!isPM && hour === 12) hour24 = 0;
    
    // Early morning (5-8 AM)
    if (hour24 >= 5 && hour24 < 8) {
      return [
        "Perfect timing for a peaceful morning walk through our gardens",
        "The tennis courts are lovely and cool this early - ideal for a morning match"
      ];
    }
    
    // Morning (8-11 AM)
    if (hour24 >= 8 && hour24 < 11) {
      return [
        "Perfect for our Garden Walking Tour that starts at 10:00 AM",
        "The Beach Terrace serves a wonderful breakfast with ocean views"
      ];
    }
    
    // Late morning (11 AM - 12 PM)  
    if (hour24 >= 11 && hour24 < 12) {
      return [
        "Perfect timing for beach service - staff is setting up loungers and umbrellas",
        "The Frozen Hut Bar opens at 11:00 AM for refreshments by the beach"
      ];
    }
    
    // Lunch time (12-2 PM)
    if (hour24 >= 12 && hour24 < 14) {
      return [
        "Perfect lunch timing! The Beach Terrace has a relaxed, beachside atmosphere",
        "The Coral Room & Longtail Terrace offers elegant dining with stunning views"
      ];
    }
    
    // Afternoon (2-5 PM)
    if (hour24 >= 14 && hour24 < 17) {
      return [
        "Wonderful time for beach activities - swimming, water sports, or lounging",
        "Perfect for exploring our extensive gardens and nature walks"
      ];
    }
    
    // Early evening (5-7 PM)
    if (hour24 >= 17 && hour24 < 19) {
      return [
        "Perfect time for a cocktail in the Main Lounge while watching the sunset",
        "Ideal for making dinner reservations - would you like help with that?"
      ];
    }
    
    // Dinner time (7-9 PM)
    if (hour24 >= 19 && hour24 < 21) {
      return [
        "Excellent dinner timing! The Coral Room & Longtail Terrace offers elegant evening dining",
        "Don't forget - gentlemen need jackets at the Coral Room on Thursday & Saturday evenings"
      ];
    }
    
    // Late evening (9+ PM)
    if (hour24 >= 21) {
      return [
        "Perfect time for drinks and conversation in our welcoming Main Lounge",
        "The covered terraces are magical in the evening with soft lighting"
      ];
    }
    
    return getGenericSuggestions();
    
  } catch (error) {
    safeLog('Suggestion Engine', 'Error generating time-based suggestions:', error.message);
    return getGenericSuggestions();
  }
}

/**
 * Generate weather-appropriate activity suggestions  
 */
export function getWeatherBasedSuggestions(weatherData) {
  if (!weatherData || !weatherData.success) {
    return getGenericSuggestions();
  }
  
  try {
    const temp = weatherData.temperature || weatherData.temperatureC;
    const condition = (weatherData.description || '').toLowerCase();
    
    // Perfect beach weather
    if (temp >= 25 && temp <= 30 && (condition.includes('clear') || condition.includes('sunny'))) {
      return [
        "Perfect beach weather! Our private pink sand beach is calling your name",
        "Great day for our Garden Walking Tour at 10:00 AM"
      ];
    }
    
    // Good outdoor weather
    if (temp >= 22 && temp <= 28 && !condition.includes('rain') && !condition.includes('storm')) {
      return [
        "Beautiful weather for enjoying our outdoor amenities",
        "Perfect for tennis, beach time, or exploring our 26-acre grounds"
      ];
    }
    
    // Warm but potentially windy
    if (temp >= 20 && temp <= 25 && condition.includes('wind')) {
      return [
        "A bit breezy but still lovely - our covered terraces offer perfect shelter",
        "The Main Lounge has wonderful views while staying comfortable"
      ];
    }
    
    // Cooler weather  
    if (temp >= 18 && temp < 22) {
      return [
        "Cooler weather is perfect for spa treatments and indoor relaxation",
        "The Main Lounge is cozy and welcoming with beautiful views"
      ];
    }
    
    // Rainy weather
    if (condition.includes('rain') || condition.includes('shower')) {
      return [
        "Rainy weather makes our spa and wellness facilities even more appealing",
        "The Main Lounge is especially cozy during rain with its warm atmosphere"
      ];
    }
    
    return getGenericSuggestions();
    
  } catch (error) {
    safeLog('Suggestion Engine', 'Error generating weather-based suggestions:', error.message);
    return getGenericSuggestions();
  }
}

/**
 * Generate activity-specific suggestions
 */
export function getActivitySuggestions(queryTopic) {
  const suggestions = {
    dining: [
      "Would you like help making a reservation at one of our dining venues?",
      "I can tell you about our dress codes and current menu highlights",
      "Shall I share the hours for our different restaurants?",
      "Would you like to know about our private dining options?"
    ],
    tennis: [
      "Would you like me to connect you with our Tennis Shop to check court availability?", 
      "Shall I tell you about our tennis programs and lessons?",
      "Would you like information about our dress code and court fees?",
      "I can share details about our championship Har-Tru clay courts"
    ],
    spa: [
      "Would you like to know about our most popular treatments?",
      "Shall I tell you about our wellness packages?",
      "Would you like information about our fitness facilities?",
      "I can share details about booking spa appointments"
    ],
    beach: [
      "Would you like to know about our beach service hours?",
      "Shall I tell you about water sports equipment rentals?",
      "Would you like information about the Frozen Hut Bar?",
      "I can share details about our private pink sand beach amenities"
    ],
    accommodation: [
      "Would you like to know about our cottage and suite options?",
      "Shall I tell you about our room amenities?", 
      "Would you like help submitting an accommodation inquiry?",
      "I can share details about our different accommodation types"
    ]
  };
  
  return suggestions[queryTopic] || getGenericSuggestions();
}

/**
 * Generic suggestions for fallback
 */
function getGenericSuggestions() {
  return [
    "Would you like to know about our current activities and amenities?",
    "Shall I tell you about our dining options?",
    "Would you like information about our spa and wellness facilities?",
    "I can share details about our tennis courts and beach amenities"
  ];
}

/**
 * Select random suggestion from array
 */
export function getRandomSuggestion(suggestions) {
  if (!suggestions || suggestions.length === 0) {
    return "Is there anything else I can help you with today?";
  }
  
  return suggestions[Math.floor(Math.random() * suggestions.length)];
}

/**
 * PROACTIVE SERVICE SUGGESTIONS - Intelligent follow-up prompts based on context
 */

/**
 * Generate proactive service suggestions based on user query context
 */
export function getProactiveServiceSuggestions(userMessage, responseText) {
  const messageLower = userMessage.toLowerCase();
  const responseLower = responseText.toLowerCase();
  
  // Dining-related inquiries
  if (messageLower.includes('dining') || messageLower.includes('restaurant') || 
      messageLower.includes('eat') || messageLower.includes('menu') ||
      messageLower.includes('food') || messageLower.includes('meal')) {
    
    const diningActions = [
      "Would you like me to help you make a dining reservation?",
      "Shall I provide the current menu or dining hours?", 
      "Would you like information about our dress codes for different venues?",
      "I can connect you with our front desk to check dining availability if you'd like"
    ];
    
    // More specific for reservation inquiries
    if (messageLower.includes('reserv') || messageLower.includes('book') || messageLower.includes('table')) {
      return [
        "I can help you submit a reservation request to our dining team - shall we get started?",
        "Would you like me to collect your dining preferences and send them to our restaurant?"
      ];
    }
    
    return diningActions;
  }
  
  // Tennis/Sports inquiries
  if (messageLower.includes('tennis') || messageLower.includes('court') || 
      messageLower.includes('pickle') || messageLower.includes('squash') ||
      messageLower.includes('sport')) {
    
    const sportsActions = [
      "Would you like me to connect you with the Tennis Shop to check court availability?",
      "Shall I provide the Tennis Shop contact information for booking courts?",
      "Would you like information about tennis programs and lessons?",
      "I can share the dress code and equipment requirements if helpful"
    ];
    
    // More specific for booking-related tennis queries
    if (messageLower.includes('book') || messageLower.includes('reserv') || 
        messageLower.includes('available') || messageLower.includes('time')) {
      return [
        "I can connect you directly with our Tennis Shop at +1 (441) 239-7216 to check real-time court availability",
        "Would you like me to provide the Tennis Shop's booking information so you can reserve courts?"
      ];
    }
    
    return sportsActions;
  }
  
  // Spa/Wellness inquiries
  if (messageLower.includes('spa') || messageLower.includes('massage') || 
      messageLower.includes('wellness') || messageLower.includes('treatment') ||
      messageLower.includes('facial') || messageLower.includes('fitness')) {
    
    const spaActions = [
      "Would you like me to provide the spa's booking information for treatments?",
      "Shall I share details about our current spa specials and packages?",
      "I can connect you with our spa at +1 (441) 239-7222 for appointments",
      "Would you like information about our wellness classes and fitness programs?"
    ];
    
    // More specific for booking spa services
    if (messageLower.includes('book') || messageLower.includes('appointment') || 
        messageLower.includes('schedule') || messageLower.includes('available')) {
      return [
        "I can provide our spa's direct contact: +1 (441) 239-7222 or spa@coralbeach.bm for immediate booking",
        "Would you like me to share our spa hours and help you plan your treatment schedule?"
      ];
    }
    
    return spaActions;
  }
  
  // Accommodation inquiries
  if (messageLower.includes('room') || messageLower.includes('cottage') || 
      messageLower.includes('suite') || messageLower.includes('stay') ||
      messageLower.includes('accommodation') || messageLower.includes('book')) {
    
    const accommodationActions = [
      "Would you like help submitting an accommodation inquiry to our reservations team?",
      "Shall I provide our reservations contact information for availability and rates?",
      "I can help collect your stay preferences and send them to our front desk",
      "Would you like information about our different accommodation types to help you choose?"
    ];
    
    // More specific for booking accommodations
    if (messageLower.includes('available') || messageLower.includes('rate') || 
        messageLower.includes('price') || messageLower.includes('reserv')) {
      return [
        "I can help you submit a detailed accommodation inquiry - would you like me to guide you through that process?",
        "Shall I connect you directly with reservations at reservations@coralbeach.bm or +1 (441) 239-7201?"
      ];
    }
    
    return accommodationActions;
  }
  
  // Event/Wedding inquiries
  if (messageLower.includes('wedding') || messageLower.includes('event') || 
      messageLower.includes('celebration') || messageLower.includes('party') ||
      messageLower.includes('anniversary') || messageLower.includes('birthday')) {
    
    const eventActions = [
      "Would you like me to connect you with our events team for planning assistance?",
      "Shall I provide information about our various event venues and their capacities?",
      "I can help you understand our event packages and coordination services",
      "Would you like to submit an initial event inquiry to our planning team?"
    ];
    
    // More specific for wedding inquiries  
    if (messageLower.includes('wedding')) {
      return [
        "I can connect you with our Wedding Coordinator Valerie Mesto at vmesto@coralbeach.bm for detailed planning",
        "Would you like me to provide information about our wedding packages and venue options?"
      ];
    }
    
    return eventActions;
  }
  
  // Transportation inquiries
  if (messageLower.includes('transport') || messageLower.includes('taxi') || 
      messageLower.includes('airport') || messageLower.includes('getting') ||
      messageLower.includes('travel') || messageLower.includes('arrival')) {
    
    return [
      "Would you like me to provide the front desk number to arrange airport transfers?",
      "Shall I share information about transportation options around Bermuda?",
      "I can connect you with the front desk to help coordinate your arrival arrangements"
    ];
  }
  
  // General information with booking hints
  if (responseLower.includes('contact') || responseLower.includes('call') || 
      responseLower.includes('email') || responseLower.includes('reserv')) {
    
    return [
      "Would you like me to help you connect with the right department for your needs?",
      "Shall I provide additional details to help you prepare for your call or visit?"
    ];
  }
  
  return null; // No specific proactive suggestion
}

/**
 * Generate contextual action prompts based on response content
 */
export function getContextualActionPrompts(responseText, userMessage) {
  const responseLower = responseText.toLowerCase();
  const messageLower = userMessage.toLowerCase();
  
  const actionPrompts = [];
  
  // If response mentions contact information, offer assistance
  if (responseLower.includes('contact') || responseLower.includes('call') || responseLower.includes('email')) {
    actionPrompts.push("Would you like any additional information before contacting them?");
  }
  
  // If response mentions hours, offer related services
  if (responseLower.includes('hours') || responseLower.includes('open') || responseLower.includes('available')) {
    actionPrompts.push("Is there anything else you'd like to know about scheduling or timing?");
  }
  
  // If response mentions facilities, offer booking help
  if ((responseLower.includes('court') || responseLower.includes('spa') || responseLower.includes('dining')) &&
      !messageLower.includes('how many') && !messageLower.includes('what are')) {
    actionPrompts.push("Would you like help with booking or getting more information?");
  }
  
  // If response mentions prices or fees, offer planning assistance
  if (responseLower.includes('fee') || responseLower.includes('rate') || responseLower.includes('cost') || responseLower.includes('price')) {
    actionPrompts.push("Can I help you plan or budget for your visit?");
  }
  
  return actionPrompts.length > 0 ? actionPrompts : null;
}

/**
 * COORDINATED SUGGESTION SYSTEM - Prevents overwhelming users with multiple suggestion types
 */

/**
 * Get single, coordinated suggestion to prevent stacking
 * Priority: Immediate Actions > Proactive Service > Time/Weather > Activity > Generic
 */
export function getCoordinatedSuggestion(userMessage, responseText, timeData, weatherData, queryTopic) {
  // Priority 1: Immediate action suggestions for urgent requests
  const immediateActions = getImmediateActionSuggestions(userMessage);
  if (immediateActions && immediateActions.length > 0) {
    return getRandomSuggestion(immediateActions);
  }
  
  // Priority 2: Proactive service suggestions for specific requests
  const proactiveService = getProactiveServiceSuggestions(userMessage, responseText);
  if (proactiveService && proactiveService.length > 0) {
    return getRandomSuggestion(proactiveService.slice(0, 2)); // Limit to 2 options
  }
  
  // Priority 3: Time-based suggestions for time queries
  if (userMessage.toLowerCase().includes('time') && timeData && timeData.success) {
    const timeSuggestions = getTimeBasedSuggestions(timeData);
    return getRandomSuggestion(timeSuggestions);
  }
  
  // Priority 4: Weather-based suggestions for weather queries  
  if (userMessage.toLowerCase().includes('weather') && weatherData && weatherData.success) {
    const weatherSuggestions = getWeatherBasedSuggestions(weatherData);
    return getRandomSuggestion(weatherSuggestions);
  }
  
  // Priority 5: Activity-specific suggestions
  if (queryTopic) {
    const activitySuggestions = getActivitySuggestions(queryTopic);
    return getRandomSuggestion(activitySuggestions);
  }
  
  // Priority 6: Generic fallback (only if no other suggestions)
  return getRandomSuggestion(getGenericSuggestions());
}

/**
 * Generate immediate action suggestions for common service requests
 */
export function getImmediateActionSuggestions(userMessage) {
  const messageLower = userMessage.toLowerCase();
  
  // Urgent booking language
  if (messageLower.includes('need to book') || messageLower.includes('want to reserve') || 
      messageLower.includes('how do i book') || messageLower.includes('make a reservation')) {
    
    return [
      "I can help you get started with that right now! What would you like to book?",
      "Let me guide you through the booking process - which service interests you?",
      "I'm here to help with reservations! Which department would you like to connect with?"
    ];
  }
  
  // Planning language
  if (messageLower.includes('planning') || messageLower.includes('organizing') || 
      messageLower.includes('arranging') || messageLower.includes('help plan')) {
    
    return [
      "I'd be delighted to help you plan! What type of experience are you looking for?",
      "Let's plan the perfect visit for you - what are your main interests?",
      "I can help organize all the details - what would you like to focus on first?"
    ];
  }
  
  // Inquiry language
  if (messageLower.includes('can you help') || messageLower.includes('i need help') || 
      messageLower.includes('looking for information')) {
    
    return [
      "Absolutely! I'm here to help with whatever you need. What can I assist you with?",
      "Of course! I'd be happy to help you find exactly what you're looking for.",
      "I'm here to help! What information or assistance can I provide?"
    ];
  }
  
  return null;
}