// ═══════════════════════════════════════════════════════
// ARTICLE FUNCTION — Generates full-length articles
// Uses cached templates + real headlines as fallback
// ═══════════════════════════════════════════════════════

import { genAI } from './gemini-config.js';
import { debugStore } from './utils.js';

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
    const { slug, forceRefresh } = await req.json();
    if (!slug) {
      return new Response(JSON.stringify({ error: 'Slug is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const url = new URL(req.url);
    const store = debugStore("vibeathon-store");
    const topic = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    let cachedArticle = null;
    try {
        if (!forceRefresh) {
            cachedArticle = await store.getJSON(`article_${slug}`);
        } else {
            console.log(`[🚀 FORCE] Refresh requested for article_${slug}. Bypassing cache.`);
        }
        if (cachedArticle) {
            const isStillGenerating = cachedArticle.isGenerating === true;
            const hasError = !!cachedArticle.error;
            const startTime = cachedArticle.timestamp || 0;
            const now = Date.now();
            const timeoutMs = 5 * 60 * 1000; // 5 mins

            if (hasError) {
                console.log(`[🚩 ERROR CACHE] Article ${slug} has a stored error. Returning to UI.`);
                return new Response(JSON.stringify(cachedArticle), {
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' },
                });
            }

            if (isStillGenerating && (now - startTime < timeoutMs)) {
                console.log(`[⏳ LOCKED] Article ${slug} is already being generated.`);
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
      const categoryMap = { 'technology': 'technology', 'business': 'business', 'science': 'science', 'general': 'general', 'health': 'health' };
      const searchCategory = Object.keys(categoryMap).find(c => topic.toLowerCase().includes(c)) || 'technology';
      const res = await fetch(`${NEWS_API}/top-headlines/category/${searchCategory}/us.json`);
      const data = await res.json();
      if (data.articles && data.articles.length > 0) {
        // Require at least 2 matching significant keywords if topic is multi-word
        const keywords = topic.toLowerCase().split(' ').filter(k => k.length > 3);
        articleContent = data.articles.find(a => {
            if (!a.title) return false;
            const titleLow = a.title.toLowerCase();
            const matchCount = keywords.filter(k => titleLow.includes(k)).length;
            return keywords.length > 1 ? matchCount >= 2 : matchCount >= 1;
        });
        
        // Final fallback: just a generic "Live processing" if no topical match found
        if (!articleContent) {
            console.log(`[ARTICLE] No matching fallback for ${topic}, using generic processing state.`);
        }
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

    // 2. Lock the Store and Clear Logs immediately
    try {
        await store.setJSON(`article_${slug}`, placeholder);
        await store.delete(`logs_${slug}`).catch(() => {}); // Clear old logs
        console.log(`Successfully locked article_${slug} and cleared old logs.`);
    } catch (sErr) {
        console.error('Failed to set placeholder lock:', sErr.message);
    }
    
    // 3. FIRE AND FORGET — trigger background generator
    // CRITICAL: Do NOT await this. The main function must return the placeholder instantly.
    try {
        const bgUrl = `${url.origin}/api/article-generator-background`;
        const bgPromise = fetch(bgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug, topic })
        }).catch(err => console.log('Background trigger failed:', err.message));
        if (context && context.waitUntil) context.waitUntil(bgPromise);
        console.log('Fired fire-and-forget background request to /api/article-generator-background.');
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


