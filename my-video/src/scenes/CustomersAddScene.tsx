import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;
const ORANGE = "#ea580c";

const FIELDS = [
  { label: "שם מלא *", value: "שרה מזרחי", delay: 40 },
  { label: "טלפון *", value: "054-123-4567", delay: 60 },
  { label: "אימייל", value: "sara.mizrahi@gmail.com", delay: 80 },
  { label: "כתובת", value: "תל אביב", delay: 96 },
];

export const CustomersAddScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  // Modal entrance
  const modalProgress = spring({ frame: frame - 10, fps, config: { damping: 180 } });
  const modalScale = interpolate(modalProgress, [0, 1], [0.9, 1]);
  const modalOpacity = interpolate(frame, [10, 25], [0, 1], { extrapolateRight: "clamp" });

  // Backdrop
  const backdropOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });

  // Tag badge
  const tagOpacity = interpolate(frame, [110, 124], [0, 1], { extrapolateRight: "clamp" });

  // Save button highlight
  const saveHighlight = interpolate(frame, [130, 142], [0, 1], { extrapolateRight: "clamp" });

  // Toast
  const toastOpacity = interpolate(frame, [150, 162], [0, 1], { extrapolateRight: "clamp" });
  const toastY = interpolate(
    spring({ frame: frame - 150, fps, config: { damping: 200 } }),
    [0, 1],
    [20, 0]
  );

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="לקוחות" />

      {/* Background page (dimmed) */}
      <div style={{ marginRight: SIDEBAR_W, opacity: 0.3, pointerEvents: "none" }}>
        <div style={{ background: "white", height: 60, borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", padding: "0 32px", gap: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#0f172a" }}>לקוחות</span>
        </div>
      </div>

      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          marginRight: SIDEBAR_W,
          background: "rgba(15,23,42,0.5)",
          opacity: backdropOpacity,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: `calc(50% - ${SIDEBAR_W / 2}px)`,
          transform: `translate(-50%, -50%) scale(${modalScale})`,
          opacity: modalOpacity,
          background: "white",
          borderRadius: 16,
          padding: "28px 32px",
          width: 440,
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          direction: "rtl",
        }}
      >
        {/* Modal header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>לקוח חדש</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>הוסף לקוח למערכת</p>
        </div>

        {/* Fields */}
        {FIELDS.map((field) => {
          const fieldOpacity = interpolate(frame, [field.delay, field.delay + 14], [0, 1], { extrapolateRight: "clamp" });
          const fieldValue = frame >= field.delay + 14 ? field.value : field.value.slice(0, Math.floor(interpolate(frame, [field.delay, field.delay + 14], [0, field.value.length], { extrapolateRight: "clamp" })));
          return (
            <div key={field.label} style={{ marginBottom: 16, opacity: fieldOpacity }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{field.label}</div>
              <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "#0f172a", minHeight: 40 }}>
                {fieldValue}
                {frame >= field.delay && frame < field.delay + 14 && (
                  <span style={{ borderRight: "2px solid #ea580c", marginRight: 1, animation: "blink 1s step-end infinite" }} />
                )}
              </div>
            </div>
          );
        })}

        {/* Tags */}
        <div style={{ marginBottom: 16, opacity: tagOpacity }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>תגיות לקוח</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["VIP", "קבוע", "מזדמן", "פוטנציאל", "לשעבר", "עסקי"].map((tag, i) => (
              <span
                key={tag}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  background: i === 1 ? "#0f172a" : "white",
                  color: i === 1 ? "white" : "#475569",
                  border: `1px solid ${i === 1 ? "#0f172a" : "#e2e8f0"}`,
                  borderRadius: 6,
                  padding: "4px 10px",
                  cursor: "pointer",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Source */}
        <div style={{ marginBottom: 20, opacity: tagOpacity }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>מקור הגעה</div>
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 13,
              color: "#94a3b8",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>— לא ידוע —</span>
            <span>▾</span>
          </div>
        </div>

        {/* Save button */}
        <div style={{ display: "flex", gap: 10 }}>
          <div
            style={{
              flex: 1,
              background: ORANGE,
              color: "white",
              borderRadius: 8,
              padding: "11px",
              fontSize: 14,
              fontWeight: 700,
              textAlign: "center",
              cursor: "pointer",
              boxShadow: saveHighlight > 0.5 ? `0 4px 20px rgba(234,88,12,${saveHighlight * 0.5})` : "none",
              transform: `scale(${1 + saveHighlight * 0.02})`,
            }}
          >
            הוסף לקוח ←
          </div>
          <div
            style={{
              padding: "11px 18px",
              fontSize: 13,
              color: "#64748b",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            ביטול
          </div>
        </div>
      </div>

      {/* Success toast */}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          left: "50%",
          transform: `translateX(-50%) translateY(${toastY}px)`,
          opacity: toastOpacity,
          background: "#0f172a",
          color: "white",
          borderRadius: 12,
          padding: "12px 20px",
          fontSize: 13,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          whiteSpace: "nowrap",
        }}
      >
        שרה מזרחי נוספה בהצלחה
        <span style={{ color: "#22c55e", marginRight: 8, borderRight: "1px solid rgba(255,255,255,0.2)", paddingRight: 8 }}>שלח ברוכים הבאים בוואטסאפ ↗</span>
      </div>
    </AbsoluteFill>
  );
};
