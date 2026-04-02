// ═══════════════════════════════════════════════════════
// NVIDIA NIM CONFIG — OpenAI-Compatible AI Gateway
// Shims the Gemini SDK interface → routes to NVIDIA NIM
// ═══════════════════════════════════════════════════════

const NVIDIA_KEY = process.env.NVIDIA_API_KEY || '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';
const NVIDIA_BASE = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const DEFAULT_MODEL = 'meta/llama-3.1-8b-instruct';

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

        const body = {
          model: effectiveModel,
          messages,
          temperature: generationConfig?.temperature ?? 0.7,
          top_p: generationConfig?.topP ?? 1.0,
          max_tokens: generationConfig?.maxOutputTokens ?? 4096,
        };

        console.log(`[NVIDIA] → ${effectiveModel} | ${messages.length} msgs | ${new Date().toISOString()}`);

        const response = await fetch(`${NVIDIA_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${NVIDIA_KEY}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          console.error(`[NVIDIA] ERROR ${response.status}: ${errText}`);
          throw new Error(`NVIDIA API Error (${response.status}): ${errText}`);
        }

        const result = await response.json();
        const content = result.choices[0].message.content;

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
