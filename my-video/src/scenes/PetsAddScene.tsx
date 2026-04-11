// src/scenes/PetsAddScene.tsx
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
  { label: "שם החיה", value: "פיפי" },
  { label: "גזע", value: "תוכי אמזוני" },
  { label: "מין", value: "נקבה" },
  { label: "תאריך לידה", value: "05.06.2022" },
  { label: "מיקרוצ'יפ", value: "972000098765", optional: true },
];

export const PetsAddScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  // Backdrop fades in
  const backdropOpacity = interpolate(frame, [8, 22], [0, 0.45], { extrapolateRight: "clamp" });

  // Modal springs in
  const modalP = spring({ frame: frame - 18, fps, config: { damping: 180 } });
  const modalScale = interpolate(modalP, [0, 1], [0.88, 1]);
  const modalOpacity = interpolate(frame, [18, 32], [0, 1], { extrapolateRight: "clamp" });

  // New pet card appears after modal
  const newCardOpacity = interpolate(frame, [200, 216], [0, 1], { extrapolateRight: "clamp" });
  const newCardP = spring({ frame: frame - 200, fps, config: { damping: 200 } });
  const newCardY = interpolate(newCardP, [0, 1], [16, 0]);

  return (
    <AbsoluteFill style={{ opacity, background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>
      {/* Sidebar */}
      <PetraSidebar activeLabel="לקוחות" />

      {/* Content area */}
      <div style={{
        position: "absolute",
        top: 0, right: 210, left: 0, bottom: 0,
        overflow: "hidden",
      }}>
        {/* Customer mini-card (top right of content) */}
        <div style={{
          position: "absolute",
          top: 16, right: 20,
          background: "white",
          borderRadius: 12,
          padding: "12px 16px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          display: "flex", alignItems: "center", gap: 10,
          direction: "rtl",
          zIndex: 1,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "white", fontSize: 14, fontWeight: 700 }}>ר</span>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>רחל כהן</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>לקוחה</div>
          </div>
        </div>

        {/* New pet card — appears after save */}
        <div style={{
          position: "absolute",
          bottom: 32, right: 20,
          opacity: newCardOpacity,
          transform: `translateY(${newCardY}px)`,
          background: "white",
          borderRadius: 12,
          padding: "12px 16px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          display: "flex", alignItems: "center", gap: 10,
          direction: "rtl",
          zIndex: 1,
          borderRight: `3px solid ${ORANGE}`,
        }}>
          <span style={{ fontSize: 24 }}>🐦</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>פיפי</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>תוכי אמזוני · 3 שנים</div>
          </div>
          <div style={{
            background: "#22c55e",
            color: "white",
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 8,
            padding: "2px 8px",
            marginRight: "auto",
          }}>חדש</div>
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
          {/* Modal header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>הוסף חיית מחמד</div>
          </div>

          {/* Species dropdown — highlighted orange */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 5 }}>סוג</div>
            <div style={{
              border: `2px solid ${ORANGE}`,
              borderRadius: 10,
              padding: "10px 14px",
              background: "rgba(234,88,12,0.04)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: ORANGE }}>ציפור</span>
              <span style={{ fontSize: 12, color: ORANGE }}>▾</span>
            </div>
          </div>

          {/* Other fields */}
          {FIELDS.map((f, i) => {
            const fieldDelay = 45 + i * 10;
            const fieldOpacity = interpolate(frame, [fieldDelay, fieldDelay + 12], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div key={f.label} style={{ marginBottom: 12, opacity: fieldOpacity }}>
                <div style={{ fontSize: 12, color: f.optional ? "#94a3b8" : "#64748b", fontWeight: 600, marginBottom: 4 }}>
                  {f.label}{f.optional ? " (אופציונלי)" : ""}
                </div>
                <div style={{
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "9px 13px",
                  background: "#fafafa",
                  fontSize: 14, color: "#0f172a",
                }}>
                  {f.value}
                </div>
              </div>
            );
          })}

          {/* Save button */}
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
