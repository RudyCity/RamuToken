import { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  Activity,
  Terminal,
  Zap,
} from "lucide-react";
import { CompressorSettings, RequestLog, Metrics } from "./types";
import DashboardTab from "./components/DashboardTab";
import PlaygroundTab from "./components/PlaygroundTab";
import SettingsTab from "./components/SettingsTab";

const APP_VERSION = "1.3.28";

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "testbench" | "settings">("dashboard");
  const [wsConnected, setWsConnected] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>({
    totalRequests: 0,
    originalTokensSum: 0,
    compressedTokensSum: 0,
    cacheHits: 0,
    totalSavedTokens: 0,
    totalSavedCost: 0,
  });
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [backendPort, setBackendPort] = useState<number>(6875);
  const [settings, setSettings] = useState<CompressorSettings>({
    rtk: { enabled: true, logs: true, paths: true, stacks: true },
    serena: { enabled: true, minLines: 8, referenceGraphPruning: true, projectRoot: "" },
    verification: { enabled: false, testCommand: "npm test", maxRetries: 3 },
    headroom: { enabled: true, minify: true, prune: true, ccr: true, minCcrLength: 200, blacklist: [] },
    caveman: { enabled: false, level: "medium", compressMcpDescriptions: false },
    cache: { enabled: true },
    upstream: {
      bifrostUrl: "http://localhost:8080",
      openaiKey: "",
      anthropicKey: "",
      preferBifrost: true,
      preferCustom: false,
      customUrl: "",
      customKey: "",
      customHeader: "Authorization"
    },
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


  // Selected log detail state
  const [selectedLog, setSelectedLog] = useState<RequestLog | null>(null);

  // Setup WebSocket connection with auto-reconnect
  useEffect(() => {
    let ws: WebSocket;
    let retryTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host || "localhost:6875";
      ws = new WebSocket(`${protocol}//${host}/ws`);

      ws.onopen = () => setWsConnected(true);

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "init") {
            setMetrics(payload.data.metrics);
            setLogs(payload.data.logs);
            setSettings(payload.data.settings);
            if (payload.data.port) {
              setBackendPort(payload.data.port);
            }
          } else if (payload.type === "update") {
            setMetrics(payload.data.metrics);
            if (payload.data.latestLog) {
              setLogs((prev) => [payload.data.latestLog, ...prev.slice(0, 199)]);
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
        retryTimeout = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      ws?.close();
      clearTimeout(retryTimeout);
    };
  }, []);

  // Save modified settings to the backend
  const handleSaveSettings = async (updatedSettings: CompressorSettings) => {
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSettings),
      });
      if (res.ok) {
        const resJson = await res.json();
        setSettings(resJson.settings);
      }
    } catch (err) {
      console.error("Error saving settings", err);
    }
  };

  const toggleSettingsField = (
    pipeline: "rtk" | "serena" | "headroom" | "caveman" | "cache" | "upstream" | "verification",
    field: string
  ) => {
    const updated = { ...settings };
    if (pipeline === "rtk") (updated.rtk as any)[field] = !(updated.rtk as any)[field];
    else if (pipeline === "serena") (updated.serena as any)[field] = !(updated.serena as any)[field];
    else if (pipeline === "verification") (updated.verification as any)[field] = !(updated.verification as any)[field];
    else if (pipeline === "headroom") (updated.headroom as any)[field] = !(updated.headroom as any)[field];
    else if (pipeline === "caveman") {
      if (field === "compressMcpDescriptions") {
        updated.caveman.compressMcpDescriptions = !updated.caveman.compressMcpDescriptions;
      } else {
        updated.caveman.enabled = !updated.caveman.enabled;
      }
    }
    else if (pipeline === "cache") updated.cache.enabled = !updated.cache.enabled;
    else if (pipeline === "upstream") {
      if (field === "preferCustom") {
        updated.upstream.preferCustom = !updated.upstream.preferCustom;
        if (updated.upstream.preferCustom) {
          updated.upstream.preferBifrost = false;
        }
      } else if (field === "preferBifrost") {
        updated.upstream.preferBifrost = !updated.upstream.preferBifrost;
        if (updated.upstream.preferBifrost) {
          updated.upstream.preferCustom = false;
        }
      } else {
        (updated.upstream as any)[field] = !(updated.upstream as any)[field];
      }
    }
    setSettings(updated);
    handleSaveSettings(updated);
  };

  const handleSliderChange = (pipeline: "serena" | "headroom", field: string, val: number) => {
    const updated = { ...settings };
    if (pipeline === "serena") (updated.serena as any)[field] = val;
    else if (pipeline === "headroom") (updated.headroom as any)[field] = val;
    setSettings(updated);
  };

  const handleInputChange = (field: string, val: string) => {
    const updated = { ...settings };
    (updated.upstream as any)[field] = val;
    setSettings(updated);
  };

  const handleCavemanLevelChange = (level: "low" | "medium" | "high" | "wenyan") => {
    const updated = { ...settings };
    updated.caveman.level = level;
    setSettings(updated);
    handleSaveSettings(updated);
  };

  const handleServerPortChange = (val: number) => {
    const updated = { ...settings };
    if (!updated.server) updated.server = { port: 6875, accessToken: "" };
    updated.server.port = val;
    setSettings(updated);
  };

  const handleServerTokenChange = (val: string) => {
    const updated = { ...settings };
    if (!updated.server) updated.server = { port: 6875, accessToken: "" };
    updated.server.accessToken = val;
    setSettings(updated);
  };

  const navItems = [
    { id: "dashboard" as const, label: "Dashboard", icon: Activity, activeColor: "bg-neon-purple text-white shadow-[0_0_18px_rgba(168,85,247,0.35)]" },
    { id: "testbench" as const, label: "Playground", icon: Terminal, activeColor: "bg-neon-cyan text-slate-950 shadow-[0_0_18px_rgba(6,182,212,0.35)] font-extrabold" },
    { id: "settings" as const, label: "Settings",   icon: SettingsIcon, activeColor: "bg-neon-green text-slate-950 shadow-[0_0_18px_rgba(16,185,129,0.35)] font-extrabold" },
  ] as const;

  return (
    <div className="min-h-screen bg-bg-dark text-slate-100 flex flex-col font-sans">
      {/* ── Top Header ─────────────────────────────────────────────── */}
      <header className="glass-panel border-b border-white/5 py-3 px-6 md:px-8 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-neon-purple/10 border border-neon-purple/25 p-2 rounded-xl text-neon-purple shadow-[0_0_24px_rgba(168,85,247,0.2)] shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-neon-purple via-neon-cyan to-neon-green leading-none">
                RAMUTOKEN
              </h1>
              <p className="text-xxs text-slate-500 font-mono mt-0.5">AI Context Gate v{APP_VERSION}</p>
            </div>
          </div>

          {/* Nav Tabs — center */}
          <nav className="flex items-center bg-slate-950/70 border border-white/5 p-1 rounded-xl gap-0.5">
            {navItems.map(({ id, label, icon: Icon, activeColor }) => (
              <button
                key={id}
                id={`tab-${id}`}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all duration-300 cursor-pointer ${
                  activeTab === id ? activeColor : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>

          {/* Status badge — right */}
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`w-2 h-2 rounded-full status-dot-pulse ${
                wsConnected ? "bg-neon-green text-neon-green" : "bg-neon-pink text-neon-pink"
              }`}
            />
            <span className="text-xxs font-black font-mono text-slate-400 tracking-wider hidden sm:inline">
              {wsConnected ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────────────── */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
        {activeTab === "dashboard" && (
          <DashboardTab
            metrics={metrics}
            logs={logs}
            settings={settings}
            selectedLog={selectedLog}
            setSelectedLog={setSelectedLog}
            backendPort={backendPort}
          />
        )}
        {activeTab === "testbench" && (
          <PlaygroundTab
            globalSettings={settings}
            testText={testText}
            setTestText={setTestText}
            testQuery={testQuery}
            setTestQuery={setTestQuery}
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
            backendPort={backendPort}
            handleServerPortChange={handleServerPortChange}
            handleServerTokenChange={handleServerTokenChange}
          />
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="py-3 border-t border-white/5 text-center text-xxs text-slate-600 font-mono shrink-0">
        RamuToken Proxy v{APP_VERSION} · Created by Rudy H. (Github: RudyCity &lt;https://github.com/RudyCity/RamuToken&gt;) · Built with Bun, React &amp; Tailwind CSS v4
      </footer>
    </div>
  );
}
