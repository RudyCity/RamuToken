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

  const [subTab, setSubTab] = useState<"compress" | "search" | "verify" | "caveman">("compress");
  
  // Caveman tools state
  const [cavemanTool, setCavemanTool] = useState<"compressor" | "commit" | "review" | "rules">("compressor");
  
  // 4. Rules Generator state
  const [rulesAgent, setRulesAgent] = useState<"cursor" | "cline" | "copilot" | "general">("cursor");
  const [includeProxyRules, setIncludeProxyRules] = useState(true);
  const [rulesWriteResult, setRulesWriteResult] = useState<any>(null);
  const [writingRules, setWritingRules] = useState(false);
  const [rulesCopied, setRulesCopied] = useState(false);
  
  // 1. Reference File Compressor state
  const [compressorInputText, setCompressorInputText] = useState("");
  const [compressorResult, setCompressorResult] = useState<any>(null);
  const [compressorLoading, setCompressorLoading] = useState(false);
  const [compressorCopied, setCompressorCopied] = useState(false);

  // 2. Commit Generator state
  const [commitDiff, setCommitDiff] = useState("");
  const [commitResult, setCommitResult] = useState("");
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitCopied, setCommitCopied] = useState(false);

  // 3. Review Commenter state
  const [reviewInput, setReviewInput] = useState("");
  const [reviewResult, setReviewResult] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewCopied, setReviewCopied] = useState(false);
  
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

  const handleLocalCavemanLevel = (level: "low" | "medium" | "high" | "wenyan") => {
    const updated = { ...playgroundSettings };
    updated.caveman.level = level;
    setPlaygroundSettings(updated);
  };

  const runFileCompression = async () => {
    if (!compressorInputText.trim()) return;
    setCompressorLoading(true);
    setCompressorResult(null);
    try {
      const res = await fetch("/api/caveman/compress-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: compressorInputText,
          level: playgroundSettings.caveman.level || "medium"
        }),
      });
      if (res.ok) {
        setCompressorResult(await res.json());
      }
    } catch (err) {
      console.error("Reference compression failed", err);
    } finally {
      setCompressorLoading(false);
    }
  };

  const runCommitGeneration = async () => {
    if (!commitDiff.trim()) return;
    setCommitLoading(true);
    setCommitResult("");
    try {
      const res = await fetch("/api/caveman/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diff: commitDiff }),
      });
      if (res.ok) {
        const data = await res.json();
        setCommitResult(data.commitMessage || "");
      } else {
        const data = await res.json();
        setCommitResult(`Error: ${data.error || "Failed to generate commit message"}`);
      }
    } catch (err: any) {
      console.error("Commit generation failed", err);
      setCommitResult(`Error: ${err.message}`);
    } finally {
      setCommitLoading(false);
    }
  };

  const runReviewCompression = async () => {
    if (!reviewInput.trim()) return;
    setReviewLoading(true);
    setReviewResult("");
    try {
      const res = await fetch("/api/caveman/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentDraft: reviewInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setReviewResult(data.reviewComment || "");
      } else {
        const data = await res.json();
        setReviewResult(`Error: ${data.error || "Failed to compress review"}`);
      }
    } catch (err: any) {
      console.error("Review compression failed", err);
      setReviewResult(`Error: ${err.message}`);
    } finally {
      setReviewLoading(false);
    }
  };

  const generateRulesContent = () => {
    const level = playgroundSettings.caveman.level || "medium";
    
    // Choose caveman instructions text
    let instructions = "";
    if (level === "low") {
      instructions = `- Remove filler phrases (like "Certainly!", "Of course!", "I'd be happy to", "Sure!", "Absolutely!", "Great!").\n- Reply directly without greeting or intro/outro pleasantries.\n- Maintain full technical accuracy and detail.`;
    } else if (level === "high") {
      instructions = `- Speak in max-compression telegraphic style.\n- Zero articles (the/a/an) and zero pronouns.\n- Omit pleasantries, acknowledgments, and transitional phrases.\n- Use symbols: → (leads to), ∴ (therefore), ∵ (because), & (and).\n- Noun phrases only: "Fix: remove null check" not "You should remove the null check".\n- Code blocks only, zero surrounding prose unless requested.\n- State line number + fix for errors.`;
    } else if (level === "wenyan") {
      instructions = `- Use Classical Chinese style grammar and vocabulary for extreme brevity.\n- Zero pleasantries, noun phrases or single/dual characters only.\n- Keep technical accuracy, code, paths, and URLs unchanged.`;
    } else { // medium
      instructions = `- Speak compressed. No pronouns (I, we, you, they, it) and no articles.\n- No filler ("Certainly", "Of course", "Happy to help", "Sure", "Absolutely").\n- No preamble, intro sentences, or sign-offs.\n- Code blocks: no explanation unless asked.\n- Lists: terse keywords only.\n- Errors: state fix, not cause-analysis prose.`;
    }

    let proxySection = "";
    if (includeProxyRules) {
      proxySection = `\n## RamuToken Context Compression Integration\nAlways write clean, structured code. If you see temporary placeholder tokens (like {{HR_CCR_xxxx}}), do not modify or strip them; they will be decompressed automatically.\nTo maximize token savings:\n- Use minified configurations.\n- Focus code changes strictly on relevant scopes.\n- Return raw code blocks when executing commands or writing files.`;
    }

    const titleMap = {
      cursor: "Cursor AI Rules (.cursorrules)",
      cline: "Cline Agent Instructions (.clinerules)",
      copilot: "GitHub Copilot Instructions (.github/copilot-instructions.md)",
      general: "General Workspace Rules (AGENTS.md)"
    };

    return `# ${titleMap[rulesAgent]}\n\n## Caveman Communication Guidelines (Level: ${level.toUpperCase()})\n${instructions}\n${proxySection}`.trim();
  };

  const writeRulesFile = async () => {
    const fileNameMap = {
      cursor: ".cursorrules",
      cline: ".clinerules",
      copilot: ".github/copilot-instructions.md",
      general: "AGENTS.md"
    };
    const fileName = fileNameMap[rulesAgent];
    const content = generateRulesContent();

    setWritingRules(true);
    setRulesWriteResult(null);
    try {
      const res = await fetch("/api/caveman/write-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          content,
          projectRoot: globalSettings.serena.projectRoot || undefined
        }),
      });
      if (res.ok) {
        setRulesWriteResult(await res.json());
      } else {
        const data = await res.json();
        setRulesWriteResult({ error: data.error || "Failed to write rules file" });
      }
    } catch (err: any) {
      console.error("Rules write failed", err);
      setRulesWriteResult({ error: err.message });
    } finally {
      setWritingRules(false);
    }
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
                  <div className="flex bg-slate-950 p-0.5 rounded-lg border border-white/5 flex-wrap gap-0.5">
                    {(["low", "medium", "high", "wenyan"] as const).map((l) => (
                      <button
                        key={l}
                        onClick={() => handleLocalCavemanLevel(l)}
                        className={`flex-1 text-center py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer min-w-[40px] ${
                          playgroundSettings.caveman.level === l
                            ? "bg-neon-pink text-slate-950 font-black shadow-[0_0_8px_rgba(244,63,94,0.3)]"
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {l === "medium" ? "med" : l === "wenyan" ? "wnyn" : l}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xxs text-slate-400 mt-1">
                    <input
                      type="checkbox"
                      checked={playgroundSettings.caveman.compressMcpDescriptions}
                      onChange={() => {
                        const updated = { ...playgroundSettings };
                        updated.caveman.compressMcpDescriptions = !updated.caveman.compressMcpDescriptions;
                        setPlaygroundSettings(updated);
                      }}
                    />
                    Compress MCP Tools
                  </label>
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
          <button
            onClick={() => setSubTab("caveman")}
            className={`px-4 py-2 text-xs font-mono font-bold border-b-2 cursor-pointer transition-all ${
              subTab === "caveman" ? "border-neon-pink text-neon-pink" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            CAVEMAN TOOLS
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

        {subTab === "caveman" && (
          <div className="space-y-4">
            {/* Inner tool selection tabs */}
            <div className="flex bg-slate-950/70 border border-white/5 p-1 rounded-xl gap-1 max-w-2xl">
              {(["compressor", "commit", "review", "rules"] as const).map((tool) => (
                <button
                  key={tool}
                  onClick={() => setCavemanTool(tool)}
                  className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    cavemanTool === tool
                      ? "bg-neon-pink text-slate-950 font-black shadow-[0_0_12px_rgba(244,63,94,0.25)]"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                >
                  {tool === "compressor" ? "Reference Compressor" : tool === "commit" ? "Commit Generator" : tool === "review" ? "Review Commenter" : "Rules Generator"}
                </button>
              ))}
            </div>

            {/* 1. Reference File Compressor Tool */}
            {cavemanTool === "compressor" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-in">
                <div className="flex flex-col">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                    Reference File Content (e.g. CLAUDE.md / instructions)
                  </label>
                  <textarea
                    value={compressorInputText}
                    onChange={(e) => setCompressorInputText(e.target.value)}
                    rows={12}
                    placeholder="Paste reference file or prose content here..."
                    className="w-full bg-slate-950/95 border border-white/8 rounded-2xl p-4 text-xs font-mono text-slate-300 focus:outline-none focus:border-neon-pink/50 transition-all resize-y leading-relaxed"
                    style={{ minHeight: "15rem" }}
                  />
                  <div className="mt-3 flex justify-between items-center">
                    <span className="text-xxs font-mono text-slate-500">
                      Level: <span className="text-neon-pink font-bold">{playgroundSettings.caveman.level || "medium"}</span>
                    </span>
                    <button
                      onClick={runFileCompression}
                      disabled={compressorLoading || !compressorInputText.trim()}
                      className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black tracking-wider cursor-pointer bg-neon-pink text-slate-950 shadow-[0_0_12px_rgba(244,63,94,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {compressorLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      {compressorLoading ? "COMPRESSING…" : "COMPRESS FILE"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                    Compressed Output
                  </label>
                  <div className="border border-white/5 bg-slate-950/40 rounded-2xl p-4 flex-1 flex flex-col justify-between min-h-[18rem]">
                    {compressorLoading ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2 py-16">
                        <RefreshCw className="w-6 h-6 animate-spin text-neon-pink" />
                        <span className="text-xs font-mono">Running Caveman rules engine...</span>
                      </div>
                    ) : compressorResult ? (
                      <div className="flex-1 flex flex-col justify-between h-full space-y-4">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-slate-900/60 p-2 border border-white/5 rounded-xl text-center">
                            <span className="block text-[10px] font-mono text-slate-500 uppercase">Original</span>
                            <span className="text-sm font-black text-slate-200">{compressorResult.originalTokens} tok</span>
                          </div>
                          <div className="bg-slate-900/60 p-2 border border-white/5 rounded-xl text-center">
                            <span className="block text-[10px] font-mono text-slate-500 uppercase">Compressed</span>
                            <span className="text-sm font-black text-neon-pink">{compressorResult.compressedTokens} tok</span>
                          </div>
                          <div className="bg-slate-900/60 p-2 border border-white/5 rounded-xl text-center">
                            <span className="block text-[10px] font-mono text-slate-500 uppercase">Savings</span>
                            <span className="text-sm font-black text-neon-green">{compressorResult.savingsPercent.toFixed(1)}%</span>
                          </div>
                        </div>
                        <pre className="p-3 bg-black/60 rounded-xl text-slate-300 font-mono text-xs overflow-auto border border-white/5 leading-relaxed max-h-48 flex-1 select-all">
                          {compressorResult.compressedText}
                        </pre>
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(compressorResult.compressedText);
                              setCompressorCopied(true);
                              setTimeout(() => setCompressorCopied(false), 2000);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 transition-all cursor-pointer"
                          >
                            {compressorCopied ? <CheckCheck className="w-3.5 h-3.5 text-neon-green" /> : <Copy className="w-3.5 h-3.5" />}
                            {compressorCopied ? "Copied!" : "Copy Compressed"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-700 gap-2 py-16">
                        <Terminal className="w-8 h-8" />
                        <span className="text-xs font-mono">Compressed file content will appear here</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Commit Generator Tool */}
            {cavemanTool === "commit" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-in">
                <div className="flex flex-col">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                    Git Diff Output (git diff)
                  </label>
                  <textarea
                    value={commitDiff}
                    onChange={(e) => setCommitDiff(e.target.value)}
                    rows={12}
                    placeholder="Paste git diff here..."
                    className="w-full bg-slate-950/95 border border-white/8 rounded-2xl p-4 text-xs font-mono text-slate-300 focus:outline-none focus:border-neon-pink/50 transition-all resize-y leading-relaxed"
                    style={{ minHeight: "15rem" }}
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={runCommitGeneration}
                      disabled={commitLoading || !commitDiff.trim()}
                      className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black tracking-wider cursor-pointer bg-neon-pink text-slate-950 shadow-[0_0_12px_rgba(244,63,94,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {commitLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      {commitLoading ? "GENERATING…" : "GENERATE COMMIT"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                    Caveman Commit Message
                  </label>
                  <div className="border border-white/5 bg-slate-950/40 rounded-2xl p-4 flex-1 flex flex-col justify-between min-h-[18rem]">
                    {commitLoading ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2 py-16">
                        <RefreshCw className="w-6 h-6 animate-spin text-neon-pink" />
                        <span className="text-xs font-mono">Contacting Upstream LLM for commit message...</span>
                      </div>
                    ) : commitResult ? (
                      <div className="flex-1 flex flex-col justify-between h-full space-y-4">
                        <div className="bg-black/60 p-5 rounded-2xl border border-white/5 flex-1 flex items-center justify-center font-mono text-sm font-bold text-neon-pink text-center select-all">
                          {commitResult}
                        </div>
                        {!commitResult.startsWith("Error:") && (
                          <div className="flex justify-end mt-2">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(commitResult);
                                setCommitCopied(true);
                                setTimeout(() => setCommitCopied(false), 2000);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 transition-all cursor-pointer"
                            >
                              {commitCopied ? <CheckCheck className="w-3.5 h-3.5 text-neon-green" /> : <Copy className="w-3.5 h-3.5" />}
                              {commitCopied ? "Copied!" : "Copy Commit Message"}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-700 gap-2 py-16">
                        <Terminal className="w-8 h-8" />
                        <span className="text-xs font-mono">Generated commit message will appear here</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Review Commenter Tool */}
            {cavemanTool === "review" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-in">
                <div className="flex flex-col">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                    Review Feedback Draft
                  </label>
                  <textarea
                    value={reviewInput}
                    onChange={(e) => setReviewInput(e.target.value)}
                    rows={12}
                    placeholder="Enter long code review notes or issues here..."
                    className="w-full bg-slate-950/95 border border-white/8 rounded-2xl p-4 text-xs font-mono text-slate-300 focus:outline-none focus:border-neon-pink/50 transition-all resize-y leading-relaxed"
                    style={{ minHeight: "15rem" }}
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={runReviewCompression}
                      disabled={reviewLoading || !reviewInput.trim()}
                      className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black tracking-wider cursor-pointer bg-neon-pink text-slate-950 shadow-[0_0_12px_rgba(244,63,94,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {reviewLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      {reviewLoading ? "COMPRESSING…" : "COMPRESS REVIEW"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                    Compressed One-Line Review Comment
                  </label>
                  <div className="border border-white/5 bg-slate-950/40 rounded-2xl p-4 flex-1 flex flex-col justify-between min-h-[18rem]">
                    {reviewLoading ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2 py-16">
                        <RefreshCw className="w-6 h-6 animate-spin text-neon-pink" />
                        <span className="text-xs font-mono">Contacting Upstream LLM for review compression...</span>
                      </div>
                    ) : reviewResult ? (
                      <div className="flex-1 flex flex-col justify-between h-full space-y-4">
                        <div className="bg-black/60 p-5 rounded-2xl border border-white/5 flex-1 flex items-center justify-center font-mono text-sm font-bold text-neon-pink text-center select-all leading-relaxed">
                          {reviewResult}
                        </div>
                        {!reviewResult.startsWith("Error:") && (
                          <div className="flex justify-end mt-2">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(reviewResult);
                                setReviewCopied(true);
                                setTimeout(() => setReviewCopied(false), 2000);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 transition-all cursor-pointer"
                            >
                              {reviewCopied ? <CheckCheck className="w-3.5 h-3.5 text-neon-green" /> : <Copy className="w-3.5 h-3.5" />}
                              {reviewCopied ? "Copied!" : "Copy Review Comment"}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-700 gap-2 py-16">
                        <Terminal className="w-8 h-8" />
                        <span className="text-xs font-mono">Compressed review comment will appear here</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 4. Rules Generator Tool */}
            {cavemanTool === "rules" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-in">
                <div className="flex flex-col space-y-4">
                  <div>
                    <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                      Target AI Coding Agent
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["cursor", "cline", "copilot", "general"] as const).map((agent) => (
                        <button
                          key={agent}
                          onClick={() => {
                            setRulesAgent(agent);
                            setRulesWriteResult(null);
                          }}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                            rulesAgent === agent
                              ? "bg-neon-pink/10 border-neon-pink text-neon-pink shadow-[0_0_8px_rgba(244,63,94,0.15)]"
                              : "bg-slate-950 border-white/5 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {agent === "cursor" ? "Cursor Rules" : agent === "cline" ? "Cline Rules" : agent === "copilot" ? "Copilot Instructions" : "General AGENTS.md"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-950/60 p-4 border border-white/5 rounded-2xl space-y-2">
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300 font-semibold">
                      <input
                        type="checkbox"
                        checked={includeProxyRules}
                        onChange={() => setIncludeProxyRules(!includeProxyRules)}
                        className="rounded border-white/10 text-neon-pink focus:ring-0 cursor-pointer"
                      />
                      <span>Include RamuToken Proxy Instructions</span>
                    </label>
                    <p className="text-xxs text-slate-500 font-mono pl-6 leading-relaxed">
                      Instructs your AI agent to format output properly and avoid disrupting CCR token substitutions.
                    </p>
                  </div>

                  <div className="mt-3 flex justify-end gap-3">
                    <button
                      onClick={writeRulesFile}
                      disabled={writingRules}
                      className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black tracking-wider cursor-pointer bg-neon-pink text-slate-950 shadow-[0_0_12px_rgba(244,63,94,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {writingRules ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      {writingRules ? "WRITING…" : "WRITE TO PROJECT ROOT"}
                    </button>
                  </div>

                  {rulesWriteResult && (
                    <div className="animate-in">
                      {rulesWriteResult.error ? (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl flex items-start gap-2.5 text-xs font-mono">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block mb-0.5">Failed to Write File</span>
                            {rulesWriteResult.error}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-neon-green/10 border border-neon-green/25 text-neon-green p-3.5 rounded-xl flex items-start gap-2.5 text-xs font-mono">
                          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block mb-0.5">Rules File Written!</span>
                            Successfully saved rules to workspace root as <span className="font-bold underline">{rulesAgent === "cursor" ? ".cursorrules" : rulesAgent === "cline" ? ".clinerules" : rulesAgent === "copilot" ? ".github/copilot-instructions.md" : "AGENTS.md"}</span>.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                    Generated Rules Content
                  </label>
                  <div className="border border-white/5 bg-slate-950/40 rounded-2xl p-4 flex-1 flex flex-col justify-between min-h-[20rem]">
                    <pre className="p-4 bg-black/60 rounded-xl text-slate-300 font-mono text-xs overflow-auto border border-white/5 leading-relaxed max-h-[22rem] flex-1 select-all whitespace-pre-wrap">
                      {generateRulesContent()}
                    </pre>
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generateRulesContent());
                          setRulesCopied(true);
                          setTimeout(() => setRulesCopied(false), 2000);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 transition-all cursor-pointer"
                      >
                        {rulesCopied ? <CheckCheck className="w-3.5 h-3.5 text-neon-green" /> : <Copy className="w-3.5 h-3.5" />}
                        {rulesCopied ? "Copied!" : "Copy Rules"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
