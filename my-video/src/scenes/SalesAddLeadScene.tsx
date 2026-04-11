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

function typingText(fullText: string, frame: number, startFrame: number, speed = 0.55): string {
  return fullText.slice(0, Math.floor(Math.max(0, frame - startFrame) * speed));
}

export const SalesAddLeadScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.6], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.6, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const modalProgress = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const modalScale = interpolate(modalProgress, [0, 1], [0.92, 1]);
  const modalOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });

  const nameText = typingText("ענבל כהן", frame, 32, 0.6);
  const phoneText = typingText("054-321-8876", frame, 78, 0.65);
  const dogText = typingText("קיירה", frame, 122, 0.7);

  const nameActive = frame >= 28 && frame < 74;
  const phoneActive = frame >= 74 && frame < 118;
  const dogActive = frame >= 118 && frame < 154;
  const serviceActive = frame >= 154 && frame < 186;
  const sourceActive = frame >= 186 && frame < 215;

  const serviceValue = frame >= 168 ? "אילוף גורים" : "";
  const sourceValue = frame >= 200 ? "אתר" : "";

  const savePulse = interpolate(frame, [218, 223, 230], [1, 0.93, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const successOpacity = interpolate(frame, [233, 246], [0, 1], { extrapolateRight: "clamp" });
  const successScale = spring({ frame: frame - 233, fps, config: { damping: 200 } });

  const cursor = Math.floor(frame / 14) % 2 === 0;

  const Field = ({ label, value, placeholder, active, isSelect }: {
    label: string; value: string; placeholder: string; active?: boolean; isSelect?: boolean;
  }) => (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</div>
      <div style={{
        border: `1.5px solid ${active ? ORANGE : "#e2e8f0"}`,
        borderRadius: 8, padding: "9px 12px",
        fontSize: 13, color: value ? "#0f172a" : "#94a3b8",
        background: active ? "#fff7ed" : "white",
        boxShadow: active ? "0 0 0 3px rgba(234,88,12,0.1)" : "none",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span>{value || placeholder}</span>
        {active && cursor && (
          <span style={{ width: 2, height: 15, background: ORANGE, display: "inline-block" }} />
        )}
        {isSelect && !active && <span style={{ color: "#94a3b8", fontSize: 10 }}>▼</span>}
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} />

      {/* BG */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, background: "#f8fafc" }} />
      {/* Overlay */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, background: "rgba(15,23,42,0.4)", opacity: modalOpacity }} />

      {/* Modal */}
      <div style={{
        position: "absolute",
        top: "50%",
        right: SIDEBAR_W + (1280 - SIDEBAR_W) / 2,
        transform: `translate(50%, -50%) scale(${modalScale})`,
        background: "white",
        borderRadius: 16,
        width: 460,
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        opacity: modalOpacity,
        direction: "rtl",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 24px 14px",
          borderBottom: "1px solid #f1f5f9",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0, marginBottom: 2 }}>ליד חדש</h2>
            <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>הוספת ליד ידנית למערכת</p>
          </div>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#64748b" }}>×</div>
        </div>

        {/* Form */}
        <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="שם מלא *" value={nameText} placeholder="שם הליד" active={nameActive} />
          <Field label="טלפון *" value={phoneText} placeholder="050-000-0000" active={phoneActive} />
          <Field label="שם הכלב 🐾" value={dogText} placeholder="שם הכלב (אופציונלי)" active={dogActive} />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label="שירות מבוקש" value={serviceValue} placeholder="בחרו שירות" active={serviceActive} isSelect />
            </div>
            <div style={{ flex: 1 }}>
              <Field label="מקור הליד" value={sourceValue} placeholder="בחרו מקור" active={sourceActive} isSelect />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 24px 18px",
          borderTop: "1px solid #f1f5f9",
          display: "flex", gap: 8, alignItems: "center",
          opacity: interpolate(frame, [18, 30], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          <div style={{
            background: ORANGE, color: "white", borderRadius: 8,
            padding: "9px 22px", fontSize: 13, fontWeight: 700,
            transform: `scale(${savePulse})`,
            boxShadow: "0 2px 8px rgba(234,88,12,0.3)",
          }}>
            שמירה
          </div>
          <div style={{ background: "#f1f5f9", color: "#64748b", borderRadius: 8, padding: "9px 14px", fontSize: 13 }}>
            ביטול
          </div>
        </div>
      </div>

      {/* Success toast */}
      {frame >= 233 && (
        <div style={{
          position: "absolute",
          bottom: 36,
          left: "50%",
          transform: `translateX(-50%) scale(${successScale})`,
          opacity: successOpacity,
          background: "#16a34a",
          color: "white",
          borderRadius: 12,
          padding: "12px 22px",
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 14, fontWeight: 700,
          boxShadow: "0 4px 20px rgba(22,163,74,0.35)",
          direction: "rtl", whiteSpace: "nowrap",
        }}>
          <span>✓</span>
          <span>ענבל (קיירה) נוסף בהצלחה לעמודת "ליד חדש"</span>
        </div>
      )}
    </AbsoluteFill>
  );
};
