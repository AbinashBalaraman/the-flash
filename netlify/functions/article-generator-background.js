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

    try {
        const body = await req.json().catch(() => ({}));
        const slug = body.slug;
        const topic = body.topic;
        const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        if (!slug || !topic) {
            console.log('Background article generator missing slug/topic. Aborting.');
            return new Response("Missing parameters.", { status: 400 });
        }

        console.log(`Starting Heavy 253B Background Generation for Article: ${slug}...`);

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
            console.log('NewsAPI fetch failed during background generation:', e.message);
        }

        const ARTICLE_PROMPT = `You are an elite, veteran feature journalist writing for "DailyAI," a prestigious digital magazine known for deep, analytical, and highly human writing. Your goal is to write a feature that is indistinguishable from a top-tier human writer at The Atlantic or Bloomberg Businessweek. 

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
        let text = result.response.text();
        
        if (text.startsWith('\`\`\`json')) {
            text = text.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '');
        }

        const data = JSON.parse(text);
        const store = getStore("vibeathon-store");
        
        await store.setJSON(`article_${slug}`, data);
        console.log(`Saved newly generated 253B article for ${slug} to Blobs.`);

        return new Response("Success");
    } catch (error) {
        console.error('Background article generation error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

export const config = {
    path: '/api/article-generator-background',
};
