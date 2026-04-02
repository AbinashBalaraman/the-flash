// ═══════════════════════════════════════════════════════
// ASK FUNCTION — Q&A on specific articles
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
    const { context: articleContext, question } = await req.json();
    if (!question || !articleContext) {
      return new Response(JSON.stringify({ error: 'Question and context are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const QA_PROMPT = `You are an expert analyst at DailyAI newsroom. A reader is messaging you about one of your articles.
    
ARTICLE CONTEXT:
${articleContext.substring(0, 3000)}

READER MESSAGE:
${question}

Instructions:
1. If the reader asks a direct question, answer it thoughtfully and concisely (2-4 sentences) using the article context and broader knowledge.
2. If the reader says something conversational (e.g. "hi", "hello", "thanks", "wow"), acknowledge it warmly and briefly, and invite them to ask a specific question about the article. Do NOT say "you haven't provided a question".
3. Be direct and informative. No filler.

ANTI-PATTERNS (DO NOT USE THESE EVER):
- "In today's rapidly evolving digital landscape..."
- "It remains to be seen..."
- "Let's delve into/dive into..."
- "Furthermore", "Moreover", "In conclusion"`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,
      },
    });

    const result = await model.generateContent(QA_PROMPT);
    const answer = result.response.text();

    return new Response(JSON.stringify({ answer }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Q&A error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to answer question', details: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
}

export const config = {
  path: '/api/ask',
};
