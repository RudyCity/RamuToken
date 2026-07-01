import { useState } from "react";
import { Info, Terminal, FileCode, Database, Cpu, Wifi, WifiOff, Loader } from "lucide-react";
import { CompressorSettings } from "../types";

interface SettingsTabProps {
  settings: CompressorSettings;
  toggleSettingsField: (pipeline: "rtk" | "serena" | "headroom" | "caveman" | "cache" | "upstream", field: string) => void;
  handleSliderChange: (pipeline: "serena" | "headroom", field: string, val: number) => void;
  handleInputChange: (field: string, val: string) => void;
  handleSaveSettings: (updatedSettings: CompressorSettings) => void;
  handleCavemanLevelChange: (level: "low" | "medium" | "high") => void;
  backendPort: number;
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────
interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  color?: string;
  id?: string;
}

function Toggle({ checked, onChange, color = "#10b981", id }: ToggleProps) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`toggle-track ${checked ? "on" : "off"}`}
      style={checked ? { background: color, boxShadow: `0 0 12px ${color}88` } : {}}
    >
      <span className="toggle-thumb" />
    </button>
  );
}

// ── Bifrost status type ───────────────────────────────────────────────────────
type BifrostStatus = "idle" | "checking" | "online" | "offline";

// ── Main component ────────────────────────────────────────────────────────────
export default function SettingsTab({
  settings,
  toggleSettingsField,
  handleSliderChange,
  handleInputChange,
  handleSaveSettings,
  handleCavemanLevelChange,
  backendPort,
}: SettingsTabProps) {
  const [bifrostStatus, setBifrostStatus] = useState<BifrostStatus>("idle");
  const [bifrostLatency, setBifrostLatency] = useState<number | null>(null);

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

  // ── Section wrapper ─────────────────────────────────────────────
  const Section = ({ children }: { children: React.ReactNode }) => (
    <div className="glass-panel p-6 rounded-2xl space-y-5">{children}</div>
  );

  const SectionTitle = ({ children, gradient }: { children: React.ReactNode; gradient: string }) => (
    <h2 className={`text-sm font-black text-transparent bg-clip-text bg-gradient-to-r ${gradient} mb-1`}>
      {children}
    </h2>
  );

  // Pipeline row with toggle
  const PipelineSection = ({
    id, icon, name, desc, active, color, activeGradient, children,
  }: {
    id: string; icon: React.ReactNode; name: string; desc: string;
    active: boolean; color: string; activeGradient: string;
    children?: React.ReactNode;
  }) => (
    <div className="border border-white/5 rounded-xl overflow-hidden">
      <div
        className="flex justify-between items-center p-4"
        style={active ? { background: color + "08" } : { background: "rgba(15,20,35,0.5)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon}
          <div className="min-w-0">
            <h3 className="text-sm font-bold leading-none">{name}</h3>
            <p className="text-xxs text-slate-500 font-mono mt-0.5 truncate">{desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span
            className="text-xxs font-black font-mono hidden sm:inline"
            style={{ color: active ? color : "#64748b" }}
          >
            {active ? "ACTIVE" : "IDLE"}
          </span>
          <Toggle
            id={`toggle-${id}`}
            checked={active}
            onChange={() => toggleSettingsField(id.split(".")[0] as any, id.split(".")[1] || "enabled")}
            color={color}
          />
        </div>
      </div>
      {active && children && (
        <div className="p-4 pt-3 border-t border-white/5 bg-slate-950/30 space-y-4">
          {children}
        </div>
      )}
    </div>
  );

  // Checkbox option
  const CheckOption = ({
    label, sub, checked, onChange, color,
  }: { label: string; sub: string; checked: boolean; onChange: () => void; color: string }) => (
    <label className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <div
        className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all"
        style={checked ? { background: color, borderColor: color } : { borderColor: "rgba(255,255,255,0.15)" }}
      >
        {checked && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
      </div>
      <div>
        <span className="text-xs font-bold block">{label}</span>
        <span className="text-xxs text-slate-500 font-mono">{sub}</span>
      </div>
    </label>
  );

  return (
    <div className="space-y-6 animate-in">

      {/* ── Upstream Routing ──────────────────────────────────────── */}
      <Section>
        <div>
          <SectionTitle gradient="from-neon-green to-neon-cyan">UPSTREAM ROUTING & GATEWAY</SectionTitle>
          <p className="text-xxs text-slate-500 font-mono">
            Connect to Bifrost (auto-spawned) or use direct provider API keys as fallback. Direct your AI agents to <code className="text-neon-cyan font-bold bg-white/5 px-1 py-0.5 rounded">http://localhost:{backendPort}/v1</code>.
          </p>
        </div>

        {/* Prefer Bifrost toggle row */}
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

        {/* Bifrost URL + Test connection */}
        <div className="space-y-2">
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

        {/* Divider */}
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
        >
          <div className="max-w-lg">
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
        </PipelineSection>

        {/* 3. Headroom */}
        <PipelineSection
          id="headroom.enabled"
          icon={<Database className="w-4 h-4 text-neon-green shrink-0" />}
          name="Headroom — JSON & Reversible CCR"
          desc="Minifies JSON, drops empty attributes, and substitutes long strings with reversible tokens."
          active={settings.headroom.enabled}
          color="#10b981"
          activeGradient="from-neon-green to-neon-cyan"
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
        >
          <div className="max-w-xs">
            <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
              Compression Level
            </label>
            <select
              id="select-caveman-level"
              value={settings.caveman.level || "medium"}
              onChange={(e) => handleCavemanLevelChange(e.target.value as "low" | "medium" | "high")}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-neon-pink cursor-pointer"
            >
              <option value="low">Low — Remove filler & greetings</option>
              <option value="medium">Medium — Direct & concise, code-focused</option>
              <option value="high">High — Telegraphic caveman mode</option>
            </select>
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
        />
      </Section>
    </div>
  );
}
