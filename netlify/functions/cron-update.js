import { getStore } from '@netlify/blobs';
import { genAI } from './gemini-config.js';

// Reusing same real NewsAPI fetch
async function fetchFromSauravAPI(category, country = 'us') {
  try {
    const res = await fetch(`https://saurav.tech/NewsAPI/top-headlines/category/${category}/${country}.json`);
    const data = await res.json();
    
    if (data.articles && data.articles.length > 0) {
      return data.articles
        .filter(a => a.title && a.description && !a.title.includes('[Removed]'))
        .slice(0, 4)
        .map(a => ({
          title: a.title,
          description: a.description,
          category: category,
          source: a.source?.name,
          url: a.url,
          publishedAt: a.publishedAt
        }));
    }
  } catch (e) {
    console.error(`Saurav API failed for ${category}:`, e.message);
  }
  return null;
}

async function fetchRealHeadlines() {
  const categories = ['technology', 'business', 'science', 'sports'];
  const headlines = [];
  
  for (const category of categories) {
    const articles = await fetchFromSauravAPI(category);
    if (articles) {
      headlines.push(...articles);
    }
  }
  
  if (headlines.length < 5) {
    try {
      const fallbackRes = await fetch(`https://hacker-news.firebaseio.com/v0/topstories.json`);
      const storyIds = await fallbackRes.json();
      
      const topStories = storyIds.slice(0, 20);
      for (const id of topStories.slice(0, 8)) {
        const storyRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        const story = await storyRes.json();
        
        if (story && story.title) {
          headlines.push({
            title: story.title,
            description: `${story.type?.toUpperCase()} from Hacker News`,
            category: 'technology',
            source: 'Hacker News',
            url: story.url || `https://news.ycombinator.com/item?id=${id}`,
            publishedAt: new Date(story.time * 1000).toISOString()
          });
        }
      }
    } catch (e) {
      console.error('Fallback API failed:', e.message);
    }
  }
  
  return headlines.slice(0, 12);
}

export default async function handler(req, context) {
  console.log('[CRON] Starting Autonomous Pre-Generation Cycle...');
  const store = getStore("vibeathon-store");

  try {
    // 1. Fetch News
    const headlines = await fetchRealHeadlines();
    if (headlines.length === 0) {
      console.error('[CRON] No headlines to process.');
      return;
    }

    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    const TRANSFORM_PROMPT = `You are the Editor-in-Chief for "DailyAI", an elite, autonomous digital newsroom.
    
    Your task is to review the following REAL raw headlines and transform them into EXACTLY 8 compelling article cards and 7 trending topics.
    
    REAL HEADLINES:
    ${headlines.map((h, i) => `[${h.category.toUpperCase()}] ${h.title} - ${h.description || ''}`).join('\n')}
    
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
          "readingTime": 5,
          "date": "${today}"
        }
      ],
      "trending": [
        {
          "name": "Topic (1-3 words max)",
          "slug": "topic-slug",
          "velocity": "2.4k" 
        }
      ]
    }`;

    // 2. Generate Feed via 253B
    console.log('[CRON] Generating Main Feed via 253B Model...');
    const feedModel = genAI.getGenerativeModel({
      model: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
      generationConfig: { temperature: 0.8, maxOutputTokens: 8192, responseMimeType: 'application/json' },
    });

    // We can use a long timeout since this is cron
    const result = await feedModel.generateContent(TRANSFORM_PROMPT);
    let feedText = result.response.text();
    if (feedText.startsWith('\`\`\`json')) feedText = feedText.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '');
    const feedData = JSON.parse(feedText);

    // Save feed to blobs
    await store.set('feed_latest', JSON.stringify(feedData));
    console.log('[CRON] Main Feed saved to Blobs Cache.');

    // 3. Generate Articles
    for (const article of feedData.articles) {
       console.log(`[CRON] Generating Article: ${article.slug}`);
       // find best headline match
       const matchingHeadline = headlines.find(h => h.title.includes(article.topic) || article.title.includes(h.topic)) || headlines[0];
       
       const ARTICLE_PROMPT = `You are an elite, veteran feature journalist writing for "DailyAI," a prestigious digital magazine known for deep, analytical, and highly human writing. Your goal is to write a feature that is indistinguishable from a top-tier human writer at The Atlantic or Bloomberg Businessweek. 

        TASK: Write a comprehensive 1000-1500 word feature article about: "${article.topic}".
        
        REAL-WORLD BASE CONTEXT: "${matchingHeadline.title}" - ${matchingHeadline.description || ''}
        
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
          "topic": "${article.topic}",
          "date": "${today}",
          "readingTime": 7,
          "body": "<p>Your full HTML article here using only p, h2, h3, blockquote, strong, em, ul, li tags. DO NOT INCLUDE AN H1. Do not use markdown wraps around HTML.</p>"
        }`;

        const articleModel = genAI.getGenerativeModel({
          model: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
          generationConfig: { temperature: 0.85, maxOutputTokens: 8192, responseMimeType: 'application/json' },
        });

        try {
            const articleRes = await articleModel.generateContent(ARTICLE_PROMPT);
            let articleText = articleRes.response.text();
            if (articleText.startsWith('\`\`\`json')) articleText = articleText.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '');
            const articleJson = JSON.parse(articleText);
            
            await store.set(`article_${article.slug}`, JSON.stringify(articleJson));
            console.log(`[CRON] Saved article_${article.slug} to Blobs.`);
        } catch (articleErr) {
            console.warn(`[CRON] Failed to generate article ${article.slug}:`, articleErr.message);
        }
    }

    console.log('[CRON] Cycle complete!');
  } catch (error) {
    console.error('[CRON] Fatal generation error:', error);
  }
}

export const config = {
  schedule: "@hourly"
};
