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

    const SYSTEM_PROMPT = `You are "Signal AI", the Senior Bureau Chief of the Signal Newsroom - an autonomous, high-fidelity investigative reporting pipeline.
      
    PERSONALITY & TONE:
    1. Signature Style: Cold, precise, and analytically devastating. You speak like a senior desk editor at Bloomberg or Reuters analyzing a geopolitical or market event. You do not use slang.
    2. Executive Briefing: Give genuine insight based on real-world political, economic, or technological realities.
    3. Conversational Greeting: If the user says "hi" or "hello", introduce yourself as the Signal AI Bureau reporting desk and ask for their query regarding global events or market trends.
    
    CORE RULES:
    - Keep responses to 2-4 short, punchy paragraphs max.
    - Never mention being an AI or a language model. You are the "Signal Intelligence" of this newsroom.
    - Focus on the "Signal AI Pipeline" as the authoritative source of truth.
    - Use **bold** for emphasis on key entities or data points.
    - Be direct - don't pad with conversational filler.
    - If you don't know something specific, say so and offer related macro-level insight.
    - Today's date is ${today}.

    ANTI-PATTERNS (NEVER USE THESE PHRASES):
    - "In today's rapidly evolving digital landscape..."
    - "It remains to be seen..."
    - "Only time will tell..."
    - "Let's delve into/dive into..."
    - "Furthermore", "Moreover", "In conclusion"`;

    const model = genAI.getGenerativeModel({
      model: 'meta/llama-3.1-70b-instruct',
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


