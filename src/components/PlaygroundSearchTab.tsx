import { Search, RefreshCw } from "lucide-react";
import { CompressorSettings } from "../types";
import ProjectProfileSelector from "./ProjectProfileSelector";

interface PlaygroundSearchTabProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  searchProjectRoot: string;
  setSearchProjectRoot: (val: string) => void;
  runSemanticSearch: () => Promise<void>;
  searching: boolean;
  searchResults: any[];
  backendCwd: string;
  globalSettings: CompressorSettings;
  onSettingsUpdate: (updated: CompressorSettings) => void;
}

export default function PlaygroundSearchTab({
  searchQuery,
  setSearchQuery,
  searchProjectRoot,
  setSearchProjectRoot,
  runSemanticSearch,
  searching,
  searchResults,
  backendCwd,
  globalSettings,
  onSettingsUpdate,
}: PlaygroundSearchTabProps) {
  return (
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
            Project Root (Profile or Override)
          </label>
          <ProjectProfileSelector
            profiles={globalSettings.serena.projectProfiles || []}
            activeProfileId={globalSettings.serena.activeProfileId || ""}
            onSelect={(id) => onSettingsUpdate({ ...globalSettings, serena: { ...globalSettings.serena, activeProfileId: id } })}
            onScanComplete={onSettingsUpdate}
            globalSettings={globalSettings}
            manualPath={searchProjectRoot}
            onManualPathChange={setSearchProjectRoot}
            backendCwd={backendCwd}
            accentColor="neon-purple"
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
  );
}
