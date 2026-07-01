import { Play, RefreshCw, Copy, Terminal, CheckCheck } from "lucide-react";
import { useState } from "react";
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

/** Returns hsl colour string that fades from red (0%) to green (100%) */
function savingsHsl(pct: number) {
  const h = Math.round(pct * 1.2); // 0→0 (red), 100→120 (green)
  return `hsl(${h}, 80%, 55%)`;
}

export default function TestBenchTab({
  testText,
  setTestText,
  testQuery,
  setTestQuery,
  testResult,
  testing,
  runTestCompression,
}: TestBenchTabProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!testResult) return;
    navigator.clipboard.writeText(testResult.compressedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inputTokens = countTokens(testText);
  const savingsPct = testResult?.savingsPercent ?? 0;
  const gaugeColor = testResult ? savingsHsl(savingsPct) : "#334155";

  return (
    <div className="space-y-5 animate-in">
      <div className="glass-panel p-6 rounded-2xl">

        {/* Title */}
        <h2 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-purple mb-1">
          COMPRESSION TEST BENCH
        </h2>
        <p className="text-xxs text-slate-400 font-mono mb-5">
          Paste logs, code files, or JSON schemas below. Specify keywords to protect from Serena pruning, then run compression.
        </p>

        {/* Query input + run button */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex-1">
            <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
              Serena Keywords (space-separated)
            </label>
            <input
              id="input-test-query"
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder="e.g. compile calculateTokens handleRequest …"
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-neon-cyan transition-colors"
            />
          </div>
          <div className="flex items-end">
            <button
              id="btn-run-compression"
              onClick={runTestCompression}
              disabled={testing || !testText.trim()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black tracking-wider cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: testing ? "rgba(6,182,212,0.2)" : "#06b6d4",
                color: testing ? "#06b6d4" : "#0a0f1a",
                boxShadow: testing ? "none" : "0 0 24px rgba(6,182,212,0.3)",
              }}
            >
              {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {testing ? "COMPRESSING…" : "RUN COMPRESSION"}
            </button>
          </div>
        </div>

        {/* Side-by-side panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Input panel */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Input Payload
              </label>
              <span className="text-xxs font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded">
                ~{inputTokens.toLocaleString()} tokens
              </span>
            </div>
            <div className="code-area flex-1">
              <textarea
                id="textarea-test-input"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                rows={18}
                placeholder="Paste logs, code blocks, or JSON schemas here…"
                className="w-full h-full bg-slate-950/90 border border-white/8 rounded-2xl p-4 text-xs font-mono text-slate-300 focus:outline-none focus:border-neon-purple/50 transition-all resize-y whitespace-pre leading-relaxed"
                style={{ minHeight: "22rem" }}
              />
            </div>
          </div>

          {/* Output panel */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <label
                className="text-xxs font-bold uppercase tracking-wider font-mono"
                style={{ color: testResult ? gaugeColor : "#94a3b8" }}
              >
                Compressed Output
              </label>
              {testResult && (
                <span
                  className="text-xxs font-bold font-mono px-2 py-0.5 rounded"
                  style={{ color: gaugeColor, background: gaugeColor + "18", border: `1px solid ${gaugeColor}30` }}
                >
                  −{savingsPct.toFixed(1)}% · {testResult.compressedTokens.toLocaleString()} tok
                </span>
              )}
            </div>
            <div
              className="code-area flex-1 relative bg-slate-950/90 border rounded-2xl overflow-hidden transition-all"
              style={{
                borderColor: testResult ? gaugeColor + "40" : "rgba(255,255,255,0.05)",
                boxShadow: testResult ? `0 0 30px -8px ${gaugeColor}40` : "none",
                minHeight: "22rem",
              }}
            >
              {/* Copy button */}
              {testResult && (
                <button
                  id="btn-copy-output"
                  onClick={handleCopy}
                  title="Copy Output"
                  className="absolute right-3 top-3 z-10 flex items-center gap-1.5 bg-white/8 border border-white/10 hover:bg-white/14 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-xl text-xxs font-bold cursor-pointer transition-all"
                >
                  {copied ? <CheckCheck className="w-3.5 h-3.5 text-neon-green" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              )}

              {/* Content */}
              {testResult ? (
                <pre className="h-full p-4 text-xs font-mono text-slate-300 overflow-auto whitespace-pre leading-relaxed">
                  {testResult.compressedText}
                </pre>
              ) : testing ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-neon-cyan/50" />
                  <p className="text-xs font-mono">Compressing payload…</p>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-2">
                  <Terminal className="w-8 h-8" />
                  <p className="text-xs font-mono">Run compression to see output</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats bar */}
        {testResult && (
          <div className="mt-5 bg-slate-950/60 border border-white/5 rounded-2xl p-4">
            <div className="flex flex-wrap gap-6 items-center justify-between">
              <div className="flex gap-6 flex-wrap text-xs font-mono">
                <div>
                  <span className="text-slate-500">Original: </span>
                  <span className="font-bold text-slate-300">{testResult.originalTokens.toLocaleString()} tokens</span>
                </div>
                <div>
                  <span className="text-slate-500">Compressed: </span>
                  <span className="font-bold" style={{ color: gaugeColor }}>{testResult.compressedTokens.toLocaleString()} tokens</span>
                </div>
                <div>
                  <span className="text-slate-500">Time: </span>
                  <span className="font-bold text-slate-300">{testResult.durationMs}ms</span>
                </div>
              </div>

              {/* Compression gauge arc */}
              <div className="flex items-center gap-3">
                <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
                  <circle cx="26" cy="26" r="21" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                  <circle
                    cx="26" cy="26" r="21" fill="none"
                    stroke={gaugeColor}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${(savingsPct / 100) * 132} 132`}
                    transform="rotate(-90 26 26)"
                    style={{ filter: `drop-shadow(0 0 4px ${gaugeColor})`, transition: "stroke-dasharray 0.8s ease" }}
                  />
                  <text x="26" y="30" textAnchor="middle" fill={gaugeColor} fontSize="10" fontWeight="bold" fontFamily="monospace">
                    {savingsPct.toFixed(0)}%
                  </text>
                </svg>
                <div>
                  <p className="text-xs font-bold" style={{ color: gaugeColor }}>
                    {testResult.originalTokens - testResult.compressedTokens} tokens saved
                  </p>
                  <p className="text-xxs text-slate-500 font-mono">compression ratio</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
