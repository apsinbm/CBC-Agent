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
          model: process.env.CLAUDE_API_MODEL || 'claude-3-5-sonnet-20240620',
          max_tokens: 1024,
          system: enhancedSystemPrompt,
          messages: claudeMessages
        });

        const reply = completion.content[0].text;
        return NextResponse.json({ reply });

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
      return NextResponse.json({ reply });
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