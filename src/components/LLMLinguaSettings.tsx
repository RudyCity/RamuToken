import { RefreshCw } from "lucide-react";
import { CompressorSettings } from "../types";

interface LLMLinguaSettingsProps {
  settings: CompressorSettings;
  handleSliderChange: (pipeline: "serena" | "headroom" | "llmlingua", field: string, val: number) => void;
  handleLlmlinguaInputChange: (field: string, val: string) => void;
  handleSaveSettings: (updatedSettings: CompressorSettings) => void;
  fetchModels: () => Promise<void>;
  fetchingModels: boolean;
  localModelPresets: { value: string; label: string }[];
  apiModelPresets: { value: string; label: string }[];
}

export default function LLMLinguaSettings({
  settings,
  handleSliderChange,
  handleLlmlinguaInputChange,
  handleSaveSettings,
  fetchModels,
  fetchingModels,
  localModelPresets,
  apiModelPresets,
}: LLMLinguaSettingsProps) {
  const method = settings.llmlingua?.method || "api";

  return (
    <div className="space-y-4 max-w-lg font-mono">
      {/* Method selection */}
      <div className="max-w-xs">
        <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-2">
          Compression Method
        </label>
        <select
          id="select-llmlingua-method"
          value={method}
          onChange={() => {
            const updated = { ...settings };
            if (!updated.llmlingua) {
              updated.llmlingua = {
                enabled: true,
                method: "api",
                localModel: "microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank",
                apiModel: "auto",
                rate: 0.5,
                apiPrompt: "",
              };
            }
            updated.llmlingua.method = method === "api" ? "local" : "api";
            handleSaveSettings(updated);
          }}
          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-neon-purple cursor-pointer"
        >
          <option value="api">Upstream API Model (Claude/GPT)</option>
          <option value="local">Local LLMLingua-2 Model (Offline)</option>
        </select>
      </div>

      {/* Local Method Settings */}
      {method === "local" && (
        <div className="space-y-4 pt-2 border-t border-white/5">
          <div>
            <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              HuggingFace Local Model
            </label>
            <select
              value={localModelPresets.some(p => p.value === settings.llmlingua?.localModel) ? settings.llmlingua?.localModel : "custom"}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== "custom") {
                  handleLlmlinguaInputChange("localModel", val);
                  handleSaveSettings({
                    ...settings,
                    llmlingua: { ...settings.llmlingua!, localModel: val }
                  });
                } else {
                  handleLlmlinguaInputChange("localModel", "");
                }
              }}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-neon-purple cursor-pointer mb-2 font-mono"
            >
              {localModelPresets.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
              <option value="custom">Custom Model Path...</option>
            </select>

            {(!settings.llmlingua?.localModel || !localModelPresets.some(p => p.value === settings.llmlingua?.localModel)) && (
              <input
                type="text"
                value={settings.llmlingua?.localModel || ""}
                placeholder="e.g. microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank"
                onChange={(e) => handleLlmlinguaInputChange("localModel", e.target.value)}
                onBlur={() => handleSaveSettings(settings)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-neon-purple font-mono"
              />
            )}
            <p className="text-[10px] text-slate-500 mt-1">
              Loads locally using python background daemon. Default is extremely fast and light.
            </p>
          </div>

          <div>
            <div className="flex justify-between text-xxs text-slate-400 mb-2">
              <span>Target Compression Rate (percentage of prompt to keep):</span>
              <span className="text-neon-purple font-bold">{Math.round((settings.llmlingua?.rate || 0.5) * 100)}%</span>
            </div>
            <input
              id="slider-llmlingua-rate"
              type="range" min={0.1} max={0.9} step={0.05}
              value={settings.llmlingua?.rate || 0.5}
              onChange={(e) => handleSliderChange("llmlingua", "rate", parseFloat(e.target.value))}
              onMouseUp={() => handleSaveSettings(settings)}
              onTouchEnd={() => handleSaveSettings(settings)}
              className="w-full accent-purple-400"
            />
          </div>
        </div>
      )}

      {/* API Method Settings */}
      {method === "api" && (
        <div className="space-y-4 pt-2 border-t border-white/5">
          <div>
            <div className="flex justify-between items-center mb-1.5 font-mono">
              <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400">
                Compression Target Model
              </label>
              <button
                type="button"
                onClick={fetchModels}
                disabled={fetchingModels}
                className="text-[10px] text-neon-purple hover:underline focus:outline-none flex items-center gap-1 cursor-pointer disabled:opacity-50 font-mono"
              >
                {fetchingModels ? "Fetching..." : "Refresh list"}
              </button>
            </div>
            <select
              value={apiModelPresets.some(p => p.value === settings.llmlingua?.apiModel) ? settings.llmlingua?.apiModel : "custom"}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== "custom") {
                  handleLlmlinguaInputChange("apiModel", val);
                  handleSaveSettings({
                    ...settings,
                    llmlingua: { ...settings.llmlingua!, apiModel: val }
                  });
                } else {
                  handleLlmlinguaInputChange("apiModel", "");
                }
              }}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-neon-purple cursor-pointer mb-2 font-mono"
            >
              {apiModelPresets.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
              <option value="custom">Custom Model ID...</option>
            </select>

            {(!settings.llmlingua?.apiModel || !apiModelPresets.some(p => p.value === settings.llmlingua?.apiModel)) && (
              <input
                type="text"
                value={settings.llmlingua?.apiModel || ""}
                placeholder="auto"
                onChange={(e) => handleLlmlinguaInputChange("apiModel", e.target.value)}
                onBlur={() => handleSaveSettings(settings)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-neon-purple font-mono"
              />
            )}
            <p className="text-[10px] text-slate-500 mt-1">
              Set model name (e.g. <code className="text-neon-purple">gpt-4o-mini</code> or <code className="text-neon-purple">claude-3-5-haiku-20241022</code>) or keep <code className="text-neon-purple">auto</code> to select a cheap model dynamically.
            </p>
          </div>

          <div>
            <label className="block text-xxs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Compression System Prompt Instructions
            </label>
            <textarea
              value={settings.llmlingua?.apiPrompt || ""}
              onChange={(e) => handleLlmlinguaInputChange("apiPrompt", e.target.value)}
              onBlur={() => handleSaveSettings(settings)}
              rows={4}
              placeholder="Instructions for the AI to compress the text..."
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-neon-purple font-mono"
            />
          </div>
        </div>
      )}
    </div>
  );
}
