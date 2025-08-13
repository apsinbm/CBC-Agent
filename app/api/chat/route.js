import { anthropic } from "@/src/lib/anthropic";
import { openai } from "@/src/lib/openai";
import { searchFAQs } from "@/src/lib/faq";
import { initFaqs, searchFaqs as searchFaqsNew, hotReloadInDev } from "@/src/lib/faqs";
import { logEvent } from "@/src/lib/analytics/logEvent";
import { getSessionId, trackSession, trackPageView, trackInteraction, trackSearch, getSessionHeaders } from "@/src/lib/analytics/sessionManager";
import weatherService, { WEATHER_UNITS } from "@/src/lib/weather";
import fs from "fs";
import path from "path";
import * as yaml from "js-yaml";

// Enable hot reload in development
if (process.env.NODE_ENV === 'development') {
  hotReloadInDev();
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
  const model = process.env.CLAUDE_API_MODEL || "claude-3-5-sonnet-20240620";
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
        console.error('Tool execution error:', error);
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
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const resp = await openai.chat.completions.create({
    model,
    max_tokens: 1024,
    messages: toOpenAIMessages(messages, system),
  });
  const text = resp?.choices?.[0]?.message?.content || "";
  return { provider: "openai", model, text };
}

function detectTimeQuery(messages) {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') return false;
  
  const content = String(lastMessage.content || '').toLowerCase();
  const timePatterns = [
    /what.?s?\s+the\s+time/,
    /what\s+time\s+is\s+it/,
    /current\s+time/,
    /time\s+is\s+it/,
    /\btime\b.*\?/,
    /clock/
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
    console.error('Failed to load accommodations data:', error);
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
    console.error('[Weather] Chat integration error:', error);
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
    console.error('Time fetch error:', error);
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


export async function POST(req) {
  try {
    const { messages = [] } = await req.json();
    const lastMessage = messages[messages.length - 1];
    const userQuery = lastMessage?.content || '';
    
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
        model: "claude-3-5-sonnet-20240620",
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
    
    // New FAQ interception logic using Fuse.js
    const FAQ_ENABLED = process.env.FAQ_ENABLED !== 'false'; // Default true
    const FAQ_MIN_SCORE = parseFloat(process.env.FAQ_MIN_SCORE || '0.78');
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
    const knowledge = readText("data/cbc_knowledge.md");
    const diningKnowledge = readText("data/cbc_dining.md");
    const venuesEventsKnowledge = readText("data/cbc_venues_events.md");
    const activitiesKnowledge = readText("data/cbc_activities.md");
    const tennisPickleballKnowledge = readText("data/cbc_tennis_pickleball.md");
    const weddingServicesKnowledge = readText("data/cbc_wedding_services.md");
    
    let system = `${systemPrompt}\n\nKnowledge Base:\n${knowledge}\n\n${diningKnowledge}\n\n${venuesEventsKnowledge}\n\n${activitiesKnowledge}\n\n${tennisPickleballKnowledge}\n\n${weddingServicesKnowledge}`;
    
    // ALWAYS fetch and inject current time (for context awareness)
    const timeData = await fetchClubTime();
    if (timeData.success) {
      system += `\n\n**CURRENT TIME AT THE CLUB**: ${timeData.time} on ${timeData.date}
Note: You always have access to the current time. Reference it naturally when relevant to the conversation.`;
    }
    
    // ALWAYS fetch and inject current weather (for context awareness)
    console.log('[Weather] Fetching current weather for context...');
    const weatherData = await fetchClubWeather();
    console.log('[Weather] Data:', weatherData);
    
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
      system += `\n\n**WEATHER STATUS**: Temporarily unavailable. You may share typical climate patterns for this time of year if asked.`;
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

    // Try Anthropic first, then OpenAI
    try {
      const a = await getFromAnthropic({ system, messages });
      return new Response(JSON.stringify({ provider: a.provider, model: a.model, reply: a.text }), {
        status: 200, headers: { 
          "Content-Type": "application/json",
          ...getSessionHeaders(sessionId)
        },
      });
    } catch (_) {
      const o = await getFromOpenAI({ system, messages });
      return new Response(JSON.stringify({ provider: o.provider, model: o.model, reply: o.text }), {
        status: 200, headers: { 
          "Content-Type": "application/json",
          ...getSessionHeaders(sessionId)
        },
      });
    }
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error", detail: String(err?.message || err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}