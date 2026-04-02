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

    const QA_PROMPT = `You are an expert analyst at THE SIGNAL newsroom. A reader has a follow-up question about one of your articles.

ARTICLE CONTEXT:
${articleContext.substring(0, 3000)}

READER'S QUESTION:
${question}

Answer the question thoughtfully and concisely (2-4 sentences). Draw from the article's context but also bring in relevant broader knowledge. Be direct and informative. If the question is unrelated to the article, politely redirect to the article's topic.`;

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
