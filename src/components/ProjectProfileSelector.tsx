/**
 * ProjectProfileSelector.tsx
 * Reusable dropdown to select the active project profile.
 * Shows a badge per profile type, supports auto-scan, and manual entry.
 */
import { useState } from "react";
import { FolderOpen, RefreshCw, ChevronDown } from "lucide-react";
import { ProjectProfile, CompressorSettings } from "../types";

interface ProjectProfileSelectorProps {
  /** All saved profiles from settings */
  profiles: ProjectProfile[];
  /** Currently active profile id */
  activeProfileId: string;
  /** Called when user picks a profile (empty string = use default/cwd) */
  onSelect: (profileId: string) => void;
  /** Called after a scan merges new profiles — receives updated settings */
  onScanComplete: (updatedSettings: CompressorSettings) => void;
  /** The current globalSettings (needed to save after scan) */
  globalSettings: CompressorSettings;
  /** Manual override value (used when typing a custom path) */
  manualPath?: string;
  onManualPathChange?: (val: string) => void;
  /** Accent color class e.g. "neon-purple" */
  accentColor?: string;
  /** Auto-detected backend CWD as fallback label */
  backendCwd?: string;
}

const TYPE_COLORS: Record<string, string> = {
  "Node/Bun": "bg-emerald-500/20 text-emerald-400",
  "Python":   "bg-yellow-500/20 text-yellow-400",
  "Rust":     "bg-orange-500/20 text-orange-400",
  "Go":       "bg-cyan-500/20 text-cyan-400",
  "Java":     "bg-red-500/20 text-red-400",
  "C/C++":    "bg-blue-500/20 text-blue-400",
  "Git":      "bg-slate-500/20 text-slate-400",
};

export default function ProjectProfileSelector({
  profiles,
  activeProfileId,
  onSelect,
  onScanComplete,
  globalSettings,
  manualPath,
  onManualPathChange,
  accentColor = "neon-purple",
  backendCwd = "",
}: ProjectProfileSelectorProps) {
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const [open, setOpen] = useState(false);

  const activeProfile = profiles.find(p => p.id === activeProfileId);
  const fallbackLabel = globalSettings.serena.projectRoot
    ? `Default: ${globalSettings.serena.projectRoot}`
    : backendCwd
    ? `Auto-detected: ${backendCwd}`
    : "Auto (server CWD)";

  const handleScan = async () => {
    setScanning(true);
    setScanMsg("");
    try {
      const res = await fetch("/api/scan-projects");
      if (res.ok) {
        const data = await res.json();
        setScanMsg(`✅ ${data.added} new project(s) found (${data.detected} scanned)`);
        // Update parent settings with merged profiles
        onScanComplete({
          ...globalSettings,
          serena: { ...globalSettings.serena, projectProfiles: data.profiles }
        });
      } else {
        setScanMsg("❌ Scan failed");
      }
    } catch {
      setScanMsg("❌ Network error");
    } finally {
      setScanning(false);
      setTimeout(() => setScanMsg(""), 4000);
    }
  };

  return (
    <div className="space-y-2">
      {/* Dropdown trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center justify-between gap-2 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-left transition-colors focus:outline-none hover:border-white/20 ${open ? `border-${accentColor}` : ""}`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <FolderOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            {activeProfile ? (
              <>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${TYPE_COLORS[activeProfile.type] || "bg-slate-500/20 text-slate-400"}`}>
                  {activeProfile.type}
                </span>
                <span className="text-slate-200 truncate">{activeProfile.name}</span>
              </>
            ) : (
              <span className="text-slate-500 truncate">{fallbackLabel}</span>
            )}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {/* Dropdown list */}
        {open && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-slate-900 border border-white/10 rounded-xl shadow-xl overflow-hidden">
            {/* Default / no profile option */}
            <button
              type="button"
              onClick={() => { onSelect(""); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-mono text-left hover:bg-white/5 transition-colors ${!activeProfileId ? "text-slate-200 bg-white/5" : "text-slate-500"}`}
            >
              <FolderOpen className="w-3 h-3 shrink-0" />
              <span className="truncate">{fallbackLabel}</span>
            </button>

            {profiles.length > 0 && (
              <div className="border-t border-white/5">
                {profiles.map(profile => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => { onSelect(profile.id); setOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-mono text-left hover:bg-white/5 transition-colors ${profile.id === activeProfileId ? "bg-white/5 text-slate-200" : "text-slate-400"}`}
                  >
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${TYPE_COLORS[profile.type] || "bg-slate-500/20 text-slate-400"}`}>
                      {profile.type}
                    </span>
                    <span className="font-semibold shrink-0 text-slate-300">{profile.name}</span>
                    <span className="text-slate-600 truncate text-[10px]">{profile.path}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Manual custom path entry */}
            {onManualPathChange && (
              <div className="border-t border-white/5 p-2">
                <input
                  type="text"
                  value={manualPath || ""}
                  onChange={e => onManualPathChange(e.target.value)}
                  placeholder="Or type a custom path..."
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-white/30"
                  onClick={e => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active profile path hint */}
      {activeProfile && (
        <p className="text-[10px] font-mono text-slate-600 truncate pl-1">
          📁 {activeProfile.path}
        </p>
      )}

      {/* Scan button + feedback */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 hover:text-slate-200 border border-white/10 rounded-lg px-2 py-1 transition-colors cursor-pointer disabled:opacity-50"
        >
          {scanning
            ? <RefreshCw className="w-3 h-3 animate-spin" />
            : <RefreshCw className="w-3 h-3" />}
          Auto-Scan Projects
        </button>
        {scanMsg && <span className="text-[10px] font-mono text-slate-400">{scanMsg}</span>}
      </div>
    </div>
  );
}
