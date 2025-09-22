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

// Process reply to replace weather placeholders
async function processReply(reply, req) {
  if (reply.includes('{weather}') || reply.includes('<weather_check>')) {
    console.log('[Chat] Replacing weather placeholder with live data');
    const weatherData = await fetchWeatherData(req);
    const weatherText = formatWeatherData(weatherData);
    let processedReply = reply.replace('{weather}', weatherText);
    processedReply = processedReply.replace(/<weather_check>\s*<\/weather_check>/g, weatherText);
    return processedReply;
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
        const processedReply = await processReply(reply, req);
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
      const processedReply = await processReply(reply, req);
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