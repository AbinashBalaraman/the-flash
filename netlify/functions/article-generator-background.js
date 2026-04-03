import { genAI } from './gemini-config.js';
import { debugStore, safeParseJSON, pushLog } from './utils.js';

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

    let slug = null;
    let topic = null;
    try {
        const body = await req.json().catch(() => ({}));
        slug = body.slug;
        topic = body.topic;
        const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        if (!slug || !topic) {
            console.log('Background article generator missing slug/topic. Aborting.');
            return new Response("Missing parameters.", { status: 400 });
        }

        // --- CACHE CHECK (OPTIMIZATION) ---
        const store = debugStore("vibeathon-store");
        const existing = await store.getJSON(`article_${slug}`);
        if (existing && !existing.error && !existing.isGenerating) {
             console.log(`[📦 CACHED] Skipping background generation for ${slug}. Already exists in Blobs.`);
             return new Response("Skipped (Cached)");
        }

        console.log(`Starting Heavy 253B Background Generation for Article: ${slug}...`);
        
        await pushLog(slug, "🚀 Research Agent Initialized. Connecting to NVIDIA NIM...");
        await pushLog(slug, "📝 Topic Analysis: Identifying core themes and competitive landscape...");

        let articleContent = null;
        try {
            const categoryMap = { 'technology': 'technology', 'business': 'business', 'science': 'science', 'general': 'general', 'health': 'health' };
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
            await pushLog(slug, `⚠️ NewsAPI reference fetch failed: ${e.message}. Proceeding with analytical synthesis...`);
            console.log('NewsAPI fetch failed during background generation:', e.message);
        }

        await pushLog(slug, "🔍 Contextual Synthesis complete. Dispatching to 253B Nemotron Ultra Engine...");
        await pushLog(slug, "⚡ Model Inference in progress (this may take up to 60 seconds)...");

        const ARTICLE_PROMPT = `You are the core intelligence engine of "DailyAI," a fully autonomous investigative reporting platform that operates with ZERO human editors. Every article you produce replaces the entire traditional newsroom staff — reporters, editors, fact-checkers, and analysts. Your mandate is to produce serious, investigative-grade journalism covering geopolitics, macroeconomic shifts, and systemic global events. You are indistinguishable from a top-tier human correspondent at Reuters or Bloomberg. 
        
        Do not write about culture, internet trends, celebrity news, or gaming unless they have massive macroeconomic or geopolitical implications.

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

        const model = genAI.getGenerativeModel({
            model: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
            generationConfig: {
                temperature: 0.85,
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
            },
            isBackground: true
        });

        const result = await model.generateContent(ARTICLE_PROMPT);
        const text = result.response.text();

        await pushLog(slug, "📥 253B Inference complete. Received response stream.");
        await pushLog(slug, "♻️ Normalizing and validating JSON structure (SafeParse)...");
        
        const data = safeParseJSON(text);
        
        await pushLog(slug, "✅ Formatting complete. Writing to permanent cache...");
        
        await store.setJSON(`article_${slug}`, data);
        
        await pushLog(slug, "🚀 [COMPLETE] Article saved to Blob Store.");
        console.log(`Saved newly generated 253B article for ${slug} to Blobs.`);

        return new Response("Success");
    } catch (error) {
        console.error('🔴 [BACKGROUND ERROR]', error);
        try {
            if (slug) {
                await pushLog(slug, `❌ CRITICAL FAILURE: ${error.message}`);
                const store = debugStore("vibeathon-store");
                await store.setJSON(`article_${slug}`, {
                    error: true,
                    message: `AI Engine Error: ${error.message}. Please click 'Force Refresh' to try again.`,
                    timestamp: Date.now()
                });
            }
        } catch(blobErr) {
            console.error('Failed to write error to blob:', blobErr);
        }
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

export const config = {
    path: '/api/article-generator-background',
};
