import { genAI } from './netlify/functions/gemini-config.js';

async function test() {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.9,
        topP: 0.95,
        maxOutputTokens: 100,
        responseMimeType: 'application/json',
      },
    });

    console.log("Testing NVIDIA API via shim...");
    const result = await model.generateContent("Say hello in JSON format.");
    console.log("Response text:", result.response.text());
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
