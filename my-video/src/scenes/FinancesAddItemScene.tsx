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
  { label: "שם השירות / מוצר *", value: "פגישת אילוף פרטית", delay: 90 },
  { label: "קטגוריה *", value: "אילוף", delay: 165, isSelect: true },
  { label: "מחיר *", value: "₪350", delay: 225 },
];

const UNIT_OPTIONS = ["לפגישה", "לשעה", "ליום", "מחיר קבוע"];

export const FinancesAddItemScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const backdropOpacity = interpolate(frame, [5, 16], [0, 1], { extrapolateRight: "clamp" });

  const modalProgress = spring({ frame: frame - 10, fps, config: { damping: 180 } });
  const modalScale = interpolate(modalProgress, [0, 1], [0.9, 1]);
  const modalOpacity = interpolate(frame, [10, 24], [0, 1], { extrapolateRight: "clamp" });

  // Spread animations across the ~22.8s voiceover
  // name@3s → category@5.5s → price@7.5s → unit@9.5s → dur/vat@11s → toggle@12.3s → link@16s → save@19.3s → toast@20.6s
  const unitOpacity = interpolate(frame, [285, 300], [0, 1], { extrapolateRight: "clamp" });
  const durationOpacity = interpolate(frame, [320, 335], [0, 1], { extrapolateRight: "clamp" });
  const vatOpacity = interpolate(frame, [345, 360], [0, 1], { extrapolateRight: "clamp" });
  const bookingToggleOpacity = interpolate(frame, [375, 392], [0, 1], { extrapolateRight: "clamp" });
  const paymentLinkOpacity = interpolate(frame, [480, 498], [0, 1], { extrapolateRight: "clamp" });
  const saveHighlight = interpolate(frame, [580, 598], [0, 1], { extrapolateRight: "clamp" });

  const toastOpacity = interpolate(frame, [618, 636], [0, 1], { extrapolateRight: "clamp" });
  const toastY = interpolate(
    spring({ frame: frame - 618, fps, config: { damping: 200 } }),
    [0, 1],
    [20, 0]
  );

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="פיננסים" />

      {/* Dimmed background */}
      <div style={{ marginRight: SIDEBAR_W, opacity: 0.28, pointerEvents: "none" }}>
        <div style={{ background: "white", height: 50, borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", padding: "0 24px" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>מחירון</span>
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
          padding: "20px 28px",
          width: 450,
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          direction: "rtl",
        }}
      >
        {/* Modal header */}
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הוסף פריט למחירון</h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#94a3b8" }}>הגדר שירות או מוצר חדש</p>
        </div>

        {/* Text fields */}
        {FIELDS.map((field) => {
          const fOpacity = interpolate(frame, [field.delay, field.delay + 14], [0, 1], { extrapolateRight: "clamp" });
          const fValue = frame >= field.delay + 14
            ? field.value
            : field.value.slice(0, Math.floor(interpolate(frame, [field.delay, field.delay + 14], [0, field.value.length], { extrapolateRight: "clamp" })));

          return (
            <div key={field.label} style={{ marginBottom: 10, opacity: fOpacity }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {field.label}
              </div>
              <div
                style={{
                  background: "#f8fafc",
                  border: `1.5px solid ${frame >= field.delay && frame < field.delay + 14 ? ORANGE : "#e2e8f0"}`,
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 14,
                  color: "#0f172a",
                  minHeight: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: field.isSelect ? "space-between" : "flex-start",
                }}
              >
                <span>{field.isSelect ? field.value : fValue}</span>
                {field.isSelect && <span style={{ color: "#94a3b8" }}>▾</span>}
                {!field.isSelect && frame >= field.delay && frame < field.delay + 14 && (
                  <span style={{ borderRight: "2px solid #ea580c", marginRight: 1 }} />
                )}
              </div>
            </div>
          );
        })}

        {/* Unit billing */}
        <div style={{ marginBottom: 10, opacity: unitOpacity }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            יחידת חיוב *
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {UNIT_OPTIONS.map((u, i) => (
              <span
                key={u}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  background: i === 0 ? "#0f172a" : "white",
                  color: i === 0 ? "white" : "#475569",
                  border: `1px solid ${i === 0 ? "#0f172a" : "#e2e8f0"}`,
                  borderRadius: 6,
                  padding: "5px 12px",
                  cursor: "pointer",
                }}
              >
                {u}
              </span>
            ))}
          </div>
        </div>

        {/* Duration + VAT row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1, opacity: durationOpacity }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              משך זמן
            </div>
            <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "#0f172a" }}>
              60 דקות
            </div>
          </div>
          <div style={{ flex: 1, opacity: vatOpacity, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 8 }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, background: "#e2e8f0", border: "1.5px solid #cbd5e1" }} />
              <span style={{ fontSize: 13, color: "#374151" }}>חייב מע"מ</span>
            </div>
          </div>
        </div>

        {/* Online booking toggle */}
        <div
          style={{
            opacity: bookingToggleOpacity,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f0fdf4",
            border: "1.5px solid #bbf7d0",
            borderRadius: 8,
            padding: "8px 14px",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Toggle switch ON */}
            <div
              style={{
                width: 36,
                height: 20,
                borderRadius: 10,
                background: "#16a34a",
                position: "relative",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "white",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#166534" }}>פעיל להזמנה אונליין</span>
          </div>
          <span style={{ fontSize: 11, color: "#16a34a" }}>לקוחות יכולים לקבוע תור</span>
        </div>

        {/* Payment link */}
        <div style={{ marginBottom: 12, opacity: paymentLinkOpacity }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            קישור תשלום
          </div>
          <div
            style={{
              background: "#f8fafc",
              border: "1.5px solid #e2e8f0",
              borderRadius: 8,
              padding: "9px 14px",
              fontSize: 12,
              color: "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span style={{ direction: "ltr", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#64748b" }}>
              https://app.cardcom.co.il/view/12345
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 10, color: "#94a3b8" }}>
            הדביקו קישור לדף תשלום שלכם — קארדקום, מורנינג, ביט וכו׳
          </p>
        </div>

        {/* Save button */}
        <div
          style={{
            background: ORANGE,
            color: "white",
            borderRadius: 8,
            padding: "12px",
            fontSize: 14,
            fontWeight: 700,
            textAlign: "center",
            cursor: "pointer",
            boxShadow: saveHighlight > 0.5 ? `0 4px 20px rgba(234,88,12,${saveHighlight * 0.5})` : "none",
            transform: `scale(${1 + saveHighlight * 0.02})`,
          }}
        >
          שמור פריט ←
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
        פגישת אילוף פרטית נוספה למחירון
      </div>
    </AbsoluteFill>
  );
};
