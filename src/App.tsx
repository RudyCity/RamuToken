import React, { useState, useEffect, useRef } from "react";
import { 
  Settings as SettingsIcon, 
  Activity, 
  Play, 
  RefreshCw, 
  Database, 
  Terminal, 
  FileCode, 
  Cpu, 
  Zap, 
  CheckCircle, 
  XCircle,
  Copy,
  ChevronRight,
  TrendingDown,
  Info,
  Sliders
} from "lucide-react";

// Types matching backend configuration
interface CompressorSettings {
  rtk: {
    enabled: boolean;
    logs: boolean;
    paths: boolean;
    stacks: boolean;
  };
  serena: {
    enabled: boolean;
    minLines: number;
  };
  headroom: {
    enabled: boolean;
    minify: boolean;
    prune: boolean;
    ccr: boolean;
    minCcrLength: number;
    blacklist: string[];
  };
  caveman: {
    enabled: boolean;
  };
  cache: {
    enabled: boolean;
  };
  upstream: {
    bifrostUrl: string;
    openaiKey: string;
    anthropicKey: string;
    preferBifrost: boolean;
  };
}

interface RequestLog {
  id: string;
  timestamp: number;
  provider: "openai" | "anthropic";
  model: string;
  originalTokens: number;
  compressedTokens: number;
  savingsPercent: number;
  cached: boolean;
  durationMs: number;
  status: "success" | "error";
  ccrMappingsCount: number;
  originalPrompt: string;
  compressedPrompt: string;
}

interface Metrics {
  totalRequests: number;
  originalTokensSum: number;
  compressedTokensSum: number;
  cacheHits: number;
  totalSavedTokens: number;
  totalSavedCost: number;
}

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
    caveman: { enabled: false },
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
          // Trigger a dummy re-evaluation
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

  // Calculate cumulative saving percentage
  const avgSavingPercent = metrics.originalTokensSum > 0 
    ? ((metrics.originalTokensSum - metrics.compressedTokensSum) / metrics.originalTokensSum) * 100 
    : 0;

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
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Metrics cards grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div className="glass-panel glass-panel-glow-purple p-5 rounded-2xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 rounded-full bg-neon-purple/5 blur-xl"></div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Total Saved Tokens</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-purple-200">
                    {metrics.totalSavedTokens.toLocaleString()}
                  </span>
                  <span className="text-xs text-neon-purple font-mono font-bold">tokens</span>
                </div>
                <div className="mt-2 text-xs text-slate-500 font-mono">
                  From {metrics.originalTokensSum.toLocaleString()} total input
                </div>
              </div>

              <div className="glass-panel glass-panel-glow-cyan p-5 rounded-2xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 rounded-full bg-neon-cyan/5 blur-xl"></div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Compression Ratio</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-cyan-200">
                    {avgSavingPercent.toFixed(1)}%
                  </span>
                  <TrendingDown className="w-5 h-5 text-neon-cyan" />
                </div>
                <div className="mt-2 text-xs text-slate-500 font-mono">
                  Average input size reduction
                </div>
              </div>

              <div className="glass-panel glass-panel-glow-green p-5 rounded-2xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 rounded-full bg-neon-green/5 blur-xl"></div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Estimated Savings</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-emerald-200">
                    ${metrics.totalSavedCost.toFixed(3)}
                  </span>
                  <span className="text-xs text-neon-green font-mono font-bold">USD</span>
                </div>
                <div className="mt-2 text-xs text-slate-500 font-mono">
                  Saved at ~$0.005/1K tokens
                </div>
              </div>

              <div className="glass-panel p-5 rounded-2xl relative overflow-hidden">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Requests & Cache</p>
                <div className="flex items-baseline gap-4">
                  <div>
                    <span className="text-2xl md:text-3xl font-black text-white">{metrics.totalRequests}</span>
                    <span className="text-xs text-slate-500 ml-1 font-mono">reqs</span>
                  </div>
                  <div className="border-l border-white/10 pl-4">
                    <span className="text-2xl md:text-3xl font-black text-neon-cyan">{metrics.cacheHits}</span>
                    <span className="text-xs text-slate-500 ml-1 font-mono">hits</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500 font-mono">
                  Cache hit rate: {metrics.totalRequests > 0 ? ((metrics.cacheHits / metrics.totalRequests) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>

            {/* Main Stats Graph and Active Pipelines Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Active Pipeline Status */}
              <div className="glass-panel p-6 rounded-2xl lg:col-span-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-slate-300 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-neon-purple" />
                    Pipeline Status
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <Terminal className="w-5 h-5 text-neon-purple" />
                        <div>
                          <p className="text-sm font-bold">RTK Compressor</p>
                          <p className="text-xxs text-slate-500 font-mono">CLI outputs & logs</p>
                        </div>
                      </div>
                      <span className={`text-xs font-black font-mono px-2 py-1 rounded ${settings.rtk.enabled ? "bg-neon-purple/10 text-neon-purple" : "bg-slate-900 text-slate-500"}`}>
                        {settings.rtk.enabled ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <FileCode className="w-5 h-5 text-neon-cyan" />
                        <div>
                          <p className="text-sm font-bold">Serena Pruner</p>
                          <p className="text-xxs text-slate-500 font-mono">AST function signatures</p>
                        </div>
                      </div>
                      <span className={`text-xs font-black font-mono px-2 py-1 rounded ${settings.serena.enabled ? "bg-neon-cyan/10 text-neon-cyan" : "bg-slate-900 text-slate-500"}`}>
                        {settings.serena.enabled ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <Database className="w-5 h-5 text-neon-green" />
                        <div>
                          <p className="text-sm font-bold">Headroom Layer</p>
                          <p className="text-xxs text-slate-500 font-mono">JSON & Reversible CCR</p>
                        </div>
                      </div>
                      <span className={`text-xs font-black font-mono px-2 py-1 rounded ${settings.headroom.enabled ? "bg-neon-green/10 text-neon-green" : "bg-slate-900 text-slate-500"}`}>
                        {settings.headroom.enabled ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <Cpu className="w-5 h-5 text-neon-pink" />
                        <div>
                          <p className="text-sm font-bold">Caveman prose</p>
                          <p className="text-xxs text-slate-500 font-mono">Instruction injection</p>
                        </div>
                      </div>
                      <span className={`text-xs font-black font-mono px-2 py-1 rounded ${settings.caveman.enabled ? "bg-neon-pink/10 text-neon-pink" : "bg-slate-900 text-slate-500"}`}>
                        {settings.caveman.enabled ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Target Router:</span>
                    <span className="text-neon-cyan font-bold">
                      {settings.upstream.preferBifrost ? "Bifrost Gateway" : "Direct Provider API"}
                    </span>
                  </div>
                  {settings.upstream.preferBifrost && (
                    <div className="flex justify-between text-xxs font-mono text-slate-500">
                      <span>Gateway Address:</span>
                      <span>{settings.upstream.bifrostUrl}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Dynamic SVGs / Sparklines of Recent Savings */}
              <div className="glass-panel p-6 rounded-2xl lg:col-span-2 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-slate-300 flex items-center justify-between">
                    <span>Compression Performance History</span>
                    <span className="text-xs font-mono font-normal text-slate-500">Last 15 requests</span>
                  </h3>
                  
                  {logs.length === 0 ? (
                    <div className="h-44 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-2xl">
                      <Zap className="w-8 h-8 text-slate-600 mb-2" />
                      <p className="text-xs text-slate-500 font-mono">Waiting for proxy traffic...</p>
                    </div>
                  ) : (
                    <div className="h-44 w-full flex items-end justify-between gap-1 pt-6 px-2">
                      {logs.slice(0, 15).reverse().map((log, index) => {
                        const ratio = log.status === "error" ? 0 : Math.min(100, Math.max(5, log.savingsPercent));
                        return (
                          <div key={log.id || index} className="flex-1 flex flex-col items-center group cursor-pointer relative">
                            {/* Hover Details Tooltip */}
                            <div className="absolute bottom-full mb-2 bg-slate-950 border border-white/10 px-3 py-2 rounded-xl text-xxs font-mono pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 w-32 shadow-xl">
                              <p className="font-bold text-neon-cyan">{log.model.substring(0, 12)}</p>
                              <div className="mt-1 flex justify-between border-t border-white/5 pt-1">
                                <span>Saved:</span>
                                <span className="font-bold text-neon-green">{log.savingsPercent.toFixed(0)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Tokens:</span>
                                <span>{log.compressedTokens}</span>
                              </div>
                            </div>

                            {/* Bar Graphic */}
                            <div className="w-full bg-slate-900 rounded-lg h-32 flex items-end">
                              <div 
                                style={{ height: `${ratio}%` }}
                                className={`w-full rounded-b-lg rounded-t-sm transition-all duration-500 ${
                                  log.status === "error" 
                                    ? "bg-neon-pink" 
                                    : log.cached 
                                      ? "bg-neon-cyan" 
                                      : "bg-gradient-to-t from-neon-purple to-neon-cyan"
                                }`}
                              ></div>
                            </div>
                            <span className="text-[9px] font-mono text-slate-500 mt-2">#{log.id}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-6 mt-6 pt-4 border-t border-white/5 justify-end">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                    <span className="w-2.5 h-2.5 rounded bg-gradient-to-t from-neon-purple to-neon-cyan"></span>
                    Compressed
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                    <span className="w-2.5 h-2.5 rounded bg-neon-cyan"></span>
                    Cached
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                    <span className="w-2.5 h-2.5 rounded bg-neon-pink"></span>
                    Error
                  </div>
                </div>
              </div>
            </div>

            {/* Request Logs Table */}
            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-slate-300 flex items-center justify-between">
                <span>Recent Proxy Activity</span>
                <span className="text-xxs font-mono text-slate-500">Auto-updating logs</span>
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-xxs font-mono text-slate-400 uppercase tracking-widest">
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Provider</th>
                      <th className="py-3 px-4">Model</th>
                      <th className="py-3 px-4">Original</th>
                      <th className="py-3 px-4">Compressed</th>
                      <th className="py-3 px-4">Savings</th>
                      <th className="py-3 px-4">CCR</th>
                      <th className="py-3 px-4">Duration</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-xs font-mono text-slate-500">
                          No requests processed yet. Generate some traffic to see logs here.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr 
                          key={log.id} 
                          className="border-b border-white/5 hover:bg-white/[0.02] text-xs font-mono transition-colors"
                        >
                          <td className="py-3 px-4">
                            {log.status === "success" ? (
                              <span className="flex items-center gap-1.5 text-neon-green">
                                <CheckCircle className="w-3.5 h-3.5" />
                                OK
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-neon-pink">
                                <XCircle className="w-3.5 h-3.5" />
                                FAIL
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-300">
                            {log.provider === "openai" ? "OpenAI" : "Anthropic"}
                          </td>
                          <td className="py-3 px-4 text-slate-400 max-w-[150px] truncate" title={log.model}>
                            {log.model}
                          </td>
                          <td className="py-3 px-4 text-slate-300">{log.originalTokens}</td>
                          <td className="py-3 px-4 text-slate-300">
                            {log.cached ? (
                              <span className="bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan px-1.5 py-0.5 rounded text-[10px] font-bold">
                                CACHED
                              </span>
                            ) : (
                              log.compressedTokens
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold text-neon-cyan">
                            {log.savingsPercent.toFixed(0)}%
                          </td>
                          <td className="py-3 px-4 text-slate-400">{log.ccrMappingsCount}</td>
                          <td className="py-3 px-4 text-slate-400">{log.durationMs}ms</td>
                          <td className="py-3 px-4 text-right">
                            <button 
                              onClick={() => setSelectedLog(log)}
                              className="text-neon-purple hover:underline flex items-center gap-0.5 ml-auto cursor-pointer"
                            >
                              View
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Selected Log Details Modal / Panel */}
        {selectedLog && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="glass-panel w-full max-w-4xl max-h-[85vh] rounded-3xl flex flex-col overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-cyan">
                    REQUEST DETAILS: #{selectedLog.id}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Model: {selectedLog.model} | Savings: {selectedLog.savingsPercent.toFixed(1)}%
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono flex items-center justify-between">
                    <span>Original Prompt</span>
                    <span className="text-[10px] text-slate-500 font-normal">{selectedLog.originalTokens} tokens</span>
                  </h4>
                  <pre className="bg-slate-950/80 border border-white/5 p-4 rounded-2xl text-xxs font-mono overflow-auto h-[45vh] text-slate-300 whitespace-pre-wrap">
                    {selectedLog.originalPrompt || "[No original prompt recorded]"}
                  </pre>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neon-cyan mb-2 font-mono flex items-center justify-between">
                    <span>Compressed Prompt</span>
                    <span className="text-[10px] text-slate-500 font-normal">{selectedLog.compressedTokens} tokens</span>
                  </h4>
                  <pre className="bg-slate-950/80 border border-white/5 p-4 rounded-2xl text-xxs font-mono overflow-auto h-[45vh] text-slate-300 whitespace-pre-wrap">
                    {selectedLog.compressedPrompt || "[No compressed prompt recorded]"}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Test Bench Tab */}
        {activeTab === "testbench" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
              <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-purple mb-2">
                COMPRESSION TEST BENCH
              </h2>
              <p className="text-xs text-slate-400 font-mono mb-6">
                Paste long logs, files, or JSON schemas below. Enter keywords to prevent Serena from pruning specific functions, and test the compression ratio instantly.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                    Serena Target Keywords (e.g. function or method name)
                  </label>
                  <input 
                    type="text" 
                    value={testQuery}
                    onChange={(e) => setTestQuery(e.target.value)}
                    placeholder="Enter keywords separated by spaces (e.g., compile calculateTokens)..." 
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-neon-cyan transition-colors"
                  />
                </div>
                <div className="flex items-end">
                  <button 
                    onClick={runTestCompression}
                    disabled={testing}
                    className="w-full bg-neon-cyan text-slate-950 hover:bg-neon-cyan/90 px-6 py-2.5 rounded-xl text-sm font-black tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.2)] disabled:opacity-50"
                  >
                    {testing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    RUN COMPRESSION
                  </button>
                </div>
              </div>

              {/* Side-by-Side Editor Panels */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                      Input Payload / Prompt
                    </label>
                    <span className="text-xxs font-mono text-slate-500">
                      ~{countTokens(testText)} tokens
                    </span>
                  </div>
                  <textarea 
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    rows={16}
                    placeholder="Paste logs, AST-code block, or JSON schemas here..."
                    className="w-full bg-slate-950/80 border border-white/5 rounded-2xl p-4 text-xs font-mono text-slate-300 focus:outline-none focus:border-neon-purple transition-all resize-y whitespace-pre"
                  ></textarea>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-neon-cyan font-mono">
                      Compressed Output
                    </label>
                    {testResult && (
                      <span className="text-xxs font-mono text-neon-cyan font-bold bg-neon-cyan/10 border border-neon-cyan/20 px-1.5 py-0.5 rounded">
                        -{testResult.savingsPercent.toFixed(0)}% Saved ({testResult.compressedTokens} tokens)
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-slate-950/80 border border-white/5 rounded-2xl p-4 text-xs font-mono text-slate-400 overflow-auto h-[352px] whitespace-pre relative">
                    {testResult ? (
                      <>
                        <button 
                          onClick={() => navigator.clipboard.writeText(testResult.compressedText)}
                          className="absolute right-4 top-4 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white p-2 rounded-xl text-xxs font-bold cursor-pointer"
                          title="Copy Output"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {testResult.compressedText}
                      </>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-600">
                        <Terminal className="w-8 h-8 mb-2" />
                        <p className="text-xs">Run compression to generate output</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {testResult && (
                <div className="mt-6 bg-slate-900/50 border border-white/5 rounded-2xl p-4 flex flex-wrap gap-6 items-center justify-between text-xs font-mono">
                  <div className="flex gap-6 flex-wrap">
                    <div>
                      <span className="text-slate-500">Original size:</span>{" "}
                      <span className="font-bold text-slate-300">{testResult.originalTokens} tokens</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Compressed size:</span>{" "}
                      <span className="font-bold text-neon-cyan">{testResult.compressedTokens} tokens</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Processing Time:</span>{" "}
                      <span className="font-bold text-slate-300">{testResult.durationMs}ms</span>
                    </div>
                  </div>
                  <div className="text-neon-green font-bold bg-neon-green/10 border border-neon-green/20 px-3 py-1 rounded-xl">
                    Dynamic Saving: {testResult.originalTokens - testResult.compressedTokens} tokens saved
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Upstream Config */}
            <div className="glass-panel p-6 rounded-2xl">
              <h2 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-green to-neon-cyan mb-2">
                UPSTREAM ROUTING & GATEWAY CONFIG
              </h2>
              <p className="text-xs text-slate-400 font-mono mb-6">
                Configure your routing options. Connect to Bifrost (recommended) or enter direct API provider keys.
              </p>

              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-950/60 border border-white/5 rounded-xl gap-4">
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      Route via Bifrost Gateway (Go API gateway)
                    </h4>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      Sends compressed payloads through Bifrost for failover & key rotation.
                    </p>
                  </div>
                  <button 
                    onClick={() => toggleSettingsField("upstream", "preferBifrost")}
                    className={`px-4 py-1.5 rounded-xl text-xs font-black font-mono cursor-pointer transition-all ${
                      settings.upstream.preferBifrost 
                        ? "bg-neon-green/20 border border-neon-green/30 text-neon-green" 
                        : "bg-slate-900 border border-white/5 text-slate-500"
                    }`}
                  >
                    {settings.upstream.preferBifrost ? "ENABLED" : "DISABLED"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                      Bifrost Gateway Endpoint
                    </label>
                    <input 
                      type="text" 
                      value={settings.upstream.bifrostUrl}
                      onChange={(e) => handleInputChange("bifrostUrl", e.target.value)}
                      onBlur={() => handleSaveSettings(settings)}
                      placeholder="http://localhost:8080" 
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-neon-green"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 font-mono flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-slate-500" />
                    Direct Fallback Keys (Optional)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 font-mono">
                        OpenAI API Key
                      </label>
                      <input 
                        type="password" 
                        value={settings.upstream.openaiKey}
                        onChange={(e) => handleInputChange("openaiKey", e.target.value)}
                        onBlur={() => handleSaveSettings(settings)}
                        placeholder="sk-or-left-blank..." 
                        className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2 text-sm font-mono text-slate-400 focus:outline-none focus:border-neon-purple"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 font-mono">
                        Anthropic API Key
                      </label>
                      <input 
                        type="password" 
                        value={settings.upstream.anthropicKey}
                        onChange={(e) => handleInputChange("anthropicKey", e.target.value)}
                        onBlur={() => handleSaveSettings(settings)}
                        placeholder="sk-ant-or-left-blank..." 
                        className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2 text-sm font-mono text-slate-400 focus:outline-none focus:border-neon-purple"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Compression Pipelines Configuration */}
            <div className="glass-panel p-6 rounded-2xl">
              <h2 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-purple via-neon-cyan to-neon-green mb-6">
                COMPRESSION ENGINE PIPELINES
              </h2>

              <div className="space-y-6">
                {/* 1. RTK Config */}
                <div className="border-b border-white/5 pb-6">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <Terminal className="w-4.5 h-4.5 text-neon-purple" />
                        RTK (Rust Token Killer) Log & CLI Compressor
                      </h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Filters out ANSI color garbage, collapses stack traces, and shortens absolute paths.
                      </p>
                    </div>
                    <button 
                      onClick={() => toggleSettingsField("rtk", "enabled")}
                      className={`px-4 py-1.5 rounded-xl text-xs font-black font-mono cursor-pointer transition-all ${
                        settings.rtk.enabled 
                          ? "bg-neon-purple/20 border border-neon-purple/30 text-neon-purple" 
                          : "bg-slate-900 border border-white/5 text-slate-500"
                      }`}
                    >
                      {settings.rtk.enabled ? "ACTIVE" : "INACTIVE"}
                    </button>
                  </div>
                  
                  {settings.rtk.enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pl-6">
                      <label className="flex items-center gap-3 bg-slate-950/40 p-3 rounded-xl border border-white/5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={settings.rtk.logs}
                          onChange={() => toggleSettingsField("rtk", "logs")}
                          className="accent-neon-purple"
                        />
                        <div>
                          <span className="text-xs font-bold block">Log Deduplication</span>
                          <span className="text-[10px] text-slate-500 font-mono">Groups repeated lines</span>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 bg-slate-950/40 p-3 rounded-xl border border-white/5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={settings.rtk.paths}
                          onChange={() => toggleSettingsField("rtk", "paths")}
                          className="accent-neon-purple"
                        />
                        <div>
                          <span className="text-xs font-bold block">Path Shortening</span>
                          <span className="text-[10px] text-slate-500 font-mono">Normalizes local path prefixes</span>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 bg-slate-950/40 p-3 rounded-xl border border-white/5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={settings.rtk.stacks}
                          onChange={() => toggleSettingsField("rtk", "stacks")}
                          className="accent-neon-purple"
                        />
                        <div>
                          <span className="text-xs font-bold block">Stacktrace Truncation</span>
                          <span className="text-[10px] text-slate-500 font-mono">Keeps only vital trace lines</span>
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                {/* 2. Serena Config */}
                <div className="border-b border-white/5 pb-6">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <FileCode className="w-4.5 h-4.5 text-neon-cyan" />
                        Serena Code AST Pruner
                      </h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Identifies functions/methods longer than limit and collapses them if they are not in the query keywords.
                      </p>
                    </div>
                    <button 
                      onClick={() => toggleSettingsField("serena", "enabled")}
                      className={`px-4 py-1.5 rounded-xl text-xs font-black font-mono cursor-pointer transition-all ${
                        settings.serena.enabled 
                          ? "bg-neon-cyan/20 border border-neon-cyan/30 text-neon-cyan" 
                          : "bg-slate-900 border border-white/5 text-slate-500"
                      }`}
                    >
                      {settings.serena.enabled ? "ACTIVE" : "INACTIVE"}
                    </button>
                  </div>
                  
                  {settings.serena.enabled && (
                    <div className="pl-6 space-y-4 max-w-xl">
                      <div>
                        <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                          <span>Minimum lines to trigger signature compression:</span>
                          <span className="text-neon-cyan font-bold">{settings.serena.minLines} lines</span>
                        </div>
                        <input 
                          type="range" 
                          min={3} 
                          max={30} 
                          value={settings.serena.minLines}
                          onChange={(e) => handleSliderChange("serena", "minLines", parseInt(e.target.value))}
                          onMouseUp={() => handleSaveSettings(settings)}
                          onTouchEnd={() => handleSaveSettings(settings)}
                          className="w-full accent-neon-cyan"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Headroom Config */}
                <div className="border-b border-white/5 pb-6">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <Database className="w-4.5 h-4.5 text-neon-green" />
                        Headroom Structural & Reversible CCR Layer
                      </h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Minifies raw JSON, drops empty attributes, and substitutes long contexts with reversible placeholders.
                      </p>
                    </div>
                    <button 
                      onClick={() => toggleSettingsField("headroom", "enabled")}
                      className={`px-4 py-1.5 rounded-xl text-xs font-black font-mono cursor-pointer transition-all ${
                        settings.headroom.enabled 
                          ? "bg-neon-green/20 border border-neon-green/30 text-neon-green" 
                          : "bg-slate-900 border border-white/5 text-slate-500"
                      }`}
                    >
                      {settings.headroom.enabled ? "ACTIVE" : "INACTIVE"}
                    </button>
                  </div>
                  
                  {settings.headroom.enabled && (
                    <div className="pl-6 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <label className="flex items-center gap-3 bg-slate-950/40 p-3 rounded-xl border border-white/5 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={settings.headroom.minify}
                            onChange={() => toggleSettingsField("headroom", "minify")}
                            className="accent-neon-green"
                          />
                          <div>
                            <span className="text-xs font-bold block">JSON Minify</span>
                            <span className="text-[10px] text-slate-500 font-mono">Removes white-spaces</span>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 bg-slate-950/40 p-3 rounded-xl border border-white/5 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={settings.headroom.prune}
                            onChange={() => toggleSettingsField("headroom", "prune")}
                            className="accent-neon-green"
                          />
                          <div>
                            <span className="text-xs font-bold block">Prune JSON metadata</span>
                            <span className="text-[10px] text-slate-500 font-mono">Strips empty arrays & nulls</span>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 bg-slate-950/40 p-3 rounded-xl border border-white/5 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={settings.headroom.ccr}
                            onChange={() => toggleSettingsField("headroom", "ccr")}
                            className="accent-neon-green"
                          />
                          <div>
                            <span className="text-xs font-bold block">Reversible CCR</span>
                            <span className="text-[10px] text-slate-500 font-mono">Client Context Retrieval substitution</span>
                          </div>
                        </label>
                      </div>

                      {settings.headroom.ccr && (
                        <div className="max-w-xl">
                          <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                            <span>Minimum character length to replace with placeholder CCR token:</span>
                            <span className="text-neon-green font-bold">{settings.headroom.minCcrLength} chars</span>
                          </div>
                          <input 
                            type="range" 
                            min={100} 
                            max={1000} 
                            value={settings.headroom.minCcrLength}
                            onChange={(e) => handleSliderChange("headroom", "minCcrLength", parseInt(e.target.value))}
                            onMouseUp={() => handleSaveSettings(settings)}
                            onTouchEnd={() => handleSaveSettings(settings)}
                            className="w-full accent-neon-green"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 4. Caveman Config */}
                <div className="border-b border-white/5 pb-6">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <Cpu className="w-4.5 h-4.5 text-neon-pink" />
                        Caveman Output Prose Compressor (Opt-in)
                      </h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Forces the model to omit articles, pronouns, greetings, and speak in keyword fragments to save output tokens.
                      </p>
                    </div>
                    <button 
                      onClick={() => toggleSettingsField("caveman", "enabled")}
                      className={`px-4 py-1.5 rounded-xl text-xs font-black font-mono cursor-pointer transition-all ${
                        settings.caveman.enabled 
                          ? "bg-neon-pink/20 border border-neon-pink/30 text-neon-pink" 
                          : "bg-slate-900 border border-white/5 text-slate-500"
                      }`}
                    >
                      {settings.caveman.enabled ? "ACTIVE" : "INACTIVE"}
                    </button>
                  </div>
                </div>

                {/* 5. Local Cache Config */}
                <div>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <Database className="w-4.5 h-4.5 text-neon-cyan" />
                        Local Request Cache Optimizer
                      </h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Caches exact hits of compressed request payloads in-memory, returning responses instantly with 0 token consumption.
                      </p>
                    </div>
                    <button 
                      onClick={() => toggleSettingsField("cache", "enabled")}
                      className={`px-4 py-1.5 rounded-xl text-xs font-black font-mono cursor-pointer transition-all ${
                        settings.cache.enabled 
                          ? "bg-neon-cyan/20 border border-neon-cyan/30 text-neon-cyan" 
                          : "bg-slate-900 border border-white/5 text-slate-500"
                      }`}
                    >
                      {settings.cache.enabled ? "ACTIVE" : "INACTIVE"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-white/5 text-center text-slate-500 text-xxs font-mono shrink-0">
        RamuToken Proxy © 2026. Made with Bun, React, and Tailwind CSS v4.
      </footer>
    </div>
  );
}
