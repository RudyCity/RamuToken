import { Play, RefreshCw, Copy, Terminal, CheckCheck, Sliders, ToggleLeft, ToggleRight, Search, ShieldCheck, AlertCircle, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { countTokens } from "../utils/token";
import { CompressorSettings } from "../types";

interface PlaygroundTabProps {
  globalSettings: CompressorSettings;
  testText: string;
  setTestText: (text: string) => void;
  testQuery: string;
  setTestQuery: (query: string) => void;
}

function savingsHsl(pct: number) {
  const h = Math.round(pct * 1.2);
  return `hsl(${h}, 80%, 55%)`;
}

export default function PlaygroundTab({
  globalSettings,
  testText,
  setTestText,
  testQuery,
  setTestQuery
}: PlaygroundTabProps) {
  const [playgroundSettings, setPlaygroundSettings] = useState<CompressorSettings>(() =>
    JSON.parse(JSON.stringify(globalSettings))
  );
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showConfig, setShowConfig] = useState(true);

  const [subTab, setSubTab] = useState<"compress" | "search" | "verify">("compress");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchProjectRoot, setSearchProjectRoot] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  
  // Verify state
  const [verifyFilePath, setVerifyFilePath] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyProjectRoot, setVerifyProjectRoot] = useState("");
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  const runSemanticSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch("/api/semantic-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          projectRoot: searchProjectRoot || undefined
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.symbols || []);
      }
    } catch (err) {
      console.error("Semantic search failed", err);
    } finally {
      setSearching(false);
    }
  };

  const runCodeVerification = async () => {
    if (!verifyFilePath.trim() || !verifyCode.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: verifyFilePath,
          code: verifyCode,
          projectRoot: verifyProjectRoot || undefined
        }),
      });
      if (res.ok) {
        setVerifyResult(await res.json());
      } else {
        const errData = await res.json();
        setVerifyResult({ error: errData.error || "Verification request failed" });
      }
    } catch (err) {
      console.error("Code verification failed", err);
      setVerifyResult({ error: err.message });
    } finally {
      setVerifying(false);
    }
  };

  // Sync with global settings only once when mounted or if global changes initially
  useEffect(() => {
    setPlaygroundSettings(JSON.parse(JSON.stringify(globalSettings)));
  }, [globalSettings]);

  const handleCopy = () => {
    if (!testResult) return;
    navigator.clipboard.writeText(testResult.compressedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runTestCompression = async () => {
    if (!testText.trim()) return;
    setTesting(true);
    try {
      const res = await fetch("/api/compress-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: testText,
          query: testQuery,
          settings: playgroundSettings
        }),
      });
      if (res.ok) {
        setTestResult(await res.json());
      }
    } catch (err) {
      console.error("Test compression failed", err);
    } finally {
      setTesting(false);
    }
  };

  const toggleLocalField = (
    pipeline: "rtk" | "serena" | "headroom" | "caveman",
    field: string
  ) => {
    const updated = { ...playgroundSettings };
    if (pipeline === "rtk") {
      (updated.rtk as any)[field] = !(updated.rtk as any)[field];
    } else if (pipeline === "serena") {
      (updated.serena as any)[field] = !(updated.serena as any)[field];
    } else if (pipeline === "headroom") {
      (updated.headroom as any)[field] = !(updated.headroom as any)[field];
    } else if (pipeline === "caveman") {
      (updated.caveman as any)[field] = !(updated.caveman as any)[field];
    }
    setPlaygroundSettings(updated);
  };

  const handleLocalSlider = (pipeline: "serena" | "headroom", field: string, val: number) => {
    const updated = { ...playgroundSettings };
    if (pipeline === "serena") (updated.serena as any)[field] = val;
    else if (pipeline === "headroom") (updated.headroom as any)[field] = val;
    setPlaygroundSettings(updated);
  };

  const handleLocalCavemanLevel = (level: "low" | "medium" | "high") => {
    const updated = { ...playgroundSettings };
    updated.caveman.level = level;
    setPlaygroundSettings(updated);
  };

  const inputTokens = countTokens(testText);
  const savingsPct = testResult?.savingsPercent ?? 0;
  const gaugeColor = testResult ? savingsHsl(savingsPct) : "#334155";

  return (
    <div className="space-y-5 animate-in">
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex justify-between items-start gap-4 mb-2">
          <div>
            <h2 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan to-neon-purple mb-1">
              COMPRESSION PLAYGROUND
            </h2>
            <p className="text-xxs text-slate-400 font-mono">
              Interactively test context compression pipelines with customized overrides.
            </p>
          </div>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 transition-all cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            {showConfig ? "Hide Config" : "Show Config"}
          </button>
        </div>

        {/* Dynamic configuration panel */}
        {showConfig && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-white/5 bg-slate-950/40 rounded-2xl mb-5 animate-in">
            {/* RTK configuration */}
            <div className="p-3 border border-white/5 bg-slate-950/50 rounded-xl space-y-2">
              <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                <span className="text-xs font-black tracking-wide text-neon-cyan font-mono">RTK (Logs)</span>
                <button onClick={() => toggleLocalField("rtk", "enabled")} className="cursor-pointer">
                  {playgroundSettings.rtk.enabled ? (
                    <ToggleRight className="w-6 h-6 text-neon-cyan" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-600" />
                  )}
                </button>
              </div>
              {playgroundSettings.rtk.enabled && (
                <div className="space-y-1.5 pt-1 text-xxs font-mono text-slate-400">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={playgroundSettings.rtk.logs}
                      onChange={() => toggleLocalField("rtk", "logs")}
                    />
                    Collapse Repeated Logs
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={playgroundSettings.rtk.paths}
                      onChange={() => toggleLocalField("rtk", "paths")}
                    />
                    Shorten System Paths
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={playgroundSettings.rtk.stacks}
                      onChange={() => toggleLocalField("rtk", "stacks")}
                    />
                    Prune Stack Traces
                  </label>
                </div>
              )}
            </div>

             {/* Serena configuration */}
            <div className="p-3 border border-white/5 bg-slate-950/50 rounded-xl space-y-2">
              <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                <span className="text-xs font-black tracking-wide text-neon-purple font-mono">Serena (LSP)</span>
                <button onClick={() => toggleLocalField("serena", "enabled")} className="cursor-pointer">
                  {playgroundSettings.serena.enabled ? (
                    <ToggleRight className="w-6 h-6 text-neon-purple" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-600" />
                  )}
                </button>
              </div>
              {playgroundSettings.serena.enabled && (
                <div className="space-y-2 pt-1 font-mono">
                  <div className="flex justify-between text-xxs text-slate-400">
                    <span>Min Lines:</span>
                    <span className="font-bold text-neon-purple">{playgroundSettings.serena.minLines} lines</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="30"
                    value={playgroundSettings.serena.minLines}
                    onChange={(e) => handleLocalSlider("serena", "minLines", parseInt(e.target.value))}
                    className="w-full accent-neon-purple mb-1.5"
                  />
                  <label className="flex items-center gap-2 cursor-pointer text-xxs text-slate-400">
                    <input
                      type="checkbox"
                      checked={playgroundSettings.serena.referenceGraphPruning}
                      onChange={() => {
                        const updated = { ...playgroundSettings };
                        updated.serena.referenceGraphPruning = !updated.serena.referenceGraphPruning;
                        setPlaygroundSettings(updated);
                      }}
                    />
                    Ref Graph Pruning
                  </label>
                </div>
              )}
            </div>

            {/* Headroom configuration */}
            <div className="p-3 border border-white/5 bg-slate-950/50 rounded-xl space-y-2">
              <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                <span className="text-xs font-black tracking-wide text-neon-green font-mono">Headroom (AI)</span>
                <button onClick={() => toggleLocalField("headroom", "enabled")} className="cursor-pointer">
                  {playgroundSettings.headroom.enabled ? (
                    <ToggleRight className="w-6 h-6 text-neon-green" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-600" />
                  )}
                </button>
              </div>
              {playgroundSettings.headroom.enabled && (
                <div className="space-y-1.5 pt-1 text-xxs font-mono text-slate-400">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={playgroundSettings.headroom.minify}
                      onChange={() => toggleLocalField("headroom", "minify")}
                    />
                    Minify JSON Blocks
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={playgroundSettings.headroom.prune}
                      onChange={() => toggleLocalField("headroom", "prune")}
                    />
                    Prune Nulls & Empty Fields
                  </label>
                </div>
              )}
            </div>

            {/* Caveman configuration */}
            <div className="p-3 border border-white/5 bg-slate-950/50 rounded-xl space-y-2">
              <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                <span className="text-xs font-black tracking-wide text-neon-pink font-mono">Caveman (Prose)</span>
                <button onClick={() => toggleLocalField("caveman", "enabled")} className="cursor-pointer">
                  {playgroundSettings.caveman.enabled ? (
                    <ToggleRight className="w-6 h-6 text-neon-pink" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-600" />
                  )}
                </button>
              </div>
              {playgroundSettings.caveman.enabled && (
                <div className="space-y-2 pt-1 font-mono">
                  <span className="text-xxs text-slate-400 block">Compression level:</span>
                  <div className="flex bg-slate-950 p-0.5 rounded-lg border border-white/5">
                    {(["low", "medium", "high"] as const).map((l) => (
                      <button
                        key={l}
                        onClick={() => handleLocalCavemanLevel(l)}
                        className={`flex-1 text-center py-1 rounded text-xxs font-bold uppercase transition-all cursor-pointer ${
                          playgroundSettings.caveman.level === l
                            ? "bg-neon-pink text-slate-950 font-black shadow-[0_0_8px_rgba(244,63,94,0.3)]"
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Verification loop configuration */}
            <div className="p-3 border border-white/5 bg-slate-950/50 rounded-xl space-y-2">
              <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                <span className="text-xs font-black tracking-wide text-neon-green font-mono">Verification</span>
                <button
                  onClick={() => {
                    const updated = { ...playgroundSettings };
                    updated.verification.enabled = !updated.verification.enabled;
                    setPlaygroundSettings(updated);
                  }}
                  className="cursor-pointer"
                >
                  {playgroundSettings.verification?.enabled ? (
                    <ToggleRight className="w-6 h-6 text-neon-green" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-600" />
                  )}
                </button>
              </div>
              {playgroundSettings.verification?.enabled && (
                <div className="space-y-1 text-xxs font-mono text-slate-400 pt-1">
                  <div>Cmd: {playgroundSettings.verification.testCommand}</div>
                  <div>Retries: {playgroundSettings.verification.maxRetries}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sub-tab navigation */}
        <div className="flex border-b border-white/5 mb-5">
          <button
            onClick={() => setSubTab("compress")}
            className={`px-4 py-2 text-xs font-mono font-bold border-b-2 cursor-pointer transition-all ${
              subTab === "compress" ? "border-neon-cyan text-neon-cyan" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            COMPRESSION TEST
          </button>
          <button
            onClick={() => setSubTab("search")}
            className={`px-4 py-2 text-xs font-mono font-bold border-b-2 cursor-pointer transition-all ${
              subTab === "search" ? "border-neon-purple text-neon-purple" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            SEMANTIC SEARCH
          </button>
          <button
            onClick={() => setSubTab("verify")}
            className={`px-4 py-2 text-xs font-mono font-bold border-b-2 cursor-pointer transition-all ${
              subTab === "verify" ? "border-neon-green text-neon-green" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            VERIFICATION LOOP
          </button>
        </div>

        {subTab === "compress" && (
          <>
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
          </>
        )}

        {subTab === "search" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                  Search Query (e.g. "calculate")
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter symbol substring..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-neon-purple transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                  Project Root Dir (Optional Override)
                </label>
                <input
                  type="text"
                  value={searchProjectRoot}
                  onChange={(e) => setSearchProjectRoot(e.target.value)}
                  placeholder="Leave empty for default"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-neon-purple transition-colors"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={runSemanticSearch}
                  disabled={searching || !searchQuery.trim()}
                  className="flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-xs font-black tracking-wider cursor-pointer bg-neon-purple text-white shadow-[0_0_12px_rgba(168,85,247,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed h-9"
                >
                  {searching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  {searching ? "SEARCHING…" : "SEARCH"}
                </button>
              </div>
            </div>

            <div className="border border-white/5 bg-slate-950/40 rounded-2xl p-4">
              <h3 className="text-xs font-mono font-bold text-slate-400 mb-3 uppercase tracking-wider">Search Results</h3>
              {searching ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-neon-purple" />
                  <span className="text-xs font-mono">Scanning index...</span>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-4 max-h-[30rem] overflow-y-auto pr-1">
                  {searchResults.map((sym, idx) => (
                    <div key={idx} className="border border-white/5 bg-slate-950/90 rounded-xl p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xxs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="bg-neon-purple/20 text-neon-purple px-1.5 py-0.5 rounded font-black uppercase text-[10px]">
                            {sym.kind}
                          </span>
                          <span className="text-slate-200 font-bold text-xs">{sym.name}</span>
                        </div>
                        <span className="text-slate-500">{sym.relative_path}:{sym.start_line + 1}-{sym.end_line + 1}</span>
                      </div>
                      {sym.snippet && (
                        <pre className="p-3 bg-black/60 rounded-xl text-slate-300 font-mono text-[11px] overflow-x-auto border border-white/5 leading-relaxed">
                          {sym.snippet}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-600 font-mono text-xs">
                  No matching symbols found. Enter a query and run search.
                </div>
              )}
            </div>
          </div>
        )}

        {subTab === "verify" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                  File Path to Write (Relative to project root, e.g. "src/temp.ts")
                </label>
                <input
                  type="text"
                  value={verifyFilePath}
                  onChange={(e) => setVerifyFilePath(e.target.value)}
                  placeholder="src/utils/math.ts"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-neon-green transition-colors"
                />
              </div>
              <div>
                <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
                  Project Root Dir (Optional)
                </label>
                <input
                  type="text"
                  value={verifyProjectRoot}
                  onChange={(e) => setVerifyProjectRoot(e.target.value)}
                  placeholder="Leave empty for default"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-neon-green transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="flex flex-col">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                  Code Content
                </label>
                <textarea
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  rows={14}
                  placeholder="Paste TS/JS or Python code block to write & verify here..."
                  className="w-full bg-slate-950/90 border border-white/8 rounded-2xl p-4 text-xs font-mono text-slate-300 focus:outline-none focus:border-neon-green/50 transition-all resize-y leading-relaxed"
                  style={{ minHeight: "18rem" }}
                />
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={runCodeVerification}
                    disabled={verifying || !verifyFilePath.trim() || !verifyCode.trim()}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black tracking-wider cursor-pointer bg-neon-green text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {verifying ? "VERIFYING…" : "WRITE & VERIFY"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-xxs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                  Verification Report
                </label>
                <div className="border border-white/5 bg-slate-950/40 rounded-2xl p-4 flex-1 space-y-4 min-h-[20rem]">
                  {verifying ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 py-16">
                      <RefreshCw className="w-6 h-6 animate-spin text-neon-green" />
                      <span className="text-xs font-mono">Running compiler & tests...</span>
                    </div>
                  ) : verifyResult ? (
                    <div className="space-y-4">
                      {verifyResult.error ? (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl flex items-start gap-2.5 text-xs font-mono">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block mb-0.5">Execution Failed</span>
                            {verifyResult.error}
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Success badge */}
                          {verifyResult.success ? (
                            <div className="bg-neon-green/10 border border-neon-green/20 text-neon-green p-3 rounded-xl flex items-center gap-2.5 text-xs font-mono">
                              <CheckCircle className="w-4 h-4 shrink-0" />
                              <span className="font-bold">Code Verification Succeeded! 0 errors & tests passed.</span>
                            </div>
                          ) : (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl flex items-center gap-2.5 text-xs font-mono">
                              <AlertCircle className="w-4 h-4 shrink-0" />
                              <span className="font-bold">Verification Failed. Check diagnostics or test results.</span>
                            </div>
                          )}

                          {/* Diagnostics */}
                          <div>
                            <h4 className="text-xxs font-mono font-bold text-slate-400 mb-1.5 uppercase">LSP Diagnostics</h4>
                            {verifyResult.diagnostics && verifyResult.diagnostics.length > 0 ? (
                              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {verifyResult.diagnostics.map((diag: any, dIdx: number) => (
                                  <div key={dIdx} className="bg-black/40 border border-white/5 rounded-lg p-2 text-xxs font-mono space-y-0.5">
                                    <div className="flex justify-between text-slate-500">
                                      <span>Severity: {diag.severity === 1 ? "Error" : diag.severity === 2 ? "Warning" : "Info"}</span>
                                      <span>Line: {diag.range.start.line + 1}:{diag.range.start.character}</span>
                                    </div>
                                    <div className="text-slate-300">{diag.message}</div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xxs font-mono text-slate-500 italic">No compiler diagnostics reported.</div>
                            )}
                          </div>

                          {/* Test output */}
                          {verifyResult.testOutput && (
                            <div>
                              <h4 className="text-xxs font-mono font-bold text-slate-400 mb-1.5 uppercase">Test Suite Output</h4>
                              <pre className="p-3 bg-black/60 rounded-xl text-slate-300 font-mono text-[10px] overflow-auto border border-white/5 leading-relaxed max-h-40">
                                {verifyResult.testOutput}
                              </pre>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-2 py-16">
                      <Terminal className="w-8 h-8" />
                      <span className="text-xs font-mono">Report will appear after verification</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
