import { useState, useEffect } from "react";
import { 
  Settings as SettingsIcon, 
  Activity, 
  Terminal, 
  Zap 
} from "lucide-react";
import { CompressorSettings, RequestLog, Metrics } from "./types";
import DashboardTab from "./components/DashboardTab";
import TestBenchTab from "./components/TestBenchTab";
import SettingsTab from "./components/SettingsTab";

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "testbench" | "settings">("dashboard");
  const [wsConnected, setWsConnected] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>({
    totalRequests: 0,
    originalTokensSum: 0,
    compressedTokensSum: 0,
    cacheHits: 0,
    totalSavedTokens: 0,
    totalSavedCost: 0
  });
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [settings, setSettings] = useState<CompressorSettings>({
    rtk: { enabled: true, logs: true, paths: true, stacks: true },
    serena: { enabled: true, minLines: 8 },
    headroom: { enabled: true, minify: true, prune: true, ccr: true, minCcrLength: 200, blacklist: [] },
    caveman: { enabled: false, level: "medium" },
    cache: { enabled: true },
    upstream: { bifrostUrl: "http://localhost:8080", openaiKey: "", anthropicKey: "", preferBifrost: true }
  });

  // Test bench state
  const [testText, setTestText] = useState(
    `[2026-07-01 08:35:42] INFO: Processing request #342\n` +
    `[2026-07-01 08:35:42] DEBUG: Database response: {"status": "ok", "metadata": {"session_id": "9a7f3e82b1d044f7ba9c", "id_token": "token12345", "user_agent": "Mozilla/5.0"}, "data": []}\n` +
    `[2026-07-01 08:35:43] ERROR: Unhandled exception in C:\\Users\\USER\\projects\\ramu-token\\server\\index.ts:\n` +
    `  at processRequest (C:\\Users\\USER\\projects\\ramu-token\\server\\index.ts:45:12)\n` +
    `  at handleRoute (C:\\Users\\USER\\projects\\ramu-token\\server\\index.ts:102:8)\n` +
    `  at dispatch (C:\\Users\\USER\\projects\\ramu-token\\node_modules\\express\\lib\\router\\index.js:284:7)\n` +
    `  at next (C:\\Users\\USER\\projects\\ramu-token\\node_modules\\express\\lib\\router\\index.js:230:5)\n` +
    `  at checkAuth (C:\\Users\\USER\\projects\\ramu-token\\server\\auth.ts:12:3)\n` +
    `  at runMicrotasks (<anonymous>)\n` +
    `  at processTicksAndRejections (node:internal/process/task_queues:95:5)\n` +
    `  at runNext (C:\\Users\\USER\\projects\\ramu-token\\server\\index.ts:22:2)\n\n` +
    `Here is the source code file:\n` +
    `\`\`\`typescript\n` +
    `import { getEncoding } from "js-tiktoken";\n` +
    `import { settings } from "./config";\n\n` +
    `export function calculateTokens(text: string): number {\n` +
    `  const encoder = getEncoding("cl100k_base");\n` +
    `  const tokens = encoder.encode(text);\n` +
    `  return tokens.length;\n` +
    `}\n\n` +
    `export function computeSavings(original: number, compressed: number): number {\n` +
    `  if (original === 0) return 0;\n` +
    `  const delta = original - compressed;\n` +
    `  const ratio = (delta / original) * 100;\n` +
    `  return Math.round(ratio * 100) / 100;\n` +
    `}\n` +
    `\`\`\``
  );
  const [testQuery, setTestQuery] = useState("calculateTokens");
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  // Selected log detail state
  const [selectedLog, setSelectedLog] = useState<RequestLog | null>(null);

  // Setup WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host || "localhost:6875";
    const wsUrl = `${protocol}//${host}/ws`;

    console.log(`[Dashboard] Connecting to WebSocket: ${wsUrl}`);
    let ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "init") {
          setMetrics(payload.data.metrics);
          setLogs(payload.data.logs);
          setSettings(payload.data.settings);
        } else if (payload.type === "update") {
          setMetrics(payload.data.metrics);
          if (payload.data.latestLog) {
            setLogs(prev => [payload.data.latestLog, ...prev.slice(0, 199)]);
          }
        } else if (payload.type === "settings") {
          setSettings(payload.data);
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message", err);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      // Reconnect after 3 seconds
      setTimeout(() => {
        if (!wsConnected) {
          setWsConnected(c => c);
        }
      }, 3000);
    };

    return () => {
      ws.close();
    };
  }, []);

  // Save modified settings to the backend
  const handleSaveSettings = async (updatedSettings: CompressorSettings) => {
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSettings)
      });
      if (response.ok) {
        const resJson = await response.json();
        setSettings(resJson.settings);
      }
    } catch (err) {
      console.error("Error saving settings", err);
    }
  };

  const toggleSettingsField = (pipeline: "rtk" | "serena" | "headroom" | "caveman" | "cache" | "upstream", field: string) => {
    const updated = { ...settings };
    if (pipeline === "rtk") {
      const p = updated.rtk as any;
      p[field] = !p[field];
    } else if (pipeline === "serena") {
      const p = updated.serena as any;
      p[field] = !p[field];
    } else if (pipeline === "headroom") {
      const p = updated.headroom as any;
      p[field] = !p[field];
    } else if (pipeline === "caveman") {
      updated.caveman.enabled = !updated.caveman.enabled;
    } else if (pipeline === "cache") {
      updated.cache.enabled = !updated.cache.enabled;
    } else if (pipeline === "upstream") {
      const p = updated.upstream as any;
      p[field] = !p[field];
    }
    setSettings(updated);
    handleSaveSettings(updated);
  };

  const handleSliderChange = (pipeline: "serena" | "headroom", field: string, val: number) => {
    const updated = { ...settings };
    if (pipeline === "serena") {
      const p = updated.serena as any;
      p[field] = val;
    } else if (pipeline === "headroom") {
      const p = updated.headroom as any;
      p[field] = val;
    }
    setSettings(updated);
  };

  const handleInputChange = (field: string, val: string) => {
    const updated = { ...settings };
    const p = updated.upstream as any;
    p[field] = val;
    setSettings(updated);
  };

  const handleCavemanLevelChange = (level: "low" | "medium" | "high") => {
    const updated = { ...settings };
    updated.caveman.level = level;
    setSettings(updated);
    handleSaveSettings(updated);
  };

  // Run test compression
  const runTestCompression = async () => {
    if (!testText.trim()) return;
    setTesting(true);
    try {
      const response = await fetch("/api/compress-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: testText,
          query: testQuery
        })
      });
      if (response.ok) {
        const data = await response.json();
        setTestResult(data);
      }
    } catch (err) {
      console.error("Test compression failed", err);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-dark text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="glass-panel border-b border-white/5 py-4 px-6 md:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-neon-purple/10 border border-neon-purple/30 p-2 rounded-xl text-neon-purple shadow-[0_0_20px_rgba(168,85,247,0.2)]">
            <Zap className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-neon-purple via-neon-cyan to-neon-green">
              RAMUTOKEN
            </h1>
            <p className="text-xs text-slate-400 font-mono">Dynamic AI Context Gate v1.0</p>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <nav className="flex items-center bg-slate-950/60 border border-white/5 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-350 cursor-pointer ${
              activeTab === "dashboard" 
                ? "bg-neon-purple text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="w-4 h-4" />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab("testbench")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-350 cursor-pointer ${
              activeTab === "testbench" 
                ? "bg-neon-cyan text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)] font-bold" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="w-4 h-4" />
            Test Bench
          </button>
          <button 
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-350 cursor-pointer ${
              activeTab === "settings" 
                ? "bg-neon-green text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)] font-bold" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            Settings
          </button>
        </nav>

        {/* Connection status badge */}
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full status-dot-pulse ${wsConnected ? "text-neon-green bg-neon-green" : "text-neon-pink bg-neon-pink"}`}></span>
          <span className="text-xs font-bold font-mono text-slate-400 tracking-wider">
            {wsConnected ? "PROXY ONLINE" : "PROXY OFFLINE"}
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
        {activeTab === "dashboard" && (
          <DashboardTab
            metrics={metrics}
            logs={logs}
            settings={settings}
            selectedLog={selectedLog}
            setSelectedLog={setSelectedLog}
          />
        )}

        {activeTab === "testbench" && (
          <TestBenchTab
            testText={testText}
            setTestText={setTestText}
            testQuery={testQuery}
            setTestQuery={setTestQuery}
            testResult={testResult}
            testing={testing}
            runTestCompression={runTestCompression}
          />
        )}

        {activeTab === "settings" && (
          <SettingsTab
            settings={settings}
            toggleSettingsField={toggleSettingsField}
            handleSliderChange={handleSliderChange}
            handleInputChange={handleInputChange}
            handleSaveSettings={handleSaveSettings}
            handleCavemanLevelChange={handleCavemanLevelChange}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-white/5 text-center text-slate-500 text-xxs font-mono shrink-0">
        RamuToken Proxy © 2026. Made with Bun, React, and Tailwind CSS v4.
      </footer>
    </div>
  );
}
