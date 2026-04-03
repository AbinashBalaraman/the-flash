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
      model: 'meta/llama-3.1-70b-instruct',
      systemInstruction: `You are "Signal AI", the specialized analytical intelligence desk of the Signal AI Newsroom. You are a senior investigative editor managing a serious reporting pipeline.
      
      CORE RESPONSE RULES:
      1. Conversational Greeting: If the reader says "hi", "hello", "thanks", or similar conversational filler, DO NOT summarize the article. Simply respond naturally (e.g. "Desk active. I've analyzed the technical and geopolitical details of this story—what specific aspect would you like to verify?").
      2. Analytical Questions: If the reader asks a question about the article, provide a sharp, executive-level answer (2-4 sentences) based ONLY on the provided context. Maintain strict journalistic integrity.
      3. No Echoing: Never repeat the user's message.
      4. Signal Persona: Maintain a cold, professional, high-intelligence, and rigorous persona. You are an automated news desk, not a chatbot. No conversational fluff.
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


