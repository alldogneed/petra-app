// src/scenes/teaser/TeaserCalendarScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "../PetraSidebar";
import { PainOverlay } from "../../components/teaser/PainOverlay";
import { BenefitTag } from "../../components/teaser/BenefitTag";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const DAYS = ["ראשון 6.4", "שני 7.4", "שלישי 8.4", "רביעי 9.4"];

const APPTS = [
  { day: 0, time: "09:00", name: "ענבל כהן", service: "אילוף גורים", color: "#ea580c", delay: 62 },
  { day: 0, time: "11:00", name: "מיכל לוי", service: "טיפוח", color: "#8b5cf6", delay: 74 },
  { day: 1, time: "10:00", name: "יוסי גולן", service: "שיעור הגנה", color: "#ea580c", delay: 80 },
  { day: 2, time: "09:30", name: "שירה כהן", service: "אילוף גורים", color: "#ea580c", delay: 88 },
  { day: 2, time: "14:00", name: "עמית בן-דוד", service: "אילוף גורים", color: "#ea580c", delay: 96 },
  { day: 3, time: "11:00", name: "נויה אביב", service: "פנסיון", color: "#0891b2", delay: 104 },
];

export const TeaserCalendarScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [52, 65], [0, 1], { extrapolateRight: "clamp" });
  const gridOpacity = interpolate(frame, [55, 68], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="יומן" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity, flexShrink: 0,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>יומן תורים</div>
          <div style={{
            background: ORANGE, color: "white", borderRadius: 8,
            padding: "6px 14px", fontSize: 12, fontWeight: 700,
          }}>
            + תור חדש
          </div>
        </div>

        {/* Calendar grid */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", opacity: gridOpacity }}>
          {/* Day headers */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            gap: 1, padding: "0 16px", background: "white",
            borderBottom: "1px solid #e2e8f0",
          }}>
            {DAYS.map((day) => (
              <div key={day} style={{
                padding: "10px 12px", fontSize: 12, fontWeight: 700,
                color: "#0f172a", textAlign: "center",
              }}>
                {day}
              </div>
            ))}
          </div>

          {/* Grid body */}
          <div style={{
            flex: 1, display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            gap: 1, padding: "8px 16px", alignItems: "start",
          }}>
            {DAYS.map((day, dayIdx) => (
              <div key={day} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 4px" }}>
                {APPTS.filter((a) => a.day === dayIdx).map((appt) => {
                  const p = spring({ frame: frame - appt.delay, fps, config: { damping: 200 } });
                  const y = interpolate(p, [0, 1], [14, 0]);
                  const apptOpacity = interpolate(frame, [appt.delay, appt.delay + 10], [0, 1], { extrapolateRight: "clamp" });

                  return (
                    <div key={appt.name} style={{
                      background: "white", borderRadius: 8,
                      borderRight: `3px solid ${appt.color}`,
                      border: "1px solid #e2e8f0",
                      borderRightWidth: 3,
                      borderRightColor: appt.color,
                      padding: "8px 10px",
                      opacity: apptOpacity,
                      transform: `translateY(${y}px)`,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }}>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>{appt.time}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{appt.name}</div>
                      <div style={{ fontSize: 10, color: appt.color, fontWeight: 600, marginTop: 2 }}>{appt.service}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <PainOverlay text="תורים נשכחים ברגע האחרון" fadeOutStart={35} fadeOutEnd={52} />
      <BenefitTag text="תזכורות WhatsApp אוטומטיות" appearAt={68} />
    </AbsoluteFill>
  );
};
