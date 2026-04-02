// ═══════════════════════════════════════════════════════
// ARTICLE FUNCTION — Generates full-length articles
// Uses cached templates + real headlines as fallback
// ═══════════════════════════════════════════════════════

import { genAI } from './gemini-config.js';
import { getStore } from '@netlify/blobs';

const NEWS_API = 'https://saurav.tech/NewsAPI';

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

    const url = new URL(req.url);
    const store = getStore("vibeathon-store");
    const topic = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    let cachedArticle = null;
    try {
        cachedArticle = await store.getJSON(`article_${slug}`);
        if (cachedArticle) {
            const isStillGenerating = cachedArticle.isGenerating === true;
            const startTime = cachedArticle.timestamp || 0;
            const now = Date.now();
            const timeoutMs = 5 * 60 * 1000; // 5 mins

            if (isStillGenerating && (now - startTime < timeoutMs)) {
                console.log(`Article ${slug} is already being generated (Locked). Returning status.`);
                return new Response(JSON.stringify(cachedArticle), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'no-cache',
                    },
                });
            }
            
            if (!isStillGenerating) {
                console.log(`Serving complete article_${slug} from Blobs cache.`);
                return new Response(JSON.stringify(cachedArticle), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'no-cache',
                    },
                });
            }
            
            console.log(`Article ${slug} generation marker is stale (>5m). Re-triggering.`);
        }
    } catch (blobErr) {
        console.warn('Blob article read failed or not initialized:', blobErr.message);
    }

    // --- FALLBACK / TRIGGER LOGIC ---
    
    // Fetch real article news context if possible
    let articleContent = null;
    try {
      const categoryMap = { 'technology': 'technology', 'business': 'business', 'science': 'science', 'sports': 'sports' };
      const searchCategory = Object.keys(categoryMap).find(c => topic.toLowerCase().includes(c)) || 'technology';
      const res = await fetch(`${NEWS_API}/top-headlines/category/${searchCategory}/us.json`);
      const data = await res.json();
      if (data.articles && data.articles.length > 0) {
        articleContent = data.articles.find(a => a.title && topic.toLowerCase().includes(a.title.toLowerCase().split(' ')[0])) || data.articles[0];
      }
    } catch (e) {
      console.log('NewsAPI context fetch failed:', e.message);
    }

    // 1. Prepare Placeholder Data
    const placeholder = {
       isGenerating: true,
       timestamp: Date.now(),
       title: articleContent ? articleContent.title : topic,
       deck: "Real-time coverage from the wire.",
       topic: topic,
       date: today,
       readingTime: 2,
       body: `<p>${articleContent ? (articleContent.description || 'Live coverage incoming...') : 'Live coverage of this event is ongoing. We are experiencing high traffic, reducing the full AI processing capability temporarily.'}</p><hr><p class="dynamic-ai-tag"><i>Live Analysis Processing...</i></p><p><em>Our autonomous 253B-parameter engine is currently in the background generating the full feature article for this story. It will dynamically load here automatically as soon as it's ready.</em></p>`
    };

    // 2. Lock the Store immediately
    try {
        await store.setJSON(`article_${slug}`, placeholder);
        console.log(`Successfully locked article_${slug} (isGenerating: true)`);
    } catch (sErr) {
        console.error('Failed to set placeholder lock:', sErr.message);
    }
    
    // 3. Trigger Background Process (Async)
    try {
        const bgUrl = `${url.origin}/api/article-generator-background`;
        // We await the trigger because Netlify Background functions return 202 quickly.
        // This ensures the request is actually sent before the main function returns.
        await fetch(bgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug, topic })
        }).catch(err => console.log('Background trigger failed:', err.message));
        console.log('Fired async background request to /api/article-generator-background.');
    } catch(err) {
        console.log('Could not fire background article request:', err);
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
