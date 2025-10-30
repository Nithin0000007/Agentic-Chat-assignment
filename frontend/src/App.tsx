import { useState, useRef, useEffect } from "react";
import { Send, Bot, Sparkles, Search, ChevronDown, ChevronUp, RotateCw, ExternalLink, Info } from "lucide-react";

interface Message {
  type: "reasoning" | "tool_call" | "response" | "error" | "done";
  content?: string;
  tool?: string;
  input?: string;
  output?: any;
  timestamp: number;
}

interface PanelState {
  response: boolean;
  reasoning: boolean;
  tools: boolean;
}

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
  source?: string;
}

interface SearchResponse {
  query: string;
  totalResults: number;
  summary?: string;
  results: SearchResult[];
}

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [panels, setPanels] = useState<PanelState>({
    response: true,
    reasoning: true,
    tools: true,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userQuery = input.trim();
    setInput("");
    setIsStreaming(true);
    setMessages([]);

    try {
      const response = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userQuery }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.replace("data: ", ""));
              if (data.type !== "done") {
                setMessages((prev) => [...prev, { ...data, timestamp: Date.now() }]);
              }
            } catch (e) {
              console.error("Parse error:", e);
            }
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { type: "error", content: err.message, timestamp: Date.now() },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput("");
  };

  const togglePanel = (panel: keyof PanelState) => {
    setPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  };

  const getPanelData = (type: Message["type"]) => {
    return messages.filter((m) => m.type === type);
  };

  const renderCitations = (text: string, toolData: SearchResponse | null) => {
    if (!toolData || !toolData.results) return text;

    const parts = text.split(/(\[[0-9]+\])/g);
    return parts.map((part, i) => {
      const match = part.match(/\[(\d+)\]/);
      if (match) {
        const idx = parseInt(match[1]) - 1;
        const result = toolData.results[idx];
        if (result) {
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 group cursor-pointer"
              title={`${result.title} → ${result.link}`}
            >
              <sup className="text-xs text-indigo-600 font-medium">[ {match[1]} ]</sup>
              <ExternalLink className="w-3 h-3 text-indigo-500 opacity-0 group-hover:opacity-100 transition" />
            </span>
          );
        }
      }
      return part;
    });
  };

  const renderToolCall = (msg: Message) => {
    const output = msg.output as SearchResponse | null;
    if (!output) return null;

    return (
      <div className="space-y-4">
        {output.summary && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800 flex items-center gap-2">
              <Info className="w-4 h-4" />
              {output.summary}
            </p>
          </div>
        )}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {output.results.map((r, i) => (
            <div
              key={i}
              className="border-l-4 border-purple-500 pl-4 py-3 bg-purple-50 rounded-r-lg hover:bg-purple-100 transition"
            >
              <div className="flex justify-between items-start gap-2">
                <a
                  href={r.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-purple-800 hover:underline text-sm flex items-center gap-1"
                >
                  [{i + 1}] {r.title}
                  <ExternalLink className="w-3 h-3" />
                </a>
                {r.date && <span className="text-xs text-gray-500">• {r.date}</span>}
              </div>
              <p className="text-xs text-gray-700 mt-1 leading-relaxed">{r.snippet}</p>
              <p className="text-xs text-gray-500 mt-1">via {r.source}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Agentic Chat</h1>
                <p className="text-xs text-gray-500">AI with real-time web tools</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isStreaming && (
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-9 h-9 rounded bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs flex items-center justify-center animate-pulse font-medium"
                      style={{ animationDelay: `${i * 150}ms` }}
                    >
                      Streaming
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={clearChat}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 transition font-medium"
              >
                <RotateCw className="w-4 h-4" />
                Clear
              </button>
            </div>
          </div>
        </header>

        {/* Panels */}
        <div className="flex-1 max-w-7xl mx-auto w-full p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* AI Response */}
          <div
            className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all ${
              panels.response ? "" : "opacity-75"
            }`}
          >
            <div
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-3 flex items-center justify-between cursor-pointer select-none"
              onClick={() => togglePanel("response")}
            >
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                <span className="font-semibold">AI Response</span>
              </div>
              {panels.response ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
            {panels.response && (
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {getPanelData("response").length === 0 ? (
                  <p className="text-gray-400 italic">Waiting for response...</p>
                ) : (
                  getPanelData("response").map((msg, i) => {
                    const toolData = messages.find((m) => m.type === "tool_call")?.output as SearchResponse | null;
                    return (
                      <p key={i} className="text-sm leading-relaxed text-gray-800">
                        {renderCitations(msg.content || "", toolData)}
                      </p>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Reasoning Process */}
          <div
            className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all ${
              panels.reasoning ? "" : "opacity-75"
            }`}
          >
            <div
              className="bg-gradient-to-r from-orange-500 to-amber-600 text-white px-4 py-3 flex items-center justify-between cursor-pointer select-none"
              onClick={() => togglePanel("reasoning")}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <span className="font-semibold">Reasoning Process</span>
              </div>
              {panels.reasoning ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
            {panels.reasoning && (
              <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                {getPanelData("reasoning").length === 0 ? (
                  <p className="text-gray-400 italic">No reasoning yet...</p>
                ) : (
                  getPanelData("reasoning").map((msg, i) => (
                    <p key={i} className="text-xs text-gray-700 italic flex items-center gap-2">
                      <Sparkles className="w-3 h-3 text-orange-500" />
                      {msg.content}
                    </p>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tool Calls & Results */}
        <div className="max-w-7xl mx-auto w-full px-4 pb-4">
          <div
            className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all ${
              panels.tools ? "" : "opacity-75"
            }`}
          >
            <div
              className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-3 flex items-center justify-between cursor-pointer select-none"
              onClick={() => togglePanel("tools")}
            >
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                <span className="font-semibold">Tool Calls & Results</span>
              </div>
              {panels.tools ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
            {panels.tools && (
              <div className="p-4 max-h-96 overflow-y-auto">
                {getPanelData("tool_call").length === 0 ? (
                  <p className="text-gray-400 italic">No tool calls yet...</p>
                ) : (
                  getPanelData("tool_call").map((msg, i) => renderToolCall(msg))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="e.g., Explain the state of AI in 2025?"
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition"
                disabled={isStreaming}
              />
              <button
                onClick={sendMessage}
                disabled={isStreaming || !input.trim()}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 font-medium shadow-md"
              >
                {isStreaming ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Thinking...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}