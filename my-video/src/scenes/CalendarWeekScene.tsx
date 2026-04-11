// src/scenes/CalendarWeekScene.tsx
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

const DAY_LABELS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const APPOINTMENTS = [
  { day: 0, startSlot: 1, color: ORANGE,     label: "אילוף",   customer: "דנה לוי",   time: "09:00" },
  { day: 1, startSlot: 3, color: "#22c55e",  label: "גרומינג", customer: "יוסי כהן",  time: "10:30" },
  { day: 2, startSlot: 7, color: "#3b82f6",  label: "אילוף",   customer: "מירי לוי",  time: "14:00" },
  { day: 3, startSlot: 1, color: ORANGE,     label: "אילוף",   customer: "רון אבן",   time: "09:00" },
  { day: 4, startSlot: 4, color: "#22c55e",  label: "גרומינג", customer: "שרה גל",    time: "11:00" },
];

const TIME_SLOTS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];

export const CalendarWeekScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerP = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const headerY = interpolate(headerP, [0, 1], [-16, 0]);
  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });

  const calloutOpacity = interpolate(frame, [200, 216], [0, 1], { extrapolateRight: "clamp" });
  const calloutP = spring({ frame: frame - 200, fps, config: { damping: 200 } });
  const calloutY = interpolate(calloutP, [0, 1], [14, 0]);

  const VIEW_TABS = ["יום", "שבוע", "חודש", "סדר יום"];

  return (
    <AbsoluteFill style={{ opacity, background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="יומן" />

      <div style={{
        position: "absolute",
        top: 0, right: 210, left: 0, bottom: 0,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header bar */}
        <div style={{
          height: 52, background: "white",
          borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center",
          padding: "0 16px", gap: 12,
          opacity: headerOpacity, transform: `translateY(${headerY}px)`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <span style={{ fontSize: 18, color: "#64748b" }}>›</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>13–19 אפריל 2026</span>
            <span style={{ fontSize: 18, color: "#64748b" }}>‹</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {VIEW_TABS.map((tab) => (
              <div key={tab} style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: tab === "שבוע" ? ORANGE : "transparent",
                color: tab === "שבוע" ? "white" : "#64748b",
              }}>{tab}</div>
            ))}
          </div>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 20,
          }}>+</div>
        </div>

        {/* Calendar grid */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* Day headers */}
          <div style={{
            display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)",
            borderBottom: "1px solid #e2e8f0", background: "white",
          }}>
            <div />
            {DAY_LABELS.map((d, i) => (
              <div key={d} style={{
                padding: "8px 4px", textAlign: "center",
                fontSize: 12, fontWeight: 600,
                color: i === 6 ? "#cbd5e1" : "#64748b",
                borderRight: "1px solid #f1f5f9",
              }}>{d}</div>
            ))}
          </div>

          {/* Time rows */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            {TIME_SLOTS.map((time, rowIdx) => (
              <div key={time} style={{
                display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)",
                borderBottom: "1px solid #f1f5f9",
                height: 44,
              }}>
                <div style={{ fontSize: 11, color: "#94a3b8", padding: "4px 6px", textAlign: "left" }}>{time}</div>
                {DAY_LABELS.map((_, colIdx) => (
                  <div key={colIdx} style={{
                    borderRight: "1px solid #f1f5f9",
                    background: colIdx === 6 ? "#fafafa" : "white",
                    position: "relative",
                  }}>
                    {APPOINTMENTS.filter(a => a.day === colIdx && a.startSlot === rowIdx).map((appt, ai) => {
                      const apptDelay = 25 + (appt.day * 8) + (ai * 5);
                      const apptOpacity = interpolate(frame, [apptDelay, apptDelay + 12], [0, 1], { extrapolateRight: "clamp" });
                      const apptP = spring({ frame: frame - apptDelay, fps, config: { damping: 180 } });
                      const apptY = interpolate(apptP, [0, 1], [8, 0]);
                      return (
                        <div key={ai} style={{
                          position: "absolute", inset: "2px 2px",
                          background: `${appt.color}20`,
                          border: `1.5px solid ${appt.color}`,
                          borderRadius: 6,
                          padding: "2px 5px",
                          opacity: apptOpacity,
                          transform: `translateY(${apptY}px)`,
                          overflow: "hidden",
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: appt.color }}>{appt.time} {appt.label}</div>
                          <div style={{ fontSize: 10, color: "#475569" }}>{appt.customer}</div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Orange callout */}
        <div style={{
          margin: "0 16px 14px",
          background: "rgba(234,88,12,0.08)",
          border: `1.5px solid rgba(234,88,12,0.25)`,
          borderRadius: 12, padding: "11px 16px",
          opacity: calloutOpacity, transform: `translateY(${calloutY}px)`,
        }}>
          <span style={{ fontSize: 13, color: ORANGE, fontWeight: 600 }}>
            4 תצוגות — יום, שבוע, חודש, וסדר יום
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
