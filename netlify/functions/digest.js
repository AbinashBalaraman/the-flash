// ═══════════════════════════════════════════════════════
// DIGEST FUNCTION — Daily digest of top stories
// ═══════════════════════════════════════════════════════

import { genAI } from './gemini-config.js';
import { getStore } from '@netlify/blobs';

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
    const url = new URL(req.url);
    const store = getStore("vibeathon-store");
    
    // 1. Check Blob Cache
    let cachedDigest = null;
    try {
        cachedDigest = await store.getJSON('digest_latest');
        if (cachedDigest) {
            const isStillGenerating = cachedDigest.isGenerating === true;
            const startTime = cachedDigest.timestamp || 0;
            const now = Date.now();
            const timeoutMs = 5 * 60 * 1000; // 5 mins

            if (isStillGenerating && (now - startTime < timeoutMs)) {
                console.log(`Digest is already being generated (Locked). Returning status.`);
                return new Response(JSON.stringify(cachedDigest), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'no-cache',
                    },
                });
            }
            
            if (!isStillGenerating) {
                console.log(`Serving complete digest from Blobs cache.`);
                return new Response(JSON.stringify(cachedDigest), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'no-cache',
                    },
                });
            }
            
            console.log(`Digest generation marker is stale. Re-triggering.`);
        }
    } catch (blobErr) {
        console.warn('Blob digest read failed or not initialized:', blobErr.message);
    }

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // 1. Prepare Placeholder Data
    const placeholder = {
        isGenerating: true,
        timestamp: Date.now(),
        date: today,
        stories: [
            {
                title: "Live Analysis Processing",
                slug: "live-analysis",
                summary: "<span class='dynamic-ai-tag'><i>Our 253B Parameter Editorial AI is currently synthesizing today's global trends...</i></span>"
            },
            {
                title: "Global Markets Update",
                slug: "global-markets",
                summary: "Market volatility remains high as algos assess new data points. Deep dive analysis is pending."
            },
             {
                title: "Technology Ethics",
                slug: "tech-ethics",
                summary: "The balance between rapid acceleration and safety protocols continues to dominate boardroom discussions."
            }
        ]
    };

    // 2. Lock the Store immediately
    try {
        await store.setJSON('digest_latest', placeholder);
        console.log(`Successfully locked digest_latest (isGenerating: true)`);
    } catch (sErr) {
        console.error('Failed to set digest placeholder lock:', sErr.message);
    }
    
    // 3. Trigger Background Process (Async)
    try {
        const bgUrl = `${url.origin}/api/digest-generator-background`;
        // We await the trigger because Netlify Background functions return 202 quickly.
        // This ensures the request is actually sent before the main function returns.
        await fetch(bgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        }).catch(err => console.log('Background trigger failed:', err.message));
        console.log('Fired async background request to /api/digest-generator-background.');
    } catch(err) {
        console.log('Could not fire background digest request:', err);
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
