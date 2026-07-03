import { Terminal, RefreshCw, ShieldCheck, AlertCircle, CheckCircle } from "lucide-react";
import { CompressorSettings } from "../types";

interface PlaygroundVerifyTabProps {
  verifyFilePath: string;
  setVerifyFilePath: (val: string) => void;
  verifyProjectRoot: string;
  setVerifyProjectRoot: (val: string) => void;
  verifyCode: string;
  setVerifyCode: (val: string) => void;
  runCodeVerification: () => Promise<void>;
  verifying: boolean;
  verifyResult: any;
  backendCwd: string;
  globalSettings: CompressorSettings;
}

export default function PlaygroundVerifyTab({
  verifyFilePath,
  setVerifyFilePath,
  verifyProjectRoot,
  setVerifyProjectRoot,
  verifyCode,
  setVerifyCode,
  runCodeVerification,
  verifying,
  verifyResult,
  backendCwd,
  globalSettings,
}: PlaygroundVerifyTabProps) {
  const defaultRootPlaceholder = globalSettings.serena.projectRoot 
    ? `Default: ${globalSettings.serena.projectRoot}`
    : backendCwd 
    ? `Default (auto): ${backendCwd}`
    : "Leave empty for default";

  return (
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
            placeholder={defaultRootPlaceholder}
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
  );
}
