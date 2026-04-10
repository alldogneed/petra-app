// src/scenes/DashboardAppointmentsScene.tsx
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

const APPOINTMENTS = [
  { time: "09:00", pet: "מקס (לברדור)",  service: "אילוף בסיסי",    owner: "דני כהן" },
  { time: "10:30", pet: "בלה (פינצ'ר)",  service: "טיפוח ועיצוב",   owner: "שרה לוי" },
  { time: "14:00", pet: "רקי (האסקי)",   service: "אילוף מתקדם",    owner: "מיכל ברנשטיין" },
  { time: "16:30", pet: "קפה (שפניה)",   service: "בדיקת בריאות",   owner: "דוד אברהם" },
];

export const DashboardAppointmentsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const calloutOpacity = interpolate(frame, [260, 280], [0, 1], { extrapolateRight: "clamp" });
  const calloutP = spring({ frame: frame - 260, fps, config: { damping: 200 } });
  const calloutY = interpolate(calloutP, [0, 1], [16, 0]);

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

        <div style={{ padding: "20px 24px" }}>

          {/* Section heading */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
            opacity: headerOpacity,
          }}>
            <div style={{ width: 4, height: 20, background: ORANGE, borderRadius: 2 }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>תורים קרובים</div>
          </div>

          {/* Appointments list */}
          <div style={{
            background: "white", borderRadius: 16,
            border: "1px solid #e2e8f0", overflow: "hidden",
            marginBottom: 20,
          }}>
            {APPOINTMENTS.map((appt, i) => {
              const startFrame = 25 + i * 40;
              const rowP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const rowX = interpolate(rowP, [0, 1], [-40, 0]);
              const rowOpacity = interpolate(frame, [startFrame, startFrame + 18], [0, 1], { extrapolateRight: "clamp" });

              return (
                <div key={appt.time} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                  borderBottom: i < APPOINTMENTS.length - 1 ? "1px solid #f1f5f9" : "none",
                  opacity: rowOpacity,
                  transform: `translateX(${rowX}px)`,
                }}>
                  {/* Time */}
                  <div style={{
                    background: "rgba(234,88,12,0.08)", borderRadius: 8,
                    padding: "5px 10px", fontSize: 13, fontWeight: 800, color: ORANGE,
                    flexShrink: 0, minWidth: 52, textAlign: "center",
                  }}>
                    {appt.time}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{appt.pet}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{appt.service} · {appt.owner}</div>
                  </div>
                  {/* WhatsApp button */}
                  <div style={{
                    background: "#22c55e", borderRadius: 8,
                    padding: "6px 12px", fontSize: 11, fontWeight: 700, color: "white",
                    flexShrink: 0,
                  }}>
                    💬
                  </div>
                </div>
              );
            })}
          </div>

          {/* WhatsApp callout */}
          <div style={{
            background: "rgba(34,197,94,0.07)",
            border: "1px solid rgba(34,197,94,0.3)",
            borderRadius: 12, padding: "14px 18px",
            opacity: calloutOpacity,
            transform: `translateY(${calloutY}px)`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#166534" }}>
              תזכורות WhatsApp אוטומטיות — פטרה שולחת תזכורת ללקוח 24–48 שעות לפני התור
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
