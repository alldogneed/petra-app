// src/scenes/DashboardStatsScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const STATS = [
  { value: 12450, label: "הכנסות החודש", sub: "היום: ₪680", color: ORANGE, format: "currency" },
  { value: 6,     label: "תורים היום",   sub: "הבא: 10:30", color: "#2563eb", format: "number" },
  { value: 48,    label: "לקוחות פעילים", sub: "+3 החודש",  color: "#16a34a", format: "number" },
  { value: 3,     label: "תשלומים ממתינים", sub: "סה״כ ₪1,230", color: "#d97706", format: "number" },
];

export const DashboardStatsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const calloutP = spring({ frame: frame - 220, fps, config: { damping: 200 } });
  const calloutY = interpolate(calloutP, [0, 1], [20, 0]);
  const calloutOpacity = interpolate(frame, [220, 240], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="דשבורד" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>

        {/* Page header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          opacity: headerOpacity,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>לוח הבקרה</div>
        </div>

        {/* Stat cards 2×2 grid */}
        <div style={{
          padding: "20px 24px",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
        }}>
          {STATS.map((stat, i) => {
            const startFrame = 20 + i * 30;
            const cardP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
            const cardY = interpolate(cardP, [0, 1], [30, 0]);
            const cardOpacity = interpolate(frame, [startFrame, startFrame + 18], [0, 1], { extrapolateRight: "clamp" });

            const counterProgress = interpolate(
              frame,
              [startFrame + 10, startFrame + 55],
              [0, 1],
              { extrapolateRight: "clamp" }
            );
            const currentValue = Math.round(counterProgress * stat.value);
            const displayValue = stat.format === "currency"
              ? `₪${currentValue.toLocaleString()}`
              : String(currentValue);

            return (
              <div key={stat.label} style={{
                background: "white", borderRadius: 16,
                border: `1px solid #e2e8f0`,
                padding: "20px 20px 16px",
                opacity: cardOpacity,
                transform: `translateY(${cardY}px)`,
                borderTop: `3px solid ${stat.color}`,
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: stat.color, marginBottom: 4 }}>
                  {displayValue}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{stat.sub}</div>
              </div>
            );
          })}
        </div>

        {/* Callout */}
        <div style={{
          margin: "0 24px",
          background: "rgba(234,88,12,0.07)",
          border: "1px solid rgba(234,88,12,0.25)",
          borderRadius: 12, padding: "14px 18px",
          opacity: calloutOpacity,
          transform: `translateY(${calloutY}px)`,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>
            הנתונים מתעדכנים בזמן אמת — כל תשלום ותור מתווסף אוטומטית
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
