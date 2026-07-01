import {
  Zap,
  Sliders,
  Terminal,
  FileCode,
  Database,
  Cpu,
  CheckCircle,
  XCircle,
  ChevronRight,
  TrendingDown,
} from "lucide-react";
import { Metrics, RequestLog, CompressorSettings } from "../types";

interface DashboardTabProps {
  metrics: Metrics;
  logs: RequestLog[];
  settings: CompressorSettings;
  selectedLog: RequestLog | null;
  setSelectedLog: (log: RequestLog | null) => void;
  backendPort: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a colour that transitions green→amber→red based on savings value (high savings = green) */
function savingsColor(pct: number): string {
  if (pct >= 50) return "#10b981"; // neon-green
  if (pct >= 25) return "#f59e0b"; // amber
  if (pct >= 10) return "#06b6d4"; // cyan
  return "#ec4899";                 // pink / bad
}

/** Bg colour with low opacity for savings badges */
function savingsBg(pct: number): string {
  if (pct >= 50) return "rgba(16,185,129,0.12)";
  if (pct >= 25) return "rgba(245,158,11,0.12)";
  if (pct >= 10) return "rgba(6,182,212,0.12)";
  return "rgba(236,72,153,0.12)";
}

// ── Pipeline row component ────────────────────────────────────────────────────
interface PipelineRowProps {
  icon: React.ReactNode;
  name: string;
  sub: string;
  active: boolean;
  dotColor: string;
}

function PipelineRow({ icon, name, sub, active, dotColor }: PipelineRowProps) {
  return (
    <div className="flex justify-between items-center bg-slate-900/40 p-3 rounded-xl border border-white/5">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-sm font-bold leading-none">{name}</p>
          <p className="text-xxs text-slate-500 font-mono mt-0.5">{sub}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="pipeline-dot"
          style={{ background: active ? dotColor : "#334155", color: dotColor }}
          data-active={active}
        />
        <span
          className="text-xs font-black font-mono px-2 py-0.5 rounded"
          style={
            active
              ? { color: dotColor, background: dotColor + "18" }
              : { color: "#64748b", background: "rgba(255,255,255,0.04)" }
          }
        >
          {active ? "ACTIVE" : "IDLE"}
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DashboardTab({
  metrics,
  logs,
  settings,
  selectedLog,
  setSelectedLog,
  backendPort,
}: DashboardTabProps) {
  const avgSavingPercent =
    metrics.originalTokensSum > 0
      ? ((metrics.originalTokensSum - metrics.compressedTokensSum) / metrics.originalTokensSum) * 100
      : 0;

  const cacheHitRate =
    metrics.totalRequests > 0
      ? ((metrics.cacheHits / metrics.totalRequests) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-6 animate-in">

      {/* ── Metric Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Saved tokens */}
        <div className="glass-panel glass-panel-glow-purple p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-neon-purple/8 blur-2xl pointer-events-none" />
          <p className="text-xxs text-slate-400 font-bold uppercase tracking-wider mb-1">Saved Tokens</p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-purple-300">
              {metrics.totalSavedTokens.toLocaleString()}
            </span>
            <span className="text-xxs text-neon-purple font-mono font-bold">tok</span>
          </div>
          {/* mini progress bar */}
          <div className="mt-3 h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-neon-purple to-neon-cyan transition-all duration-700"
              style={{ width: `${Math.min(100, avgSavingPercent)}%` }}
            />
          </div>
          <p className="text-xxs text-slate-500 font-mono mt-1">of {metrics.originalTokensSum.toLocaleString()} sent</p>
        </div>

        {/* Compression ratio */}
        <div className="glass-panel glass-panel-glow-cyan p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-neon-cyan/8 blur-2xl pointer-events-none" />
          <p className="text-xxs text-slate-400 font-bold uppercase tracking-wider mb-1">Avg Compression</p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-cyan-300">
              {avgSavingPercent.toFixed(1)}%
            </span>
            <TrendingDown className="w-4 h-4 text-neon-cyan mb-0.5" />
          </div>
          <div className="mt-3 h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-neon-cyan transition-all duration-700"
              style={{ width: `${Math.min(100, avgSavingPercent)}%` }}
            />
          </div>
          <p className="text-xxs text-slate-500 font-mono mt-1">average input reduction</p>
        </div>

        {/* Cost saved */}
        <div className="glass-panel glass-panel-glow-green p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-neon-green/8 blur-2xl pointer-events-none" />
          <p className="text-xxs text-slate-400 font-bold uppercase tracking-wider mb-1">Est. Savings</p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-emerald-300">
              ${metrics.totalSavedCost.toFixed(3)}
            </span>
            <span className="text-xxs text-neon-green font-mono font-bold">USD</span>
          </div>
          <div className="mt-3 h-1 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-neon-green w-full" />
          </div>
          <p className="text-xxs text-slate-500 font-mono mt-1">at ~$0.005 / 1K tokens</p>
        </div>

        {/* Requests & cache */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden">
          <p className="text-xxs text-slate-400 font-bold uppercase tracking-wider mb-1">Requests / Cache</p>
          <div className="flex items-baseline gap-3 mt-1">
            <div>
              <span className="text-2xl md:text-3xl font-black text-white">{metrics.totalRequests}</span>
              <span className="text-xxs text-slate-500 ml-1 font-mono">req</span>
            </div>
            <div className="border-l border-white/10 pl-3">
              <span className="text-2xl md:text-3xl font-black text-neon-cyan">{metrics.cacheHits}</span>
              <span className="text-xxs text-slate-500 ml-1 font-mono">hit</span>
            </div>
          </div>
          <div className="mt-3 h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-green transition-all duration-700"
              style={{ width: `${Math.min(100, parseFloat(cacheHitRate))}%` }}
            />
          </div>
          <p className="text-xxs text-slate-500 font-mono mt-1">cache hit rate {cacheHitRate}%</p>
        </div>
      </div>

      {/* ── Middle row: Pipeline Status + Bar Chart ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Pipeline status */}
        <div className="glass-panel p-6 rounded-2xl lg:col-span-1 flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-wider mb-4 text-slate-300 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-neon-purple" />
            Pipeline Status
          </h3>
          <div className="space-y-2.5 flex-1">
            <PipelineRow
              icon={<Terminal className="w-4 h-4 text-neon-purple" />}
              name="RTK Compressor"
              sub="CLI outputs & logs"
              active={settings.rtk.enabled}
              dotColor="#a855f7"
            />
            <PipelineRow
              icon={<FileCode className="w-4 h-4 text-neon-cyan" />}
              name="Serena Pruner"
              sub="AST function collapse"
              active={settings.serena.enabled}
              dotColor="#06b6d4"
            />
            <PipelineRow
              icon={<Database className="w-4 h-4 text-neon-green" />}
              name="Headroom Layer"
              sub="JSON & Reversible CCR"
              active={settings.headroom.enabled}
              dotColor="#10b981"
            />
            <PipelineRow
              icon={<Cpu className="w-4 h-4 text-neon-pink" />}
              name="Caveman Prose"
              sub="Output instruction injection"
              active={settings.caveman.enabled}
              dotColor="#ec4899"
            />
          </div>
          <div className="mt-4 pt-4 border-t border-white/5 space-y-1.5">
            <div className="flex justify-between text-xxs font-mono">
              <span className="text-slate-400">Target Router:</span>
              <span className="font-bold" style={{ color: settings.upstream.preferBifrost ? "#06b6d4" : "#a855f7" }}>
                {settings.upstream.preferBifrost ? "Bifrost Gateway" : "Direct API"}
              </span>
            </div>
            {settings.upstream.preferBifrost && (
              <div className="flex justify-between text-xxs font-mono text-slate-500">
                <span>Bifrost Endpoint:</span>
                <span className="truncate max-w-[140px]">{settings.upstream.bifrostUrl}</span>
              </div>
            )}
            <div className="flex justify-between text-xxs font-mono pt-1 border-t border-white/5">
              <span className="text-slate-400">Agent Base URL:</span>
              <span className="text-neon-cyan font-bold">http://localhost:{backendPort}/v1</span>
            </div>
          </div>
        </div>

        {/* Compression bar chart */}
        <div className="glass-panel p-6 rounded-2xl lg:col-span-2 flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-wider mb-4 text-slate-300 flex items-center justify-between">
            <span>Compression History</span>
            <span className="text-xxs font-mono font-normal text-slate-500">last 15 requests</span>
          </h3>

          {logs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/8 rounded-2xl min-h-[11rem]">
              <Zap className="w-7 h-7 text-slate-700 mb-2" />
              <p className="text-xs text-slate-600 font-mono">Waiting for proxy traffic…</p>
            </div>
          ) : (
            <>
              <div className="flex-1 flex items-end justify-between gap-1.5 px-1 min-h-[11rem]">
                {logs.slice(0, 15).reverse().map((log, index) => {
                  const ratio = log.status === "error" ? 3 : Math.min(100, Math.max(5, log.savingsPercent));
                  const barColor =
                    log.status === "error"
                      ? "#ec4899"
                      : log.cached
                      ? "#06b6d4"
                      : savingsColor(log.savingsPercent);
                  return (
                    <div key={log.id || index} className="flex-1 flex flex-col items-center group cursor-pointer relative">
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 bg-slate-950 border border-white/10 px-3 py-2 rounded-xl text-xxs font-mono pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 w-32 shadow-xl">
                        <p className="font-bold text-neon-cyan truncate">{log.model.substring(0, 14)}</p>
                        <div className="mt-1 pt-1 border-t border-white/5 space-y-0.5">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Saved:</span>
                            <span className="font-bold" style={{ color: barColor }}>{log.savingsPercent.toFixed(0)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Tokens:</span>
                            <span>{log.compressedTokens}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Time:</span>
                            <span>{log.durationMs}ms</span>
                          </div>
                        </div>
                      </div>

                      {/* Percent label above bar */}
                      <span className="text-[9px] font-mono font-bold mb-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: barColor }}>
                        {log.savingsPercent.toFixed(0)}%
                      </span>

                      {/* Bar */}
                      <div className="w-full bg-slate-900/80 rounded-lg overflow-hidden" style={{ height: "8rem" }}>
                        <div
                          className="w-full rounded-b-lg rounded-t-sm transition-all duration-500"
                          style={{
                            height: `${ratio}%`,
                            marginTop: `${100 - ratio}%`,
                            background: log.cached
                              ? `linear-gradient(to top, ${barColor}cc, ${barColor}55)`
                              : `linear-gradient(to top, ${barColor}, ${barColor}80)`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-5 mt-4 pt-4 border-t border-white/5 justify-end">
                {[
                  { color: "#10b981", label: "High savings" },
                  { color: "#06b6d4", label: "Cached" },
                  { color: "#ec4899", label: "Error" },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xxs text-slate-400 font-mono">
                    <span className="w-2.5 h-2.5 rounded" style={{ background: color }} />
                    {label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Request Log Table ─────────────────────────────────────── */}
      <div className="glass-panel p-6 rounded-2xl">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-4 text-slate-300 flex items-center justify-between">
          <span>Proxy Activity Log</span>
          <span className="text-xxs font-mono text-slate-500 font-normal">Live — last {logs.length} entries</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-xxs font-mono text-slate-500 uppercase tracking-widest">
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Provider</th>
                <th className="py-3 px-3">Model</th>
                <th className="py-3 px-3">Original</th>
                <th className="py-3 px-3">Compressed</th>
                <th className="py-3 px-3">Savings</th>
                <th className="py-3 px-3">CCR</th>
                <th className="py-3 px-3">Time</th>
                <th className="py-3 px-3 text-right">Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-xs font-mono text-slate-600">
                    No requests yet. Send traffic through the proxy to see logs here.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] text-xs font-mono transition-colors cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="py-3 px-3">
                      {log.status === "success" ? (
                        <span className="flex items-center gap-1.5 text-neon-green">
                          <CheckCircle className="w-3.5 h-3.5" /> OK
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-neon-pink">
                          <XCircle className="w-3.5 h-3.5" /> ERR
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-300">{log.provider === "openai" ? "OpenAI" : "Anthropic"}</td>
                    <td className="py-3 px-3 text-slate-400 max-w-[130px] truncate" title={log.model}>{log.model}</td>
                    <td className="py-3 px-3 text-slate-400">{log.originalTokens.toLocaleString()}</td>
                    <td className="py-3 px-3 text-slate-300">
                      {log.cached ? (
                        <span className="bg-neon-cyan/10 border border-neon-cyan/25 text-neon-cyan px-1.5 py-0.5 rounded text-[10px] font-bold">CACHED</span>
                      ) : (
                        log.compressedTokens.toLocaleString()
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {/* Savings badge with dynamic color */}
                      <span
                        className="savings-badge"
                        style={{
                          color: savingsColor(log.savingsPercent),
                          background: savingsBg(log.savingsPercent),
                          border: `1px solid ${savingsColor(log.savingsPercent)}30`,
                        }}
                      >
                        {log.savingsPercent.toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{log.ccrMappingsCount}</td>
                    <td className="py-3 px-3 text-slate-500">{log.durationMs}ms</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                        className="text-neon-purple hover:text-neon-cyan flex items-center gap-0.5 ml-auto transition-colors cursor-pointer"
                      >
                        View <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Log Detail Modal ──────────────────────────────────────── */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="glass-panel w-full max-w-5xl max-h-[88vh] rounded-3xl flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="p-5 border-b border-white/5 flex justify-between items-start shrink-0">
              <div>
                <h3 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-purple to-neon-cyan">
                  REQUEST #{selectedLog.id}
                </h3>
                <div className="flex flex-wrap gap-3 mt-1.5 text-xxs font-mono text-slate-500">
                  <span>Model: <span className="text-slate-300">{selectedLog.model}</span></span>
                  <span>Provider: <span className="text-slate-300">{selectedLog.provider}</span></span>
                  <span>
                    Savings:{" "}
                    <span className="font-bold" style={{ color: savingsColor(selectedLog.savingsPercent) }}>
                      {selectedLog.savingsPercent.toFixed(1)}%
                    </span>
                  </span>
                  <span>Duration: <span className="text-slate-300">{selectedLog.durationMs}ms</span></span>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors shrink-0 ml-4"
              >
                ✕ Close
              </button>
            </div>

            {/* Prompt diff */}
            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xxs font-bold uppercase tracking-wider text-slate-400 font-mono">Original Prompt</h4>
                  <span className="text-xxs font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded">{selectedLog.originalTokens.toLocaleString()} tok</span>
                </div>
                <pre className="flex-1 bg-slate-950/90 border border-white/5 p-4 rounded-2xl text-xxs font-mono overflow-auto min-h-[40vh] text-slate-300 whitespace-pre-wrap">
                  {selectedLog.originalPrompt || "[No original prompt recorded]"}
                </pre>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xxs font-bold uppercase tracking-wider text-neon-cyan font-mono">Compressed Prompt</h4>
                  <span className="text-xxs font-mono font-bold px-2 py-0.5 rounded" style={{ color: savingsColor(selectedLog.savingsPercent), background: savingsBg(selectedLog.savingsPercent) }}>
                    {selectedLog.compressedTokens.toLocaleString()} tok
                  </span>
                </div>
                <pre
                  className="flex-1 bg-slate-950/90 border p-4 rounded-2xl text-xxs font-mono overflow-auto min-h-[40vh] text-slate-300 whitespace-pre-wrap"
                  style={{ borderColor: savingsColor(selectedLog.savingsPercent) + "30" }}
                >
                  {selectedLog.compressedPrompt || "[No compressed prompt recorded]"}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
