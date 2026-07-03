import { useState } from "react";
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
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  TrendingDown,
  Copy,
  Check,
  Brain,
  HardDrive,
  ShieldCheck,
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

// ── Copy button with transient ✓ feedback ────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer"
      style={{
        background: copied ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)",
        color: copied ? "#10b981" : "#64748b",
        border: copied ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : "Copy"}
    </button>
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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [tweetCopied, setTweetCopied] = useState(false);

  const totalPages = Math.ceil(logs.length / itemsPerPage);
  const activePage = Math.min(currentPage, Math.max(1, totalPages));

  const startIndex = (activePage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, logs.length);
  const paginatedLogs = logs.slice(startIndex, endIndex);

  const avgSavingPercent =
    metrics.originalTokensSum > 0
      ? ((metrics.originalTokensSum - metrics.compressedTokensSum) / metrics.originalTokensSum) * 100
      : 0;

  const cacheHitRate =
    metrics.totalRequests > 0
      ? ((metrics.cacheHits / metrics.totalRequests) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="animate-in">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        
        {/* ── Left Column (Metrics, Chart, Activity Log) ──────────────── */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

          {/* Compression bar chart */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col">
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

          {/* Request Log Table */}
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-4 text-slate-300 flex items-center justify-between">
              <span>Proxy Activity Log</span>
              <span className="text-xxs font-mono text-slate-500 font-normal">
                Live — showing {logs.length > 0 ? startIndex + 1 : 0}-{endIndex} of {logs.length}
              </span>
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
                    paginatedLogs.map((log) => (
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

            {/* Pagination Controls */}
            {logs.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-white/5 text-xxs font-mono text-slate-400">
                <div>
                  Showing <span className="text-slate-200">{logs.length > 0 ? startIndex + 1 : 0}</span> to{" "}
                  <span className="text-slate-200">{endIndex}</span> of{" "}
                  <span className="text-slate-200">{logs.length}</span> entries
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={activePage === 1}
                    className="p-1.5 rounded-lg border border-white/5 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="First Page"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(activePage - 1)}
                    disabled={activePage === 1}
                    className="p-1.5 rounded-lg border border-white/5 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {Array.from({ length: totalPages }).map((_, i) => {
                    const pageNum = i + 1;
                    const isFirstOrLast = pageNum === 1 || pageNum === totalPages;
                    const isNearActive = Math.abs(pageNum - activePage) <= 1;

                    if (!isFirstOrLast && !isNearActive) {
                      if (pageNum === 2 && activePage > 3) {
                        return <span key="ellipsis-start" className="px-1 text-slate-600 select-none">...</span>;
                      }
                      if (pageNum === totalPages - 1 && activePage < totalPages - 2) {
                        return <span key="ellipsis-end" className="px-1 text-slate-600 select-none">...</span>;
                      }
                      return null;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`min-w-[24px] h-6 rounded-md border flex items-center justify-center font-bold transition-all cursor-pointer ${
                          activePage === pageNum
                            ? "border-neon-purple/30 bg-neon-purple/10 text-neon-purple shadow-[0_0_8px_rgba(168,85,247,0.15)]"
                            : "border-white/5 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-white/5"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setCurrentPage(activePage + 1)}
                    disabled={activePage === totalPages}
                    className="p-1.5 rounded-lg border border-white/5 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={activePage === totalPages}
                    className="p-1.5 rounded-lg border border-white/5 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Last Page"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Show</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-slate-950 border border-white/10 text-slate-300 rounded-lg px-2 py-0.5 focus:outline-none focus:border-neon-purple/40 font-bold transition-all cursor-pointer text-xxs"
                  >
                    {[5, 10, 15, 25, 50].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                  <span className="text-slate-500">entries</span>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ── Right Column (Sticky Status & Badge Panels) ─────────────── */}
        <div className="xl:col-span-1 space-y-6 lg:sticky lg:top-6">
          
          {/* Pipeline status card */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col">
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
              <PipelineRow
                icon={<Brain className="w-4 h-4 text-violet-400" />}
                name="LLMLingua"
                sub="AI prompt compressor"
                active={settings.llmlingua?.enabled ?? false}
                dotColor="#a78bfa"
              />
              <PipelineRow
                icon={<HardDrive className="w-4 h-4 text-neon-cyan" />}
                name="Request Cache"
                sub="Zero-token identical replay"
                active={settings.cache.enabled}
                dotColor="#06b6d4"
              />
              <PipelineRow
                icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
                name="Verification Loop"
                sub="Compiler & test self-correction"
                active={settings.verification.enabled}
                dotColor="#34d399"
              />
            </div>

            {/* Visual routing flow */}
            <div className="mt-4 pt-4 border-t border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-3 font-mono">Active Routing Path</span>
              
              <div className="bg-slate-950/60 border border-white/5 p-3 rounded-xl flex items-center justify-between font-mono text-[9px] relative overflow-hidden mb-3">
                <div className="flex flex-col items-center">
                  <span className="text-slate-500 text-[8px] uppercase tracking-wider">Client</span>
                  <span className="text-slate-300 font-bold mt-0.5">Agent</span>
                </div>
                
                <div className="flex-1 flex items-center justify-center px-1 relative">
                  <div className="h-[1px] bg-white/10 w-full absolute top-1/2 -translate-y-1/2 left-0 right-0"></div>
                  {/* Glowing animating pulse line */}
                  <div className="h-[1px] bg-gradient-to-r from-neon-purple to-neon-cyan w-1/2 absolute top-1/2 -translate-y-1/2 left-1/4 animate-pulse"></div>
                  <span className="bg-slate-900 border border-white/10 text-slate-300 px-2 py-0.5 rounded text-[9px] font-bold z-10 shadow-[0_0_10px_rgba(168,85,247,0.1)]">
                    Proxy
                  </span>
                </div>
                
                <div className="flex flex-col items-center">
                  <span className="text-slate-500 text-[8px] uppercase tracking-wider">Upstream</span>
                  <span
                    className="font-black mt-0.5"
                    style={{
                      color: settings.upstream.preferCustom
                        ? "#10b981"
                        : settings.upstream.preferBifrost
                        ? "#06b6d4"
                        : "#a855f7",
                    }}
                  >
                    {settings.upstream.preferCustom
                      ? "Custom"
                      : settings.upstream.preferBifrost
                      ? "Bifrost"
                      : "Direct"}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                {settings.upstream.preferCustom && (
                  <div className="flex justify-between text-xxs font-mono text-slate-500">
                    <span>Endpoint:</span>
                    <span className="truncate max-w-[170px] text-slate-400 font-bold">{settings.upstream.customUrl || "—"}</span>
                  </div>
                )}
                {!settings.upstream.preferCustom && settings.upstream.preferBifrost && (
                  <div className="flex justify-between text-xxs font-mono text-slate-500">
                    <span>Endpoint:</span>
                    <span className="truncate max-w-[170px] text-slate-400 font-bold">{settings.upstream.bifrostUrl}</span>
                  </div>
                )}
                <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
                  <div className="flex justify-between text-xxs font-mono">
                    <span className="text-slate-400 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      OpenAI Port:
                    </span>
                    <span className="text-neon-cyan font-bold">:{backendPort}/v1</span>
                  </div>
                  <div className="flex justify-between text-xxs font-mono">
                    <span className="text-slate-400 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                      Anthropic Port:
                    </span>
                    <span className="text-orange-300 font-bold">:{backendPort}/anthropic/v1</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Caveman Stats & Badge card */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col relative overflow-hidden border border-neon-pink/10">
            <div className="absolute -right-6 -top-6 w-16 h-16 rounded-full bg-neon-pink/8 blur-2xl pointer-events-none" />
            
            <h3 className="text-xs font-bold uppercase tracking-wider mb-4 text-slate-300 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-neon-pink" />
              Caveman Stats & Badge
            </h3>
            
            <div className="space-y-4 flex-1">
              {/* Visual badge mockup */}
              <div className="bg-slate-950 border border-white/5 p-4 rounded-xl flex flex-col items-center justify-center gap-1.5 font-mono">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Claude Code Status Badge</span>
                <div className="bg-slate-900 border border-neon-pink/35 px-4 py-1.5 rounded-lg text-xs flex items-center gap-2 text-neon-pink shadow-[0_0_15px_rgba(236,72,153,0.15)] font-bold">
                  <span>[CAVEMAN]</span>
                  <span>⛏</span>
                  <span className="text-white">{metrics.totalSavedTokens >= 1000 ? `${(metrics.totalSavedTokens / 1000).toFixed(1)}k` : metrics.totalSavedTokens}</span>
                </div>
              </div>

              {/* Token savings stats */}
              <div className="grid grid-cols-2 gap-2 text-xxs font-mono">
                <div className="bg-slate-900/40 p-2.5 rounded-lg border border-white/5">
                  <span className="text-slate-500 block">Saved Tokens:</span>
                  <span className="text-xs font-bold text-slate-300">{metrics.totalSavedTokens.toLocaleString()}</span>
                </div>
                <div className="bg-slate-900/40 p-2.5 rounded-lg border border-white/5">
                  <span className="text-slate-500 block">USD Saved:</span>
                  <span className="text-xs font-bold text-neon-green">${metrics.totalSavedCost.toFixed(3)}</span>
                </div>
              </div>

              {/* Share action */}
              <div className="pt-2 border-t border-white/5">
                <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">Share your savings</label>
                <button
                  onClick={() => {
                    const shareText = `⚡ RamuToken saved me ${metrics.totalSavedTokens.toLocaleString()} tokens ($${metrics.totalSavedCost.toFixed(3)})! Speed up your AI coding agents with RamuToken. #AI #Coding`;
                    navigator.clipboard.writeText(shareText);
                    setTweetCopied(true);
                    setTimeout(() => setTweetCopied(false), 2000);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-300"
                >
                  {tweetCopied ? <Check className="w-3.5 h-3.5 text-neon-green" /> : <Copy className="w-3.5 h-3.5" />}
                  {tweetCopied ? "Copied tweet draft!" : "Copy Shareable Tweet"}
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ── Log Detail Modal ──────────────────────────────────────── */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-start justify-center p-4 z-50 animate-in overflow-y-auto"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="glass-panel w-full max-w-5xl rounded-3xl flex flex-col shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header — pinned, never scrolls */}
            <div className="p-5 border-b border-white/5 flex justify-between items-start sticky top-0 z-10 rounded-t-3xl" style={{ background: "rgba(10,12,20,0.96)", backdropFilter: "blur(12px)" }}>
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
                  <span>CCR Mappings: <span className="text-slate-300">{selectedLog.ccrMappingsCount}</span></span>
                  {selectedLog.cached && (
                    <span className="bg-neon-cyan/10 border border-neon-cyan/25 text-neon-cyan px-1.5 py-0.5 rounded font-bold">CACHED</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors shrink-0 ml-4"
              >
                ✕ Close
              </button>
            </div>

            {/* Prompt diff — no nested scroll; outer overlay scrolls */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Original Prompt */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xxs font-bold uppercase tracking-wider text-slate-400 font-mono">Original Prompt</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xxs font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded">
                      {selectedLog.originalTokens.toLocaleString()} tok
                    </span>
                    <CopyButton text={selectedLog.originalPrompt || ""} />
                  </div>
                </div>
                <pre className="bg-slate-950/90 border border-white/5 p-4 rounded-2xl text-xxs font-mono text-slate-300 whitespace-pre-wrap break-words">
                  {selectedLog.originalPrompt || "[No original prompt recorded]"}
                </pre>
              </div>

              {/* Compressed Prompt */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xxs font-bold uppercase tracking-wider text-neon-cyan font-mono">Compressed Prompt</h4>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xxs font-mono font-bold px-2 py-0.5 rounded"
                      style={{ color: savingsColor(selectedLog.savingsPercent), background: savingsBg(selectedLog.savingsPercent) }}
                    >
                      {selectedLog.compressedTokens.toLocaleString()} tok
                    </span>
                    <CopyButton text={selectedLog.compressedPrompt || ""} />
                  </div>
                </div>
                <pre
                  className="bg-slate-950/90 border p-4 rounded-2xl text-xxs font-mono text-slate-300 whitespace-pre-wrap break-words"
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
