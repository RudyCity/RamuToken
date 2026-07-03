import React from "react";

// Toggle Switch
interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  color?: string;
  id?: string;
}

export function Toggle({ checked, onChange, color = "#10b981", id }: ToggleProps) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`toggle-track ${checked ? "on" : "off"}`}
      style={checked ? { background: color, boxShadow: `0 0 12px ${color}88` } : {}}
    >
      <span className="toggle-thumb" />
    </button>
  );
}

// Section wrapper
export function Section({ children }: { children: React.ReactNode }) {
  return <div className="glass-panel p-6 rounded-2xl space-y-5">{children}</div>;
}

export function SectionTitle({ children, gradient }: { children: React.ReactNode; gradient: string }) {
  return (
    <h2 className={`text-sm font-black text-transparent bg-clip-text bg-gradient-to-r ${gradient} mb-1`}>
      {children}
    </h2>
  );
}

// Pipeline row with toggle
interface PipelineSectionProps {
  id: string;
  icon: React.ReactNode;
  name: string;
  desc: string;
  active: boolean;
  color: string;
  activeGradient: string;
  children?: React.ReactNode;
  toggleSettingsField: (pipeline: any, field: string) => void;
}

export function PipelineSection({
  id, icon, name, desc, active, color, activeGradient, children, toggleSettingsField,
}: PipelineSectionProps) {
  const parts = id.split(".");
  const pipeline = parts[0];
  const field = parts[1] || "enabled";

  return (
    <div className="border border-white/5 rounded-xl overflow-hidden">
      <div
        className="flex justify-between items-center p-4"
        style={active ? { background: color + "08" } : { background: "rgba(15,20,35,0.5)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon}
          <div className="min-w-0">
            <h3 className="text-sm font-bold leading-none">{name}</h3>
            <p className="text-xxs text-slate-500 font-mono mt-0.5 truncate">{desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span
            className="text-xxs font-black font-mono hidden sm:inline"
            style={{ color: active ? color : "#64748b" }}
          >
            {active ? "ACTIVE" : "IDLE"}
          </span>
          <Toggle
            id={`toggle-${pipeline}`}
            checked={active}
            onChange={() => toggleSettingsField(pipeline, field)}
            color={color}
          />
        </div>
      </div>
      {active && children && (
        <div className="p-4 bg-slate-950/30 border-t border-white/5 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

// Checkbox Option
interface CheckOptionProps {
  label: string;
  sub: string;
  checked: boolean;
  onChange: () => void;
  color?: string;
}

export function CheckOption({
  label, sub, checked, onChange, color = "#10b981"
}: CheckOptionProps) {
  return (
    <label className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <div
        className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all"
        style={checked ? { background: color, borderColor: color } : { borderColor: "rgba(255,255,255,0.15)" }}
      >
        {checked && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
      </div>
      <div>
        <span className="text-xs font-bold block">{label}</span>
        <span className="text-xxs text-slate-500 font-mono">{sub}</span>
      </div>
    </label>
  );
}
