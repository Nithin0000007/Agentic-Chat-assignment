// services/webSearch.ts
import axios from "axios";

const MODE = process.env.WEB_SEARCH_MODE || "mock";
const SEARCH_API_KEY = process.env.SEARCH_API_KEY;

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
  source?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  query: string;
  summary?: string;
}

export async function webSearch(query: string): Promise<SearchResponse> {
  const safeQuery = encodeURIComponent(query.trim());

  if (MODE === "mock") {
    return {
      query,
      totalResults: 3,
      results: [
        {
          title: "State of AI Report 2025",
          link: "https://www.stateof.ai/",
          snippet: "The most trusted annual analysis of AI trends. Agentic AI, cost drops, and new regulations dominate 2025.",
          date: "2025-10-15",
          source: "State of AI Institute",
        },
        {
          title: "Stanford AI Index 2025",
          link: "https://hai.stanford.edu/ai-index",
          snippet: "AI boosts productivity by 40%. Inference costs down 280x since 2023. 1.2M AI jobs created.",
          date: "2025-04-10",
          source: "Stanford HAI",
        },
        {
          title: "Gemini 2.5 Flash Released",
          link: "https://blog.google/technology/ai/gemini-2-5-flash/",
          snippet: "Google's fastest model yet. 128K context, $0.35/M tokens. Free tier: 15 RPM.",
          date: "2025-06-20",
          source: "Google AI Blog",
        },
      ],
    };
  }

  if (!SEARCH_API_KEY) {
    return {
      query,
      totalResults: 0,
      results: [],
      summary: "Search API key missing.",
    };
  }

  try {
    const url = "https://www.searchapi.io/api/v1/search";
    const resp = await axios.get(url, {
      params: {
        q: safeQuery,
        engine: "google",
        num: 10, // Get more results
        gl: "us",
        hl: "en",
      },
      headers: { Authorization: `Bearer ${SEARCH_API_KEY}` },
      timeout: 10000,
    });

    const organic = resp.data.organic_results || [];
    const total = resp.data.search_information?.total_results || 0;

    const results: SearchResult[] = organic.slice(0, 10).map((r: any) => ({
      title: r.title || "Untitled",
      link: r.link || "#",
      snippet: truncateSnippet(r.snippet || "", 300), // Smarter truncation
      date: r.date || undefined,
      source: extractDomain(r.link) || r.source || "Unknown",
    }));

    // Optional: Add AI summary of top 3
    const summary = results.length > 0
      ? `Found ${total.toLocaleString()} results. Top sources: ${results
          .slice(0, 3)
          .map((r) => r.source)
          .join(", ")}.`
      : "No results found.";

    return { query, totalResults: total, results, summary };
  } catch (err: any) {
    const msg = err.response?.data?.error || err.message;
    console.error("Search API Error:", msg);
    return {
      query,
      totalResults: 0,
      results: [],
      summary: `Search failed: ${msg}`,
    };
  }
}

// Helpers
function truncateSnippet(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).replace(/\s+\S*$/, "") + "...";
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return null;
  }
}