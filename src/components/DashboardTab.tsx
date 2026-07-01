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
  TrendingDown 
} from "lucide-react";
import { Metrics, RequestLog, CompressorSettings } from "../types";

interface DashboardTabProps {
  metrics: Metrics;
  logs: RequestLog[];
  settings: CompressorSettings;
  selectedLog: RequestLog | null;
  setSelectedLog: (log: RequestLog | null) => void;
}

export default function DashboardTab({
  metrics,
  logs,
  settings,
  selectedLog,
  setSelectedLog
}: DashboardTabProps) {
  // Calculate cumulative saving percentage
  const avgSavingPercent = metrics.originalTokensSum > 0 
    ? ((metrics.originalTokensSum - metrics.compressedTokensSum) / metrics.originalTokensSum) * 100 
    : 0;

  return (
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
    </div>
  );
}
