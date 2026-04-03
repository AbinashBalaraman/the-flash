import 'dotenv/config';

const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';

const topic = "Target just announced a massive change to checkout";
const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const articleContent = { title: "Target changes self-checkout rules", description: "Target is restricting self-checkout to 10 items or fewer across most of its 2,000 stores nationwide." };

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

async function run() {
    console.log("Starting fetch...");
    try {
        const response = await fetch(`${NVIDIA_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${NVIDIA_KEY}`,
            },
            body: JSON.stringify({
                model: 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
                messages: [{role: 'user', content: ARTICLE_PROMPT}],
                max_tokens: 8192,
                temperature: 0.85
            })
        });

        if (!response.ok) {
            console.error("HTTP Error:", response.status, await response.text());
            return;
        }

        const data = await response.json();
        let text = data.choices[0].message.content;
        console.log("GOT TEXT LENGTH:", text.length);
        console.log("FIRST 100 CHARS:", text.substring(0, 100));
        console.log("LAST 100 CHARS:", text.substring(text.length - 100));

        if (text.startsWith('\`\`\`json')) {
            text = text.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '');
            console.log("Trimmed starting backticks");
        }
        
        // Let's strip whitespace at ends first!
        text = text.trim();
        if (text.startsWith('\`\`\`json')) text = text.substring(7);
        if (text.endsWith('\`\`\`')) text = text.substring(0, text.length - 3);
        text = text.trim();

        try {
            const parsed = JSON.parse(text);
            console.log("JSON parsed successfully! Title:", parsed.title);
        } catch (e) {
            console.error("JSON Parse Error:", e.message);
            console.log("Text fragment for debugging:", text.substring(0, 200));
        }

    } catch(e) {
        console.error("FETCH ERROR:", e);
    }
}
run();
