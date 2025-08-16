import { anthropic } from "@/src/lib/anthropic";
import { openai } from "@/src/lib/openai";
import { searchFAQs } from "@/src/lib/faq";
import { initFaqs, searchFaqs as searchFaqsNew, hotReloadInDev } from "@/src/lib/faqs";
import { logEvent } from "@/src/lib/analytics/logEvent";
import { getSessionId, trackSession, trackPageView, trackInteraction, trackSearch, getSessionHeaders } from "@/src/lib/analytics/sessionManager";
import weatherService, { WEATHER_UNITS } from "@/src/lib/weather";
import { validateEnvironment } from "@/src/lib/validate-env";
import { checkRateLimit, getRateLimitId } from "@/src/lib/rate-limiter";
import { checkRateLimitTier } from "@/src/lib/rate-limit-tiers";
import { checkModeration, validateConversation, hardenSystemPrompt, filterResponse } from "@/src/lib/prompt-moderation";
import { maybeGetAlonsoSnippet } from "@/src/lib/alonso-persona";
import { 
  isOutdoorWeatherSuitable, 
  detectMessageTopic, 
  generateFollowUp, 
  getParrotSnippet, 
  getSafeActivityFallback,
  getIndoorAlternatives 
} from "@/src/lib/alonso-enhanced";
import { 
  addToConversationHistory,
  generateContextualReference,
  getRelevantContext 
} from "@/src/lib/conversational-memory";
import { getCachedResponse, setCachedResponse } from "@/src/lib/response-cache";
import { enhanceGreeting, isGreetingMessage, getContextualGreeting, getFirstTimeWelcome, isFirstTimeVisitor, getTimeAwareGreeting, getWeatherContext, isFarewellMessage, generateFarewellResponse } from "@/src/lib/greeting-enhancer";
import { getCoordinatedSuggestion, getTimeBasedSuggestions, getWeatherBasedSuggestions, getActivitySuggestions, getRandomSuggestion, getProactiveServiceSuggestions, getContextualActionPrompts, getImmediateActionSuggestions } from "@/src/lib/suggestion-engine";
import { detectKBTopic, loadRelevantKBContent, getKBTrace, getClarifyingQuestion } from "@/src/lib/kb-topic-router";
import { safeLog, createSafeLogObject } from "@/src/lib/pii-protection";
import { validateRequest, withTimeout, TIMEOUT_LIMITS } from "@/src/lib/request-guards";
import fs from "fs";

// Model configuration
const DEFAULT_CLAUDE_MODEL = "claude-3-5-sonnet-20240620";
const getClaudeModel = () => process.env.CLAUDE_API_MODEL || DEFAULT_CLAUDE_MODEL;
import path from "path";
import * as yaml from "js-yaml";

// Enable hot reload in development
if (process.env.NODE_ENV === 'development') {
  hotReloadInDev();
}

// Validate environment on first load
let envValidated = false;
if (!envValidated) {
  validateEnvironment();
  envValidated = true;
}

function readText(relPath) {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf-8");
}

function toAnthropicMessages(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === "user" || m.role === "assistant") {
      out.push({ role: m.role, content: [{ type: "text", text: String(m.content ?? "") }] });
    }
  }
  return out.length ? out : [{ role: "user", content: [{ type: "text", text: "Hello" }] }];
}

function toOpenAIMessages(messages, system) {
  const base = [{ role: "system", content: system }];
  for (const m of messages) {
    if (m.role === "user" || m.role === "assistant") {
      base.push({ role: m.role, content: String(m.content ?? "") });
    }
  }
  if (base.length === 1) base.push({ role: "user", content: "Hello" });
  return base;
}

async function getFromAnthropic({ system, messages }) {
  const model = getClaudeModel();
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("No Anthropic key");
  
  // Define the submitReservation tool
  const tools = [{
    name: "submitReservation",
    description: "Submit a reservation inquiry to the front desk",
    input_schema: {
      type: "object",
      properties: {
        fullName: { type: "string", description: "Guest full name" },
        email: { type: "string", description: "Guest email address" },
        phone: { type: "string", description: "Guest phone number (optional)" },
        countryCity: { type: "string", description: "Country/city traveling from (optional)" },
        planningMode: { type: "string", enum: ["certain", "unsure"], description: "Whether guest has specific dates (certain) or is exploring options (unsure)" },
        arrivalDate: { type: "string", description: "Arrival date (YYYY-MM-DD) - required if planningMode is certain, optional if unsure" },
        departureDate: { type: "string", description: "Departure date (YYYY-MM-DD) - required if planningMode is certain, optional if unsure" },
        numberOfGuests: { type: "number", description: "Number of guests (1-12)" },
        partyBreakdown: { type: "string", description: "Party breakdown e.g. 2 adults, 2 children (optional)" },
        accommodationPreference: { type: "string", description: "Main Club rooms/Cottages/Suites/No preference (optional)" },
        budgetRange: { type: "string", description: "Budget range (optional)" },
        airlineInfo: { type: "string", description: "Airline and flight info (optional)" },
        memberStatus: { type: "string", description: "Member status or who's introducing (optional)" },
        bookingQuestion: { type: "string", description: "Early booking question or context about their plans (optional)" },
        interests: { type: "array", items: { type: "string" }, description: "Areas of interest from: Rooms & Cottages, Dining & Restaurants, Spa & Wellness, Tennis & Sports, Beach Services, Family Activities, Special Events, Weddings & Celebrations, Other (optional)" },
        otherInterest: { type: "string", description: "Details for Other interest if selected (optional)" },
        specialRequests: { type: "string", description: "Special requests or accessibility needs (optional)" },
        consent: { type: "boolean", description: "Consent to share information with front desk" }
      },
      required: ["fullName", "email", "planningMode", "numberOfGuests", "consent"]
    }
  }];
  
  const resp = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system,
    messages: toAnthropicMessages(messages),
    tools,
  });
  
  // Check if the model wants to use a tool
  if (resp?.content?.find?.(c => c.type === "tool_use")) {
    const toolUse = resp.content.find(c => c.type === "tool_use");
    
    if (toolUse.name === "submitReservation") {
      // Call the reservation API
      try {
        const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
        const reservationResponse = await fetch(`${baseUrl}/api/intake/reservation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toolUse.input),
        });
        
        const result = await reservationResponse.json();
        
        if (result.ok) {
          const responseText = toolUse.input.planningMode === 'unsure' 
            ? `Perfect! I've submitted your inquiry to our front desk team. Your reference number is ${result.id}. Since you're still exploring options, our team will reach out within 24-48 hours with seasonal highlights, availability windows, and rate options to help you find the perfect time for your visit. You'll receive a confirmation email shortly.`
            : `Excellent! I've submitted your reservation inquiry to our front desk team. Your reference number is ${result.id}. You'll receive a confirmation email shortly, and our team will be in touch within 24-48 hours with availability and rates.`;
          
          return { 
            provider: "anthropic", 
            model, 
            text: responseText
          };
        } else {
          return { 
            provider: "anthropic", 
            model, 
            text: `I apologize, but there was an issue submitting your inquiry: ${result.message}. Would you like to try again or use our reservation form instead?` 
          };
        }
      } catch (error) {
        safeLog('Tool Error', error.message);
        return { 
          provider: "anthropic", 
          model, 
          text: "I apologize, but I couldn't submit your inquiry at the moment. Would you like to use our reservation form instead? Just click the 'Plan Your Stay' button at the top of the chat." 
        };
      }
    }
  }
  
  const text = resp?.content?.find?.(c => c.type === "text")?.text || "";
  return { provider: "anthropic", model, text };
}

async function getFromOpenAI({ system, messages }) {
  if (!openai) throw new Error("No OpenAI key");
  const model = process.env.OPENAI_FALLBACK_MODEL || "gpt-4o-mini";
  const resp = await openai.chat.completions.create({
    model,
    max_tokens: 1024,
    messages: toOpenAIMessages(messages, system),
  });
  const text = resp?.choices?.[0]?.message?.content || "";
  return { provider: "openai", model, text };
}

/**
 * Primary LLM function with intelligent fallback
 * Uses Anthropic Claude 3.5 Sonnet as primary, OpenAI as fallback
 */
async function getFromLLM({ system, messages }) {
  const fallbackEnabled = process.env.FALLBACK_ENABLED !== 'false';
  const hasOpenAIKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 10;
  
  // Always try Anthropic first
  try {
    const startTime = Date.now();
    const result = await getFromAnthropic({ system, messages });
    const duration = Date.now() - startTime;
    
    // Log successful primary provider usage (masked keys)
    const anthropicKeyMask = process.env.ANTHROPIC_API_KEY ? 
      `${process.env.ANTHROPIC_API_KEY.slice(0, 8)}...${process.env.ANTHROPIC_API_KEY.slice(-4)}` : 'none';
    safeLog('LLM Primary', `Success: Anthropic ${result.model} (${duration}ms) [key: ${anthropicKeyMask}]`);
    
    return result;
  } catch (error) {
    const errorType = getErrorType(error);
    const shouldFallback = fallbackEnabled && hasOpenAIKey && isFallbackableError(error);
    
    // Log primary provider failure with error classification
    safeLog('LLM Primary', `Anthropic failed: ${errorType} - ${error.message}`);
    
    if (shouldFallback) {
      try {
        const startTime = Date.now();
        const result = await getFromOpenAI({ system, messages });
        const duration = Date.now() - startTime;
        
        // Log successful fallback usage (masked keys)
        const openaiKeyMask = process.env.OPENAI_API_KEY ? 
          `${process.env.OPENAI_API_KEY.slice(0, 8)}...${process.env.OPENAI_API_KEY.slice(-4)}` : 'none';
        safeLog('LLM Fallback', `Success: OpenAI ${result.model} (${duration}ms) [key: ${openaiKeyMask}]`);
        
        return result;
      } catch (fallbackError) {
        safeLog('LLM Fallback', `OpenAI also failed: ${fallbackError.message}`);
        throw new Error(`Both providers failed. Primary: ${error.message}, Fallback: ${fallbackError.message}`);
      }
    } else {
      if (!fallbackEnabled) {
        safeLog('LLM Fallback', 'Fallback disabled by configuration');
      } else if (!hasOpenAIKey) {
        safeLog('LLM Fallback', 'OpenAI key not available for fallback');
      } else {
        safeLog('LLM Fallback', `Error not fallbackable: ${errorType}`);
      }
      throw error;
    }
  }
}

/**
 * Classify error types for fallback decisions
 */
function getErrorType(error) {
  const message = error.message?.toLowerCase() || '';
  if (message.includes('rate limit') || message.includes('429')) return 'rate_limit';
  if (message.includes('timeout') || message.includes('network')) return 'network_error';
  if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) return 'server_error';
  if (message.includes('authentication') || message.includes('401')) return 'auth_error';
  if (message.includes('key')) return 'key_error';
  return 'unknown_error';
}

/**
 * Determine if an error should trigger fallback
 */
function isFallbackableError(error) {
  const errorType = getErrorType(error);
  // Fallback on transport errors, rate limits, and server errors
  // Don't fallback on auth errors (those need human intervention)
  return ['rate_limit', 'network_error', 'server_error', 'unknown_error'].includes(errorType);
}

function detectHoursQuery(messages) {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') return false;
  
  const content = String(lastMessage.content || '').toLowerCase();
  
  // Hours-intent patterns (these should outrank time queries)
  const hoursPatterns = [
    /\b(open|opening|close|closing|hours)\b/,
    /open\s+until/,
    /what\s+time.*open/,
    /when.*open/,
    /when\s+are\s+you\s+open/,
    /when\s+does.*close/,
    /last\s+seating/,
    /service\s+hours/,
    /operating\s+hours/,
    /what\s+are.*hours/,
    /business\s+hours/,
    /office\s+hours/,
    /\bhours\s+of\s+operation/,
    /are\s+you\s+open/,
    /until\s+what\s+time/,
    /what\s+time.*close/
  ];
  
  return hoursPatterns.some(pattern => pattern.test(content));
}

function detectTimeQuery(messages) {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') return false;
  
  const content = String(lastMessage.content || '').toLowerCase();
  
  // First check if this is actually a hours query - if so, don't treat as time query
  if (detectHoursQuery(messages)) {
    return false;
  }
  
  // Pure time-of-day patterns (no venue/hours context)
  const timePatterns = [
    /^what\s+time\s+is\s+it\??$/,
    /^what\s+is\s+the\s+time\??$/,   // Added missing pattern
    /^what.?s?\s+the\s+time\??$/,
    /^current\s+time\??$/,
    /^time\s+now\??$/,
    /\btime\s+is\s+it\s+right\s+now/,
    /\bclock\b/,  // Simplified regex that was causing syntax error
    /what\s+time.*right\s+now/
  ];
  
  return timePatterns.some(pattern => pattern.test(content));
}

function detectWeatherQuery(messages) {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') return false;
  
  const content = String(lastMessage.content || '').toLowerCase();
  const weatherPatterns = [
    /what.?s?\s+the\s+weather/,
    /weather.*like/,
    /how.?s?\s+the\s+weather/,
    /current\s+weather/,
    /temperature/,
    /\bweather\b.*\?/,
    /forecast/,
    /is\s+it\s+(hot|cold|warm|cool|rainy|sunny)/,
    /weather\s+(in|at|for)?\s*(bermuda|the club|today|now)?/,
    /bermuda\s+weather/,
    /\bweather\b/
  ];
  
  return weatherPatterns.some(pattern => pattern.test(content));
}

function detectNewsQuery(messages) {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') return false;
  
  const content = String(lastMessage.content || '').toLowerCase();
  const newsPatterns = [
    /bermuda\s+news/,
    /royal\s+gazette/,
    /bernews/,
    /\bheadlines?\b/,
    /top\s+stories/,
    /latest\s+news/,
    /bermuda\s+stories/,
    /what.?s?\s+happening\s+in\s+bermuda/,
    /news\s+from\s+bermuda/,
    /local\s+news/,
    /island\s+news/,
    /more\s+bermuda\s+news/
  ];
  
  return newsPatterns.some(pattern => pattern.test(content));
}

function detectWaterTemperatureQuery(messages) {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') return false;
  
  const content = String(lastMessage.content || '').toLowerCase();
  
  // Patterns specifically for water/ocean/sea temperature
  const waterTempPatterns = [
    /water\s+temp/,
    /ocean\s+temp/,
    /sea\s+temp/,
    /\b(water|ocean|sea)\s+(is|temperature|temp)/,
    /how\s+(warm|cold|hot)\s+(is\s+)?the\s+(water|ocean|sea)/,
    /\bswimming\s+temp/,
    /\bbeach\s+water/,
    /temperature\s+of\s+(the\s+)?(water|ocean|sea)/,
    /\b(water|ocean|sea)'?s?\s+temp/,
    /can\s+i\s+swim/,
    /good\s+for\s+swimming/,
    /warm\s+enough\s+(to|for)\s+swim/,
    /\bsst\b/,  // Sea Surface Temperature
    /sea\s+surface\s+temp/
  ];
  
  // Exclude patterns that indicate air temperature
  const airTempIndicators = [
    /\bair\s+temp/,
    /\boutside\s+temp/,
    /\bweather\s+temp/,
    /\bambient\s+temp/,
    /\broom\s+temp/
  ];
  
  // Check if it's specifically about water temperature
  const isWaterTemp = waterTempPatterns.some(pattern => pattern.test(content));
  const isAirTemp = airTempIndicators.some(pattern => pattern.test(content));
  
  return isWaterTemp && !isAirTemp;
}

function detectGreeting(messages) {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') return false;
  
  const content = String(lastMessage.content || '').trim().toLowerCase();
  
  // Simple greetings without additional context
  const simpleGreetings = [
    /^hi$/,
    /^hello$/,
    /^hey$/,
    /^good morning$/,
    /^good afternoon$/,
    /^good evening$/,
    /^good day$/,
    /^howdy$/,
    /^greetings$/,
    /^salutations$/,
    /^yo$/
  ];
  
  // Greeting with minimal additional words (still clearly a greeting, not an info request)
  const casualGreetings = [
    /^hi there$/,
    /^hello there$/,
    /^hey there$/,
    /^hi\s+(alonso|parrot)$/,
    /^hello\s+(alonso|parrot)$/,
    /^good morning\s+(alonso|parrot)?$/,
    /^good afternoon\s+(alonso|parrot)?$/,
    /^good evening\s+(alonso|parrot)?$/,
    /^hi\s+how\s+are\s+you\??$/,
    /^hello\s+how\s+are\s+you\??$/,
    /^hey\s+how\s+are\s+you\??$/,
    /^how\s+are\s+you\s+doing\??$/,
    /^how\s+are\s+things\??$/,
    /^what's\s+up\??$/,
    /^whats\s+up\??$/,
    /^how's\s+it\s+going\??$/,
    /^hows\s+it\s+going\??$/
  ];
  
  // Check simple greetings first
  if (simpleGreetings.some(pattern => pattern.test(content))) {
    return true;
  }
  
  // Check casual greetings
  if (casualGreetings.some(pattern => pattern.test(content))) {
    return true;
  }
  
  // Exclude messages that contain question words that indicate information seeking
  const questionIndicators = [
    /\b(what|when|where|who|why|how|which|can|could|would|should|do|does|did|is|are|will|tell|explain|show|find|help|book|reserve|recommend|suggest)\b/
  ];
  
  // If it contains question indicators, it's likely not just a greeting
  if (questionIndicators.some(pattern => pattern.test(content))) {
    // Unless it's a very short greeting with how are you
    if (content.length < 25 && /^(hi|hello|hey)\s+how\s+are\s+you\??$/.test(content)) {
      return true;
    }
    return false;
  }
  
  return false;
}

function generateGreetingResponse(sessionId, messages) {
  const isFirstMessage = messages.length <= 1;
  
  // Base greeting responses (warm and welcoming)
  const baseGreetings = [
    "Good day! Welcome to Coral Beach & Tennis Club.",
    "Hello there! Lovely to have you with us.",
    "Good day and welcome!",
    "Hello! What a pleasure to greet you.",
    "Welcome to the Club! Good day to you.",
    "Hello and welcome! Hope you're having a wonderful day.",
    "Good day! Delighted to see you here."
  ];
  
  // Alonso introductions (use occasionally for variety)
  const alonsoIntros = [
    "Good day—this is Alonso, the Club's resident Amazon parrot. Lovely to meet you!",
    "Hello there! I'm Alonso, your feathered concierge here at the Club.",
    "Good day! Alonso here—I'm the Amazon parrot who's been welcoming guests for years.",
    "Hello! I'm Alonso, the Club's beloved parrot, and I'm here to help."
  ];
  
  // Follow-up options
  const followUps = [
    "How may I help you plan your stay?",
    "What can I help you with today?",
    "Would you like suggestions for today's activities?",
    "How can I assist you during your visit?",
    "What would you like to know about the Club?",
    "Shall I tell you about today's highlights?",
    "How may I be of service?"
  ];
  
  // Determine if we should use Alonso intro (about 30% chance for first message, 15% for others)
  const useAlonsoIntro = isFirstMessage ? Math.random() < 0.3 : Math.random() < 0.15;
  
  let greeting;
  if (useAlonsoIntro) {
    greeting = alonsoIntros[Math.floor(Math.random() * alonsoIntros.length)];
  } else {
    greeting = baseGreetings[Math.floor(Math.random() * baseGreetings.length)];
  }
  
  // Add follow-up (about 80% of the time)
  const addFollowUp = Math.random() < 0.8;
  if (addFollowUp) {
    const followUp = followUps[Math.floor(Math.random() * followUps.length)];
    greeting += ` ${followUp}`;
  }
  
  return greeting;
}

function detectAccommodationQuery(messages) {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') return false;
  
  const content = String(lastMessage.content || '').toLowerCase();
  const accommodationPatterns = [
    /\b(cottage|cottages|room|rooms|suite|suites|accommodation|accommodations)\b/,
    /\bstay\b.*\b(night|nights|week|weekend)\b/,
    /\b(book|booking|reserve|reservation)\b/,
    /\b(availability|available)\b.*\b(cottage|room|suite)\b/,
    /family.*friendly.*cottage/,
    /ocean.*view.*room/,
    /beach.*access/,
    /how\s+many\s+(room|bed|bedroom|cottage)/,
    /what.*cottage.*best/,
    /largest.*cottage/,
    /private.*cottage/,
    /(surfsong|skerries|breakers|stowaways|high\s+tidings|wheelhouse|bay\s+grape|enchanted\s+trifle|crow.?s?\s+nest)/,
    /(barefoot\s+way|noontide\s+sun)/,
    /deluxe.*room/,
    /superior.*room/,
    /standard.*room/
  ];
  
  return accommodationPatterns.some(pattern => pattern.test(content));
}

async function loadAccommodationsData() {
  try {
    const accommodationsPath = path.join(process.cwd(), 'data', 'accommodations.yaml');
    const fileContent = fs.readFileSync(accommodationsPath, 'utf-8');
    return yaml.load(fileContent);
  } catch (error) {
    safeLog('Accommodations Error', error.message);
    return null;
  }
}

async function fetchClubWeather() {
  try {
    // Initialize weather service if needed
    if (!weatherService.initialized) {
      await weatherService.initialize();
    }
    
    // Fetch weather using new service with unified response
    const weatherData = await weatherService.getCurrentWeather({
      units: WEATHER_UNITS.METRIC // We'll convert for display
    });
    
    // Extract temperature values from formatted strings
    const tempMatch = weatherData.current.temp.match(/(\d+)/);
    const tempC = tempMatch ? parseInt(tempMatch[1]) : 20;
    const tempF = Math.round((tempC * 9/5) + 32);
    
    // Extract wind speed value
    const windMatch = weatherData.current.wind_speed.match(/(\d+)/);
    const windSpeed = windMatch ? parseInt(windMatch[1]) : 0;
    
    // Extract wind direction
    const windDirMatch = weatherData.current.wind_speed.match(/from the (\w+)/);
    const windDirection = windDirMatch ? windDirMatch[1] : 'variable';
    
    return {
      success: true,
      temperature: tempC,
      temperatureF: tempF,
      humidity: weatherData.current.humidity,
      windSpeed: windSpeed,
      windDirection: windDirection,
      description: weatherData.current.condition,
      provider: weatherData.provider,
      isStale: weatherData.is_stale,
      unit: '°C'
    };
  } catch (error) {
    safeLog('Weather', 'Chat integration error:', error.message);
    return {
      success: false,
      error: error.message || 'fetch_failed'
    };
  }
}

async function fetchClubTime() {
  try {
    // Use America/Halifax as it follows same DST rules as Bermuda
    // Atlantic/Bermuda might not be available in all environments
    const tz = 'America/Halifax';
    const now = new Date();
    
    const time = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true
    }).format(now);
    
    const date = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric'
    }).format(now);
    
    return { 
      timeZone: 'Atlantic/Bermuda', 
      time, 
      date, 
      offsetMinutes: -240,
      success: true 
    };
  } catch (error) {
    safeLog('Time', 'Fetch error:', error.message);
    // Return a basic fallback
    const now = new Date();
    return { 
      timeZone: 'Atlantic/Bermuda',
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      date: now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      offsetMinutes: -240,
      success: false
    };
  }
}

async function fetchWaterTemperature() {
  try {
    // Bermuda coordinates (approximately Coral Beach Club location)
    const latitude = 32.3439;
    const longitude = -64.8430;
    
    // Open-Meteo Marine API for sea surface temperature
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&current=ocean_current_velocity,ocean_current_direction,wave_height,wave_direction,wave_period&hourly=wave_height,wave_direction,wave_period&daily=wave_height_max,wave_period_max&timezone=Atlantic%2FBermuda`;
    
    // Try the marine API first
    try {
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        
        // Check if we have current ocean data
        if (data.current) {
          // Marine API doesn't always have SST, so we'll use a different approach
          // Fall back to regular weather API with apparent temperature as proxy
          throw new Error('SST not available in marine API response');
        }
      }
    } catch (marineError) {
      // Fall back to using weather API for water temperature estimation
      // Open-Meteo doesn't provide direct SST, so we'll use a calculation based on air temp
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature&timezone=Atlantic%2FBermuda`;
      
      const weatherResponse = await fetch(weatherUrl);
      if (weatherResponse.ok) {
        const weatherData = await weatherResponse.json();
        
        if (weatherData.current) {
          const airTemp = weatherData.current.temperature_2m;
          
          // Bermuda water temperature estimation based on air temperature and season
          // Water temp is more stable than air temp
          const month = new Date().getMonth();
          let waterTempC;
          
          // Seasonal adjustments for Bermuda's waters
          if (month >= 5 && month <= 9) {
            // Summer: June-October (water warmer, lags behind air)
            waterTempC = Math.min(29, Math.max(24, airTemp - 1));
          } else if (month >= 2 && month <= 4) {
            // Spring: March-May
            waterTempC = Math.min(22, Math.max(18, airTemp - 3));
          } else if (month >= 10 || month <= 1) {
            // Winter: November-February
            waterTempC = Math.min(20, Math.max(17, airTemp - 2));
          }
          
          const waterTempF = Math.round((waterTempC * 9/5) + 32);
          
          return {
            success: true,
            temperatureC: Math.round(waterTempC),
            temperatureF: waterTempF,
            isEstimate: true,
            source: 'estimated',
            description: getWaterDescription(waterTempC)
          };
        }
      }
    }
    
    // If all APIs fail, return seasonal average
    return getSeasonalWaterTemp();
    
  } catch (error) {
    safeLog('Water Temperature', 'Fetch error:', error.message);
    return getSeasonalWaterTemp();
  }
}

function getWaterDescription(tempC) {
  if (tempC >= 27) return "perfect for swimming";
  if (tempC >= 24) return "refreshing and pleasant";
  if (tempC >= 21) return "cool but swimmable";
  if (tempC >= 18) return "brisk";
  return "quite cool";
}

function getSeasonalWaterTemp() {
  const month = new Date().getMonth();
  let tempC, tempF, season;
  
  // Bermuda seasonal water temperatures (based on historical averages)
  if (month >= 6 && month <= 9) {
    // July-October: Peak season
    tempC = 28;
    tempF = 82;
    season = 'summer';
  } else if (month >= 4 && month <= 5) {
    // May-June: Late spring/early summer
    tempC = 24;
    tempF = 75;
    season = 'late spring';
  } else if (month >= 2 && month <= 3) {
    // March-April: Spring
    tempC = 20;
    tempF = 68;
    season = 'spring';
  } else {
    // November-February: Winter
    tempC = 19;
    tempF = 66;
    season = 'winter';
  }
  
  return {
    success: true,
    temperatureC: tempC,
    temperatureF: tempF,
    isEstimate: false,
    isSeasonal: true,
    season: season,
    source: 'seasonal average',
    description: getWaterDescription(tempC)
  };
}

async function handleHoursQuery(messages, knowledgeBase) {
  const lastMessage = messages[messages.length - 1];
  const content = String(lastMessage.content || '').toLowerCase();
  
  // Extract potential venue from the query
  const venuePatterns = [
    { pattern: /front\s+desk|reception|check.?in/, venue: 'front desk', hours: '7:00 AM–11:00 PM daily' },
    { pattern: /spa|wellness/, venue: 'spa', hours: null }, // Check knowledge base
    { pattern: /tennis\s+shop|pro\s+shop/, venue: 'tennis shop', hours: null },
    { pattern: /restaurant|dining|coral\s+room|beach\s+terrace/, venue: 'restaurant', hours: null },
    { pattern: /bar|frozen\s+hut/, venue: 'bar', hours: null },
    { pattern: /fitness|gym/, venue: 'fitness center', hours: null }
  ];
  
  let detectedVenue = null;
  let knownHours = null;
  
  for (const {pattern, venue, hours} of venuePatterns) {
    if (pattern.test(content)) {
      detectedVenue = venue;
      knownHours = hours;
      break;
    }
  }
  
  // If we found a venue with predefined hours, return immediately
  if (detectedVenue && knownHours) {
    if (detectedVenue === 'front desk') {
      return {
        success: true,
        venue: 'Front Desk',
        hours: knownHours,
        reply: `Our Front Desk is open ${knownHours}. Would you like help with arrivals, late check-in, or luggage assistance?`
      };
    }
  }
  
  // If no specific venue detected, ask for clarification
  if (!detectedVenue) {
    return {
      success: true,
      venue: null,
      hours: null,
      reply: "Which specific area or outlet did you have in mind? We have the Front Desk, Spa, Tennis Shop, restaurants, and several other venues with different hours."
    };
  }
  
  // For other venues, we'd typically check the knowledge base here
  // For now, provide a general response
  return {
    success: true,
    venue: detectedVenue,
    hours: null,
    reply: `I'd be happy to help with ${detectedVenue} hours. Let me check our current schedule for you.`
  };
}


export async function POST(req) {
  try {
    // Validate request size and structure
    const validation = await validateRequest(req, 'chat');
    if (!validation.valid) {
      return new Response(JSON.stringify({ 
        error: validation.error,
        reply: "I apologize, but there seems to be an issue with your message. " + validation.error
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    // Use tiered rate limiting for chat
    const tierCheck = checkRateLimitTier(req, 'chat');
    if (!tierCheck.allowed) {
      return new Response(JSON.stringify({
        error: "Rate limit exceeded",
        reply: tierCheck.message || "I need a moment to catch my breath! Please wait a few seconds before sending another message. 🦜",
        retryAfter: tierCheck.retryAfter
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(tierCheck.retryAfter),
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Date.now() + tierCheck.retryAfter * 1000)
        }
      });
    }
    
    const { messages = [] } = await req.json();
    
    // Validate conversation for injection attempts
    const conversationCheck = validateConversation(messages);
    if (!conversationCheck.valid) {
      return new Response(JSON.stringify({ 
        error: "Invalid conversation",
        reply: "I apologize, but there seems to be an issue with your message. Please try rephrasing your question about Coral Beach Club."
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const lastMessage = messages[messages.length - 1];
    const userQuery = lastMessage?.content || '';
    
    // Check for cached response first (for common queries)
    const cachedResponse = getCachedResponse(userQuery);
    if (cachedResponse) {
      return new Response(JSON.stringify({ 
        provider: "anthropic",
        model: getClaudeModel(),
        reply: cachedResponse
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Check for prompt injection and moderation needs
    const moderationCheck = checkModeration(userQuery);
    if (moderationCheck.needsModeration && moderationCheck.action === 'block') {
      safeLog('Moderation', 'Blocked message due to:', moderationCheck.action);
      return new Response(JSON.stringify({ 
        error: "Content moderation",
        reply: moderationCheck.message
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Get IP for analytics (hashed, never stored raw)
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    
    // Session tracking
    const sessionId = getSessionId(req);
    await trackSession(sessionId, ip);
    
    // Track page view if this is first message in session
    if (messages.length <= 1) {
      await trackPageView(sessionId, '/chat', ip);
    }
    
    // Track user interaction
    await trackInteraction(sessionId, 'chat_message', {
      messageCount: messages.length,
      queryLength: userQuery.length
    }, ip);
    
    // Log chat message event (existing)
    await logEvent('CHAT_MESSAGE', { 
      messageCount: messages.length 
    }, { sessionId, ip });
    
    // Check if this is a news query and return link-only response immediately
    if (detectNewsQuery(messages)) {
      const newsResponse = {
        provider: "anthropic",
        model: getClaudeModel(),
        reply: "Here are today's trusted local news sources:\n• The Royal Gazette — https://www.royalgazette.com/\n• Bernews — https://bernews.com/\n\nI can't fetch headlines directly right now, but those links will always have the latest Bermuda stories."
      };
      
      return new Response(JSON.stringify(newsResponse), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          ...getSessionHeaders(sessionId)
        }
      });
    }
    
    // Check if this is a simple greeting and handle it directly
    if (detectGreeting(messages)) {
      const userMessage = messages[messages.length - 1]?.content || '';
      
      // Get conversation history to check if first-time visitor
      const conversationHistory = getRelevantContext(sessionId, userMessage);
      const isFirstTime = isFirstTimeVisitor(userMessage, conversationHistory.relevantExchanges);
      
      let greetingReply;
      
      if (isFirstTime) {
        // Use comprehensive first-time welcome
        try {
          const currentTime = await fetchClubTime();
          const currentWeather = await fetchClubWeather();
          const timeGreeting = getTimeAwareGreeting(currentTime);
          const weatherContext = getWeatherContext(currentWeather);
          greetingReply = getFirstTimeWelcome(timeGreeting, weatherContext);
        } catch (error) {
          safeLog('First Time Greeting', 'Error generating first-time welcome:', error.message);
          greetingReply = generateGreetingResponse(sessionId, messages);
        }
      } else {
        // Use standard greeting
        greetingReply = generateGreetingResponse(sessionId, messages);
      }
      
      // Store greeting in conversation memory
      try {
        addToConversationHistory(sessionId, userMessage, greetingReply);
      } catch (error) {
        safeLog('Memory', 'Error storing greeting:', error.message);
      }
      
      const greetingResponse = {
        provider: "anthropic",
        model: getClaudeModel(),
        reply: greetingReply
      };
      
      return new Response(JSON.stringify(greetingResponse), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          ...getSessionHeaders(sessionId)
        }
      });
    }
    
    // Check if this is a farewell message and handle it directly
    if (isFarewellMessage(messages[messages.length - 1]?.content || '')) {
      const userMessage = messages[messages.length - 1]?.content || '';
      
      let farewellReply;
      try {
        const currentTime = await fetchClubTime();
        const currentWeather = await fetchClubWeather();
        farewellReply = generateFarewellResponse(currentTime, currentWeather);
      } catch (error) {
        safeLog('Farewell System', 'Error generating farewell:', error.message);
        farewellReply = "Thank you for visiting with me! I hope you have a wonderful time at Coral Beach & Tennis Club.";
      }
      
      // Store farewell in conversation memory
      try {
        addToConversationHistory(sessionId, userMessage, farewellReply);
      } catch (error) {
        safeLog('Memory', 'Error storing farewell:', error.message);
      }
      
      const farewellResponse = {
        provider: "anthropic",
        model: getClaudeModel(),
        reply: farewellReply
      };
      
      return new Response(JSON.stringify(farewellResponse), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          ...getSessionHeaders(sessionId)
        }
      });
    }
    
    // Check if this is a hours query and handle it directly (PRIORITY OVER TIME)
    if (detectHoursQuery(messages)) {
      const hoursData = await handleHoursQuery(messages);
      
      // Store hours query in conversation memory
      try {
        const userMessage = messages[messages.length - 1]?.content || '';
        addToConversationHistory(sessionId, userMessage, hoursData.reply);
      } catch (error) {
        safeLog('Memory', 'Error storing hours query:', error.message);
      }
      
      const hoursResponse = {
        provider: "anthropic",
        model: getClaudeModel(),
        reply: hoursData.reply
      };
      
      return new Response(JSON.stringify(hoursResponse), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          ...getSessionHeaders(sessionId)
        }
      });
    }
    
    // Check if this is a time query and handle it directly (AFTER hours check)
    if (detectTimeQuery(messages)) {
      const userMessage = messages[messages.length - 1]?.content || '';
      const timeData = await fetchClubTime();
      let timeReply;
      
      if (timeData.success) {
        timeReply = `Here at the Club it's ${timeData.time} on ${timeData.date}`;
        
        // Add coordinated suggestion (prevents stacking with other systems)
        const suggestion = getCoordinatedSuggestion(userMessage, timeReply, timeData, null, null);
        timeReply += ` - ${suggestion}`;
      } else {
        timeReply = "I'm having a spot of trouble with the club clock right now. Let me give you my best estimate based on Atlantic time—it should be around the current local time for Bermuda. While you're here, would you like to know about our current activities and amenities?";
      }
      
      const timeResponse = {
        provider: "anthropic",
        model: getClaudeModel(), 
        reply: timeReply
      };
      
      return new Response(JSON.stringify(timeResponse), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          ...getSessionHeaders(sessionId)
        }
      });
    }
    
    // Check if this is a water temperature query and handle it directly
    if (detectWaterTemperatureQuery(messages)) {
      const waterData = await fetchWaterTemperature();
      let waterReply;
      
      if (waterData.success) {
        if (waterData.isSeasonal) {
          // Using seasonal average
          waterReply = `The ocean temperature typically ranges around ${waterData.temperatureC}°C (${waterData.temperatureF}°F) during ${waterData.season} — ${waterData.description}. These are seasonal averages for Bermuda's waters.`;
        } else if (waterData.isEstimate) {
          // Using estimation based on current conditions
          waterReply = `The ocean's around ${waterData.temperatureC}°C (${waterData.temperatureF}°F) right now — ${waterData.description}! Perfect day for a dip in our beautiful turquoise waters.`;
        } else {
          // Direct SST measurement (if available)
          waterReply = `The ocean temperature is ${waterData.temperatureC}°C (${waterData.temperatureF}°F) — ${waterData.description}! The water's calling your name.`;
        }
      } else {
        waterReply = "I can't check the exact ocean temperature right now, but Bermuda's waters typically range from 19°C (66°F) in winter to 28°C (82°F) in summer — always refreshing for a swim!";
      }
      
      const waterResponse = {
        provider: "anthropic",
        model: getClaudeModel(),
        reply: waterReply
      };
      
      return new Response(JSON.stringify(waterResponse), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          ...getSessionHeaders(sessionId)
        }
      });
    }
    
    // Check if this is a weather query and handle it directly
    if (detectWeatherQuery(messages)) {
      const userMessage = messages[messages.length - 1]?.content || '';
      const weatherData = await fetchClubWeather();
      let weatherReply;
      
      if (weatherData.success) {
        const dataFreshness = weatherData.isStale ? 'recent' : 'current';
        weatherReply = `Here are the ${dataFreshness} conditions at Coral Beach & Tennis Club: ${weatherData.temperature}°C (${weatherData.temperatureF}°F), ${weatherData.description}. Humidity is ${weatherData.humidity}% with winds at ${weatherData.windSpeed} km/h from the ${weatherData.windDirection}.`;
        
        // Add coordinated suggestion (prevents stacking with other systems)
        const suggestion = getCoordinatedSuggestion(userMessage, weatherReply, null, weatherData, null);
        weatherReply += ` ${suggestion}`;
      } else {
        weatherReply = "I'm having trouble reaching our weather service right now, but I can tell you that the Club enjoys Bermuda's lovely subtropical climate year-round. Our indoor amenities like the spa, dining rooms, and Main Lounge are always comfortable and welcoming. Would you like to know more about our facilities?";
      }
      
      const weatherResponse = {
        provider: "anthropic",
        model: getClaudeModel(),
        reply: weatherReply
      };
      
      return new Response(JSON.stringify(weatherResponse), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          ...getSessionHeaders(sessionId)
        }
      });
    }
    
    // New FAQ interception logic using Fuse.js
    const FAQ_ENABLED = process.env.FAQ_ENABLED !== 'false'; // Default true
    const FAQ_MIN_SCORE = parseFloat(process.env.FAQ_MIN_SCORE || '0.68');
    const FAQ_RETURN_TOP = parseInt(process.env.FAQ_RETURN_TOP || '1', 10);
    const FAQ_SHOW_BADGE = process.env.FAQ_SHOW_BADGE === 'true';
    
    if (FAQ_ENABLED) {
      // Initialize FAQs if needed
      await initFaqs();
      
      // Search FAQs using new Fuse.js system
      const { hits } = searchFaqsNew(userQuery, FAQ_RETURN_TOP);
      
      // Track search query
      await trackSearch(sessionId, userQuery, hits.length, ip);
      
      if (hits.length > 0) {
        const best = hits[0];
        // Fuse.js returns scores where 0 = perfect match, 1 = no match
        // For our threshold check, we need to check if score is LOW enough (good match)
        const fuseScore = best.score || 0;
        
        // High confidence - return FAQ directly
        // Check if Fuse score is low enough (lower = better match)
        if (fuseScore <= FAQ_MIN_SCORE) {
          await logEvent('FAQ_HIT', { 
            faqId: best.id, 
            score: 1 - fuseScore  // Convert to confidence for logging
          }, { sessionId, ip });
          
          const prefix = FAQ_SHOW_BADGE ? '(From FAQs) ' : '';
          const faqResponse = {
            provider: "faq",
            model: "direct",
            reply: `${prefix}${best.a}`,
            mode: 'faq'
          };
          
          return new Response(JSON.stringify(faqResponse), {
            status: 200,
            headers: { 
              "Content-Type": "application/json",
              ...getSessionHeaders(sessionId)
            }
          });
        } else {
          // Low confidence - log as miss
          await logEvent('FAQ_MISS', { 
            topScore: 1 - fuseScore,  // Convert to confidence for logging
            ipHash: ip
          }, { sessionId, ip });
        }
      } else {
        // No FAQ matches
        await logEvent('FAQ_MISS', { 
          topScore: 0,
          ipHash: ip
        }, { sessionId, ip });
      }
    }

    const systemPrompt = readText("prompts/system_cbc_agent.md");
    
    // Use topic-aware selective KB loading
    const kbSections = loadRelevantKBContent(userQuery);
    let knowledgeContent = "";
    
    // Always load canonical facts first
    const canonicalFacts = readText("data/canonical_facts.md");
    knowledgeContent += `\n## CANONICAL FACTS (Always Reference First):\n${canonicalFacts}\n\n`;
    
    // Add topic-specific sections
    for (const section of kbSections) {
      if (section.source !== 'canonical_facts') {
        knowledgeContent += `\n## ${section.source}:\n${section.content}\n\n`;
      }
    }
    
    // Log which sections were loaded for debugging
    const kbTrace = getKBTrace(kbSections);
    safeLog('KB Loading', `Query topic detection - ${kbTrace}`);
    
    // Check if we need clarification
    const clarifyingQuestion = getClarifyingQuestion(userQuery);
    if (clarifyingQuestion && messages.length <= 1) {
      knowledgeContent += `\nNote: If the user's intent is unclear, consider asking: "${clarifyingQuestion}"\n`;
    }
    
    // Harden system prompt against injection  
    const baseSystem = `${systemPrompt}\n\nKnowledge Base (Topic-Selective Loading):\n${knowledgeContent}`;
    let system = hardenSystemPrompt(baseSystem);
    
    // ALWAYS fetch and inject current time (for context awareness)
    const timeData = await fetchClubTime();
    if (timeData.success) {
      system += `\n\n**CURRENT TIME AT THE CLUB**: ${timeData.time} on ${timeData.date}
Note: You always have access to the current time. Reference it naturally when relevant to the conversation.`;
    } else {
      // Graceful fallback for time - still provide approximation without claiming live check
      system += `\n\n**TIME STATUS**: Having a spot of trouble with the club clock—when asked about time, I'll give my best estimate based on Atlantic time (UTC-4/UTC-3 depending on daylight saving).`;
    }
    
    // ALWAYS fetch and inject current weather (for context awareness)
    // Weather fetch - no PII to log
    const weatherData = await fetchClubWeather();
    // Weather data retrieved - no PII
    
    if (weatherData.success) {
      const dataFreshness = weatherData.isStale 
        ? 'RECENT WEATHER DATA (cached)' 
        : 'LIVE WEATHER DATA';
        
      system += `\n\n**${dataFreshness}** - Current conditions at Coral Beach & Tennis Club:
- Temperature: ${weatherData.temperature}°C (${weatherData.temperatureF}°F)
- Conditions: ${weatherData.description}
- Humidity: ${weatherData.humidity}%
- Wind: ${weatherData.windSpeed} km/h from the ${weatherData.windDirection}
- Source: ${weatherData.provider}

Note: You always have access to current weather conditions. Reference them naturally when relevant to the conversation (e.g., activity recommendations, clothing suggestions, outdoor dining, etc.). ${weatherData.isStale ? 'This is recent cached data.' : 'This is live real-time data.'}`;
    } else {
      // Graceful fallback message - no pretense of live checking
      system += `\n\n**WEATHER STATUS**: It's quiet on the line—when I can't reach our weather service, I'll still share the latest typical conditions for this time of year if asked. The club enjoys Bermuda's subtropical climate year-round.`;
    }
    
    // Check if this is an accommodation query and load detailed data
    if (detectAccommodationQuery(messages)) {
      const accommodationsData = await loadAccommodationsData();
      if (accommodationsData) {
        system += `\n\nREMINDER - Accommodation Answering Rules:
1. NEVER quote specific rates - say "rates vary by season and type - contact Reservations"
2. NEVER claim availability - say "please check with Reservations for availability"
3. Always provide: reservations@coralbeach.bm or +1 (441) 239-7201
4. Mention member priority and 15% discount when relevant
5. Note that all rates include daily breakfast

You have access to detailed accommodation data to help guests understand their options, but always defer to Reservations for rates and availability.`;
      }
    }

    // Helper function to finalize response with enhanced Alonso features and memory
    const finalizeResponse = async (responseText, provider, model) => {
      // Prepare context for Alonso snippet logic
      const isFirstTurn = messages.length <= 1;
      const userMessage = messages[messages.length - 1]?.content || '';
      const turnIndex = Math.floor(messages.length / 2); // Approximate turn index
      
      // Check if this is a critical task (form submission, etc.)
      const isCriticalTask = (
        responseText.includes('submitReservation') ||
        responseText.includes('consent') ||
        responseText.includes('Your reference number is') ||
        userMessage.toLowerCase().includes('submit') ||
        userMessage.toLowerCase().includes('confirm')
      );
      
      // Check if this is a greeting interaction
      const isUserGreeting = isGreetingMessage(userMessage, isFirstTurn);
      const wasGreeting = (
        responseText.includes('Hello') ||
        responseText.includes('Hi ') ||
        responseText.includes('Welcome') ||
        responseText.includes('Good day')
      );

      // Enhanced greeting logic with first-time visitor detection
      let finalText = responseText;
      if (isUserGreeting && !isCriticalTask) {
        try {
          const currentTime = await fetchClubTime();
          const currentWeather = await fetchClubWeather();
          
          // Check if this is a first-time visitor for comprehensive welcome
          const conversationHistory = getRelevantContext(sessionId, userMessage);
          const isFirstTime = isFirstTimeVisitor(userMessage, conversationHistory.relevantExchanges);
          
          if (isFirstTime) {
            // Generate comprehensive first-time welcome
            const timeGreeting = getTimeAwareGreeting(currentTime);
            const weatherContext = getWeatherContext(currentWeather);
            finalText = getFirstTimeWelcome(timeGreeting, weatherContext);
          } else if (wasGreeting) {
            // Use standard greeting enhancement for returning visitors
            finalText = enhanceGreeting(responseText, currentTime, currentWeather);
          }
        } catch (error) {
          safeLog('Greeting Enhancement', 'Error enhancing greeting:', error.message);
          // Continue with original greeting on error
        }
      }

      // Get conversational context for memory enhancement
      let contextualEnhancement = null;
      try {
        if (!isCriticalTask && !isFirstTurn) {
          contextualEnhancement = generateContextualReference(sessionId, userMessage, finalText);
        }
      } catch (error) {
        safeLog('Memory', 'Error generating contextual reference:', error.message);
      }

      // Enhanced context with new features
      const context = {
        userMessage,
        isFirstTurn,
        isCriticalTask,
        turnIndex,
        messageCount: messages.length,
        isFormSubmission: isCriticalTask,
        responseLength: finalText.length,
        responseText: finalText,
        wasGreeting,
        topicsDetected: [detectMessageTopic(userMessage)]
      };
      
      // Apply conversational memory enhancements
      if (contextualEnhancement && !isCriticalTask) {
        try {
          // Add contextual prefix if available
          if (contextualEnhancement.contextualPrefix) {
            finalText = contextualEnhancement.contextualPrefix + finalText;
          }
          
          // Insert guest name naturally if appropriate
          if (contextualEnhancement.shouldUseName && contextualEnhancement.guestName) {
            // Find a natural place to insert the name (after comma, before period, etc.)
            const nameInsertions = [
              // After "Since..." phrase
              /(Since [^,]+), /g,
              // Before suggestions
              /(Let me suggest|I'd suggest|I recommend|You might enjoy|How about) /g,
              // After "well" or "certainly"
              /(Well|Certainly), /g
            ];
            
            let nameInserted = false;
            for (const pattern of nameInsertions) {
              if (pattern.test(finalText)) {
                finalText = finalText.replace(pattern, `$1, ${contextualEnhancement.guestName}, `);
                nameInserted = true;
                break;
              }
            }
            
            // Fallback: add name at the end of first sentence
            if (!nameInserted && finalText.includes('.')) {
              const firstSentenceEnd = finalText.indexOf('.');
              if (firstSentenceEnd > 50) { // Only if sentence is substantial
                finalText = finalText.substring(0, firstSentenceEnd) + `, ${contextualEnhancement.guestName}` + finalText.substring(firstSentenceEnd);
              }
            }
          }
        } catch (error) {
          safeLog('Memory Enhancement', 'Error applying memory enhancement:', error.message);
          // Continue with original text on error
        }
      }
      
      // Add weather-aware activity suggestions if response mentions activities
      const mentionsActivity = /\b(activity|activities|do|outdoor|beach|walk|tennis|golf|garden|explore)\b/i.test(finalText);
      if (mentionsActivity && !isCriticalTask) {
        try {
          const currentWeather = await fetchClubWeather();
          const currentTime = await fetchClubTime();
          const outdoorSuitability = isOutdoorWeatherSuitable(currentWeather, currentTime);
          
          if (!outdoorSuitability.suitable && outdoorSuitability.safeToRecommend) {
            // Add indoor alternatives suggestion
            const indoorSuggestion = getIndoorAlternatives(outdoorSuitability.reason);
            finalText += ` ${outdoorSuitability.message} ${indoorSuggestion}`;
          } else if (!outdoorSuitability.safeToRecommend) {
            // API failed, use safe fallback
            const safeFallback = getSafeActivityFallback();
            finalText += ` ${safeFallback}`;
          }
        } catch (error) {
          safeLog('Weather Activity Check', 'Error in activity suggestion enhancement:', error.message);
          // Continue without enhancement on error
        }
      }

      // Add follow-up question (if not critical task and response is substantial)
      if (!isCriticalTask && !wasGreeting && responseText.length > 50 && messages.length > 1) {
        try {
          const mainTopic = detectMessageTopic(userMessage);
          // Track recent follow-ups (simple last 3 messages check)
          const recentFollowUps = messages.slice(-6).map(m => m.content || '').filter(Boolean);
          const followUp = generateFollowUp(mainTopic, recentFollowUps);
          
          if (followUp) {
            // Add follow-up with proper spacing
            finalText += ` ${followUp}`;
          }
        } catch (error) {
          safeLog('Follow-up', 'Error generating follow-up:', error.message);
          // Continue without follow-up on error
        }
      }

      // Add coordinated suggestion (prevents stacking - single suggestion system)
      if (!isCriticalTask && !isUserGreeting) {
        try {
          // Detect query topic from KB routing
          let queryTopic = null;
          const userMessageLower = userMessage.toLowerCase();
          if (userMessageLower.includes('dinin') || userMessageLower.includes('restaurant') || userMessageLower.includes('eat')) {
            queryTopic = 'dining';
          } else if (userMessageLower.includes('tennis') || userMessageLower.includes('court')) {
            queryTopic = 'tennis';
          } else if (userMessageLower.includes('spa') || userMessageLower.includes('massage') || userMessageLower.includes('wellness')) {
            queryTopic = 'spa';
          } else if (userMessageLower.includes('beach') || userMessageLower.includes('swim') || userMessageLower.includes('water')) {
            queryTopic = 'beach';
          } else if (userMessageLower.includes('room') || userMessageLower.includes('stay') || userMessageLower.includes('cottage')) {
            queryTopic = 'accommodation';
          }
          
          // Get single coordinated suggestion (70% chance to avoid over-suggesting)
          if (Math.random() < 0.7) {
            const suggestion = getCoordinatedSuggestion(userMessage, finalText, timeData, weatherData, queryTopic);
            if (suggestion && suggestion.trim() !== '') {
              finalText += ` ${suggestion}`;
            }
          }
          
        } catch (error) {
          safeLog('Coordinated Suggestions', 'Error adding coordinated suggestion:', error.message);
          // Continue without suggestions on error
        }
      }
      
      // Get enhanced Alonso features
      const alonsoEnabled = process.env.ALONSO_PERSONA_ENABLED !== 'false'; // Default true
      
      if (alonsoEnabled) {
        try {
          // Original Alonso persona system
          const snippet = maybeGetAlonsoSnippet(sessionId, context);
          if (snippet) {
            finalText = finalText + (finalText.endsWith('.') || finalText.endsWith('?') ? ' ' : '. ') + snippet;
          }
          
          // Occasionally add new parrot snippets (separate from persona system)
          const parrotSnippet = getParrotSnippet(context);
          if (parrotSnippet && !snippet) { // Don't double up on personality
            finalText = finalText + (finalText.endsWith('.') || finalText.endsWith('?') ? ' ' : '. ') + parrotSnippet;
          }
          
          // Filter final response for safety
          finalText = filterResponse(finalText);
        } catch (error) {
          safeLog('Alonso Enhanced', 'Error adding enhanced features:', error.message);
          // Continue without enhancement on error
        }
      }
      
      // Store conversation in memory for future reference (after all processing)
      try {
        if (!isCriticalTask) {
          addToConversationHistory(sessionId, userMessage, finalText);
        }
      } catch (error) {
        safeLog('Memory Storage', 'Error storing conversation:', error.message);
        // Continue without storing - not critical to response
      }
      
      // Cache response for common queries (after all processing)
      try {
        if (!isCriticalTask && !contextualEnhancement) {
          setCachedResponse(userMessage, finalText);
        }
      } catch (error) {
        safeLog('Response Cache', 'Error caching response:', error.message);
        // Continue without caching - not critical to response
      }
      
      return { provider, model, reply: finalText };
    };

    // Use coordinated LLM with intelligent fallback
    const llmResult = await getFromLLM({ system, messages });
    const finalResponse = await finalizeResponse(llmResult.text, llmResult.provider, llmResult.model);
    return new Response(JSON.stringify(finalResponse), {
      status: 200, headers: { 
        "Content-Type": "application/json",
        ...getSessionHeaders(sessionId)
      },
    });
  } catch (err) {
    // Safely extract error information
    const errorMessage = err?.message || err?.toString() || 'Unknown error';
    safeLog('API Error', errorMessage);
    
    return new Response(JSON.stringify({ 
      error: "I apologize, but I encountered an error. Please try again.",
      reply: "I apologize, but I encountered an error. Please try again."
    }), {
      status: 500, 
      headers: { "Content-Type": "application/json" },
    });
  }
}