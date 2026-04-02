// ═══════════════════════════════════════════════════════
// FEED FUNCTION — Generates the article feed
// Uses real news from free APIs + AI for transformation
// ═══════════════════════════════════════════════════════

import { genAI } from './gemini-config.js';
import { getStore } from '@netlify/blobs';

const NEWS_APIS = [
  {
    name: 'saurav.tech',
    base: 'https://saurav.tech/NewsAPI',
    categories: ['technology', 'business', 'science', 'sports'],
    endpoint: (cat, country) => `/top-headlines/category/${cat}/${country}.json`
  },
  {
    name: 'gnews.io',
    base: 'https://gnews.io/api/v4',
    categories: ['technology', 'business', 'science', 'sports', 'health'],
    endpoint: (cat) => `/top headlines?category=${cat}&lang=en&max=10`,
    requiresKey: true
  }
];

const FALLBACK_API = 'https://newsdata.io/api/1/news';

async function fetchFromSauravAPI(category, country = 'us') {
  try {
    const res = await fetch(`https://saurav.tech/NewsAPI/top-headlines/category/${category}/${country}.json`);
    const data = await res.json();
    
    if (data.articles && data.articles.length > 0) {
      return data.articles
        .filter(a => a.title && a.description && !a.title.includes('[Removed]'))
        .map(a => ({
          title: a.title,
          description: a.description,
          category: category,
          source: a.source?.name,
          url: a.url,
          publishedAt: a.publishedAt
        }));
    }
  } catch (e) {
    console.error(`Saurav API failed for ${category}:`, e.message);
  }
  return null;
}

async function fetchRealHeadlines() {
  // Try primary API (saurav.tech - no key required)
  const categories = ['technology', 'business', 'science', 'sports'];
  const headlines = [];
  
  for (const category of categories) {
    const articles = await fetchFromSauravAPI(category);
    if (articles) {
      headlines.push(...articles);
    }
  }
  
  // If primary fails, try fallback
  if (headlines.length < 5) {
    console.log('Primary API insufficient, trying fallback...');
    try {
      const fallbackRes = await fetch(`https://hacker-news.firebaseio.com/v0/topstories.json`);
      const storyIds = await fallbackRes.json();
      
      const topStories = storyIds.slice(0, 20);
      for (const id of topStories.slice(0, 8)) {
        const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        const story = await storyRes.json();
        
        if (story && story.title) {
          headlines.push({
            title: story.title,
            description: `${story.type?.toUpperCase()} from Hacker News`,
            category: 'technology',
            source: 'Hacker News',
            url: story.url || `https://news.ycombinator.com/item?id=${id}`,
            publishedAt: new Date(story.time * 1000).toISOString()
          });
        }
      }
    } catch (e) {
      console.error('Fallback API failed:', e.message);
    }
  }
  
  return headlines;
}

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
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.has('t');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const store = getStore("vibeathon-store");

    if (!forceRefresh && page === 1) {
        // Attempt fast Blob load if not forcing refresh and it's the first page
        try {
            const cachedFeed = await store.getJSON('feed_latest');
            if (cachedFeed) {
                console.log('Serving feed from Blobs cache instantly.');
                return new Response(JSON.stringify(cachedFeed), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=60',
                    },
                });
            }
        } catch (blobErr) {
            console.warn('Blob read failed or not initialized locally:', blobErr.message);
        }
    }

    // Generate manually
    console.log(forceRefresh || page > 1 ? `Generating page ${page}...` : 'No cache found, generating...');
    
    // Fetch real headlines from free news API
    const allHeadlines = await fetchRealHeadlines();
    const startIndex = (page - 1) * 8;
    const headlines = allHeadlines.slice(startIndex, startIndex + 8);
    
    if (headlines.length === 0) {
      throw new Error('No more headlines available from news API');
    }

    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    const TRANSFORM_PROMPT = `You are the Editor-in-Chief for "THE SIGNAL", an elite, autonomous digital newsroom.
    
    Your task is to review the following REAL raw headlines and transform them into EXACTLY 8 compelling article cards and 7 trending topics.
    
    REAL HEADLINES:
    ${headlines.map((h, i) => `[${h.category.toUpperCase()}] ${h.title} - ${h.description || ''}`).join('\n')}
    
    EDITORIAL RULES - DO NOT VIOLATE:
    1. You must ONLY use the topics provided in the headlines above. Do not hallucinate fake news.
    2. Excerpts MUST hook the reader with insight. Do not summarize; analyze.
    3. NO generic filler phrases ("In a surprising turn of events", "Now more than ever", "Delve into").
    
    Respond ONLY with a valid JSON format exact match to this schema:
    {
      "articles": [
        {
          "title": "Editorial headline based on the real headline",
          "slug": "url-safe-slug",
          "topic": "Category Word",
          "excerpt": "A punchy, 2-to-3 sentence hook revealing the core tension.",
          "readingTime": 5, // Integer
          "date": "${today}"
        }
      ],
      "trending": [
        {
          "name": "Topic (1-3 words max)",
          "slug": "topic-slug",
          "velocity": "2.4k" // String with 'k'
        }
      ]
    }`;

    let data;
    try {
      const model = genAI.getGenerativeModel({
        model: 'meta/llama-3.1-8b-instruct',
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent(TRANSFORM_PROMPT);
      let text = result.response.text();
      
      // Safety fallback: sometimes Llama outputs Markdown blocks
      if (text.startsWith('\`\`\`json')) {
        text = text.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '');
      }
      
      data = JSON.parse(text);
    } catch (llmError) {
      console.warn('LLM aborted/timed out for Feed, failing gracefully to raw NewsAPI:', llmError.message);
      
      // Construct fallback JSON payload using raw NewsAPI data
      data = {
          articles: headlines.map((h) => ({
              title: h.title,
              slug: h.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50),
              topic: h.category,
              excerpt: h.description || 'Breaking coverage from the global wire. The AI editorial engine is currently under heavy load.',
              readingTime: 3,
              date: today
          })).slice(0, 8),
          trending: [
              { name: "Live Feed", slug: "live", velocity: "10k" },
              { name: "Global Wire", slug: "wire", velocity: "5k" }
          ]
      };
    }

    // Save newly generated or fallback data to cache, BUT ONLY FOR PAGE 1
    if (page === 1) {
        try {
            await store.setJSON('feed_latest', data);
            console.log('Saved newly generated feed to Blobs.');
        } catch(err) {
            console.warn('Failed to save feed to blob locally', err.message);
        }
    }

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60',
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
