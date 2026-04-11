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
import { CursorAnimation } from "../../components/teaser/CursorAnimation";

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
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [52, 65], [0, 1], { extrapolateRight: "clamp" });
  const gridOpacity = interpolate(frame, [55, 68], [0, 1], { extrapolateRight: "clamp" });
  const sidebarBlur = interpolate(frame, [52, 70], [0, 3.5], { extrapolateRight: "clamp" });

  // Zoom toward appointment area (day 0 column, right side)
  const zoomP = spring({ frame: frame - 54, fps, config: { damping: 320, stiffness: 45 } });
  const zoomScale = interpolate(zoomP, [0, 1], [1.0, 1.14]);

  return (
    <AbsoluteFill style={{ background: "#f8fafc", fontFamily: FONT, direction: "rtl" }}>
      {/* Sidebar with blur */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SIDEBAR_W, filter: `blur(${sidebarBlur}px)` }}>
        <PetraSidebar width={SIDEBAR_W} activeLabel="יומן" />
      </div>

      {/* Zoomable content */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
        <div style={{ transform: `scale(${zoomScale})`, transformOrigin: "78% 45%", width: "100%", height: "100%" }}>

          {/* Header */}
          <div style={{
            background: "white", borderBottom: "1px solid #e2e8f0",
            padding: "0 24px", height: 52,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            opacity: headerOpacity, flexShrink: 0,
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>יומן תורים</div>
            <div style={{ background: ORANGE, color: "white", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700 }}>
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
                <div key={day} style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "#0f172a", textAlign: "center" }}>
                  {day}
                </div>
              ))}
            </div>

            {/* Grid body */}
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, padding: "8px 16px", alignItems: "start" }}>
              {DAYS.map((day, dayIdx) => (
                <div key={day} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 4px" }}>
                  {APPTS.filter((a) => a.day === dayIdx).map((appt, ai) => {
                    const p = spring({ frame: frame - appt.delay, fps, config: { damping: 200 } });
                    const y = interpolate(p, [0, 1], [14, 0]);
                    const apptOpacity = interpolate(frame, [appt.delay, appt.delay + 10], [0, 1], { extrapolateRight: "clamp" });

                    // Glow on first appointment in day 0
                    const isHighlighted = dayIdx === 0 && ai === 0;
                    const glowP = isHighlighted ? interpolate(frame, [appt.delay + 8, appt.delay + 35], [0, 1], { extrapolateRight: "clamp" }) : 0;
                    const glowOpacity = isHighlighted ? interpolate(glowP, [0, 0.3, 1], [0, 1, 0]) : 0;

                    return (
                      <div key={appt.name} style={{
                        background: "white", borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        borderRight: `3px solid ${appt.color}`,
                        padding: "8px 10px",
                        opacity: apptOpacity,
                        transform: `translateY(${y}px)`,
                        boxShadow: glowOpacity > 0.05
                          ? `0 0 14px rgba(234,88,12,${glowOpacity * 0.5})`
                          : "0 1px 3px rgba(0,0,0,0.05)",
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
      </div>

      {/* Cursor hovers on first appointment */}
      <CursorAnimation
        startX={640} startY={460}
        endX={900} endY={172}
        appearAt={60}
        clickAt={88}
      />

      <PainOverlay text="תורים נשכחים ברגע האחרון" fadeOutStart={35} fadeOutEnd={52} />
      <BenefitTag text="תזכורות WhatsApp אוטומטיות" appearAt={68} />
    </AbsoluteFill>
  );
};
