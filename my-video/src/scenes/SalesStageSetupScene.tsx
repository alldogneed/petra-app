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

const STAGE_ITEMS = [
  { color: "#ef4444", label: "ליד חדש", delay: 42 },
  { color: "#f59e0b", label: "ללא מענה", delay: 56 },
  { color: "#3b82f6", label: "נוצר קשר ראשוני", delay: 70 },
  { color: "#8b5cf6", label: "הוצג מחיר", isNew: true, delay: 84 },
  { color: "#22c55e", label: "תואם בבית הלקוח", delay: 98 },
];

export const SalesStageSetupScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.6], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.6, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const modalProgress = spring({ frame: frame - 8, fps, config: { damping: 200 } });
  const modalScale = interpolate(modalProgress, [0, 1], [0.92, 1]);
  const modalOpacity = interpolate(frame, [8, 22], [0, 1], { extrapolateRight: "clamp" });

  // New stage glow at frame 140
  const newGlow = interpolate(frame, [140, 158], [0, 1], { extrapolateRight: "clamp" });

  // Add button pulse at frame 130
  const addBtnScale = interpolate(frame, [130, 136, 144], [1, 0.92, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} />

      {/* Blurred BG */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, background: "#f8fafc" }} />
      {/* Overlay */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, background: "rgba(15,23,42,0.45)", opacity: modalOpacity }} />

      {/* Modal centered in content area */}
      <div style={{
        position: "absolute",
        top: "50%",
        right: SIDEBAR_W + (1280 - SIDEBAR_W) / 2,
        transform: `translate(50%, -50%) scale(${modalScale})`,
        background: "white",
        borderRadius: 16,
        width: 480,
        boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
        opacity: modalOpacity,
        direction: "rtl",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid #f1f5f9",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0, marginBottom: 3 }}>
              עריכת שלבים
            </h2>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
              התאימו את שלבי המכירה לעסק שלכם
            </p>
          </div>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "#f1f5f9", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 14, color: "#64748b", cursor: "pointer",
            flexShrink: 0, marginTop: 2,
          }}>×</div>
        </div>

        {/* Stage list */}
        <div style={{ padding: "14px 24px", display: "flex", flexDirection: "column", gap: 7 }}>
          {STAGE_ITEMS.map((stage, i) => {
            const itemOpacity = interpolate(frame, [stage.delay, stage.delay + 14], [0, 1], { extrapolateRight: "clamp" });
            const itemY = interpolate(
              spring({ frame: frame - stage.delay, fps, config: { damping: 200 } }),
              [0, 1], [10, 0]
            );
            const isNewStage = stage.isNew;
            const glow = isNewStage ? newGlow : 0;

            return (
              <div key={stage.label} style={{
                opacity: itemOpacity,
                transform: `translateY(${itemY}px)`,
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px",
                borderRadius: 9,
                border: `1.5px solid ${glow > 0.1 ? stage.color : "#e8edf2"}`,
                background: glow > 0.1 ? `${stage.color}08` : "#fafafa",
                boxShadow: glow > 0.5 ? `0 0 0 3px ${stage.color}20` : "none",
              }}>
                {/* Drag */}
                <span style={{ color: "#d1d5db", fontSize: 12, cursor: "grab", letterSpacing: 1 }}>⋮⋮</span>

                {/* Color dot */}
                <div style={{
                  width: 12, height: 12, borderRadius: "50%",
                  background: stage.color, flexShrink: 0,
                  boxShadow: glow > 0.5 ? `0 0 6px ${stage.color}80` : "none",
                }} />

                {/* Label */}
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{stage.label}</span>

                {/* New badge */}
                {isNewStage && glow > 0.3 && (
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    background: `${stage.color}20`, color: stage.color,
                    borderRadius: 4, padding: "2px 6px", opacity: glow,
                  }}>חדש</span>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 5 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#64748b" }}>✏️</div>
                  {i > 0 && i < STAGE_ITEMS.length - 1 && (
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#ef4444" }}>🗑️</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add stage */}
        <div style={{ padding: "0 24px 16px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "9px 12px",
            border: "1.5px dashed #e2e8f0",
            borderRadius: 9,
            color: "#94a3b8", fontSize: 12, fontWeight: 600,
            cursor: "pointer",
            opacity: interpolate(frame, [118, 130], [0, 1], { extrapolateRight: "clamp" }),
            transform: `scale(${addBtnScale})`,
          }}>
            <span style={{ fontSize: 15 }}>+</span>
            הוספת שלב חדש
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 24px 18px",
          borderTop: "1px solid #f1f5f9",
          display: "flex", gap: 8,
          opacity: interpolate(frame, [25, 38], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          <div style={{ background: ORANGE, color: "white", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            שמירה
          </div>
          <div style={{ background: "#f1f5f9", color: "#64748b", borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>
            ביטול
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
