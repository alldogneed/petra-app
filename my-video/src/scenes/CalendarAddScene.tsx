// src/scenes/CalendarAddScene.tsx
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

const FIELDS = [
  { label: "לקוח", value: "דנה לוי" },
  { label: "שירות", value: "אילוף — 60 דק׳", highlight: true },
  { label: "תאריך", value: "14.04.2026" },
  { label: "שעה", value: "09:00" },
  { label: "הערות", value: "שיעור ראשון" },
];

export const CalendarAddScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const backdropOpacity = interpolate(frame, [8, 22], [0, 0.4], { extrapolateRight: "clamp" });

  const modalP = spring({ frame: frame - 18, fps, config: { damping: 180 } });
  const modalScale = interpolate(modalP, [0, 1], [0.88, 1]);
  const modalOpacity = interpolate(frame, [18, 32], [0, 1], { extrapolateRight: "clamp" });

  const newApptOpacity = interpolate(frame, [230, 248], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity, background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="יומן" />

      <div style={{
        position: "absolute",
        top: 0, right: 210, left: 0, bottom: 0,
        overflow: "hidden",
      }}>
        {/* Calendar background */}
        <div style={{ position: "absolute", inset: 0, background: "white", opacity: 0.6 }} />

        {/* New appointment appears after save */}
        <div style={{
          position: "absolute",
          top: 110, right: 230,
          width: 120, padding: "6px 10px",
          background: `${ORANGE}20`,
          border: `1.5px solid ${ORANGE}`,
          borderRadius: 6,
          opacity: newApptOpacity,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: ORANGE }}>09:00 אילוף</div>
          <div style={{ fontSize: 10, color: "#475569" }}>דנה לוי</div>
        </div>

        {/* Backdrop */}
        <div style={{
          position: "absolute", inset: 0,
          background: `rgba(15,23,42,${backdropOpacity})`,
          zIndex: 2,
        }} />

        {/* Modal */}
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          transform: `translate(-50%, -50%) scale(${modalScale})`,
          opacity: modalOpacity,
          zIndex: 3,
          background: "white",
          borderRadius: 18,
          padding: "28px 28px 24px",
          width: 400,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          direction: "rtl",
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 20 }}>הוסף תור</div>

          {FIELDS.map((f, i) => {
            const delay = 28 + i * 10;
            const fOpacity = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div key={f.label} style={{ marginBottom: 12, opacity: fOpacity }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>{f.label}</div>
                <div style={{
                  border: f.highlight ? `2px solid ${ORANGE}` : "1.5px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "9px 13px",
                  background: f.highlight ? "rgba(234,88,12,0.04)" : "#fafafa",
                  fontSize: 14,
                  color: f.highlight ? ORANGE : "#0f172a",
                  fontWeight: f.highlight ? 700 : 400,
                }}>
                  {f.value}
                </div>
              </div>
            );
          })}

          <div style={{
            marginTop: 18,
            background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
            borderRadius: 12, padding: "13px 0",
            textAlign: "center",
            boxShadow: "0 4px 16px rgba(234,88,12,0.35)",
          }}>
            <span style={{ color: "white", fontSize: 15, fontWeight: 800 }}>שמור</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
