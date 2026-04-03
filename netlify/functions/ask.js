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
    console.log(`[Q&A] Question: "${question}" | Context: ${articleContext?.substring(0, 50)}... (${articleContext?.length || 0} chars)`);
    
    if (!question || !articleContext) {
      return new Response(JSON.stringify({ error: 'Question and context are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const model = genAI.getGenerativeModel({
      model: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
      systemInstruction: `You are "Signal AI", the specialized analytical intelligence of the DailyAI Newsroom. 
      
      CORE RESPONSE RULES:
      1. Conversational Greeting: If the reader says "hi", "hello", "thanks", or similar conversational filler, DO NOT summarize the article. Simply respond naturally (e.g. "Hello! I'm Signal AI. I've analyzed the technical details of this story—what specific aspect would you like to dive into?").
      2. Analytical Questions: If the reader asks a question about the article, provide a sharp, executive-level answer (2-4 sentences) based ONLY on the provided context.
      3. No Echoing: Never repeat the user's message.
      4. Signal Persona: Maintain a professional, high-intelligence, yet helpful persona. No conversational fluff beyond the greeting.
      5. Branding: Start responses directly. No "Reader Message" or "Signal AI Response" labels. Just the message.`,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,
      },
    });

    const contents = [
      {
        role: 'user',
        parts: [{ text: `${articleContext.substring(0, 4000)}\n\nQUESTION: ${question}\n\nSIGNAL AI RESPONSE:` }]
      }
    ];

    const result = await model.generateContent({ contents });
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
