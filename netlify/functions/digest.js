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
    const forceRefresh = url.searchParams.has('t');
    const store = getStore("vibeathon-store");
    
    // 1. Check Blob Cache
    if (!forceRefresh) {
        try {
            const cachedDigest = await store.getJSON('digest_latest');
            if (cachedDigest) {
                console.log(`Serving digest from Blobs cache instantly.`);
                return new Response(JSON.stringify(cachedDigest), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=60',
                    },
                });
            }
        } catch (blobErr) {
            console.warn('Blob digest read failed or not initialized locally:', blobErr.message);
        }
    }

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // 2. Fire and Forget Background Generation
    try {
        const bgUrl = 'https://the-gflash.netlify.app/api/digest-generator-background';
        fetch(bgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        }).catch(err => console.log('Background trigger failed:', err.message));
        console.log('Fired async background request to /api/digest-generator-background. Returning graceful UI instantly.');
    } catch(err) {
        console.log('Could not fire background digest request:', err);
    }

    // 3. Immedately Return Graceful Data
    const fallbackData = {
        isGenerating: true,
        date: today,
        stories: [
            {
                title: "Live Analysis Processing",
                slug: "live-analysis",
                summary: "Our 253B Parameter Editorial AI is currently synthesizing today's global trends. This is a highly complex autonomous function that will return a 60-second briefing shortly."
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

    return new Response(JSON.stringify(fallbackData), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache', // Do not cache the graceful fallback
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
