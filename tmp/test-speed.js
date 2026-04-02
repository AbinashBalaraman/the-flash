// Node 22 native fetch
const NVIDIA_KEY = process.env.NVIDIA_API_KEY || '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';
const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

async function testAllModels() {
  console.log("Fetching all available models from NVIDIA API...");
  try {
    const fetchRes = await fetch(`${NVIDIA_BASE}/models`, {
      headers: { 'Authorization': `Bearer ${NVIDIA_KEY}` }
    });
    const res = await fetchRes.json();
    console.log(`API returned ${res.data.length} models.`);

    // Filter for common instruct/chat models (there are image/embedding models in that list too)
    const textModels = res.data
      .map(m => m.id)
      .filter(id => id.includes('instruct') || id.includes('chat') || id.includes('llama') || id.includes('mistral') || id.includes('qwen') || id.includes('deepseek'));

    console.log(`\nTesting latency for ${textModels.length} text models concurrently (with 4000ms timeout)...\n`);
    
    // Concurrent fetch with timeout
    const fetchWithTimeout = async (modelId) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const start = Date.now();
      try {
        const response = await fetch(`${NVIDIA_BASE}/chat/completions`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${NVIDIA_KEY}`,
          },
          body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: 'Say "1"' }],
            max_tokens: 2,
            temperature: 0.1
          }),
        });
        clearTimeout(timeoutId);
        const time = Date.now() - start;
        if (response.ok) {
          return { model: modelId, timeMs: time, status: 'OK' };
        } else {
          return { model: modelId, timeMs: 9999, status: `Failed: ${response.status}` };
        }
      } catch (e) {
        clearTimeout(timeoutId);
        return { model: modelId, timeMs: 9999, status: e.name === 'AbortError' ? 'Timeout (4s)' : e.message };
      }
    };

    // Test in batches of 10 to avoid hammering the API
    const results = [];
    const BATCH_SIZE = 15;
    for (let i = 0; i < textModels.length; i += BATCH_SIZE) {
      const batch = textModels.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(m => fetchWithTimeout(m)));
      results.push(...batchResults);
      process.stdout.write(`.`); // Progress indicator
    }

    console.log("\n\n--- Top 15 Fastest Models ---");
    // Sort and show top 15 successfully returning models
    const sorted = results
      .filter(r => r.status === 'OK')
      .sort((a, b) => a.timeMs - b.timeMs)
      .slice(0, 15);

    sorted.forEach((r, i) => console.log(`${i+1}. ${r.model} -> ${r.timeMs}ms`));

  } catch (err) {
    console.error("Test failed:", err);
  }
}

testAllModels();
