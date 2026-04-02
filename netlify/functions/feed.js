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
    const page = url.searchParams.get('page') || 1;
    const forceRefresh = url.searchParams.has('t');
    const store = getStore("vibeathon-store");
    
    // 1. Attempt to serve from fast Netlify Blobs cache
    if (!forceRefresh) {
        try {
            const cachedFeed = await store.getJSON(`feed_page_${page}`);
            if (cachedFeed) {
                console.log(`Serving feed_page_${page} from Blobs cache instantly.`);
                return new Response(JSON.stringify(cachedFeed), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=60',
                    },
                });
            }
        } catch (blobErr) {
            console.warn('Blob feed read failed or not initialized locally:', blobErr.message);
        }
    }

    // 2. Fetch raw news directly from NewsAPI for the graceful fallback AND for the background prompt
    const categories = ['technology', 'business', 'science', 'sports'];
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
      // Shuffle headlines
      headlines = headlines.sort(() => 0.5 - Math.random()).slice(0, 10);
    } catch (e) {
      console.log('NewsAPI fetch failed:', e.message);
    }
    
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    // 3. Fallback Data Structure to return IMMEDIATELY to prevent hanging
    const fallbackData = {
        articles: headlines.slice(0, 8).map(a => ({
         title: a.title || "Latest Market Movements and Technological Breakthroughs",
         slug: (a.title || "latest-news").toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40),
         topic: "Wire",
         excerpt: a.description || "The newsroom is currently processing deep analytical coverage of this ongoing story. Please check back for updates.",
         readingTime: 3,
         date: today
        })),
        trending: [
         { name: "Artificial Intelligence", slug: "artificial-intelligence", velocity: "12k" },
         { name: "Global Markets", slug: "global-markets", velocity: "8.4k" }
        ]
    };
    
    // 4. FIRE AND FORGET background generator if on Netlify, otherwise return
    try {
        const bgUrl = new URL('/api/feed-generator-background', req.url);
        fetch(bgUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ page, headlines: headlines })
        }).catch(err => console.log('Background trigger failed:', err.message));
        console.log('Fired async background request to /api/feed-generator-background. Returning graceful UI instantly.');
    } catch(err) {
        console.log('Could not fire background request:', err);
    }

    // 5. Return fast 
    return new Response(JSON.stringify(fallbackData), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache', // Important: Don't cache the fallback
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
