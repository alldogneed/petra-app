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

export const OrdersCustomerScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });
  const modalProgress = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const modalScale = interpolate(modalProgress, [0, 1], [0.94, 1]);
  const modalOpacity = interpolate(frame, [10, 22], [0, 1], { extrapolateRight: "clamp" });

  // Fields animate in sequence across the full voiceover duration
  const customerOpacity = interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" });
  const customerHighlight = interpolate(frame, [45, 80], [0, 1], { extrapolateRight: "clamp" });
  const petOpacity = interpolate(frame, [90, 105], [0, 1], { extrapolateRight: "clamp" });
  const checkInOpacity = interpolate(frame, [140, 155], [0, 1], { extrapolateRight: "clamp" });
  const checkOutOpacity = interpolate(frame, [175, 190], [0, 1], { extrapolateRight: "clamp" });
  const summaryOpacity = interpolate(frame, [220, 240], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="פיננסים" />

      <div style={{
        position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0,
        display: "flex", flexDirection: "column",
      }}>
        {/* Topbar */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center",
          opacity: headerOpacity, flexShrink: 0,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הזמנות</div>
        </div>

        {/* Modal overlay */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(15,23,42,0.45)",
          opacity: modalOpacity,
        }}>
          <div style={{
            background: "white", borderRadius: 20,
            padding: "28px 32px", width: 520,
            transform: `scale(${modalScale})`,
            boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
            direction: "rtl",
          }}>
            {/* Modal header with step indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הזמנת פנסיון</div>
              <div style={{
                background: "#f1f5f9", borderRadius: 99,
                padding: "2px 10px", fontSize: 11, color: "#64748b", fontWeight: 600,
                marginRight: "auto",
              }}>
                שלב 2 מתוך 3
              </div>
            </div>

            {/* Customer field */}
            <div style={{ marginBottom: 16, opacity: customerOpacity }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                לקוח *
              </label>
              <div style={{
                border: `2px solid ${customerHighlight > 0.7 ? ORANGE : "#e2e8f0"}`,
                borderRadius: 10, padding: "10px 14px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "white",
                boxShadow: customerHighlight > 0.7 ? `0 0 0 3px rgba(234,88,12,0.12)` : "none",
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>דנה כהן</span>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>054-321-8876</span>
              </div>
            </div>

            {/* Pet selection */}
            <div style={{ marginBottom: 16, opacity: petOpacity }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                כלב *
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{
                  borderRadius: 10, padding: "10px 14px",
                  border: `2px solid ${ORANGE}`,
                  background: "rgba(234,88,12,0.05)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: ORANGE, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>מקס</span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>גולדן רטריבר</span>
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>זכר • 3 שנים</span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#22c55e", marginTop: 6, fontWeight: 500 }}>
                ✓ כלב נבחר אוטומטית
              </div>
            </div>

            {/* Dates row */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, opacity: checkInOpacity }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                  כניסה
                </label>
                <div style={{
                  border: "1.5px solid #e2e8f0", borderRadius: 10,
                  padding: "10px 14px", background: "white",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>08.04.2026</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>12:00</div>
                </div>
              </div>
              <div style={{ flex: 1, opacity: checkOutOpacity }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                  יציאה
                </label>
                <div style={{
                  border: "1.5px solid #e2e8f0", borderRadius: 10,
                  padding: "10px 14px", background: "white",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>11.04.2026</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>12:00</div>
                </div>
              </div>
            </div>

            {/* Auto-calculated summary */}
            <div style={{
              opacity: summaryOpacity,
              background: "rgba(234,88,12,0.06)",
              border: "1.5px solid rgba(234,88,12,0.2)",
              borderRadius: 10, padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>3 לילות • 1 כלב</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>חושב אוטומטית לפי תאריכי הכניסה והיציאה</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
