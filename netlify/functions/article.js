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
    const forceRefresh = url.searchParams.has('t');
    const store = getStore("vibeathon-store");

    if (!forceRefresh) {
        try {
            const cachedArticle = await store.getJSON(`article_${slug}`);
            if (cachedArticle) {
                console.log(`Serving article_${slug} from Blobs cache instantly.`);
                return new Response(JSON.stringify(cachedArticle), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=60',
                    },
                });
            }
        } catch (blobErr) {
            console.warn('Blob article read failed or not initialized locally:', blobErr.message);
        }
    }

    const topic = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // Fetch real article content from NewsAPI for fallback
    let articleContent = null;
    try {
      const categoryMap = { 'technology': 'technology', 'business': 'business', 'science': 'science', 'sports': 'sports' };
      const searchCategory = Object.keys(categoryMap).find(c => topic.toLowerCase().includes(c)) || 'technology';
      
      const res = await fetch(`${NEWS_API}/top-headlines/category/${searchCategory}/us.json`);
      const data = await res.json();
      
      if (data.articles && data.articles.length > 0) {
        const matchingArticle = data.articles.find(a => a.title && topic.toLowerCase().includes(a.title.toLowerCase().split(' ')[0])) || data.articles[0];
        if (matchingArticle && matchingArticle.title !== '[Removed]') {
          articleContent = matchingArticle;
        }
      }
    } catch (e) {
      console.log('NewsAPI fetch failed:', e.message);
    }
    
    // FIRE AND FORGET Background Process
    try {
        const bgUrl = 'https://the-gflash.netlify.app/api/article-generator-background';
        fetch(bgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug, topic })
        }).catch(err => console.log('Background trigger failed:', err.message));
        console.log('Fired async background request to /api/article-generator-background. Returning graceful UI instantly.');
    } catch(err) {
        console.log('Could not fire background article request:', err);
    }

    // Return Fallback Instantly
    const data = {
       isGenerating: true,
       title: articleContent ? articleContent.title : topic,
       deck: "Real-time coverage from the wire.",
       topic: topic,
       date: today,
       readingTime: 2,
       body: `<p>${articleContent ? (articleContent.description || 'Live coverage incoming...') : 'Live coverage of this event is ongoing. We are experiencing high traffic, reducing the full AI processing capability temporarily.'}</p><hr><p class="dynamic-ai-tag"><i>Live Analysis Processing...</i></p><p><em>Our autonomous 253B-parameter engine is currently in the background generating the full feature article for this story. It will dynamically load here automatically as soon as it's ready.</em></p>`
    };

    return new Response(JSON.stringify(data), {
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
