// ═══════════════════════════════════════════════════════
// FEED FUNCTION — Generates the article feed
// Uses Gemini to produce newsworthy article cards
// ═══════════════════════════════════════════════════════

import { genAI } from './gemini-config.js';

const FEED_PROMPT = `You are the editorial AI engine for "THE SIGNAL", an autonomous newsroom covering culture, trends, and the stories shaping how people live, think, and create.

Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

Generate exactly 8 article cards for today's front page. These must feel like REAL newsroom-quality stories — the kind readers find on The Verge, Bloomberg, Wired, or The Atlantic. They should cover genuinely compelling cultural and trend topics happening in the world right now.

Topics to draw from (mix broadly):
- AI and technology's impact on daily life
- Social media trends and viral phenomena
- Gaming culture and industry
- Music, film, streaming culture
- Fashion, beauty, wellness trends
- Internet culture and creator economy
- Science and space breakthroughs
- Economic trends affecting young professionals
- Environmental and sustainability movements
- Sports and esports culture

For EACH article, provide:
1. title: A compelling, editorial-quality headline (not clickbait, not generic)
2. slug: URL-safe version of the title (lowercase, hyphens)
3. topic: Single category word (like "Technology", "Culture", "Gaming", "Music", "Business", "Science", "Internet", "Wellness")
4. excerpt: 2-3 sentences that hook the reader with genuine insight (not fluff)
5. readingTime: estimated minutes (5-12)
6. date: Today's date formatted as "Apr 2, 2026" style

CRITICAL RULES:
- Headlines must sound like real journalism, not AI-generated filler
- Excerpts should reveal a genuine angle or insight, not just describe the topic
- Each story should feel like it justifies a deep investigation
- Vary the topics — don't cluster in one area
- Make readers WANT to click

Respond ONLY with a valid JSON object in this exact format:
{
  "articles": [
    {
      "title": "...",
      "slug": "...",
      "topic": "...",
      "excerpt": "...",
      "readingTime": 7,
      "date": "..."
    }
  ],
  "trending": [
    {
      "name": "Topic Name",
      "slug": "topic-slug",
      "velocity": "2.4k"
    }
  ]
}

Include 8 articles and 7 trending topics. Trending topics should be single concepts (2-4 words max) with a velocity number representing social momentum.`;

export default async function handler(req, context) {
  // Handle CORS
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
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.9,
        topP: 0.95,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(FEED_PROMPT);
    const text = result.response.text();
    const data = JSON.parse(text);

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300', // Cache 5 min
      },
    });
  } catch (error) {
    console.error('Feed generation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate feed', details: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
}

export const config = {
  path: '/api/feed',
};
