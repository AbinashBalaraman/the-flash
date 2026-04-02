// ═══════════════════════════════════════════════════════
// ARTICLE FUNCTION — Generates full-length articles
// Deep, investigative-quality journalism via Gemini
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
    const { slug } = await req.json();
    if (!slug) {
      return new Response(JSON.stringify({ error: 'Slug is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const topic = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const ARTICLE_PROMPT = `You are a senior investigative journalist at "THE SIGNAL", an AI-native newsroom known for producing some of the most insightful cultural analysis in digital media. Your work is compared to the best of The Atlantic, Wired, and Bloomberg's feature reporting.

Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

Write a FULL investigative article about: "${topic}"

EDITORIAL STANDARDS:
- Open with a compelling lede that draws readers in with a vivid scene, surprising fact, or provocative question
- Use the "inverted pyramid" meets "narrative journalism" approach
- Include specific data points, statistics, and named examples (you may use plausible, representative examples)
- Present multiple perspectives - analyze what they MEAN
- Include expert-style analysis and "why this matters" framing
- Use transitions that maintain narrative momentum
- Build to a conclusion that reframes how the reader thinks about this topic
- The piece should feel like something you'd share with a colleague and say "you need to read this"

STRUCTURE REQUIREMENTS:
- 1,200-1,800 words
- 3-4 major sections with H2 subheadings
- At least one blockquote (as a pull-quote or notable statistic highlight)
- Use strong, specific language - not vague AI-speak
- End with a forward-looking conclusion

WHAT TO AVOID:
- Generic filler paragraphs
- Starting with "In today's rapidly changing world..."
- Listing things without analysis
- Hedging every statement
- Sounding like a corporate press release
- Using phrases like "it's worth noting" or "it remains to be seen"

Respond ONLY with valid JSON:
{
  "title": "The article headline",
  "deck": "A one-sentence summary that adds context beyond the headline (like a newspaper subhead)",
  "topic": "Category",
  "date": "Apr 2, 2026",
  "readingTime": 8,
  "body": "<p>Full article HTML with <h2>, <p>, <blockquote>, <strong>, <em>, <ul>, <li> tags. NO <h1> tag.</p>"
}

The "body" field must be valid HTML using only: p, h2, h3, blockquote, strong, em, ul, ol, li tags.`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.85,
        topP: 0.92,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(ARTICLE_PROMPT);
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
    console.error('Article generation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate article', details: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
}

export const config = {
  path: '/api/article',
};
