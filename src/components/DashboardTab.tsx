import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
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
  TrendingDown,
  Copy,
  Check,
  Brain,
  Trash2,
  Image,
  X,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
} from "lucide-react";
import { Metrics, RequestLog, CompressorSettings, LLMLinguaLog, PipelineStep } from "../types";
import ImageGallery from "./ImageGallery";

interface DashboardTabProps {
  metrics: Metrics;
  logs: RequestLog[];
  llmLinguaLogs: LLMLinguaLog[];
  settings: CompressorSettings;
  selectedLog: RequestLog | LLMLinguaLog | null;
  setSelectedLog: (log: RequestLog | LLMLinguaLog | null) => void;
  backendPort: number;
  onClearHistory: () => void;
  onRefresh?: () => void;
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

function formatRelativeTime(timestamp: number, now: number): string {
  const diffSec = Math.floor((now - timestamp) / 1000);
  if (diffSec < 5) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

// ── ImageGallery component is imported from ./ImageGallery ─────────────────────

// ── Main component ────────────────────────────────────────────────────────────
export default function DashboardTab({
  metrics,
  logs,
  llmLinguaLogs,
  settings: _settings,
  selectedLog,
  setSelectedLog,
  backendPort: _backendPort,
  onClearHistory,
  onRefresh,
}: DashboardTabProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // fixed page size — no setter needed
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 600);
    }
  };

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const [activeLogTab, setActiveLogTab] = useState<"all" | "rtk" | "serena" | "llmlingua" | "headroom" | "caveman" | "llmlingua_direct">("all");

  const displayLogs = useMemo(() => {
    if (activeLogTab === "all") return logs;
    if (activeLogTab === "llmlingua_direct") return llmLinguaLogs;
    const stepNameMap: Record<string, string> = {
      rtk: "RTK",
      serena: "Serena",
      llmlingua: "LLMLingua",
      headroom: "Headroom",
      caveman: "Caveman",
    };
    const targetStepName = stepNameMap[activeLogTab];
    if (!targetStepName) return [];
    return logs.filter((log) => {
      const steps = log.pipelineSteps || [];
      const foundStep = steps.find((s) => s.name === targetStepName);
      return foundStep?.enabled === true;
    });
  }, [logs, llmLinguaLogs, activeLogTab]);

  const [selectedStep, setSelectedStep] = useState<string>("all");

  useEffect(() => {
    setSelectedStep("all");
  }, [selectedLog]);

  const prevFirstLogIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentFirstLogId = displayLogs[0]?.id || null;
    const isStillPresent = selectedLog ? displayLogs.some(l => l.id === selectedLog.id) : false;

    if (!selectedLog && displayLogs.length > 0) {
      setSelectedLog(displayLogs[0]);
    } else if (isStillPresent && prevFirstLogIdRef.current && selectedLog && selectedLog.id === prevFirstLogIdRef.current && currentFirstLogId !== prevFirstLogIdRef.current) {
      setSelectedLog(displayLogs[0]);
    } else if (!isStillPresent) {
      setSelectedLog(displayLogs[0] || null);
    }

    prevFirstLogIdRef.current = currentFirstLogId;
  }, [activeLogTab, displayLogs, selectedLog, setSelectedLog]);

  // Get active step details for request modal
  const steps = (selectedLog && "pipelineSteps" in selectedLog ? selectedLog.pipelineSteps : []) || [];
  const activeStepObj = selectedStep !== "all" ? steps.find(s => s.name === selectedStep) : null;

  const originalTextToShow = activeStepObj ? activeStepObj.inputText : (selectedLog?.originalPrompt || "");
  const compressedTextToShow = activeStepObj ? activeStepObj.outputText : (selectedLog?.compressedPrompt || "");
  const originalTokensToShow = activeStepObj ? activeStepObj.inputTokens : (selectedLog?.originalTokens || 0);
  const compressedTokensToShow = activeStepObj ? activeStepObj.outputTokens : (selectedLog?.compressedTokens || 0);
  
  const stepSavings = activeStepObj 
    ? (activeStepObj.inputTokens > 0 ? ((activeStepObj.inputTokens - activeStepObj.outputTokens) / activeStepObj.inputTokens) * 100 : 0)
    : (selectedLog?.savingsPercent || 0);

  const leftLabel = activeStepObj ? `Before ${activeStepObj.name}` : "Original Prompt";
  const rightLabel = activeStepObj ? `After ${activeStepObj.name}` : "Compressed Prompt";

  const totalPages = Math.ceil(displayLogs.length / itemsPerPage);
  const activePage = Math.min(currentPage, Math.max(1, totalPages));

  const startIndex = (activePage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, displayLogs.length);
  const paginatedLogs = displayLogs.slice(startIndex, endIndex);

  const avgSavingPercent =
    metrics.originalTokensSum > 0
      ? ((metrics.originalTokensSum - metrics.compressedTokensSum) / metrics.originalTokensSum) * 100
      : 0;

  const cacheHitRate =
    metrics.totalRequests > 0
      ? ((metrics.cacheHits / metrics.totalRequests) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="animate-in space-y-6">
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


      {/* Unified Pipeline Activity Explorer (Split-Panel Layout - Full Width) */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
        
        {/* Tabs Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-neon-purple" />
              Pipeline Activity Explorer
            </h3>
            <p className="text-[10px] text-slate-500 font-mono mt-1">
              Explore prompt compression step transitions live side-by-side
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center bg-slate-950/70 border border-white/5 p-1 rounded-xl gap-0.5 text-[10px] font-bold">
              {[
                { id: "all", label: "📋 Proxy Requests" },
                { id: "llmlingua_direct", label: "🔌 LLMLingua Direct" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveLogTab(tab.id as any);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeLogTab === tab.id
                      ? "bg-neon-purple/20 text-neon-purple border border-neon-purple/35 shadow-[0_0_8px_rgba(168,85,247,0.15)]"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {onRefresh && (
              <button
                onClick={handleRefresh}
                title="Refresh activity logs and metrics"
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-400 hover:text-neon-purple hover:bg-neon-purple/10 border border-white/5 hover:border-neon-purple/20 transition-all cursor-pointer text-[10px] font-bold bg-slate-950/40 disabled:opacity-55 disabled:cursor-not-allowed"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-neon-purple" : ""}`} />
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            )}

            <button
              onClick={onClearHistory}
              title="Clear all activity history and metrics"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 transition-all cursor-pointer text-[10px] font-bold bg-slate-950/40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear History
            </button>
          </div>
        </div>

        {/* Split Panel Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[550px]">
          
          {/* Left Column: Logs List (lg:col-span-4) */}
          <div className="lg:col-span-4 flex flex-col justify-between border-r border-white/5 pr-0 lg:pr-6">
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {displayLogs.length === 0 ? (
                <div className="py-12 text-center text-xs font-mono text-slate-600">
                  No activity recorded yet.
                </div>
              ) : (
                paginatedLogs.map((log) => {
                  const isSelected = selectedLog?.id === log.id;
                  const hasSteps = "pipelineSteps" in log;
                  const ccrCount = hasSteps ? (log as RequestLog).ccrMappingsCount : 0;
                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`group p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "bg-neon-purple/10 border-neon-purple/30 shadow-[0_0_12px_rgba(168,85,247,0.08)]"
                          : "bg-slate-950/40 border-white/5 hover:bg-white/[0.02] hover:border-white/10"
                      }`}
                    >
                      <div className="flex flex-col gap-1 min-w-0 flex-1 mr-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${log.status === "success" ? "bg-neon-green" : "bg-neon-pink"}`} />
                          <span className="text-xxs font-mono font-bold text-slate-300">
                            {hasSteps ? `REQ #${log.id}` : `DIRECT #${log.id}`}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500" title={new Date(log.timestamp).toLocaleString()}>
                            {formatRelativeTime(log.timestamp, now)}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 truncate" title={log.model}>
                          {log.model}
                        </div>
                        <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500 mt-0.5">
                          {hasSteps ? (
                            <>
                              <span>{log.provider === "openai" ? "OpenAI" : "Anthropic"}</span>
                              <span>•</span>
                              <span>{ccrCount} CCR</span>
                            </>
                          ) : (
                            <span>LLMLingua ({(log as LLMLinguaLog).method.toUpperCase()})</span>
                          )}
                          <span>•</span>
                          <span>{log.durationMs}ms</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {log.status === "error" ? (
                          <span className="text-[10px] font-bold text-neon-pink bg-neon-pink/10 border border-neon-pink/20 px-1.5 py-0.5 rounded font-mono">ERR</span>
                        ) : "cached" in log && log.cached ? (
                          <span className="text-[9px] font-bold text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/20 px-1.5 py-0.5 rounded font-mono">CACHED</span>
                        ) : (
                          <span
                            className="savings-badge text-[10px] font-mono"
                            style={{
                              color: savingsColor(log.savingsPercent),
                              background: savingsBg(log.savingsPercent),
                              border: `1px solid ${savingsColor(log.savingsPercent)}30`,
                            }}
                          >
                            {log.savingsPercent.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Left Side Pagination */}
            {displayLogs.length > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5 text-[10px] font-mono text-slate-400">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, activePage - 1))}
                    disabled={activePage === 1}
                    className="p-1 rounded bg-slate-900/40 border border-white/5 text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span>
                    {activePage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, activePage + 1))}
                    disabled={activePage === totalPages}
                    className="p-1 bg-slate-900/40 border border-white/5 text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div>
                  {displayLogs.length} logs
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Pipeline Inspector (lg:col-span-8) */}
          <div className="lg:col-span-8 flex flex-col">
            {!selectedLog ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-white/8 rounded-2xl min-h-[300px]">
                <Zap className="w-8 h-8 text-slate-700 mb-3 animate-pulse" />
                <p className="text-xs font-bold text-slate-400">No Request Selected</p>
                <p className="text-[10px] font-mono text-slate-500 mt-1 max-w-[240px]">
                  Select an activity log from the list on the left to inspect its pipeline execution
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 flex-1">
                
                {/* Selected Header Info */}
                <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-200 font-mono">
                        {"provider" in selectedLog ? "Request" : "LLMLingua Direct"} #{selectedLog.id}
                      </h4>
                      {selectedLog.status === "success" ? (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-neon-green bg-neon-green/10 border border-neon-green/20 px-1.5 py-0.5 rounded font-mono">
                          <CheckCircle className="w-2.5 h-2.5" /> OK
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-neon-pink bg-neon-pink/10 border border-neon-pink/20 px-1.5 py-0.5 rounded font-mono">
                          <XCircle className="w-2.5 h-2.5" /> ERROR
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-1">
                      {selectedLog.model} • {selectedLog.durationMs}ms latency
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right sm:border-l border-white/5 sm:pl-4">
                    <div>
                      <div className="text-[9px] font-mono text-slate-500">Savings</div>
                      <div className="text-sm font-black font-mono mt-0.5" style={{ color: savingsColor(selectedLog.savingsPercent) }}>
                        {selectedLog.savingsPercent.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-mono text-slate-500">Tokens (Before/After)</div>
                      <div className="text-xxs font-mono font-bold text-slate-300 mt-1">
                        {selectedLog.originalTokens.toLocaleString()} ➔ {selectedLog.compressedTokens.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Error display if failed */}
                {selectedLog.status === "error" && selectedLog.errorMessage && (
                  <div className="bg-neon-pink/5 border border-neon-pink/25 rounded-xl p-3 text-[10px] font-mono text-neon-pink whitespace-pre-wrap break-all">
                    <strong>Error Message:</strong> {selectedLog.errorMessage}
                  </div>
                )}

                {/* Pipeline Steps Horizontal Timeline (Only for Requests) */}
                {"pipelineSteps" in selectedLog && steps.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                      Pipeline Steps Timeline
                    </span>
                    <div className="flex items-center bg-slate-950/70 border border-white/5 p-1 rounded-xl gap-1 text-[9px] font-bold overflow-x-auto">
                      <button
                        onClick={() => setSelectedStep("all")}
                        className={`px-2 py-1.5 rounded-lg whitespace-nowrap cursor-pointer transition-all ${
                          selectedStep === "all"
                            ? "bg-neon-purple/20 text-neon-purple border border-neon-purple/35"
                            : "text-slate-400 hover:text-slate-300"
                        }`}
                      >
                        All Steps
                      </button>
                      {steps.map((step) => {
                        const isStepSelected = selectedStep === step.name;
                        const stepSavings = step.inputTokens > 0 ? ((step.inputTokens - step.outputTokens) / step.inputTokens) * 100 : 0;
                        return (
                          <button
                            key={step.name}
                            disabled={!step.enabled}
                            onClick={() => setSelectedStep(step.name)}
                            className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap cursor-pointer transition-all flex items-center gap-1 ${
                              !step.enabled
                                ? "opacity-30 cursor-not-allowed"
                                : isStepSelected
                                ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/35 shadow-[0_0_8px_rgba(6,182,212,0.15)]"
                                : "text-slate-400 hover:text-slate-300"
                            }`}
                          >
                            {step.name === "RTK" && <Terminal className="w-3 h-3" />}
                            {step.name === "Serena" && <FileCode className="w-3 h-3" />}
                            {step.name === "LLMLingua" && <Brain className="w-3 h-3" />}
                            {step.name === "Headroom" && <Database className="w-3 h-3" />}
                            {step.name === "Caveman" && <Cpu className="w-3 h-3" />}
                            <span>{step.name}</span>
                            {step.enabled && <span className="text-[8px] font-mono text-slate-500">({stepSavings.toFixed(0)}%)</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Side-by-Side Prompt Diffs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                  
                  {/* Before / Left panel */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[9px] font-mono">
                      <span className="font-bold uppercase tracking-wider text-slate-400">
                        {leftLabel}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-bold bg-white/5 px-1.5 py-0.5 rounded text-[8px]">
                          {originalTokensToShow.toLocaleString()} tokens
                        </span>
                        <CopyButton text={originalTextToShow} />
                      </div>
                    </div>
                    <pre className="flex-1 min-h-[160px] md:min-h-[220px] max-h-[300px] overflow-y-auto bg-slate-950 border border-white/5 p-3.5 rounded-xl text-xxs font-mono text-slate-300 whitespace-pre-wrap break-all focus:outline-none">
                      {originalTextToShow || "[No content recorded]"}
                    </pre>
                  </div>

                  {/* After / Right panel */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[9px] font-mono">
                      <span className="font-bold uppercase tracking-wider text-neon-cyan">
                        {rightLabel}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="font-bold px-1.5 py-0.5 rounded text-[8px]"
                          style={{ color: savingsColor(stepSavings), background: savingsBg(stepSavings) }}
                        >
                          {compressedTokensToShow.toLocaleString()} tokens ({stepSavings.toFixed(0)}%)
                        </span>
                        <CopyButton text={compressedTextToShow} />
                      </div>
                    </div>
                    <pre
                      className="flex-1 min-h-[160px] md:min-h-[220px] max-h-[300px] overflow-y-auto bg-slate-950 border p-3.5 rounded-xl text-xxs font-mono text-slate-300 whitespace-pre-wrap break-all focus:outline-none"
                      style={{ borderColor: savingsColor(stepSavings) + "25" }}
                    >
                      {compressedTextToShow || "[No content recorded]"}
                    </pre>
                  </div>
                </div>

                {/* CCR variable mappings list if they exist */}
                {"ccrMappingsCount" in selectedLog && selectedLog.ccrMappingsCount > 0 && (
                  <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3 mt-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono block mb-1.5">
                      CCR Tokens Variable Mappings ({selectedLog.ccrMappingsCount})
                    </span>
                    <div className="text-[9px] font-mono text-slate-500">
                      Inspect mapped code compression variables using the CLI console output or detail debugger logs.
                    </div>
                  </div>
                )}

                {/* Image Gallery — rendered when selected step (or any step, if All is selected) has images */}
                {(() => {
                  const allSteps = ("pipelineSteps" in selectedLog ? selectedLog.pipelineSteps : []) || [];
                  // If a specific step is selected and it has images, show it; otherwise find the first step with images
                  const imageStep: PipelineStep | undefined =
                    activeStepObj && (activeStepObj.images?.length ?? 0) > 0
                      ? activeStepObj
                      : allSteps.find(s => (s.images?.length ?? 0) > 0);
                  if (!imageStep) return null;
                  return (
                    <div className="bg-slate-950/40 border border-violet-500/15 rounded-xl p-4 mt-1">
                      <ImageGallery step={imageStep} />
                    </div>
                  );
                })()}

              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
