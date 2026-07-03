import { useState, useEffect } from "react";
import { Info, Terminal, FileCode, Database, Cpu, Wifi, WifiOff, Loader, RefreshCw } from "lucide-react";
import { CompressorSettings } from "../types";
import { Section, SectionTitle, PipelineSection, CheckOption } from "./SettingsHelpers";

interface SettingsTabProps {
  settings: CompressorSettings;
  toggleSettingsField: (pipeline: "rtk" | "serena" | "headroom" | "caveman" | "cache" | "upstream" | "verification" | "llmlingua", field: string) => void;
  handleSliderChange: (pipeline: "serena" | "headroom" | "llmlingua", field: string, val: number) => void;
  handleInputChange: (field: string, val: string) => void;
  handleLlmlinguaInputChange: (field: string, val: string) => void;
  handleSaveSettings: (updatedSettings: CompressorSettings) => void;
  handleCavemanLevelChange: (level: "low" | "medium" | "high" | "wenyan") => void;
  backendPort: number;
  handleServerPortChange: (val: number) => void;
  handleServerTokenChange: (val: string) => void;
}

// ── Bifrost status type ───────────────────────────────────────────────────────
type BifrostStatus = "idle" | "checking" | "online" | "offline";

// ── Main component ────────────────────────────────────────────────────────────
export default function SettingsTab({
  settings,
  toggleSettingsField,
  handleSliderChange,
  handleInputChange,
  handleLlmlinguaInputChange,
  handleSaveSettings,
  handleCavemanLevelChange,
  backendPort,
  handleServerPortChange,
  handleServerTokenChange,
}: SettingsTabProps) {
  const [bifrostStatus, setBifrostStatus] = useState<BifrostStatus>("idle");
  const [bifrostLatency, setBifrostLatency] = useState<number | null>(null);
  const [customStatus, setCustomStatus] = useState<BifrostStatus>("idle");
  const [customLatency, setCustomLatency] = useState<number | null>(null);
  const [copiedOpenAI, setCopiedOpenAI] = useState(false);
  const [copiedAnthropic, setCopiedAnthropic] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Background Python Daemon monitoring state
  const [daemonStatus, setDaemonStatus] = useState<{
    isActive: boolean;
    pid: number | null;
    projects: string[];
    platform: string | null;
    python_version: string | null;
  } | null>(null);
  const [restartingDaemon, setRestartingDaemon] = useState(false);

  const fetchDaemonStatus = async () => {
    try {
      const res = await fetch("/api/daemon-status");
      if (res.ok) {
        setDaemonStatus(await res.json());
      }
    } catch (err) {
      console.error("Failed to query daemon status:", err);
    }
  };

  useEffect(() => {
    fetchDaemonStatus();
    const interval = setInterval(fetchDaemonStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRestartDaemon = async () => {
    setRestartingDaemon(true);
    try {
      await fetch("/api/daemon-restart", { method: "POST" });
      // Short delay for daemon shutdown and restart process
      await new Promise((resolve) => setTimeout(resolve, 800));
      await fetchDaemonStatus();
    } catch (err) {
      console.error("Failed to restart daemon:", err);
    } finally {
      setRestartingDaemon(false);
    }
  };

  const generateToken = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "rt-";
    for (let i = 0; i < 24; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    handleServerTokenChange(token);
    const updated = { ...settings };
    if (!updated.server) updated.server = { port: 6875, accessToken: "" };
    updated.server.accessToken = token;
    handleSaveSettings(updated);
  };

  // Test Bifrost connectivity
  const testBifrost = async () => {
    setBifrostStatus("checking");
    setBifrostLatency(null);
    const start = Date.now();
    try {
      const url = settings.upstream.bifrostUrl.replace(/\/$/, "");
      await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000), mode: "no-cors" });
      setBifrostLatency(Date.now() - start);
      setBifrostStatus("online");
    } catch {
      try {
        await fetch(settings.upstream.bifrostUrl, { signal: AbortSignal.timeout(5000), mode: "no-cors" });
        setBifrostLatency(Date.now() - start);
        setBifrostStatus("online");
      } catch {
        setBifrostStatus("offline");
      }
    }
  };

  // Test Custom Upstream connectivity
  const testCustomUpstream = async () => {
    const rawUrl = settings.upstream.customUrl.replace(/\/$/, "");
    if (!rawUrl) return;
    setCustomStatus("checking");
    setCustomLatency(null);
    const start = Date.now();
    try {
      // Try /health first, then root
      await fetch(`${rawUrl}/health`, { signal: AbortSignal.timeout(5000), mode: "no-cors" });
      setCustomLatency(Date.now() - start);
      setCustomStatus("online");
    } catch {
      try {
        await fetch(rawUrl, { signal: AbortSignal.timeout(5000), mode: "no-cors" });
        setCustomLatency(Date.now() - start);
        setCustomStatus("online");
      } catch {
        setCustomStatus("offline");
      }
    }
  };

  // Nested components moved outside SettingsTab to prevent unmounting & scroll resets

  return (
    <div className="space-y-6 animate-in">

      {/* ── RamuToken Access Control & Endpoint ──────────────────── */}
      <Section>
        <div>
          <SectionTitle gradient="from-neon-purple to-neon-cyan">RAMUTOKEN ACCESS & ENDPOINTS</SectionTitle>
          <p className="text-xxs text-slate-500 font-mono">
            Copy your proxy base URL and secure client connections with an access token.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Endpoint URLs */}
          <div className="space-y-4">
            {/* OpenAI Endpoint */}
            <div className="space-y-1.5">
              <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 font-mono">
                OpenAI Router Base URL
              </label>
              <div className="flex gap-2">
                <input
                  id="input-endpoint-openai"
                  type="text"
                  readOnly
                  value={`http://localhost:${backendPort}/openai/v1`}
                  className="flex-1 bg-slate-950/80 border border-white/5 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-400 focus:outline-none"
                />
                <button
                  id="btn-copy-openai"
                  onClick={() => {
                    navigator.clipboard.writeText(`http://localhost:${backendPort}/openai/v1`);
                    setCopiedOpenAI(true);
                    setTimeout(() => setCopiedOpenAI(false), 2000);
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 hover:bg-white/5 transition-all cursor-pointer shrink-0 min-w-[70px]"
                >
                  {copiedOpenAI ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Anthropic Endpoint */}
            <div className="space-y-1.5">
              <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Anthropic Router Base URL
              </label>
              <div className="flex gap-2">
                <input
                  id="input-endpoint-anthropic"
                  type="text"
                  readOnly
                  value={`http://localhost:${backendPort}/anthropic/v1`}
                  className="flex-1 bg-slate-950/80 border border-white/5 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-400 focus:outline-none"
                />
                <button
                  id="btn-copy-anthropic"
                  onClick={() => {
                    navigator.clipboard.writeText(`http://localhost:${backendPort}/anthropic/v1`);
                    setCopiedAnthropic(true);
                    setTimeout(() => setCopiedAnthropic(false), 2000);
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 hover:bg-white/5 transition-all cursor-pointer shrink-0 min-w-[70px]"
                >
                  {copiedAnthropic ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              Use OpenAI URL for GPT models, and Anthropic URL for Claude models. Anthropic URL auto-translates format for Cursor!
            </p>
          </div>

          {/* Access Token Field */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 font-mono">
                RamuToken Access Token (Authorization Key)
              </label>
              <div className="flex gap-2">
                <input
                  id="input-access-token"
                  type={showToken ? "text" : "password"}
                  value={settings.server?.accessToken || ""}
                  onChange={(e) => handleServerTokenChange(e.target.value)}
                  onBlur={() => handleSaveSettings(settings)}
                  placeholder="No key set (unsecured)"
                  className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-neon-purple transition-colors"
                />
                <button
                  id="btn-show-token"
                  onClick={() => setShowToken(!showToken)}
                  className="px-3 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-bold font-mono transition-all cursor-pointer shrink-0"
                >
                  {showToken ? "Hide" : "Show"}
                </button>
                <button
                  id="btn-gen-token"
                  onClick={generateToken}
                  className="px-3 rounded-xl bg-neon-purple/10 border border-neon-purple/20 hover:bg-neon-purple/15 text-neon-purple text-xs font-bold font-mono transition-all cursor-pointer shrink-0"
                >
                  Gen Key
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              If configured, enter this token as the "API Key" in your coding agent (Cursor, Claude Code, etc.) to authorize requests.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Python Background Daemon Monitor ────────────────────── */}
      <Section>
        <div className="flex justify-between items-start gap-4">
          <div>
            <SectionTitle gradient="from-neon-cyan to-neon-purple">PYTHON BACKGROUND DAEMON STATUS</SectionTitle>
            <p className="text-xxs text-slate-500 font-mono">
              Monitors the persistent Python process cache holding headroom and serena LSP imports.
            </p>
          </div>
          <button
            onClick={handleRestartDaemon}
            disabled={restartingDaemon}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/5 bg-neon-pink/10 hover:bg-neon-pink/20 text-neon-pink text-xs font-mono font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            {restartingDaemon ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            RESTART DAEMON
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
          {/* Status Panel */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 flex items-center gap-3">
            <div className={`p-2 rounded-lg shrink-0 ${daemonStatus?.isActive ? "bg-neon-green/10 text-neon-green" : "bg-neon-pink/10 text-neon-pink"}`}>
              {daemonStatus?.isActive ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-xxs text-slate-500 block">DAEMON LIFE</span>
              <span className="text-xs font-black">{daemonStatus?.isActive ? "RUNNING (HOT)" : "OFFLINE / IDLE"}</span>
            </div>
          </div>

          {/* Process ID */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-neon-cyan/10 text-neon-cyan shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xxs text-slate-500 block">SYSTEM PROCESS PID</span>
              <span className="text-xs font-black">{daemonStatus?.isActive && daemonStatus.pid ? daemonStatus.pid : "NONE"}</span>
            </div>
          </div>

          {/* Projects Cached */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-neon-purple/10 text-neon-purple shrink-0">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xxs text-slate-500 block">LSP CACHED PROJECTS</span>
              <span className="text-xs font-black">{daemonStatus?.isActive ? `${daemonStatus.projects.length} Workspace(s)` : "0 Workspaces"}</span>
            </div>
          </div>
        </div>

        {daemonStatus?.isActive && (
          <div className="pt-2 text-xxs text-slate-500 font-mono space-y-1">
            {daemonStatus.projects.length > 0 && (
              <div>
                <span className="text-slate-400 font-bold">Active LSP Workspaces:</span>
                <ul className="list-disc pl-5 mt-1 text-slate-400">
                  {daemonStatus.projects.map((p, idx) => (
                    <li key={idx} className="truncate">{p}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-4 pt-1">
              <span><span className="text-slate-400">OS Platform:</span> {daemonStatus.platform}</span>
              <span className="truncate"><span className="text-slate-400">Python:</span> {daemonStatus.python_version}</span>
            </div>
          </div>
        )}
      </Section>

      {/* ── Upstream Routing ──────────────────────────────────────── */}
      <Section>
        <div>
          <SectionTitle gradient="from-neon-green to-neon-cyan">UPSTREAM ROUTING & GATEWAY</SectionTitle>
          <p className="text-xxs text-slate-500 font-mono">
            Route requests via <strong className="text-neon-green">Custom Upstream</strong>, <strong className="text-neon-cyan">Bifrost Gateway</strong>, or direct provider APIs. Point your AI agents to <code className="text-neon-cyan font-bold bg-white/5 px-1 py-0.5 rounded">http://localhost:{backendPort}/v1</code>.
          </p>
        </div>

        {/* ── Custom Upstream toggle ───────────────────────────── */}
        <div
          className="flex items-center justify-between p-4 rounded-xl border transition-all"
          style={{
            background: settings.upstream.preferCustom
              ? "rgba(16,185,129,0.07)"
              : "rgba(15,23,42,0.5)",
            borderColor: settings.upstream.preferCustom
              ? "rgba(16,185,129,0.3)"
              : "rgba(255,255,255,0.06)",
          }}
        >
          <div>
            <h4 className="text-sm font-bold flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ background: settings.upstream.preferCustom ? "#10b981" : "#334155", boxShadow: settings.upstream.preferCustom ? "0 0 6px #10b981" : "none" }}
              />
              Route via Custom Upstream Endpoint
            </h4>
            <p className="text-xxs text-slate-500 font-mono mt-0.5">
              Forward to any OpenAI-compatible API (Together AI, OpenRouter, Ollama, LiteLLM, etc.).
            </p>
          </div>
          <Toggle
            id="toggle-prefer-custom"
            checked={settings.upstream.preferCustom}
            onChange={() => toggleSettingsField("upstream", "preferCustom")}
            color="#10b981"
          />
        </div>

        {/* ── Custom Upstream inputs (visible when custom is enabled) ─ */}
        {settings.upstream.preferCustom && (
          <div className="space-y-4 p-4 rounded-xl border border-neon-green/20 bg-neon-green/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-2">
                <label className="block text-xxs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                  Custom Endpoint URL
                </label>
                <div className="flex gap-2">
                  <input
                    id="input-custom-url"
                    type="text"
                    value={settings.upstream.customUrl}
                    onChange={(e) => {
                      handleInputChange("customUrl", e.target.value);
                      setCustomStatus("idle");
                    }}
                    onBlur={() => handleSaveSettings(settings)}
                    placeholder="https://api.together.xyz  or  http://localhost:11434"
                    className="flex-1 bg-slate-950 border border-neon-green/25 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-neon-green transition-colors"
                  />
                  <button
                    id="btn-test-custom"
                    onClick={testCustomUpstream}
                    disabled={customStatus === "checking" || !settings.upstream.customUrl}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-40 shrink-0"
                    style={{
                      background: customStatus === "online"
                        ? "rgba(16,185,129,0.12)"
                        : customStatus === "offline"
                        ? "rgba(236,72,153,0.12)"
                        : "rgba(16,185,129,0.08)",
                      borderColor: customStatus === "online"
                        ? "rgba(16,185,129,0.4)"
                        : customStatus === "offline"
                        ? "rgba(236,72,153,0.35)"
                        : "rgba(16,185,129,0.25)",
                      color: customStatus === "online"
                        ? "#10b981"
                        : customStatus === "offline"
                        ? "#ec4899"
                        : "#34d399",
                    }}
                  >
                    {customStatus === "checking" ? (
                      <Loader className="w-3.5 h-3.5 animate-spin" />
                    ) : customStatus === "online" ? (
                      <Wifi className="w-3.5 h-3.5" />
                    ) : customStatus === "offline" ? (
                      <WifiOff className="w-3.5 h-3.5" />
                    ) : (
                      <Wifi className="w-3.5 h-3.5" />
                    )}
                    {customStatus === "checking"
                      ? "Checking…"
                      : customStatus === "online"
                      ? `Online${customLatency ? ` (${customLatency}ms)` : ""}`
                      : customStatus === "offline"
                      ? "Offline"
                      : "Test"}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xxs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                  Auth Header Name
                </label>
                <input
                  id="input-custom-header"
                  type="text"
                  value={settings.upstream.customHeader}
                  onChange={(e) => handleInputChange("customHeader", e.target.value)}
                  onBlur={() => handleSaveSettings(settings)}
                  placeholder="Authorization"
                  className="w-full bg-slate-950 border border-neon-green/25 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-neon-green transition-colors"
                />
                <p className="text-[10px] text-slate-500 font-mono">
                  e.g. <code className="text-emerald-400">Authorization</code>, <code className="text-emerald-400">x-api-key</code>
                </p>
              </div>
              <div className="space-y-2">
                <label className="block text-xxs font-bold uppercase tracking-wider text-emerald-400 font-mono">
                  Custom API Key
                </label>
                <input
                  id="input-custom-key"
                  type="password"
                  value={settings.upstream.customKey}
                  onChange={(e) => handleInputChange("customKey", e.target.value)}
                  onBlur={() => handleSaveSettings(settings)}
                  placeholder="sk-... or any token"
                  className="w-full bg-slate-950 border border-neon-green/25 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-400 focus:outline-none focus:border-neon-green transition-colors"
                />
                <p className="text-[10px] text-slate-500 font-mono">
                  For <code className="text-emerald-400">Authorization</code> headers, <code className="text-emerald-400">Bearer</code> is auto-prepended.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Prefer Bifrost toggle (hidden when custom is active) ─── */}
        {!settings.upstream.preferCustom && (
          <div className="flex items-center justify-between p-4 bg-slate-950/50 border border-white/8 rounded-xl">
            <div>
              <h4 className="text-sm font-bold">Route via Bifrost Gateway</h4>
              <p className="text-xxs text-slate-500 font-mono mt-0.5">
                Forward to Bifrost for failover, key rotation & load balancing.
              </p>
            </div>
            <Toggle
              id="toggle-prefer-bifrost"
              checked={settings.upstream.preferBifrost}
              onChange={() => toggleSettingsField("upstream", "preferBifrost")}
              color="#06b6d4"
            />
          </div>
        )}

        {/* Bifrost URL + Server Port Grid (hidden when custom upstream is active) */}
        {!settings.upstream.preferCustom && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Bifrost Endpoint URL
              </label>
              <div className="flex gap-2">
                <input
                  id="input-bifrost-url"
                  type="text"
                  value={settings.upstream.bifrostUrl}
                  onChange={(e) => handleInputChange("bifrostUrl", e.target.value)}
                  onBlur={() => handleSaveSettings(settings)}
                  placeholder="http://localhost:8080"
                  className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-neon-cyan transition-colors"
                />
                <button
                  id="btn-test-bifrost"
                  onClick={testBifrost}
                  disabled={bifrostStatus === "checking"}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-60 shrink-0"
                  style={{
                    background: bifrostStatus === "online"
                      ? "rgba(16,185,129,0.12)"
                      : bifrostStatus === "offline"
                      ? "rgba(236,72,153,0.12)"
                      : "rgba(6,182,212,0.1)",
                    borderColor: bifrostStatus === "online"
                      ? "rgba(16,185,129,0.3)"
                      : bifrostStatus === "offline"
                      ? "rgba(236,72,153,0.3)"
                      : "rgba(6,182,212,0.25)",
                    color: bifrostStatus === "online"
                      ? "#10b981"
                      : bifrostStatus === "offline"
                      ? "#ec4899"
                      : "#06b6d4",
                  }}
                >
                  {bifrostStatus === "checking" ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : bifrostStatus === "online" ? (
                    <Wifi className="w-3.5 h-3.5" />
                  ) : bifrostStatus === "offline" ? (
                    <WifiOff className="w-3.5 h-3.5" />
                  ) : (
                    <Wifi className="w-3.5 h-3.5" />
                  )}
                  {bifrostStatus === "checking"
                    ? "Checking…"
                    : bifrostStatus === "online"
                    ? `Online ${bifrostLatency ? `(${bifrostLatency}ms)` : ""}`
                    : bifrostStatus === "offline"
                    ? "Offline"
                    : "Test"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 font-mono">
                RamuToken Proxy Port
              </label>
              <input
                id="input-server-port"
                type="number"
                value={settings.server?.port || 6875}
                onChange={(e) => handleServerPortChange(Number(e.target.value))}
                onBlur={() => handleSaveSettings(settings)}
                placeholder="6875"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-neon-cyan transition-colors"
              />
            </div>
          </div>
        )}

        {/* Proxy Port when custom upstream is active */}
        {settings.upstream.preferCustom && (
          <div className="space-y-2">
            <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 font-mono">
              RamuToken Proxy Port
            </label>
            <input
              id="input-server-port-custom"
              type="number"
              value={settings.server?.port || 6875}
              onChange={(e) => handleServerPortChange(Number(e.target.value))}
              onBlur={() => handleSaveSettings(settings)}
              placeholder="6875"
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-neon-cyan transition-colors"
            />
          </div>
        )}

        {/* Warning if port configured differs from actual active backend port */}
        {settings.server?.port && settings.server.port !== backendPort && (
          <p className="text-[10px] text-neon-amber font-mono bg-neon-amber/8 border border-neon-amber/20 p-3 rounded-xl animate-pulse">
            ⚠️ <strong>Restart Required:</strong> You configured port {settings.server.port}, but the server is currently running on port {backendPort}. Please restart the proxy server for the change to take effect.
          </p>
        )}

        {/* Divider — Direct Fallback Keys (hidden when custom upstream is active) */}
        {!settings.upstream.preferCustom && (
          <div className="border-t border-white/5 pt-4">
            <h4 className="text-xxs font-bold uppercase tracking-wider text-slate-400 mb-3 font-mono flex items-center gap-1.5">
              <Info className="w-3 h-3 text-slate-500" />
              Direct Fallback Keys (used when Bifrost is off)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xxs font-bold uppercase tracking-wider text-slate-500 mb-2 font-mono">
                  OpenAI API Key
                </label>
                <input
                  id="input-openai-key"
                  type="password"
                  value={settings.upstream.openaiKey}
                  onChange={(e) => handleInputChange("openaiKey", e.target.value)}
                  onBlur={() => handleSaveSettings(settings)}
                  placeholder="sk-..."
                  className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-400 focus:outline-none focus:border-neon-purple transition-colors"
                />
              </div>
              <div>
                <label className="block text-xxs font-bold uppercase tracking-wider text-slate-500 mb-2 font-mono">
                  Anthropic API Key
                </label>
                <input
                  id="input-anthropic-key"
                  type="password"
                  value={settings.upstream.anthropicKey}
                  onChange={(e) => handleInputChange("anthropicKey", e.target.value)}
                  onBlur={() => handleSaveSettings(settings)}
                  placeholder="sk-ant-..."
                  className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-400 focus:outline-none focus:border-neon-purple transition-colors"
                />
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* ── Compression Pipelines ─────────────────────────────────── */}
      <Section>
        <div>
          <SectionTitle gradient="from-neon-purple via-neon-cyan to-neon-green">COMPRESSION ENGINE PIPELINES</SectionTitle>
          <p className="text-xxs text-slate-500 font-mono">Toggle and configure each compression pipeline independently.</p>
        </div>

        {/* 1. RTK */}
        <PipelineSection
          id="rtk.enabled"
          icon={<Terminal className="w-4 h-4 text-neon-purple shrink-0" />}
          name="RTK — Log & CLI Compressor"
          desc="Strips ANSI codes, deduplicates repeated lines, shortens absolute paths."
          active={settings.rtk.enabled}
          color="#a855f7"
          activeGradient="from-neon-purple to-neon-cyan"
          toggleSettingsField={toggleSettingsField}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <CheckOption label="Log Deduplication" sub="Groups repeated log lines" checked={settings.rtk.logs} onChange={() => toggleSettingsField("rtk", "logs")} color="#a855f7" />
            <CheckOption label="Path Shortening" sub="Normalizes absolute paths" checked={settings.rtk.paths} onChange={() => toggleSettingsField("rtk", "paths")} color="#a855f7" />
            <CheckOption label="Stacktrace Trim" sub="Keeps only vital trace lines" checked={settings.rtk.stacks} onChange={() => toggleSettingsField("rtk", "stacks")} color="#a855f7" />
          </div>
        </PipelineSection>

        {/* 2. Serena */}
        <PipelineSection
          id="serena.enabled"
          icon={<FileCode className="w-4 h-4 text-neon-cyan shrink-0" />}
          name="Serena — Code AST Pruner"
          desc="Collapses functions longer than threshold if not in active query keywords."
          active={settings.serena.enabled}
          color="#06b6d4"
          activeGradient="from-neon-cyan to-neon-green"
          toggleSettingsField={toggleSettingsField}
        >
          <div className="space-y-4 max-w-lg">
            <div>
              <div className="flex justify-between text-xxs font-mono text-slate-400 mb-2">
                <span>Min lines to trigger signature collapse:</span>
                <span className="text-neon-cyan font-bold">{settings.serena.minLines} lines</span>
              </div>
              <input
                id="slider-serena-minlines"
                type="range" min={3} max={30}
                value={settings.serena.minLines}
                onChange={(e) => handleSliderChange("serena", "minLines", parseInt(e.target.value))}
                onMouseUp={() => handleSaveSettings(settings)}
                onTouchEnd={() => handleSaveSettings(settings)}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="pt-2 border-t border-white/5 space-y-3">
              <CheckOption 
                label="Reference Graph Pruning" 
                sub="Prunes based on symbol call graph references" 
                checked={settings.serena.referenceGraphPruning} 
                onChange={() => toggleSettingsField("serena", "referenceGraphPruning")} 
                color="#06b6d4" 
              />
              
              <div>
                <label className="block text-xxs font-mono text-slate-400 mb-1">
                  Default Project Root Dir:
                </label>
                <input
                  type="text"
                  value={settings.serena.projectRoot || ""}
                  placeholder="e.g. D:/projects/my-app"
                  onChange={(e) => {
                    const updated = { ...settings };
                    updated.serena.projectRoot = e.target.value;
                    handleSaveSettings(updated);
                  }}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-neon-cyan"
                />
              </div>
            </div>
          </div>
        </PipelineSection>

        {/* 3. LLMLingua & AI Prompt Compressor */}
        <PipelineSection
          id="llmlingua.enabled"
          icon={<Cpu className="w-4 h-4 text-neon-purple shrink-0" />}
          name="LLMLingua — AI & LLM Context Compressor"
          desc="Compresses prompts using local small LLMs (LLMLingua) or upstream API models."
          active={settings.llmlingua?.enabled || false}
          color="#a855f7"
          activeGradient="from-neon-purple to-neon-cyan"
          toggleSettingsField={toggleSettingsField}
        >
          <div className="space-y-4 max-w-lg font-mono">
            {/* Method selection */}
            <div className="max-w-xs">
              <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Compression Method
              </label>
              <select
                id="select-llmlingua-method"
                value={settings.llmlingua?.method || "api"}
                onChange={() => toggleSettingsField("llmlingua", "method")}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-neon-purple cursor-pointer"
              >
                <option value="api">Upstream API Model (Claude/GPT)</option>
                <option value="local">Local LLMLingua-2 Model (Offline)</option>
              </select>
            </div>

            {/* Local Method Settings */}
            {(settings.llmlingua?.method || "api") === "local" && (
              <div className="space-y-4 pt-2 border-t border-white/5">
                <div>
                  <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    HuggingFace Local Model
                  </label>
                  <input
                    type="text"
                    value={settings.llmlingua?.localModel || ""}
                    placeholder="e.g. microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank"
                    onChange={(e) => handleLlmlinguaInputChange("localModel", e.target.value)}
                    onBlur={() => handleSaveSettings(settings)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-neon-purple"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Loads locally using python background daemon. Default is extremely fast and light.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between text-xxs text-slate-400 mb-2">
                    <span>Target Compression Rate (percentage of prompt to keep):</span>
                    <span className="text-neon-purple font-bold">{Math.round((settings.llmlingua?.rate || 0.5) * 100)}%</span>
                  </div>
                  <input
                    id="slider-llmlingua-rate"
                    type="range" min={0.1} max={0.9} step={0.05}
                    value={settings.llmlingua?.rate || 0.5}
                    onChange={(e) => handleSliderChange("llmlingua", "rate", parseFloat(e.target.value))}
                    onMouseUp={() => handleSaveSettings(settings)}
                    onTouchEnd={() => handleSaveSettings(settings)}
                    className="w-full accent-purple-400"
                  />
                </div>
              </div>
            )}

            {/* API Method Settings */}
            {(settings.llmlingua?.method || "api") === "api" && (
              <div className="space-y-4 pt-2 border-t border-white/5">
                <div>
                  <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Compression Target Model
                  </label>
                  <input
                    type="text"
                    value={settings.llmlingua?.apiModel || ""}
                    placeholder="auto"
                    onChange={(e) => handleLlmlinguaInputChange("apiModel", e.target.value)}
                    onBlur={() => handleSaveSettings(settings)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-neon-purple"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Set model name (e.g. <code className="text-neon-purple">gpt-4o-mini</code> or <code className="text-neon-purple">claude-3-5-haiku-20241022</code>) or keep <code className="text-neon-purple">auto</code> to select a cheap model dynamically.
                  </p>
                </div>

                <div>
                  <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Compression System Prompt Instructions
                  </label>
                  <textarea
                    value={settings.llmlingua?.apiPrompt || ""}
                    onChange={(e) => handleLlmlinguaInputChange("apiPrompt", e.target.value)}
                    onBlur={() => handleSaveSettings(settings)}
                    rows={4}
                    placeholder="Instructions for the AI to compress the text..."
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-neon-purple font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        </PipelineSection>

        {/* 4. Headroom */}
        <PipelineSection
          id="headroom.enabled"
          icon={<Database className="w-4 h-4 text-neon-green shrink-0" />}
          name="Headroom — JSON & Reversible CCR"
          desc="Minifies JSON, drops empty attributes, and substitutes long strings with reversible tokens."
          active={settings.headroom.enabled}
          color="#10b981"
          activeGradient="from-neon-green to-neon-cyan"
          toggleSettingsField={toggleSettingsField}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <CheckOption label="JSON Minify" sub="Removes whitespace" checked={settings.headroom.minify} onChange={() => toggleSettingsField("headroom", "minify")} color="#10b981" />
              <CheckOption label="Prune Metadata" sub="Strips empty arrays & nulls" checked={settings.headroom.prune} onChange={() => toggleSettingsField("headroom", "prune")} color="#10b981" />
              <CheckOption label="Reversible CCR" sub="Context shorthand substitution" checked={settings.headroom.ccr} onChange={() => toggleSettingsField("headroom", "ccr")} color="#10b981" />
            </div>
            {settings.headroom.ccr && (
              <div className="max-w-lg">
                <div className="flex justify-between text-xxs font-mono text-slate-400 mb-2">
                  <span>Min chars to replace with CCR placeholder:</span>
                  <span className="text-neon-green font-bold">{settings.headroom.minCcrLength} chars</span>
                </div>
                <input
                  id="slider-headroom-ccr"
                  type="range" min={100} max={1000}
                  value={settings.headroom.minCcrLength}
                  onChange={(e) => handleSliderChange("headroom", "minCcrLength", parseInt(e.target.value))}
                  onMouseUp={() => handleSaveSettings(settings)}
                  onTouchEnd={() => handleSaveSettings(settings)}
                  className="w-full accent-emerald-400"
                />
              </div>
            )}
          </div>
        </PipelineSection>

        {/* 4. Caveman */}
        <PipelineSection
          id="caveman.enabled"
          icon={<Cpu className="w-4 h-4 text-neon-pink shrink-0" />}
          name="Caveman — Output Prose Compressor"
          desc="Forces model to omit filler words and respond in telegraphic keyword fragments."
          active={settings.caveman.enabled}
          color="#ec4899"
          activeGradient="from-neon-pink to-neon-purple"
          toggleSettingsField={toggleSettingsField}
        >
          <div className="space-y-4 max-w-lg">
            <div className="max-w-xs">
              <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                Compression Level
              </label>
              <select
                id="select-caveman-level"
                value={settings.caveman.level || "medium"}
                onChange={(e) => handleCavemanLevelChange(e.target.value as "low" | "medium" | "high" | "wenyan")}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-neon-pink cursor-pointer"
              >
                <option value="low">Low — Remove filler & greetings</option>
                <option value="medium">Medium — Direct & concise, code-focused</option>
                <option value="high">High — Telegraphic caveman mode</option>
                <option value="wenyan">Wenyan — Classical Chinese style (shortest)</option>
              </select>
            </div>
            <div>
              <CheckOption 
                label="Compress MCP Tool Descriptions" 
                sub="Shrinks tool/function descriptions dynamically to save input tokens" 
                checked={settings.caveman.compressMcpDescriptions} 
                onChange={() => toggleSettingsField("caveman", "compressMcpDescriptions")} 
                color="#ec4899" 
              />
            </div>
          </div>
        </PipelineSection>

        {/* 5. Cache */}
        <PipelineSection
          id="cache.enabled"
          icon={<Database className="w-4 h-4 text-neon-cyan shrink-0" />}
          name="Local Request Cache"
          desc="Returns cached responses instantly with 0 token usage for identical compressed payloads."
          active={settings.cache.enabled}
          color="#06b6d4"
          activeGradient="from-neon-cyan to-neon-green"
          toggleSettingsField={toggleSettingsField}
        />

        {/* 6. Verification Loop */}
        <PipelineSection
          id="verification.enabled"
          icon={<Terminal className="w-4 h-4 text-neon-green shrink-0" />}
          name="Validation & Verification Loop"
          desc="Performs compiler/LSP check & executes test suites to self-correct AI code."
          active={settings.verification.enabled}
          color="#10b981"
          activeGradient="from-neon-green to-neon-cyan"
          toggleSettingsField={toggleSettingsField}
        >
          <div className="space-y-4 max-w-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xxs font-mono text-slate-400 mb-1">
                  Test Execution Command:
                </label>
                <input
                  type="text"
                  value={settings.verification.testCommand || "npm test"}
                  placeholder="e.g. npm test or bun test"
                  onChange={(e) => {
                    const updated = { ...settings };
                    updated.verification.testCommand = e.target.value;
                    handleSaveSettings(updated);
                  }}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-neon-green"
                />
              </div>
              <div>
                <label className="block text-xxs font-mono text-slate-400 mb-1">
                  Max Healing Retries:
                </label>
                <input
                  type="number"
                  min={1} max={5}
                  value={settings.verification.maxRetries || 3}
                  onChange={(e) => {
                    const updated = { ...settings };
                    updated.verification.maxRetries = parseInt(e.target.value) || 3;
                    handleSaveSettings(updated);
                  }}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-neon-green"
                />
              </div>
            </div>
          </div>
        </PipelineSection>
      </Section>
    </div>
  );
}
