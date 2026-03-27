"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Profile = "none" | "cognitive" | "visual" | "epilepsy" | "motor";
type FontSize = "normal" | "large" | "xlarge";
type Contrast = "normal" | "high" | "inverted";
type Saturation = "normal" | "high" | "low" | "bw";
type Align = "default" | "right" | "center" | "left";

interface A11yState {
  profile: Profile;
  fontSize: FontSize;
  contrast: Contrast;
  saturation: Saturation;
  align: Align;
  highlightLinks: boolean;
}

const DEFAULTS: A11yState = {
  profile: "none",
  fontSize: "normal",
  contrast: "normal",
  saturation: "normal",
  align: "default",
  highlightLinks: false,
};

// ── CSS helpers ───────────────────────────────────────────────────────────────

function applyStyles(state: A11yState) {
  const html = document.documentElement;

  // Font size
  html.style.fontSize =
    state.fontSize === "large" ? "120%" :
    state.fontSize === "xlarge" ? "145%" : "";

  // Contrast + Saturation filter (combined on body)
  const filters: string[] = [];
  if (state.contrast === "high") filters.push("contrast(1.6)");
  if (state.contrast === "inverted") filters.push("invert(1) hue-rotate(180deg)");
  if (state.saturation === "high") filters.push("saturate(2)");
  if (state.saturation === "low") filters.push("saturate(0.4)");
  if (state.saturation === "bw") filters.push("grayscale(1)");
  document.body.style.filter = filters.join(" ");

  // Text align
  document.body.style.textAlign =
    state.align === "right" ? "right" :
    state.align === "center" ? "center" :
    state.align === "left" ? "left" : "";

  // Highlight links
  const styleId = "a11y-links-style";
  let el = document.getElementById(styleId);
  if (state.highlightLinks) {
    if (!el) {
      el = document.createElement("style");
      el.id = styleId;
      document.head.appendChild(el);
    }
    el.textContent = "a { outline: 2px solid #f97316 !important; outline-offset: 2px !important; }";
  } else {
    el?.remove();
  }

  // Epilepsy: disable animations
  const animId = "a11y-anim-style";
  let animEl = document.getElementById(animId);
  if (state.profile === "epilepsy") {
    if (!animEl) {
      animEl = document.createElement("style");
      animEl.id = animId;
      document.head.appendChild(animEl);
    }
    animEl.textContent = "*, *::before, *::after { animation: none !important; transition: none !important; }";
  } else {
    animEl?.remove();
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-bold text-slate-500 mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`flex-1 min-w-fit py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors ${
              value === o.value
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AccessibilityButton() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<A11yState>(DEFAULTS);

  const update = useCallback((patch: Partial<A11yState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      applyStyles(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULTS);
    applyStyles(DEFAULTS);
  }, []);

  // Apply profile presets
  const applyProfile = useCallback((profile: Profile) => {
    const presets: Partial<A11yState> = { profile };
    if (profile === "visual") {
      presets.fontSize = "large";
      presets.contrast = "high";
    } else if (profile === "cognitive") {
      presets.fontSize = "normal";
      presets.contrast = "normal";
    } else if (profile === "epilepsy") {
      presets.contrast = "normal";
    } else if (profile === "motor") {
      presets.fontSize = "large";
    }
    update(presets);
  }, [update]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const isModified = JSON.stringify(state) !== JSON.stringify(DEFAULTS);

  return (
    <div className="fixed bottom-[88px] right-5 z-50 flex flex-col items-end">
      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="הגדרות נגישות"
          className="mb-3 bg-white rounded-2xl shadow-2xl border border-slate-200 w-72 max-h-[75vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-blue-600 text-white rounded-t-2xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="5" r="1.5"/>
                <path d="M9 19l3-8 3 8M9 12h6M5 8l2 2M19 8l-2 2"/>
              </svg>
              <span className="font-bold text-sm">הגדרות נגישות</span>
            </div>
            <button onClick={() => setOpen(false)} aria-label="סגור" className="hover:bg-white/20 rounded-full p-1 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4">
            {/* Profiles */}
            <div className="mb-4">
              <p className="text-xs font-bold text-slate-500 mb-2">פרופילי נגישות</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "cognitive", label: "קוגניטיבי", icon: "🧠" },
                  { value: "visual", label: "לקויי ראייה", icon: "👁" },
                  { value: "epilepsy", label: "אפילפסיה", icon: "⚡" },
                  { value: "motor", label: "מוגבלות מוטורית", icon: "✋" },
                ] as const).map((p) => (
                  <button
                    key={p.value}
                    onClick={() => applyProfile(p.value === state.profile ? "none" : p.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border transition-colors ${
                      state.profile === p.value
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span aria-hidden="true">{p.icon}</span>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <OptionGroup
              label="גודל טקסט"
              value={state.fontSize}
              onChange={(v) => update({ fontSize: v })}
              options={[
                { value: "normal", label: "רגיל" },
                { value: "large", label: "גדול" },
                { value: "xlarge", label: "גדול מאוד" },
              ]}
            />

            <OptionGroup
              label="ניגודיות"
              value={state.contrast}
              onChange={(v) => update({ contrast: v })}
              options={[
                { value: "normal", label: "רגיל" },
                { value: "high", label: "גבוהה" },
                { value: "inverted", label: "הפוכה" },
              ]}
            />

            <OptionGroup
              label="רוויית צבע"
              value={state.saturation}
              onChange={(v) => update({ saturation: v })}
              options={[
                { value: "normal", label: "רגיל" },
                { value: "high", label: "גבוהה" },
                { value: "low", label: "נמוכה" },
                { value: "bw", label: "ש/ל" },
              ]}
            />

            <OptionGroup
              label="יישור טקסט"
              value={state.align}
              onChange={(v) => update({ align: v })}
              options={[
                { value: "default", label: "ברירת מחדל" },
                { value: "right", label: "ימין" },
                { value: "center", label: "מרכז" },
                { value: "left", label: "שמאל" },
              ]}
            />

            {/* Toggles */}
            <div className="mb-4">
              <p className="text-xs font-bold text-slate-500 mb-2">תצוגה וקריאות</p>
              <label className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5 cursor-pointer">
                <span className="text-xs font-medium text-slate-700">הדגשת קישורים</span>
                <div
                  role="switch"
                  aria-checked={state.highlightLinks}
                  onClick={() => update({ highlightLinks: !state.highlightLinks })}
                  className={`relative w-9 h-5 rounded-full transition-colors ${state.highlightLinks ? "bg-blue-600" : "bg-slate-300"}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${state.highlightLinks ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
              </label>
            </div>

            {/* Reset */}
            {isModified && (
              <button
                onClick={reset}
                className="w-full py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                איפוס הגדרות
              </button>
            )}
          </div>
        </div>
      )}

      {/* Trigger button — matches All-Dog: blue, h-14 w-14 */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "סגור תפריט נגישות" : "פתח תפריט נגישות"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="h-14 w-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="5" r="1.5"/>
          <path d="M9 19l3-8 3 8M9 12h6M5 8l2 2M19 8l-2 2"/>
        </svg>
      </button>
    </div>
  );
}
