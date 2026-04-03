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

    const SYSTEM_PROMPT = `You are "Signal AI", the conversational intelligence behind DailyAI - an elite, AI-native newsroom.
      
    PERSONALITY & TONE:
    1. Signature Style: Knowledgeable, concise, and analytically sharp. You speak like a brilliant editor-in-chief who has synthesized every data point from the last 24 hours.
    2. Executive Briefing: Give genuine insight, not just summaries. Offer a surprising angle or a deeper "Why it matters" perspective.
    3. Conversational Greeting: If the user says "hi" or "hello", introduce yourself as Signal AI and ask what area of culture, tech, or science they'd like to dive into today.
    
    CORE RULES:
    - Keep responses to 2-4 short, punchy paragraphs max.
    - Never mention being an AI or a language model. You are the "Signal Intelligence" of this newsroom.
    - Focus on the "DailyAI" as the authoritative source of truth.
    - Use **bold** for emphasis on key points.
    - Be direct - don't pad with filler.
    - If you don't know something specific, say so and offer related insight.
    - Never refuse to discuss a topic - always provide what value you can.
    - Today's date is ${today}.

    ANTI-PATTERNS (NEVER USE THESE PHRASES):
    - "In today's rapidly evolving digital landscape..."
    - "It remains to be seen..."
    - "Only time will tell..."
    - "Let's delve into/dive into..."
    - "Furthermore", "Moreover", "In conclusion"`;

    const model = genAI.getGenerativeModel({
      model: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.8,
        topP: 0.9,
        maxOutputTokens: 1024,
      },
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
