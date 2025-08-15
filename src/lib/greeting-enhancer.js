/**
 * Greeting Enhancement for CBC-Agent
 * Provides time and weather-aware greeting intelligence
 */

import { safeLog } from './pii-protection.js';

/**
 * Enhance greeting with time and weather awareness
 */
export function enhanceGreeting(originalGreeting, timeData, weatherData) {
  try {
    let enhancedGreeting = originalGreeting;
    
    // Add time-aware greeting
    const timeGreeting = getTimeAwareGreeting(timeData);
    if (timeGreeting) {
      // Replace generic greetings with time-aware ones
      enhancedGreeting = enhancedGreeting
        .replace(/^Hello[!,]?/i, timeGreeting)
        .replace(/^Hi[!,]?/i, timeGreeting)
        .replace(/^Good day[!,]?/i, timeGreeting);
    }
    
    // Add weather context if appropriate
    const weatherContext = getWeatherContext(weatherData);
    if (weatherContext && !enhancedGreeting.toLowerCase().includes('weather')) {
      // Insert weather context after the greeting but before main content
      const sentences = enhancedGreeting.split('. ');
      if (sentences.length > 1) {
        sentences[0] += ` ${weatherContext}`;
        enhancedGreeting = sentences.join('. ');
      } else {
        enhancedGreeting += ` ${weatherContext}`;
      }
    }
    
    return enhancedGreeting;
    
  } catch (error) {
    safeLog('Greeting Enhancer', 'Error enhancing greeting:', error.message);
    return originalGreeting;
  }
}


/**
 * Check if a message appears to be a greeting or first interaction
 */
export function isGreetingMessage(message, isFirstInSession = false) {
  if (!message || typeof message !== 'string') {
    return false;
  }
  
  const content = message.toLowerCase().trim();
  
  // Clear greeting patterns
  const greetingPatterns = [
    /^(hi|hello|hey|good morning|good afternoon|good evening)\b/,
    /^(greetings|welcome|salutations)\b/,
    /^\w+\s+(here|speaking)\b/, // "John here", "Sarah speaking"
    /^this is \w+/,
    /^my name is \w+/
  ];
  
  const isGreetingPattern = greetingPatterns.some(pattern => pattern.test(content));
  
  // Very short messages at start of session are likely greetings
  const isShortFirstMessage = isFirstInSession && content.length < 20;
  
  // Questions about the Club in first message
  const isIntroductoryQuestion = isFirstInSession && (
    content.includes('about') || 
    content.includes('tell me') || 
    content.includes('what is') ||
    content.includes('help')
  );
  
  return isGreetingPattern || isShortFirstMessage || isIntroductoryQuestion;
}

/**
 * Generate comprehensive first-time welcome message
 */
export function getFirstTimeWelcome(timeGreeting, weatherContext) {
  const welcomeMessages = [
    {
      greeting: `${timeGreeting || 'Welcome'} to Coral Beach & Tennis Club! I'm Alonso, your friendly resident Amazon parrot`,
      intro: "I've been welcoming guests here from my perch in the Main Lounge for years, and it's always such a pleasure to meet new friends.",
      club: "You've arrived at one of Bermuda's most treasured destinations - 26 acres of sub-tropical paradise with our famous quarter-mile pink sand beach, championship tennis courts, elegant dining, and luxurious accommodations.",
      invitation: "Whether you're here to relax, play, dine, or explore, I'm here to help you make the most of your time with us."
    },
    {
      greeting: `${timeGreeting || 'Hello'} and welcome to our beautiful Coral Beach & Tennis Club! I'm Alonso, the Club's resident Amazon parrot`,
      intro: "I spend my days here in the Main Lounge watching over our wonderful guests and enjoying the sea breeze through the windows.",
      club: "Our Club has been a sanctuary of casual elegance since 1948, nestled on 26 acres of lush grounds with pristine pink sand beaches, world-class tennis facilities, and exquisite dining venues.",
      invitation: "I'd be delighted to help you discover all the Club has to offer - from our championship tennis courts to our award-winning spa."
    }
  ];
  
  const selected = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
  
  let fullWelcome = `${selected.greeting} - ${selected.intro}\n\n${selected.club} ${selected.invitation}`;
  
  // Add weather context if available
  if (weatherContext) {
    fullWelcome += `\n\n${weatherContext}`;
  }
  
  fullWelcome += "\n\nWhat would you like to know about the Club? I'm here to share recommendations for activities, dining, or anything else that interests you!";
  
  return fullWelcome;
}

/**
 * Enhanced greeting variations for different contexts
 */
export function getContextualGreeting(context = {}) {
  const { isReturningGuest, guestName, timeOfDay, weatherCondition } = context;
  
  const baseGreetings = [
    "Welcome to Coral Beach & Tennis Club!",
    "Delighted to see you at the Club!",
    "Hello and welcome!",
    "Wonderful to have you here!"
  ];
  
  // Returning guest variations
  if (isReturningGuest && guestName) {
    const returningGreetings = [
      `Welcome back, ${guestName}!`,
      `So nice to see you again, ${guestName}!`,
      `${guestName}! Wonderful to have you back at the Club!`
    ];
    return returningGreetings[Math.floor(Math.random() * returningGreetings.length)];
  }
  
  return baseGreetings[Math.floor(Math.random() * baseGreetings.length)];
}

/**
 * Detect if this is truly a first-time interaction (not just session)
 */
export function isFirstTimeVisitor(message, conversationHistory = []) {
  // Check for first-time visitor patterns
  const content = (message || '').toLowerCase().trim();
  
  // If there's conversation history but message looks like initial greeting, still treat as first time
  const firstTimePatterns = [
    /^(hi|hello|hey)\s*$/,
    /^(hi|hello|hey)\s*[.!]*\s*$/,
    /^(good morning|good afternoon|good evening)\s*[.!]*\s*$/,
    /^(greetings|welcome|salutations)\s*[.!]*\s*$/,
    /first time/,
    /never been/,
    /visiting/,
    /tourist/,
    /^help\s*[.!]*\s*$/,
    /what.*this/,
    /tell me about/
  ];
  
  const isGreetingPattern = firstTimePatterns.some(pattern => pattern.test(content));
  const isVeryShort = content.length < 10;
  
  // First time if: no conversation history OR (short greeting pattern)
  return (conversationHistory.length === 0) || (isGreetingPattern || isVeryShort);
}

/**
 * Generate time-aware greeting (moved from private function)
 */
export function getTimeAwareGreeting(timeData) {
  if (!timeData || !timeData.success || !timeData.time) {
    return null;
  }
  
  try {
    const timeStr = timeData.time.toLowerCase();
    const isPM = timeStr.includes('pm');
    const hour = parseInt(timeStr.split(':')[0]);
    
    let hour24 = hour;
    if (isPM && hour !== 12) hour24 += 12;
    if (!isPM && hour === 12) hour24 = 0;
    
    // Time-based greetings
    if (hour24 >= 5 && hour24 < 12) {
      const morningGreetings = [
        "Good morning",
        "Good morning and welcome",
        "What a lovely morning"
      ];
      return morningGreetings[Math.floor(Math.random() * morningGreetings.length)];
    } else if (hour24 >= 12 && hour24 < 17) {
      const afternoonGreetings = [
        "Good afternoon",
        "Good afternoon and welcome", 
        "What a beautiful afternoon"
      ];
      return afternoonGreetings[Math.floor(Math.random() * afternoonGreetings.length)];
    } else if (hour24 >= 17 && hour24 < 21) {
      const eveningGreetings = [
        "Good evening",
        "Good evening and welcome",
        "What a wonderful evening"
      ];
      return eveningGreetings[Math.floor(Math.random() * eveningGreetings.length)];
    } else {
      return "Welcome";
    }
  } catch (error) {
    safeLog('Greeting Enhancer', 'Error parsing time for greeting:', error.message);
    return null;
  }
}

/**
 * Generate weather-aware context (moved from private function)
 */
export function getWeatherContext(weatherData) {
  if (!weatherData || !weatherData.success) {
    return null;
  }
  
  try {
    const temp = weatherData.temperature || weatherData.temperatureC;
    const condition = (weatherData.description || '').toLowerCase();
    
    // Perfect weather conditions
    if (temp >= 24 && temp <= 28 && 
        (condition.includes('clear') || condition.includes('sunny') || condition.includes('fair'))) {
      const perfectWeatherGreetings = [
        "It's absolutely beautiful out today - perfect weather to enjoy everything the Club has to offer!",
        "What a gorgeous day we're having! The conditions are ideal for our beach, tennis courts, or garden walks.",
        "The weather is simply perfect today - you couldn't have picked a better time to visit!"
      ];
      return perfectWeatherGreetings[Math.floor(Math.random() * perfectWeatherGreetings.length)];
    }
    
    // Good weather conditions
    if (temp >= 22 && temp <= 30 && !condition.includes('rain') && !condition.includes('storm')) {
      const goodWeatherGreetings = [
        "Lovely weather today - perfect for enjoying our outdoor amenities!",
        "Beautiful day to be here! The weather is ideal for exploring the Club.",
        "The weather is wonderful today - great for our beach, tennis, or garden tours."
      ];
      return goodWeatherGreetings[Math.floor(Math.random() * goodWeatherGreetings.length)];
    }
    
    // Cooler weather
    if (temp < 22 && temp > 15) {
      return "It's a bit cool today, but our indoor spaces are lovely and warm - perfect for dining, spa treatments, or relaxing in the Main Lounge!";
    }
    
    return null;
  } catch (error) {
    safeLog('Greeting Enhancer', 'Error generating weather context:', error.message);
    return null;
  }
}

/**
 * FAREWELL SYSTEM - Warm goodbye messages for lasting impressions
 */

/**
 * Detect farewell messages from user
 */
export function isFarewellMessage(message) {
  if (!message || typeof message !== 'string') {
    return false;
  }
  
  const content = message.toLowerCase().trim();
  
  // Farewell patterns
  const farewellPatterns = [
    /^(bye|goodbye|good bye|good-bye)$/,
    /^(bye|goodbye|good bye|good-bye)\s*[!.]*$/,
    /^(thanks|thank you)\s*(bye|goodbye)?$/,
    /^(thanks|thank you)\s*[!.]*$/,
    /^(see you|see ya|talk to you later|ttyl)$/,
    /^(have a good|have a great)\s+(day|night|time)$/,
    /^(take care|farewell)$/,
    /^(catch you later|until next time)$/,
    /^(gotta go|got to go|i have to go|need to go)$/,
    /^(that.?s all|that.?s everything|that.?s it)\s*(thanks|thank you)?$/
  ];
  
  // Check for thank you with context indicating end of conversation
  const thankYouEndPatterns = [
    /thanks.*help/,
    /thank you.*help/,
    /appreciate.*help/,
    /thanks.*information/,
    /thank you.*information/,
    /that helps.*thanks/,
    /perfect.*thanks/,
    /great.*thanks/,
    /wonderful.*thanks/
  ];
  
  return farewellPatterns.some(pattern => pattern.test(content)) ||
         thankYouEndPatterns.some(pattern => pattern.test(content));
}

/**
 * Generate warm farewell messages
 */
export function generateFarewellResponse(timeData, weatherData) {
  try {
    // Base farewell messages
    const baseFarewells = [
      "It's been my absolute pleasure helping you today! I do hope you have a wonderful time here at Coral Beach & Tennis Club.",
      "Thank you for chatting with me! I hope you thoroughly enjoy your stay with us at the Club.",
      "Lovely talking with you! I hope you make the most beautiful memories here at Coral Beach.",
      "What a pleasure it's been! Please don't hesitate to find me again if you need anything during your visit.",
      "Thank you for the delightful conversation! I hope your time at the Club exceeds every expectation.",
      "It's been wonderful helping you! Enjoy every moment of your stay at our beautiful Club."
    ];
    
    // Alonso-specific farewells (occasionally)
    const alonsoFarewells = [
      "Farewell from your feathered friend! I'll be here in the Main Lounge if you need me again.",
      "Until we meet again! This parrot will be watching for your return to the Club.",
      "Goodbye for now! I'll be keeping an eye on things from my perch - have a marvelous stay!",
      "Take care, and remember - if you need anything else, just look for the friendly parrot in the Main Lounge!"
    ];
    
    // Time-specific additions
    const timeSpecificEndings = [];
    
    if (timeData && timeData.success) {
      try {
        const timeStr = timeData.time.toLowerCase();
        const isPM = timeStr.includes('pm');
        const hour = parseInt(timeStr.split(':')[0]);
        
        let hour24 = hour;
        if (isPM && hour !== 12) hour24 += 12;
        if (!isPM && hour === 12) hour24 = 0;
        
        // Morning farewells
        if (hour24 >= 6 && hour24 < 12) {
          timeSpecificEndings.push(
            "Have a magnificent day exploring everything the Club has to offer!",
            "Enjoy this beautiful morning - perhaps a stroll through our gardens or time by the beach?",
            "Make the most of this lovely morning! The tennis courts and beach are calling."
          );
        }
        // Afternoon farewells  
        else if (hour24 >= 12 && hour24 < 17) {
          timeSpecificEndings.push(
            "Have a wonderful afternoon - perfect time for lunch on our terraces!",
            "Enjoy the rest of your day! Perhaps some beach time or a relaxing spa treatment?",
            "Make the most of this beautiful afternoon at the Club!"
          );
        }
        // Evening farewells
        else if (hour24 >= 17 && hour24 < 22) {
          timeSpecificEndings.push(
            "Have a magical evening! Our dining venues offer the perfect sunset atmosphere.",
            "Enjoy your evening - the terraces are particularly lovely at this hour.",
            "Have a wonderful evening! Perhaps cocktails in the Main Lounge as the sun sets?"
          );
        }
        // Late evening/night farewells
        else {
          timeSpecificEndings.push(
            "Have a restful evening! The Club is peaceful and beautiful at night.",
            "Sleep well and sweet dreams! Tomorrow brings another perfect day at the Club.",
            "Have a lovely night - the Club's evening atmosphere is truly special."
          );
        }
      } catch (error) {
        safeLog('Farewell Generator', 'Error parsing time for farewell:', error.message);
      }
    }
    
    // Weather-aware endings
    const weatherEndings = [];
    if (weatherData && weatherData.success) {
      try {
        const temp = weatherData.temperature || weatherData.temperatureC;
        const condition = (weatherData.description || '').toLowerCase();
        
        // Perfect weather
        if (temp >= 24 && temp <= 28 && 
            (condition.includes('clear') || condition.includes('sunny') || condition.includes('fair'))) {
          weatherEndings.push(
            "What perfect weather to enjoy our beach and outdoor amenities!",
            "This gorgeous weather is ideal for making the most of your Club experience!",
            "With weather this beautiful, you simply must spend time on our pink sand beach!"
          );
        }
        // Good weather
        else if (temp >= 22 && temp <= 30 && !condition.includes('rain')) {
          weatherEndings.push(
            "Beautiful day to explore everything the Club has to offer!",
            "Lovely weather for enjoying our outdoor spaces!",
            "Perfect conditions for tennis, beach time, or garden strolls!"
          );
        }
        // Cooler/indoor weather
        else {
          weatherEndings.push(
            "Our spa and indoor dining venues are perfect for weather like this!",
            "Cozy weather for enjoying the Main Lounge and our covered terraces!",
            "Perfect day for spa treatments and leisurely indoor dining!"
          );
        }
      } catch (error) {
        safeLog('Farewell Generator', 'Error parsing weather for farewell:', error.message);
      }
    }
    
    // Select components
    const useAlonso = Math.random() < 0.25; // 25% chance for Alonso farewell
    const baseFarewell = useAlonso 
      ? alonsoFarewells[Math.floor(Math.random() * alonsoFarewells.length)]
      : baseFarewells[Math.floor(Math.random() * baseFarewells.length)];
    
    let fullFarewell = baseFarewell;
    
    // Add time-specific ending (70% chance)
    if (timeSpecificEndings.length > 0 && Math.random() < 0.7) {
      const timeEnding = timeSpecificEndings[Math.floor(Math.random() * timeSpecificEndings.length)];
      fullFarewell += ` ${timeEnding}`;
    }
    // Add weather ending if no time ending (50% chance)
    else if (weatherEndings.length > 0 && Math.random() < 0.5) {
      const weatherEnding = weatherEndings[Math.floor(Math.random() * weatherEndings.length)];
      fullFarewell += ` ${weatherEnding}`;
    }
    
    return fullFarewell;
    
  } catch (error) {
    safeLog('Farewell Generator', 'Error generating farewell:', error.message);
    // Fallback to simple farewell
    return "Thank you for visiting with me! I hope you have a wonderful time at Coral Beach & Tennis Club.";
  }
}