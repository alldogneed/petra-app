// src/scenes/AdminSubscriptionScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { AdminTabBar } from "./AdminTabBar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const BILLING = [
  { date: "01.04.2026", description: "חיוב חודשי PRO", amount: "₪149", status: "שולם" },
  { date: "01.03.2026", description: "חיוב חודשי PRO", amount: "₪149", status: "שולם" },
  { date: "01.02.2026", description: "חיוב חודשי PRO", amount: "₪149", status: "שולם" },
];

export const AdminSubscriptionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 60, [0, 30, 60], [0, 1, 0]);
  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const cardP = spring({ frame: frame - 25, fps, config: { damping: 200 } });
  const cardY = interpolate(cardP, [0, 1], [24, 0]);
  const cardOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול ובקרה" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", opacity: 0.6 + pulse * 0.4 }} />
            <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>ניטור פעיל</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>ניהול ובקרה</div>
        </div>
        <AdminTabBar activeTab="מנוי וחיוב" />

        <div style={{ padding: "20px 24px" }}>
          {/* Subscription card */}
          <div style={{
            background: "white", borderRadius: 14,
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            borderTop: `3px solid ${ORANGE}`,
            padding: "20px 22px", marginBottom: 18,
            opacity: cardOpacity, transform: `translateY(${cardY}px)`,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  background: `${ORANGE}18`, color: ORANGE,
                  fontSize: 13, fontWeight: 800, padding: "4px 12px", borderRadius: 99,
                }}>תוכנית PRO</span>
                <span style={{
                  background: "#dcfce7", color: "#16a34a",
                  fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
                }}>פעיל</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>₪149<span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>/חודש</span></div>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>מתחדש ב-01.05.2026</div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(234,88,12,0.08)", borderRadius: 8, padding: "6px 12px", marginTop: 6,
            }}>
              <span style={{ fontSize: 12, color: ORANGE, fontWeight: 700 }}>23 ימים שנותרו</span>
            </div>
          </div>

          {/* Billing history */}
          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>היסטוריית חיוב</span>
            </div>
            {BILLING.map((item, i) => {
              const startFrame = 90 + i * 22;
              const rowP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const rowY = interpolate(rowP, [0, 1], [16, 0]);
              const rowOpacity = interpolate(frame, [startFrame, startFrame + 14], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={item.date} style={{
                  display: "flex", alignItems: "center", padding: "11px 18px",
                  borderBottom: i < BILLING.length - 1 ? "1px solid #f8fafc" : "none",
                  opacity: rowOpacity, transform: `translateY(${rowY}px)`,
                }}>
                  <div style={{ flex: 1, fontSize: 12, color: "#64748b" }}>{item.date}</div>
                  <div style={{ flex: 2, fontSize: 13, color: "#1e293b" }}>{item.description}</div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{item.amount}</div>
                  <div style={{
                    fontSize: 11, fontWeight: 700,
                    padding: "3px 10px", borderRadius: 99,
                    background: "#dcfce7", color: "#16a34a",
                  }}>
                    ✓ {item.status}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
