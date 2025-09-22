import { NextResponse } from "next/server";
import { anthropic } from "@/src/lib/anthropic";
import OpenAI from "openai";
import fs from 'fs';
import path from 'path';

// Initialize OpenAI for fallback
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Load system prompt
let systemPrompt = "You are Alonso, the friendly resident Amazon parrot at Coral Beach & Tennis Club in Bermuda.";
try {
  const promptPath = path.join(process.cwd(), 'prompts', 'system_cbc_agent.md');
  systemPrompt = fs.readFileSync(promptPath, 'utf-8');
} catch (error) {
  console.warn('Could not load system prompt, using fallback');
}

// Bermuda coordinates for weather
const BERMUDA_COORDS = { lat: 32.2949, lon: -64.7820 };

// Fetch weather data for Bermuda
async function fetchWeatherData(req) {
  try {
    // Get the base URL from the request
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3001';
    const baseUrl = `${protocol}://${host}`;

    const response = await fetch(`${baseUrl}/api/weather?lat=${BERMUDA_COORDS.lat}&lon=${BERMUDA_COORDS.lon}`, {
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (!response.ok) {
      throw new Error(`Weather API returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn('Failed to fetch weather:', error.message);
    return null;
  }
}

// Format weather data for display
function formatWeatherData(weatherData) {
  if (!weatherData || !weatherData.current) {
    return "I'm unable to fetch the current weather information at the moment. However, I'd be happy to suggest some wonderful activities that are enjoyable regardless of the weather conditions.";
  }

  const { current } = weatherData;
  const provider = weatherData.provider || 'weather service';

  return `The current weather here at Coral Beach & Tennis Club is ${current.condition} with a temperature of ${current.temp} (feels like ${current.feels_like}). Humidity is at ${current.humidity}% with winds at ${current.wind_speed}.

${getWeatherSuggestion(current)}`;
}

// Get activity suggestions based on weather
function getWeatherSuggestion(current) {
  // Extract temperature number for comparison
  const tempMatch = current.temp.match(/(\d+)/);
  const temp = tempMatch ? parseInt(tempMatch[1]) : 20;

  const isRainy = current.condition.toLowerCase().includes('rain') || current.condition.toLowerCase().includes('storm');
  const isCloudy = current.condition.toLowerCase().includes('cloud') || current.condition.toLowerCase().includes('overcast');
  const isWindy = current.wind_speed && parseInt(current.wind_speed.match(/(\d+)/)?.[1] || '0') > 25;

  if (isRainy || temp < 18) {
    return "Perfect weather for enjoying our indoor amenities - perhaps a relaxing spa treatment, a visit to our fitness center, or dining in our elegant Main Dining Room with its beautiful ocean views.";
  } else if (isCloudy && !isWindy) {
    return "Lovely conditions for a stroll through our gardens, a game of tennis on our championship courts, or relaxing by our famous pink sand beach.";
  } else if (temp > 24 && !isWindy) {
    return "Perfect weather for our beach activities! Our pink sand beach is calling, or you might enjoy a refreshing swim, some watersports, or simply lounging poolside.";
  } else {
    return "Great conditions to explore all our outdoor amenities - from tennis and beach activities to our beautiful walking paths and gardens.";
  }
}

// Activity alternatives for weather conditions
const ACTIVITY_ALTERNATIVES = {
  tennis: {
    rainy: ['squash', 'fitness center', 'spa treatments', 'indoor dining'],
    hot: ['early morning tennis', 'spa treatments', 'beach activities', 'pool'],
    windy: ['squash', 'fitness center', 'spa treatments'],
    cold: ['squash', 'fitness center', 'spa treatments', 'hot beverages in the Main Lounge']
  },
  beach: {
    rainy: ['spa treatments', 'fitness center', 'Main Dining Room', 'shopping'],
    cold: ['spa treatments', 'heated pool', 'hot tub', 'indoor dining'],
    windy: ['spa treatments', 'shopping', 'Main Dining Room']
  },
  golf: {
    rainy: ['squash', 'fitness center', 'spa treatments', 'putting green (covered)'],
    windy: ['putting green practice', 'fitness center', 'spa treatments'],
    cold: ['putting green practice', 'fitness center', 'spa treatments']
  },
  outdoor: {
    rainy: ['spa treatments', 'fitness center', 'Main Lounge', 'shopping'],
    cold: ['spa treatments', 'fitness center', 'heated indoor areas'],
    windy: ['spa treatments', 'fitness center', 'Main Lounge']
  }
};

// Service hours and availability
const SERVICE_HOURS = {
  'front desk': '24/7',
  'concierge': '6:00 AM - 11:00 PM',
  'spa': '8:00 AM - 8:00 PM',
  'fitness center': '6:00 AM - 10:00 PM',
  'tennis': '7:00 AM - 9:00 PM',
  'squash': '7:00 AM - 9:00 PM',
  'main dining': '7:00 AM - 10:00 PM',
  'beach service': '9:00 AM - 6:00 PM',
  'pool service': '9:00 AM - 8:00 PM'
};

// Analyze user message for activity requests and provide intelligent suggestions
function getSmartActivitySuggestions(userMessage, weatherData, currentTime) {
  const message = userMessage.toLowerCase();
  const hour = new Date(currentTime).getHours();
  const isLateNight = hour < 6 || hour > 22;
  const isEarlyMorning = hour >= 6 && hour < 9;

  let suggestions = '';

  // Check for specific activities mentioned
  const activities = {
    tennis: message.includes('tennis'),
    beach: message.includes('beach') || message.includes('sand') || message.includes('swim') || message.includes('swimming'),
    golf: message.includes('golf') || message.includes('putting'),
    spa: message.includes('spa') || message.includes('massage'),
    dining: message.includes('eat') || message.includes('lunch') || message.includes('dinner') || message.includes('restaurant'),
    outdoor: message.includes('outside') || message.includes('outdoor') || message.includes('walk')
  };

  // Current weather conditions
  const current = weatherData.current;
  const isRainy = current.condition.includes('rain') || current.condition.includes('storm');
  const windSpeed = parseInt(current.wind_speed.match(/(\d+)/)?.[1] || '0');
  const isWindy = windSpeed > 25;
  const tempNum = parseInt(current.temp.match(/(\d+)/)?.[1] || '20');
  const isCold = tempNum < 18;
  const isHot = tempNum > 30;


  // Check forecast for planning ahead
  let forecastWarning = '';
  if (weatherData.hourly && weatherData.hourly.length > 0) {
    const nextFewHours = weatherData.hourly.slice(0, 6);
    const rainExpected = nextFewHours.some(h => h.rain_chance === 'high');
    if (rainExpected && !isRainy) {
      forecastWarning = ' Note that rain is expected in the next few hours, so you might want to consider indoor alternatives.';
    }
  }

  // Late night handling
  if (isLateNight) {
    suggestions += '\n\n**Late Night Service**: Most of our amenities have limited hours at this time. Our front desk (available 24/7) can assist you, or you might enjoy a quiet evening in the Main Lounge. Most services will resume at 6:00 AM.';
    return suggestions;
  }

  // Activity-specific suggestions
  for (const [activity, isRequested] of Object.entries(activities)) {
    if (isRequested) {
      if (activity === 'tennis' && (isRainy || isWindy || isCold)) {
        const alternatives = ACTIVITY_ALTERNATIVES.tennis[isRainy ? 'rainy' : isWindy ? 'windy' : 'cold'];
        suggestions += `\n\n**Tennis Alternative**: Due to current ${isRainy ? 'rainy' : isWindy ? 'windy' : 'cool'} conditions, I'd recommend our ${alternatives.slice(0, 2).join(' or ')} instead. Our squash court is excellent for racquet sports when weather doesn't cooperate!`;
      }

      if (activity === 'beach' && (isRainy || isCold || isWindy)) {
        const alternatives = ACTIVITY_ALTERNATIVES.beach[isRainy ? 'rainy' : isCold ? 'cold' : 'windy'];
        suggestions += `\n\n**Beach Alternative**: With current conditions, you might prefer our ${alternatives.slice(0, 2).join(' or ')}. When conditions improve, our pink sand beach will be waiting!`;
      }

      if (activity === 'outdoor' && (isRainy || isWindy || isCold)) {
        const alternatives = ACTIVITY_ALTERNATIVES.outdoor[isRainy ? 'rainy' : isWindy ? 'windy' : 'cold'];
        suggestions += `\n\n**Indoor Options**: Given the current weather, I'd suggest our ${alternatives.slice(0, 2).join(' or ')} for a comfortable experience.`;
      }
    }
  }

  // Add forecast warning if applicable
  suggestions += forecastWarning;

  // Service hours reminders for early morning
  if (isEarlyMorning) {
    suggestions += '\n\n**Early Morning**: Most services are just opening. The fitness center and tennis courts are available, with full service beginning around 9:00 AM.';
  }

  return suggestions;
}

// Process reply to replace weather placeholders and add intelligent suggestions
async function processReply(reply, req, userMessage) {
  if (reply.includes('{weather}') || reply.includes('<weather_check>')) {
    console.log('[Chat] Replacing weather placeholder with live data');
    const weatherData = await fetchWeatherData(req);
    const weatherText = formatWeatherData(weatherData);
    let processedReply = reply.replace('{weather}', weatherText);
    processedReply = processedReply.replace(/<weather_check>\s*<\/weather_check>/g, weatherText);
    return processedReply;
  }

  // Only add suggestions if user is asking about activities, not general weather
  const isActivityQuery = /tennis|beach|golf|spa|outdoor|swim|walk|play|activity|do|plans/i.test(userMessage);

  if (isActivityQuery) {
    console.log('[Chat] Adding intelligent activity suggestions');
    const weatherData = await fetchWeatherData(req);
    if (weatherData) {
      const suggestions = getSmartActivitySuggestions(userMessage, weatherData, new Date().toISOString());
      if (suggestions.trim()) {
        return reply + suggestions;
      }
    }
  }

  return reply;
}

export async function POST(req) {
  try {
    const { messages } = await req.json();

    // Validate request format
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" }, 
        { status: 400 }
      );
    }

    // Get current time and add context
    const now = new Date();
    const bermudaTime = now.toLocaleString('en-US', {
      timeZone: 'America/Halifax', // Bermuda timezone
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });

    const timeContext = `\n\nCURRENT TIME AND DATE: ${bermudaTime} (Atlantic/Bermuda time)`;
    const enhancedSystemPrompt = systemPrompt + timeContext;

    // Try Anthropic first (primary provider)
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 10) {
      try {
        const claudeMessages = messages.map(msg => ({
          role: msg.role === 'system' ? 'user' : msg.role,
          content: msg.content
        }));

        const completion = await anthropic.messages.create({
          model: process.env.CLAUDE_API_MODEL || 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: enhancedSystemPrompt,
          messages: claudeMessages
        });

        const reply = completion.content[0].text;
        const userMessage = messages[messages.length - 1]?.content || '';
        const processedReply = await processReply(reply, req, userMessage);
        return NextResponse.json({ reply: processedReply });

      } catch (anthropicError) {
        console.error('Anthropic API Error:', anthropicError);
        
        // Fall back to OpenAI if enabled
        if (process.env.FALLBACK_ENABLED !== 'false' && process.env.OPENAI_API_KEY) {
          console.log('Falling back to OpenAI...');
        } else {
          throw anthropicError;
        }
      }
    }

    // OpenAI fallback
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 10) {
      const openaiMessages = [
        { role: "system", content: enhancedSystemPrompt },
        ...messages
      ];

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_FALLBACK_MODEL || "gpt-4o-mini",
        messages: openaiMessages,
        max_tokens: 1024
      });

      const reply = completion.choices[0].message.content;
      const userMessage = messages[messages.length - 1]?.content || '';
      const processedReply = await processReply(reply, req, userMessage);
      return NextResponse.json({ reply: processedReply });
    }

    // No providers available
    return NextResponse.json(
      { error: "No LLM providers are properly configured" },
      { status: 503 }
    );

  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: "I apologize, but I encountered an error. Please try again." },
      { status: 500 }
    );
  }
}