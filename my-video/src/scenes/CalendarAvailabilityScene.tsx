// src/scenes/CalendarAvailabilityScene.tsx
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

const DAYS = [
  { name: "ראשון", open: "09:00", close: "18:00", active: true },
  { name: "שני",   open: "09:00", close: "18:00", active: true },
  { name: "שלישי", open: "09:00", close: "18:00", active: true },
  { name: "רביעי", open: "09:00", close: "18:00", active: true },
  { name: "חמישי", open: "09:00", close: "17:00", active: true },
  { name: "שישי",  open: "09:00", close: "13:00", active: true },
  { name: "שבת",   open: "—",     close: "—",     active: false },
];

export const CalendarAvailabilityScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerP = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const headerY = interpolate(headerP, [0, 1], [-16, 0]);
  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });

  const sectionOpacity = interpolate(frame, [18, 30], [0, 1], { extrapolateRight: "clamp" });

  const blockP = spring({ frame: frame - 160, fps, config: { damping: 180 } });
  const blockY = interpolate(blockP, [0, 1], [24, 0]);
  const blockOpacity = interpolate(frame, [160, 178], [0, 1], { extrapolateRight: "clamp" });

  const calloutOpacity = interpolate(frame, [260, 276], [0, 1], { extrapolateRight: "clamp" });
  const calloutP = spring({ frame: frame - 260, fps, config: { damping: 200 } });
  const calloutY = interpolate(calloutP, [0, 1], [14, 0]);

  return (
    <AbsoluteFill style={{ opacity, background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="הגדרות" />

      <div style={{
        position: "absolute",
        top: 0, right: 210, left: 0, bottom: 0,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          height: 52, background: "white",
          borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center",
          padding: "0 24px",
          opacity: headerOpacity, transform: `translateY(${headerY}px)`,
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>זמינות</span>
        </div>

        <div style={{ flex: 1, padding: "20px 24px", overflow: "hidden", display: "flex", gap: 20 }}>
          {/* Left: working hours */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 12, opacity: sectionOpacity, textTransform: "uppercase", letterSpacing: 1 }}>
              שעות פעילות
            </div>
            <div style={{
              background: "white", borderRadius: 14,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              overflow: "hidden",
            }}>
              {DAYS.map((day, i) => {
                const rowDelay = 28 + i * 12;
                const rowOpacity = interpolate(frame, [rowDelay, rowDelay + 12], [0, 1], { extrapolateRight: "clamp" });
                const rowP = spring({ frame: frame - rowDelay, fps, config: { damping: 200 } });
                const rowY = interpolate(rowP, [0, 1], [8, 0]);
                return (
                  <div key={day.name} style={{
                    display: "flex", alignItems: "center",
                    padding: "11px 16px",
                    borderBottom: i < DAYS.length - 1 ? "1px solid #f1f5f9" : "none",
                    opacity: rowOpacity, transform: `translateY(${rowY}px)`,
                    direction: "rtl",
                  }}>
                    <span style={{ width: 56, fontSize: 13, fontWeight: 600, color: day.active ? "#0f172a" : "#94a3b8" }}>{day.name}</span>
                    {day.active ? (
                      <>
                        <div style={{
                          border: "1.5px solid #e2e8f0", borderRadius: 8,
                          padding: "4px 10px", fontSize: 13, color: "#0f172a",
                          background: "#fafafa", marginLeft: "auto",
                        }}>{day.open}</div>
                        <span style={{ margin: "0 8px", color: "#94a3b8", fontSize: 12 }}>עד</span>
                        <div style={{
                          border: "1.5px solid #e2e8f0", borderRadius: 8,
                          padding: "4px 10px", fontSize: 13, color: "#0f172a",
                          background: "#fafafa",
                        }}>{day.close}</div>
                      </>
                    ) : (
                      <span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>סגור</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: block time */}
          <div style={{
            width: 240,
            opacity: blockOpacity,
            transform: `translateY(${blockY}px)`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
              חסימת זמן
            </div>
            <div style={{
              background: "white", borderRadius: 14,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              padding: "16px",
              direction: "rtl",
            }}>
              {[
                { label: "מ", value: "20.04.2026  09:00" },
                { label: "עד", value: "25.04.2026  18:00" },
                { label: "סיבה", value: "חופשה" },
              ].map((f) => (
                <div key={f.label} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>{f.label}</div>
                  <div style={{
                    border: "1.5px solid #e2e8f0", borderRadius: 8,
                    padding: "7px 10px", fontSize: 13, color: "#0f172a", background: "#fafafa",
                  }}>{f.value}</div>
                </div>
              ))}
              <div style={{
                marginTop: 12,
                background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
                borderRadius: 10, padding: "10px 0",
                textAlign: "center",
              }}>
                <span style={{ color: "white", fontSize: 13, fontWeight: 700 }}>הוסף חסימה</span>
              </div>
            </div>
          </div>
        </div>

        {/* Orange callout */}
        <div style={{
          margin: "0 24px 16px",
          background: "rgba(234,88,12,0.08)",
          border: `1.5px solid rgba(234,88,12,0.25)`,
          borderRadius: 12, padding: "11px 16px",
          opacity: calloutOpacity, transform: `translateY(${calloutY}px)`,
        }}>
          <span style={{ fontSize: 13, color: ORANGE, fontWeight: 600 }}>
            חסמו ימי חופשה — הלקוחות לא יוכלו להזמין בזמן זה
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
