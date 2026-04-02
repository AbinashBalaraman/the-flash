// ═══════════════════════════════════════════════════════
// DIGEST FUNCTION — Daily digest of top stories
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

  try {
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const DIGEST_PROMPT = `You are the digest editor at "THE SIGNAL", an AI-native newsroom. Create today's Daily Digest - a 60-second briefing on the 5 most important cultural and trend stories.

Date: ${today}

For each of the 5 stories, provide:
1. A compelling headline
2. A slug (URL-safe)
3. A 2-3 sentence summary that tells readers WHY this matters, not just WHAT happened

The stories should span different domains: tech, culture, entertainment, business, science/health. Each summary should be insightful enough that it stands alone as useful information.

Respond ONLY with valid JSON:
{
  "date": "${today}",
  "stories": [
    {
      "title": "Headline here",
      "slug": "headline-slug",
      "summary": "2-3 sentence summary with genuine insight."
    }
  ]
}`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.85,
        topP: 0.9,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(DIGEST_PROMPT);
    const text = result.response.text();
    const data = JSON.parse(text);

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=600',
      },
    });
  } catch (error) {
    console.error('Digest generation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate digest', details: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
}

export const config = {
  path: '/api/digest',
};
