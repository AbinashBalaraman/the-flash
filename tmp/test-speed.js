// Using global fetch (Node 18+)

const NVIDIA_KEY = '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';
const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

async function testModels() {
  console.log("Fetching available models from NVIDIA...");
  try {
    const res = await fetch(`${NVIDIA_BASE}/models`, {
      headers: { 'Authorization': `Bearer ${NVIDIA_KEY}` }
    });
    const { data } = await res.json();
    console.log(`Found ${data.length} models.`);

    const modelsToTest = [
      'meta/llama-3.1-8b-instruct',
      'meta/llama-3.3-70b-instruct',
      'nvidia/llama-3.1-nemotron-70b-instruct',
      'mistralai/mistral-large-2-instruct',
      'deepseek-ai/deepseek-v3'
    ];

    console.log("\nTesting speeds (TTFT - Time To First Token approximation via completion time):");
    
    for (const modelId of modelsToTest) {
      if (!data.find(m => m.id === modelId)) {
        console.log(`Skipping ${modelId} (not in available list)`);
        continue;
      }
      
      const start = Date.now();
      const response = await fetch(`${NVIDIA_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${NVIDIA_KEY}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'Say "Ready" in one word.' }],
          max_tokens: 5,
          temperature: 0.1
        }),
      });
      
      if (response.ok) {
        const time = Date.now() - start;
        console.log(`✅ ${modelId}: ${time}ms`);
      } else {
        console.log(`❌ ${modelId}: Failed (${response.status})`);
      }
    }
  } catch (err) {
    console.error("Test failed:", err);
  }
}

testModels();
