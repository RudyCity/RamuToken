import { Play, RefreshCw, Copy, Terminal } from "lucide-react";
import { countTokens } from "../utils/token";

interface TestBenchTabProps {
  testText: string;
  setTestText: (text: string) => void;
  testQuery: string;
  setTestQuery: (query: string) => void;
  testResult: any;
  testing: boolean;
  runTestCompression: () => void;
}

export default function TestBenchTab({
  testText,
  setTestText,
  testQuery,
  setTestQuery,
  testResult,
  testing,
  runTestCompression
}: TestBenchTabProps) {
  return (
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
  );
}
