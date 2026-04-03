import { genAI } from './gemini-config.js';
import { debugStore, safeParseJSON } from './utils.js';

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

    let page = 1;
    try {
        const body = await req.json().catch(() => ({}));
        const headlines = body.headlines;
        page = body.page || 1;
        const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        if (!headlines || headlines.length === 0) {
            console.log('Background feed generator received empty headlines. Aborting.');
            return new Response("Empty headlines.", { status: 400 });
        }

        console.log(`Starting Heavy 253B Background Generation for Feed page ${page}...`);

        const TRANSFORM_PROMPT = `You are the Editor-in-Chief for "DailyAI", an elite, autonomous digital newsroom.
        
        Your task is to review the following REAL raw headlines and transform them into EXACTLY 8 compelling article cards and 7 trending topics.
        
        REAL HEADLINES:
        ${headlines.map((h, i) => `[${h.category?.toUpperCase() || 'NEWS'}] ${h.title} - ${h.description || ''}`).join('\n')}
        
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

        const model = genAI.getGenerativeModel({
            model: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
            generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
            },
            isBackground: true // Prevents it from forcibly aborting at 4.5s
        });

        const result = await model.generateContent(TRANSFORM_PROMPT);
        const text = result.response.text();
        const data = safeParseJSON(text);
        const store = debugStore("vibeathon-store");
        
        await store.setJSON(`feed_page_${page}`, data);
        console.log(`[✨ FEED SAVED] Cached 253B Feed data for page ${page}.`);

        // 3. ✨ AUTOMATIC PRE-LOADING — Trigger all 8 articles in the background
        if (data.articles && data.articles.length > 0) {
            console.log(`[🚀 PRE-LOAD] Sequential triggering for ${data.articles.length} articles...`);
            
            const url = new URL(req.url);
            const baseUrl = `${url.protocol}//${url.host}`;
            const articleBgUrl = `${baseUrl}/api/article-generator-background`;

            // Trigger sequentially with a delay to respect the "one by one" preference
            for (const article of data.articles) {
                try {
                    await fetch(articleBgUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            slug: article.slug, 
                            topic: article.topic,
                            headlines: headlines 
                        })
                    });
                    console.log(`[🚀 TRIGGERED] ${article.slug}`);
                    // 1 second pause between triggers
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (err) {
                    console.error(`[PRE-LOAD ERROR] Failed to trigger ${article.slug}:`, err.message);
                }
            }
            console.log(`[✅ PRE-LOAD QUEUED] All articles are now being born in order.`);
        }

        return new Response("Success");
    } catch (error) {
        console.error('🔴 [FEED BACKGROUND ERROR]', error);
        try {
            const store = debugStore("vibeathon-store");
            await store.setJSON(`feed_page_${page}`, {
                error: true,
                message: `AI Feed Engine Error: ${error.message}. Please click 'Force Refresh'.`,
                timestamp: Date.now()
            });
        } catch(blobErr) {
            console.error('Failed to write feed error to blob:', blobErr);
        }
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

export const config = {
    path: '/api/feed-generator-background',
};
