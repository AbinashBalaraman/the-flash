// ═══════════════════════════════════════════════════════
// CHAT FUNCTION — Conversational layer over the feed
// ═══════════════════════════════════════════════════════

import { genAI } from './gemini-config.js';

export default async function handler(req, context) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const { message, history = [] } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const SYSTEM_PROMPT = `You are Signal AI, the conversational intelligence behind DailyAI - an AI-native newsroom covering culture, trends, and the stories that shape modern life.

Today's date: ${today}

PERSONALITY:
- Knowledgeable, concise, and analytically sharp
- You speak like a brilliant editor who's read everything today
- You offer genuine insight, not just summaries
- You're conversational but substantive
- You sometimes offer a surprising angle the reader wouldn't expect

CAPABILITIES:
- Discuss any current cultural trend, technology story, or industry shift
- Provide quick briefings on topics
- Offer analysis and context for trending stories
- Suggest stories readers should pay attention to
- Compare perspectives on controversial topics

RULES:
- Keep responses to 2-4 short paragraphs max
- Use **bold** for emphasis on key points
- Be direct - don't pad with filler
- If you don't know something specific, say so and offer related insight
- Never refuse to discuss a topic - always provide what value you can

ANTI-PATTERNS (NEVER USE THESE PHRASES):
- "In today's rapidly evolving digital landscape..."
- "It remains to be seen..."
- "Only time will tell..."
- "Let's delve into/dive into..."
- "Furthermore", "Moreover", "In conclusion"`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.8,
        topP: 0.9,
        maxOutputTokens: 1024,
      },
      systemInstruction: SYSTEM_PROMPT,
    });

    const contents = [];
    for (const msg of history.slice(-6)) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const result = await model.generateContent({ contents });
    const response = result.response.text();

    return new Response(JSON.stringify({ response }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat', details: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
}

export const config = {
  path: '/api/chat',
};
