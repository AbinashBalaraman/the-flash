// ═══════════════════════════════════════════════════════
// FEED FUNCTION — Generates the article feed
// Uses real news from free APIs + AI for transformation
// ═══════════════════════════════════════════════════════

import { genAI } from './gemini-config.js';
import { debugStore } from './utils.js';

const NEWS_APIS = [
  {
    name: 'saurav.tech',
    base: 'https://saurav.tech/NewsAPI',
    categories: ['general', 'business', 'technology', 'science', 'health'],
    endpoint: (cat, country) => `/top-headlines/category/${cat}/${country}.json`
  },
  {
    name: 'gnews.io',
    base: 'https://gnews.io/api/v4',
    categories: ['general', 'business', 'technology', 'science', 'health'],
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
  const categories = ['general', 'business', 'technology', 'science'];
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
    const page = url.searchParams.get('page') || 1;
    const forceRefresh = url.searchParams.get('forceRefresh') === 'true';

    // 1. Get Base Data
    const res = await fetch(`https://saurav.tech/NewsAPI/top-headlines/category/business/us.json`);
    const data = await res.json();
    const rawHeadlines = data.articles ? data.articles.slice(0, 10) : [];

    // 2. Initialize Blobs & Check Cache
    const store = debugStore("vibeathon-store");
    let cachedFeed = null;
    
    try {
        if (!forceRefresh) {
            cachedFeed = await store.getJSON(`feed_page_${page}`);
        } else {
            console.log(`[🚀 FORCE] Refresh requested for feed_page_${page}. Bypassing cache.`);
        }
        if (cachedFeed) {
            const isStillGenerating = cachedFeed.isGenerating === true;
            const hasError = !!cachedFeed.error;
            const startTime = cachedFeed.timestamp || 0;
            const now = Date.now();
            const timeoutMs = 5 * 60 * 1000; // 5 mins

            if (hasError) {
                console.log(`[🚩 ERROR CACHE] Feed page ${page} has a stored error. Returning to UI.`);
                return new Response(JSON.stringify(cachedFeed), {
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' },
                });
            }

            if (isStillGenerating && (now - startTime < timeoutMs)) {
                console.log(`[⏳ LOCKED] Feed page ${page} is already being generated.`);
                return new Response(JSON.stringify(cachedFeed), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'no-cache',
                    },
                });
            }
            
            if (!isStillGenerating) {
                console.log(`Serving complete feed_page_${page} from Blobs cache.`);
                return new Response(JSON.stringify(cachedFeed), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'no-cache',
                    },
                });
            }
            
            console.log(`Feed page ${page} generation marker is stale. Re-triggering.`);
        }
    } catch (blobErr) {
        console.warn('Blob feed read failed or not initialized:', blobErr.message);
    }

    // --- FALLBACK / TRIGGER LOGIC ---

    // Fetch raw news news context if possible
    const categories = ['general', 'business', 'technology', 'science'];
    let headlines = [];
    try {
      const fetchPromises = categories.map(cat => 
        fetch(`https://saurav.tech/NewsAPI/top-headlines/category/${cat}/us.json`).then(r => r.json())
      );
      const results = await Promise.all(fetchPromises);
      results.forEach(data => {
        if (data.articles && data.articles.length > 0) {
          headlines.push(...data.articles.slice(0, 4).map(a => ({
             title: a.title,
             description: a.description,
             category: Object.keys(data).length > 0 ? a.category : 'news' 
          })));
        }
      });
      headlines = headlines.sort(() => 0.5 - Math.random()).slice(0, 10);
    } catch (e) {
      console.log('NewsAPI context fetch failed:', e.message);
    }

    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    // 1. Prepare Placeholder Data
    const placeholder = {
        isGenerating: true,
        timestamp: Date.now(),
        articles: headlines.slice(0, 8).map(a => ({
         title: a.title || "Latest Market Movements and Technological Breakthroughs",
         slug: (a.title || "latest-news").toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40),
         topic: "Wire",
         excerpt: a.description || "<span class='dynamic-ai-tag'><i>The newsroom is currently processing deep analytical coverage...</i></span>",
         readingTime: 3,
         date: today
        })),
        trending: [
         { name: "Artificial Intelligence", slug: "artificial-intelligence", velocity: "12k" },
         { name: "Global Markets", slug: "global-markets", velocity: "8.4k" }
        ]
    };

    // 2. Lock the Store immediately
    try {
        await store.setJSON(`feed_page_${page}`, placeholder);
        console.log(`Successfully locked feed_page_${page} (isGenerating: true)`);
    } catch (sErr) {
        console.error('Failed to set feed placeholder lock:', sErr.message);
    }
    
    // 3. FIRE AND FORGET — trigger background generator
    // CRITICAL: Do NOT await this. The main function must return the placeholder instantly.
    try {
        const bgUrl = `${url.origin}/api/feed-generator-background`;
        const bgPromise = fetch(bgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ page, headlines: headlines })
        }).catch(err => console.log('Background trigger failed:', err.message));
        // Keep the function context alive for the fire-and-forget request
        if (context && context.waitUntil) context.waitUntil(bgPromise);
        console.log('Fired fire-and-forget background request to /api/feed-generator-background.');
    } catch(err) {
        console.log('Could not fire background request:', err);
    }

    // 4. Return Placeholder Instantly
    return new Response(JSON.stringify(placeholder), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
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
