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

    try {
        const today = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        const DIGEST_PROMPT = `You are the digest editor at "DailyAI", an AI-native newsroom. Create today's Daily Digest - a 60-second briefing on the 5 most important cultural and trend stories.
        Date: ${today}
        
        For each of the 5 stories, provide:
        1. A compelling headline
        2. A slug (URL-safe)
        3. A 2-3 sentence summary that tells readers WHY this matters, not just WHAT happened
        
        Respond ONLY with valid JSON:
        {
          "date": "${today}",
          "stories": [
            {
              "title": "Headline here",
              "slug": "headline-slug",
              "summary": "2-3 sentence summary with genuine insight."
            }
          ]
        }`;

        console.log('Background digest generator starting 253B generation...');
        const model = genAI.getGenerativeModel({
            model: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
            generationConfig: {
                temperature: 0.85,
                topP: 0.9,
                maxOutputTokens: 2048,
                responseMimeType: 'application/json',
            },
            isBackground: true
        });

        const result = await model.generateContent(DIGEST_PROMPT);
        const text = result.response.text();
        const data = safeParseJSON(text);
        const store = debugStore("vibeathon-store");
        
        await store.setJSON('digest_latest', data);
        console.log(`[✨ DIGEST SAVED] Cached 253B Digest data.`);

        return new Response("Success");
    } catch (error) {
        console.error('🔴 [DIGEST BACKGROUND ERROR]', error);
        
        try {
            const store = debugStore("vibeathon-store");
            await store.setJSON('digest_latest', {
                error: true,
                message: `AI Digest Engine Error: ${error.message}. Please click 'Force Refresh'.`,
                timestamp: Date.now()
            });
        } catch(blobErr) {
            console.error('Failed to write digest error to blob:', blobErr);
        }
        
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

export const config = {
    path: '/api/digest-generator-background',
};
