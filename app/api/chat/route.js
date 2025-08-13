import { anthropic } from "@/src/lib/anthropic";
import { openai } from "@/src/lib/openai";
import fs from "fs";
import path from "path";

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
  const resp = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system,
    messages: toAnthropicMessages(messages),
  });
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

async function fetchClubTime() {
  try {
    const baseURL = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const response = await fetch(`${baseURL}/api/info/time`);
    if (!response.ok) throw new Error('Time fetch failed');
    return await response.json();
  } catch (error) {
    // Fallback to direct Intl usage
    const tz = 'Atlantic/Bermuda';
    const now = new Date();
    const time = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true
    }).format(now);
    const date = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, weekday: 'short', month: 'short', day: 'numeric'
    }).format(now);
    
    return { timeZone: tz, time, date, offsetMinutes: -240 };
  }
}

export async function POST(req) {
  try {
    const { messages = [] } = await req.json();

    const systemPrompt = readText("prompts/system_cbc_agent.md");
    const knowledge = readText("data/cbc_knowledge.md");
    
    let system = `${systemPrompt}\n\nKnowledge Base:\n${knowledge}`;
    
    // Check if this is a time query and fetch current time
    if (detectTimeQuery(messages)) {
      const timeData = await fetchClubTime();
      system += `\n\nCurrent Club Time (Atlantic/Bermuda): ${timeData.time} (${timeData.date})`;
    }

    // Try Anthropic first, then OpenAI
    try {
      const a = await getFromAnthropic({ system, messages });
      return new Response(JSON.stringify({ provider: a.provider, model: a.model, reply: a.text }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    } catch (_) {
      const o = await getFromOpenAI({ system, messages });
      return new Response(JSON.stringify({ provider: o.provider, model: o.model, reply: o.text }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error", detail: String(err?.message || err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}