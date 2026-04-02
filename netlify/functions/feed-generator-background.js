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
        const body = await req.json().catch(() => ({}));
        const headlines = body.headlines;
        const page = body.page || 1;
        const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        if (!headlines || headlines.length === 0) {
            console.log('Background feed generator received empty headlines. Aborting.');
            return new Response("Empty headlines.", { status: 400 });
        }

        console.log(`Starting Heavy 253B Background Generation for Feed page ${page}...`);

        const TRANSFORM_PROMPT = `You are the Editor-in-Chief for "THE SIGNAL", an elite, autonomous digital newsroom.
        
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
        let text = result.response.text();
        
        if (text.startsWith('\`\`\`json')) {
            text = text.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '');
        }
        
        const data = JSON.parse(text);
        const store = getStore("vibeathon-store");
        
        await store.setJSON(`feed_page_${page}`, data);
        console.log(`Successfully generated and cached 253B Feed data to feed_page_${page} Blobs.`);

        return new Response("Success");
    } catch (error) {
        console.error('Background feed generation error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

export const config = {
    path: '/api/feed-generator-background',
};
