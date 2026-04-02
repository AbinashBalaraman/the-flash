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

    // Try to fetch real article content from NewsAPI
    let articleContent = null;
    try {
      const categoryMap = {
        'technology': 'technology',
        'business': 'business', 
        'science': 'science',
        'sports': 'sports'
      };
      
      const searchCategory = Object.keys(categoryMap).find(c => topic.toLowerCase().includes(c)) || 'technology';
      
      const res = await fetch(`${NEWS_API}/top-headlines/category/${searchCategory}/us.json`);
      const data = await res.json();
      
      if (data.articles && data.articles.length > 0) {
        const matchingArticle = data.articles.find(a => 
          a.title && topic.toLowerCase().includes(a.title.toLowerCase().split(' ')[0])
        ) || data.articles[0];
        
        if (matchingArticle && matchingArticle.title !== '[Removed]') {
          articleContent = matchingArticle;
        }
      }
    } catch (e) {
      console.log('NewsAPI fetch failed, using LLM:', e.message);
    }

    const ARTICLE_PROMPT = `You are an elite, veteran feature journalist writing for "THE SIGNAL," a prestigious digital magazine known for deep, analytical, and highly human writing. Your goal is to write a feature that is indistinguishable from a top-tier human writer at The Atlantic or Bloomberg Businessweek. 

    TASK: Write a comprehensive 1000-1500 word feature article about: "${topic}".
    
    ${articleContent ? `REAL-WORLD BASE CONTEXT: "${articleContent.title}" - ${articleContent.description || ''}` : ''}
    
    HUMAN-LIKE WRITING MANDATES:
    1. Sentence Rhythm: Vary your sentence lengths dramatically. Use short, punchy sentences for impact. Follow them with longer, flowing, descriptive sentences. Do not use uniform, robotic pacing.
    2. Nuance and Reality: The world is messy. Do not tie the article up in a neat, perfect bow. Acknowledge contradictions, open questions, and the friction of the topic.
    3. Active Voice: Use vivid, muscular verbs. Eliminate passive voice wherever possible. Look for specific, grounded details instead of broad generalizations.
    4. The Lede (Opening): Drop the reader in "in media res" (in the middle of the action). Start with a specific scene, a startling statistic, or a sharp observation. DO NOT start with a broad generalization about society.
    
    STRUCTURAL RULES:
    1. Organize into 3-4 distinct sections with compelling <h2> subheadings. No generic labels like "Introduction" or "Conclusion".
    2. Inject plausible, realistic data points or logical expert insight to add weight and texture.
    3. Include at least one powerful <blockquote> that captures the core tension.
    
    STRICT ANTI-PATTERNS (BANISHED AI CLICHÉS):
    You will instantly fail if you use ANY of the following phrases or their variations:
    - "In today's rapidly evolving/changing landscape..."
    - "As society navigates..."
    - "It remains to be seen..."
    - "Only time will tell..."
    - "Let's delve into / Let's explore..."
    - "Furthermore", "Moreover", "Additionally", "In conclusion."
    - "A balancing act", "A double-edged sword".
    
    Respond ONLY with JSON matching this structure:
    {
      "title": "A sharp, multi-layered headline (max 10 words)",
      "deck": "A gripping one-sentence subheadline",
      "topic": "${topic}",
      "date": "${today}",
      "readingTime": 7,
      "body": "<p>Your full HTML article here using only p, h2, h3, blockquote, strong, em, ul, li tags. DO NOT INCLUDE AN H1. Do not use markdown wraps around HTML.</p>"
    }`;

    let data;
    try {
      const model = genAI.getGenerativeModel({
        model: 'meta/llama-3.1-8b-instruct',
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent(ARTICLE_PROMPT);
      let text = result.response.text();
      
      // Safety fallback
      if (text.startsWith('\`\`\`json')) {
        text = text.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '');
      }
      
      data = JSON.parse(text);
    } catch (llmError) {
      console.warn('LLM aborted/timed out, failing gracefully to NewsAPI:', llmError.message);
      
      if (!articleContent) {
         // If we don't even have NewsAPI data, we must fail
         throw llmError;
      }
      
      // Construct fallback JSON payload using raw NewsAPI data
      data = {
         title: articleContent.title || topic,
         deck: "Real-time coverage from the wire.",
         topic: topic,
         date: today,
         readingTime: 2,
         body: `<p>${articleContent.description || 'Live coverage of this event is ongoing. We are experiencing high traffic, rendering the full AI analysis temporarily unavailable. Check back shortly for the deep dive.'}</p>`
      };
    }

    try {
        await store.setJSON(`article_${slug}`, data);
        console.log(`Saved newly generated article_${slug} to Blobs.`);
    } catch(err) {
        console.warn('Failed to save article to blob locally', err.message);
    }

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
