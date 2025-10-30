import axios from "axios";
import "dotenv/config"; // Loads .env

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY required in .env");

// In llmGemini.ts (only change the GEMINI_URL line)
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const TIMEOUT = 60000;
const MAX_TOKENS = 1024;

// Retry wrapper (3 attempts, exponential backoff)
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (err.response?.status >= 500 || err.code === "ECONNABORTED") {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
        continue;
      }
      throw err;
    }
  }
  throw lastErr!;
}

export async function callGemini(prompt: string): Promise<string> {
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: MAX_TOKENS },
  };

  try {
    const resp = await withRetry(() =>
      axios.post(GEMINI_URL, payload, {
        timeout: TIMEOUT,
        headers: { "Content-Type": "application/json" },
      })
    );

    const data = resp.data;
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error("Invalid Gemini response format");
    }

    return data.candidates[0].content.parts[0].text.trim();
  } catch (err: any) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error("[Gemini] Error:", msg);
    throw new Error(`LLM unavailable: ${msg}`);
  }
}