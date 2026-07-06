import { useState } from "react";
import { CompressorSettings } from "../types";
import { X, Search, Check, RefreshCw } from "lucide-react";

interface ImageSettingsProps {
  settings: CompressorSettings;
  handleSaveSettings: (updatedSettings: CompressorSettings) => void;
  fetchedModels: string[];
  fetchingModels: boolean;
  fetchModels: () => Promise<void>;
}

export default function ImageSettings({
  settings,
  handleSaveSettings,
  fetchedModels,
  fetchingModels,
  fetchModels,
}: ImageSettingsProps) {
  const image = settings.image || {
    enabled: false,
    triggerModels: ["gpt-4o", "claude-3-5", "gemini-1.5"],
    minCharLength: 2000,
    maxWidth: 1024,
    fontSize: 13,
    format: "jpeg" as "jpeg" | "png",
    quality: 80,
    linesPerPage: 50,
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const updateField = (field: string, value: any) => {
    const updated = {
      ...settings,
      image: {
        ...image,
        [field]: value,
      },
    };
    handleSaveSettings(updated);
  };

  const toggleModel = (modelName: string) => {
    const list = [...image.triggerModels];
    const index = list.indexOf(modelName);
    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(modelName);
    }
    updateField("triggerModels", list);
  };

  const addCustomModel = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      const val = searchQuery.trim();
      if (!image.triggerModels.includes(val)) {
        updateField("triggerModels", [...image.triggerModels, val]);
      }
      setSearchQuery("");
    }
  };

  // Filter fetched models by search query, excluding already selected models
  const filteredModels = fetchedModels.filter(
    (m) =>
      m.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !image.triggerModels.includes(m)
  );

  return (
    <div className="space-y-5 max-w-lg font-mono">
      {/* Master Toggle */}
      <div className="flex items-center justify-between p-3.5 bg-white/5 border border-white/10 rounded-2xl">
        <div>
          <span className="text-xs font-bold text-slate-200 block">Enable Image Compressor</span>
          <span className="text-[10px] text-slate-500">Converts long prompts to compressed images.</span>
        </div>
        <button
          onClick={() => updateField("enabled", !image.enabled)}
          className={`relative inline-flex items-center h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            image.enabled ? "bg-neon-purple" : "bg-slate-800"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              image.enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {image.enabled && (
        <>
          {/* Target Models Selector */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400">
                Trigger Models (Vision Enabled)
              </label>
              <button
                onClick={fetchModels}
                disabled={fetchingModels}
                className="text-[9px] flex items-center gap-1 text-neon-cyan hover:text-neon-cyan/80 transition-colors bg-transparent border-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${fetchingModels ? "animate-spin" : ""}`} />
                Sync Provider Models
              </button>
            </div>

            {/* Selected Trigger Models Pills */}
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950 border border-white/10 rounded-xl min-h-[44px]">
              {image.triggerModels.length === 0 ? (
                <span className="text-[10px] text-slate-600 self-center px-1">
                  No trigger models selected. Always skipped.
                </span>
              ) : (
                image.triggerModels.map((model) => (
                  <span
                    key={model}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold bg-neon-purple/10 border border-neon-purple/30 text-neon-purple shrink-0 animate-in fade-in zoom-in-95 duration-150"
                  >
                    {model}
                    <button
                      onClick={() => toggleModel(model)}
                      className="text-neon-purple hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Model Search & Dropdown Selection */}
            <div className="relative">
              <div className="flex items-center bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 focus-within:border-neon-purple transition-colors">
                <Search className="w-3.5 h-3.5 text-slate-500 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search fetched models or type custom and hit Enter..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={addCustomModel}
                  onFocus={() => setIsDropdownOpen(true)}
                  className="w-full bg-transparent text-xs text-slate-200 focus:outline-none font-mono"
                />
              </div>

              {isDropdownOpen && searchQuery && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setSearchQuery("");
                    }}
                  />
                  <div className="absolute z-50 left-0 right-0 mt-1 max-h-[160px] overflow-y-auto bg-slate-950 border border-white/15 rounded-xl shadow-xl flex flex-col font-mono">
                    {filteredModels.length === 0 ? (
                      <span className="text-[10px] text-slate-500 p-3 italic">
                        No matches found. Press Enter to add "{searchQuery}"
                      </span>
                    ) : (
                      filteredModels.slice(0, 10).map((m) => (
                        <button
                          key={m}
                          onClick={() => {
                            toggleModel(m);
                            setSearchQuery("");
                            setIsDropdownOpen(false);
                          }}
                          className="flex items-center justify-between px-3.5 py-2 text-xxs text-slate-300 hover:bg-white/5 hover:text-white border-0 bg-transparent text-left cursor-pointer transition-colors"
                        >
                          <span>{m}</span>
                          <Check className="w-3 h-3 text-neon-green opacity-0 hover:opacity-100" />
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Image Format */}
            <div>
              <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Image Format
              </label>
              <select
                value={image.format}
                onChange={(e) => updateField("format", e.target.value as any)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-neon-purple cursor-pointer"
              >
                <option value="jpeg">JPEG (Smaller filesize)</option>
                <option value="png">PNG (Lossless, sharpest)</option>
              </select>
            </div>

            {/* JPEG Quality (only if JPEG) */}
            {image.format === "jpeg" && (
              <div>
                <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  JPEG Quality: {image.quality}%
                </label>
                <input
                  type="range"
                  min="30"
                  max="100"
                  value={image.quality}
                  onChange={(e) => updateField("quality", parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-neon-purple mt-2"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Min Character Length */}
            <div className="col-span-2">
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400">
                  Min Content Length to Compress
                </label>
                <span className="text-xxs font-bold text-neon-cyan font-mono">
                  {image.minCharLength.toLocaleString()} chars
                </span>
              </div>
              <input
                type="range"
                min="500"
                max="20000"
                step="500"
                value={image.minCharLength}
                onChange={(e) => updateField("minCharLength", parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-neon-purple mt-1"
              />
              <span className="text-[9px] text-slate-500 block mt-1">
                Only messages larger than this will be converted into images.
              </span>
            </div>

            {/* Max Width */}
            <div>
              <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Max Width (px)
              </label>
              <input
                type="number"
                min="600"
                max="2000"
                value={image.maxWidth}
                onChange={(e) => updateField("maxWidth", parseInt(e.target.value) || 1024)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-neon-purple"
              />
            </div>

            {/* Font Size */}
            <div>
              <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Font Size (px)
              </label>
              <input
                type="number"
                min="8"
                max="24"
                value={image.fontSize}
                onChange={(e) => updateField("fontSize", parseInt(e.target.value) || 13)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-neon-purple"
              />
            </div>

            {/* Lines Per Page */}
            <div>
              <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Lines Per Page
              </label>
              <input
                type="number"
                min="10"
                max="200"
                value={image.linesPerPage}
                onChange={(e) => updateField("linesPerPage", parseInt(e.target.value) || 50)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-neon-purple"
              />
              <span className="text-[9px] text-slate-500 mt-1 block">
                Splits text into multiple pages/images.
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
