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

const CATEGORIES = ["פנסיון", "אילוף", "טיפוח", "מוצרים"];

export const OrdersItemsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const modalOpacity = interpolate(frame, [8, 20], [0, 1], { extrapolateRight: "clamp" });
  const modalProgress = spring({ frame: frame - 8, fps, config: { damping: 200 } });
  const modalScale = interpolate(modalProgress, [0, 1], [0.94, 1]);

  const item1Opacity = interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" });
  const item1Progress = spring({ frame: frame - 30, fps, config: { damping: 200 } });
  const item1Y = interpolate(item1Progress, [0, 1], [16, 0]);

  const qtyOpacity = interpolate(frame, [100, 115], [0, 1], { extrapolateRight: "clamp" });
  const refOpacity = interpolate(frame, [200, 220], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="פיננסים" />

      <div style={{
        position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0,
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center",
          flexShrink: 0,
          opacity: interpolate(frame, [5, 15], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הזמנות</div>
        </div>

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
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>בחירת פריטים</div>
              <div style={{
                background: "#f1f5f9", borderRadius: 99,
                padding: "2px 10px", fontSize: 11, color: "#64748b", fontWeight: 600,
                marginRight: "auto",
              }}>
                שלב 3 מתוך 3
              </div>
            </div>

            {/* Category chips */}
            <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
              {CATEGORIES.map((cat) => (
                <div key={cat} style={{
                  borderRadius: 99, padding: "5px 14px",
                  fontSize: 12, fontWeight: 600,
                  background: cat === "פנסיון" ? ORANGE : "#f1f5f9",
                  color: cat === "פנסיון" ? "white" : "#64748b",
                  border: cat === "פנסיון" ? "none" : "1px solid #e2e8f0",
                }}>
                  {cat}
                </div>
              ))}
            </div>

            {/* Item row */}
            <div style={{
              opacity: item1Opacity,
              transform: `translateY(${item1Y}px)`,
              border: "1.5px solid #e2e8f0", borderRadius: 12,
              padding: "14px 16px",
              display: "flex", alignItems: "center", gap: 12,
              marginBottom: 10,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>לינה פנסיון</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>לילה × כלב</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>₪150</div>

              {/* Quantity control */}
              <div style={{ opacity: qtyOpacity, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  border: "1.5px solid #e2e8f0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, color: "#64748b", cursor: "pointer",
                }}>−</div>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", minWidth: 20, textAlign: "center" }}>3</span>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: ORANGE, color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700, cursor: "pointer",
                }}>+</div>
              </div>

              <div style={{ fontSize: 14, fontWeight: 800, color: ORANGE, minWidth: 60, textAlign: "left" }}>
                ₪450
              </div>
            </div>

            {/* Total */}
            <div style={{
              opacity: item1Opacity,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 4px",
              borderTop: "1px solid #f1f5f9",
            }}>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>סה"כ לתשלום</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>₪450</span>
            </div>

            {/* Reference label */}
            <div style={{
              opacity: refOpacity,
              background: "#f8fafc",
              borderRadius: 8, padding: "8px 12px",
              marginTop: 8,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 13 }}>💡</span>
              <span style={{ fontSize: 11, color: "#64748b" }}>
                המחירון מוגדר במערכת הפיננסים
              </span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
