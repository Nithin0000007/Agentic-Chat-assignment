import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { callGemini } from "../services/llmGemini";
import { webSearch, SearchResponse } from "../services/webSearch"; // Import type

const router = express.Router();

router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Type for stream events (matches spec)
interface StreamEvent {
  type: "reasoning" | "tool_call" | "response" | "error" | "done";
  content?: string;
  tool?: string;
  input?: string;
  output?: any; 
}

// Parse LLM decision 
const parseDecision = (raw: string): boolean => {
  const norm = raw.trim().toLowerCase();
  return norm === "true" || norm.includes("yes");
};

// FIXED: Format search results for LLM (with citations)
function formatForLLM(searchData: SearchResponse): string {
  if (!searchData || !searchData.results || searchData.results.length === 0) {
    return "No search results found.";
  }

  const lines = searchData.results.map((r, i) => {
    const date = r.date ? ` (${r.date})` : "";
    return `[${i + 1}] "${r.title}"\n    ${r.snippet}\n    → ${r.link}${date} (via ${r.source})`;
  });

  return `Search results for "${searchData.query}" (${searchData.totalResults.toLocaleString()} total):\n\n${lines.join(
    "\n\n"
  )}\n\nUse [1], [2], etc. to cite sources inline.`;
}

// Stream event helper
const streamEvent = (res: Response, event: StreamEvent): void => {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
  res.flushHeaders();
};

router.post("/chat", async (req: Request, res: Response) => {
  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const { query } = req.body ?? {};
  if (typeof query !== "string" || !query.trim()) {
    streamEvent(res, { type: "error", content: "Valid 'query' string required" });
    res.status(400).end();
    return;
  }

  const safeQuery = query.trim();
  const startTime = Date.now();

  try {
    // Step 1: Acknowledge
    streamEvent(res, { type: "reasoning", content: `Received: "${safeQuery}"` });

    // Dynamic cutoff for agentic decision (e.g., Oct 2025 → post-Apr 2025 needs search)
    const cutoffDate = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Step 2: LLM decides tool need (agentic reasoning)
    const decisionPrompt = `
You are a binary classifier for tool usage. Answer **only** "true" or "false".

"true" if query needs real-time/post-${cutoffDate} data:
• Events after ${cutoffDate} (e.g., 2025 AI state)
• Live stats (prices, weather, elections)
• Recent changes (laws, releases)
• System status

"false" otherwise (timeless facts, math, pre-${cutoffDate}, hypotheticals).

Query: """${safeQuery}"""
`.trim();

    streamEvent(res, { type: "reasoning", content: "Deciding if tool needed..." });
    const decisionRaw = await callGemini(decisionPrompt);
    const needSearch = parseDecision(decisionRaw);

    streamEvent(res, {
      type: "reasoning",
      content: needSearch ? "Tool call required for fresh data." : "Internal knowledge sufficient.",
    });

    // Step 3: Tool call if needed (FIXED: Single call, rich data)
    let searchData: SearchResponse | null = null;
    let searchResultsForPrompt = "";
    
    if (needSearch) {
      streamEvent(res, { type: "reasoning", content: "Searching the web…" });

      searchData = await webSearch(safeQuery); // Returns object

      // ONE tool_call with full structured data
      streamEvent(res, {
        type: "tool_call",
        tool: "web_search",
        input: safeQuery,
        output: searchData, // ← Full object
      });

      searchResultsForPrompt = formatForLLM(searchData); // FIXED: Now defined
    }

    // Step 4: Refine & generate final answer (FIXED: Longer output)
    const finalPrompt = `
You are a concise, factual assistant. Current date: ${new Date().toISOString().split("T")[0]}.
Query: """${safeQuery}"""

${needSearch ? `Search results (cite with [1], [2], etc.):\n${searchResultsForPrompt}\n---` : ""}

Respond in 3–5 sentences with detailed explanations. Be factual and comprehensive. Cite sources inline using [1], [2], etc. after relevant facts.
`.trim();

    streamEvent(res, { type: "reasoning", content: "Refining answer..." });
    const answer = await callGemini(finalPrompt);

    streamEvent(res, { type: "response", content: answer || "(no answer generated)" });

    // Metrics (bonus for Loom)
    const duration = Date.now() - startTime;
    streamEvent(res, { type: "reasoning", content: `Completed in ${duration}ms` });

    streamEvent(res, { type: "done" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    streamEvent(res, { type: "error", content: `Agent error: ${msg}` });
    console.error("[/chat] Error:", err);
  } finally {
    res.end();
  }
});

export default router;