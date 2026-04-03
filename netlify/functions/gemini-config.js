// ═══════════════════════════════════════════════════════
// NVIDIA NIM CONFIG — OpenAI-Compatible AI Gateway
// Shims the Gemini SDK interface → routes to NVIDIA NIM
// ═══════════════════════════════════════════════════════

const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const DEFAULT_MODEL = 'meta/llama-3.1-70b-instruct';
const BACKGROUND_MODEL = 'nvidia/llama-3.1-nemotron-ultra-253b-v1';

/**
 * SHIM: Mimics the GoogleGenerativeAI SDK but uses NVIDIA NIMs
 */
class NVIDIAConfigShim {
    getGenerativeModel({ model: modelName, systemInstruction, generationConfig, isBackground = false }) {
        const effectiveModel = isBackground ? BACKGROUND_MODEL : (modelName || DEFAULT_MODEL);

        return {
            generateContent: async (promptData) => {
                const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
                const NVIDIA_BASE = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';

                if (!NVIDIA_KEY) {
                    console.error("[🔴 ERROR] NVIDIA_API_KEY is missing from environment.");
                    throw new Error("Configuration Error: API Key missing.");
                }

                let messages = [];

                if (systemInstruction) {
                    if (typeof systemInstruction === 'string') {
                        messages.push({ role: 'system', content: systemInstruction });
                    } else if (systemInstruction?.parts?.[0]) {
                        messages.push({ role: 'system', content: systemInstruction.parts[0].text });
                    }
                }

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

                const FALLBACK_MODELS = [
                    'meta/llama-3.1-70b-instruct',
                    'meta/llama-3.1-70b-instruct',
                    'meta/llama-3.1-8b-instruct'
                ];
                
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

                    console.log(`[🚀 NIM-GATEWAY-V3 REQUEST] Model: ${modelId} | ${messages.length} msgs`);
                    try {
                        const response = await fetch(`${NVIDIA_BASE}/chat/completions`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${NVIDIA_KEY}`,
                            },
                            body: JSON.stringify(body),
                            signal: AbortSignal.timeout(isBackground ? 900000 : 30000), 
                        });

                        if (!response.ok) {
                            const errText = await response.text().catch(() => '');
                            console.error(`[🔴 NVIDIA FAIL] ${modelId} status ${response.status}: ${errText}`);
                            lastError = new Error(`NVIDIA API Error (${response.status}) on ${modelId}`);
                            continue;
                        }

                        const result = await response.json();
                        const content = result.choices?.[0]?.message?.content;
                        
                        if (!content) {
                            console.warn(`[⚠️ NIM-GATEWAY-V3 EMPTY] No content in choices[0]`);
                        }

                        console.log(`[✅ NIM-GATEWAY-V3 SUCCESS] Received response from ${modelId}`);
                        
                        return {
                            response: { text: () => content || "" }
                        };
                    } catch (err) {
                        console.error(`[⚠️ NVIDIA EXCEPTION] ${modelId}: ${err.message}`);
                        lastError = err;
                        continue;
                    }
                }

                throw lastError || new Error("All AI models failed to respond.");
            }
        };
    }
}

export const genAI = new NVIDIAConfigShim();
