import { Info, Terminal, FileCode, Database, Cpu } from "lucide-react";
import { CompressorSettings } from "../types";

interface SettingsTabProps {
  settings: CompressorSettings;
  toggleSettingsField: (pipeline: "rtk" | "serena" | "headroom" | "caveman" | "cache" | "upstream", field: string) => void;
  handleSliderChange: (pipeline: "serena" | "headroom", field: string, val: number) => void;
  handleInputChange: (field: string, val: string) => void;
  handleSaveSettings: (updatedSettings: CompressorSettings) => void;
}

export default function SettingsTab({
  settings,
  toggleSettingsField,
  handleSliderChange,
  handleInputChange,
  handleSaveSettings
}: SettingsTabProps) {
  return (
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
  );
}
