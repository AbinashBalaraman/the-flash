// ═══════════════════════════════════════════════════════
// NVIDIA NIM CONFIG — OpenAI-Compatible AI Gateway
// Shims the Gemini SDK interface → routes to NVIDIA NIM
// ═══════════════════════════════════════════════════════

const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const DEFAULT_MODEL = 'nvidia/llama-3.1-nemotron-ultra-253b-v1';

/**
 * SHIM: Mimics the GoogleGenerativeAI SDK but uses NVIDIA NIMs
 */
class NVIDIAConfigShim {
    getGenerativeModel({ model: modelName, systemInstruction, generationConfig, isBackground = false }) {
        // User preference: 253B is primary for chat/ai, 70B is secondary
        const effectiveModel = isBackground ? DEFAULT_MODEL : (modelName || 'nvidia/llama-3.1-nemotron-ultra-253b-v1');

        return {
            generateContent: async (promptData) => {
                let messages = [];

                // Handle System Instruction (Gemini style)
                if (systemInstruction) {
                    if (typeof systemInstruction === 'string') {
                        messages.push({ role: 'system', content: systemInstruction });
                    } else if (systemInstruction?.parts?.[0]) {
                        messages.push({ role: 'system', content: systemInstruction.parts[0].text });
                    }
                }

                // Handle prompt data
                if (typeof promptData === 'string') {
                    messages.push({ role: 'user', content: promptData });
                } else if (promptData?.contents) {
                    promptData.contents.forEach(msg => {
                        messages.push({
                            role: msg.role === 'model' ? 'assistant' : 'user',
                            content: msg.parts[0].text
                        });
                    });
                }

                // Define models priority (User: 253B Primary, 70B Secondary)
                const FALLBACK_MODELS = [
                    'nvidia/llama-3.1-nemotron-ultra-253b-v1', // Global Primary
                    'meta/llama-3.1-70b-instruct',               // High-Speed Secondary
                    'meta/llama-3.1-8b-instruct'                 // Emergency Fallback
                ];
                
                // If a specific model was requested by caller (e.g. for background), prepend it
                const uniqueModels = [...new Set([effectiveModel, ...FALLBACK_MODELS])];

                let lastError = null;

                for (const modelId of uniqueModels) {
                    const body = {
                        model: modelId,
                        messages,
                        temperature: generationConfig?.temperature ?? 0.7,
                        top_p: generationConfig?.topP ?? 1.0,
                        max_tokens: generationConfig?.maxOutputTokens ?? 4096,
                    };

                    console.log(`[NVIDIA] → ${modelId} | ${messages.length} msgs | ${new Date().toISOString()}`);

                    try {
                        const response = await fetch(`${NVIDIA_BASE}/chat/completions`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${NVIDIA_KEY}`,
                            },
                            body: JSON.stringify(body),
                            signal: AbortSignal.timeout(isBackground ? 900000 : 9900), // Max for Netlify (10s sync / 15m background)
                        });

                        if (!response.ok) {
                            const errText = await response.text().catch(() => '');
                            console.error(`[🔴 NVIDIA ERROR] ${response.status} ${response.statusText} on ${modelId}`);
                            console.error(`[🔴 RESPONSE BODY] ${errText}`);
                            
                            lastError = new Error(`NVIDIA API ${response.status} (${response.statusText}): ${errText || 'No response body'}`);
                            continue; // Try next model
                        }

                        const result = await response.json();
                        const content = result.choices[0].message.content;
                        return {
                            response: { text: () => content }
                        };
                    } catch (err) {
                        console.warn(`[NVIDIA] FETCH ERROR on ${modelId}: ${err.message}. Trying next model...`);
                        lastError = err;
                        continue; // Try next model
                    }
                }

                // If we exhausted all the models
                console.error(`[NVIDIA] CRITICAL: All models in fallback chain failed.`);
                throw lastError;
            }
        };
    }
}

export const genAI = new NVIDIAConfigShim();
