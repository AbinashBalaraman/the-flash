// ═══════════════════════════════════════════════════════
// NVIDIA NIM CONFIG — OpenAI-Compatible AI Gateway
// Shims the Gemini SDK interface → routes to NVIDIA NIM
// ═══════════════════════════════════════════════════════

const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const DEFAULT_MODEL = 'meta/llama-3.1-70b-instruct';

/**
 * SHIM: Mimics the GoogleGenerativeAI SDK but uses NVIDIA NIMs
 */
class NVIDIAConfigShim {
    getGenerativeModel({ model: modelName, generationConfig, systemInstruction }) {
        const effectiveModel = DEFAULT_MODEL;

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

                // Define models priority (253B first as requested, 70B fallback)
                let primaryModel = modelName || DEFAULT_MODEL;
                const FALLBACK_MODELS = [
                    primaryModel,
                    'meta/llama-3.1-70b-instruct',
                    'meta/llama-3.1-8b-instruct'
                ];
                
                // Remove duplicates in case primaryModel is already the fallback
                const uniqueModels = [...new Set(FALLBACK_MODELS)];

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
                            signal: AbortSignal.timeout(4500), // STRICT 4.5-second timeout to allow graceful fallback before Netlify's 10s kill
                        });

                        if (!response.ok) {
                            const errText = await response.text().catch(() => '');
                            console.warn(`[NVIDIA] ERROR ${response.status} on ${modelId}: ${errText}. Trying next model...`);
                            lastError = new Error(`NVIDIA API Error (${response.status}): ${errText}`);
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

                // Shim: return Gemini-shaped response
                return {
                    response: {
                        text: () => content
                    }
                };
            }
        };
    }
}

export const genAI = new NVIDIAConfigShim();
