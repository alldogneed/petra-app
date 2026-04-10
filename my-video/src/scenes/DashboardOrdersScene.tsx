// src/scenes/DashboardOrdersScene.tsx
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

const ORDERS = [
  { customer: "דני כהן / מקס",          date: "היום",  service: "אילוף בסיסי ×4",     amount: "₪480",    paid: true },
  { customer: "שרה לוי / בלה",           date: "אתמול", service: "טיפוח ועיצוב",       amount: "₪180",    paid: false },
  { customer: "מיכל ברנשטיין / רקי",     date: "23/03", service: "חבילת אילוף מלאה",  amount: "₪1,200",  paid: true },
  { customer: "דוד אברהם / קפה",         date: "21/03", service: "פנסיון 3 לילות",    amount: "₪360",    paid: false },
  { customer: "יוסי מזרחי / לונה",       date: "18/03", service: "בדיקת בריאות",      amount: "₪220",    paid: true },
];

export const DashboardOrdersScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const calloutOpacity = interpolate(frame, [250, 270], [0, 1], { extrapolateRight: "clamp" });

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
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 14, opacity: headerOpacity,
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>הזמנות אחרונות</div>
            <div style={{ fontSize: 12, color: ORANGE, fontWeight: 700 }}>לכל ההזמנות ←</div>
          </div>

          {/* Orders table card */}
          <div style={{
            background: "white", borderRadius: 16,
            border: "1px solid #e2e8f0", overflow: "hidden",
            marginBottom: 16,
          }}>
            {/* Table header */}
            <div style={{
              display: "grid", gridTemplateColumns: "2fr 0.8fr 2fr 0.8fr 0.9fr",
              padding: "10px 18px", background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
              opacity: headerOpacity,
            }}>
              {["לקוח / חיה", "תאריך", "שירות", "סכום", "סטטוס"].map((h) => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>{h}</div>
              ))}
            </div>

            {/* Order rows */}
            {ORDERS.map((order, i) => {
              const startFrame = 25 + i * 30;
              const rowP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const rowX = interpolate(rowP, [0, 1], [-40, 0]);
              const rowOpacity = interpolate(frame, [startFrame, startFrame + 18], [0, 1], { extrapolateRight: "clamp" });

              return (
                <div key={order.customer} style={{
                  display: "grid", gridTemplateColumns: "2fr 0.8fr 2fr 0.8fr 0.9fr",
                  alignItems: "center", padding: "11px 18px",
                  borderBottom: i < ORDERS.length - 1 ? "1px solid #f1f5f9" : "none",
                  opacity: rowOpacity,
                  transform: `translateX(${rowX}px)`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{order.customer}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{order.date}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{order.service}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{order.amount}</div>
                  <div style={{
                    fontSize: 11, fontWeight: 700,
                    color: order.paid ? "#16a34a" : "#d97706",
                    background: order.paid ? "rgba(22,163,74,0.08)" : "rgba(217,119,6,0.08)",
                    borderRadius: 99, padding: "3px 8px", display: "inline-block",
                  }}>
                    {order.paid ? "✓ שולם" : "⏳ ממתין"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary callout */}
          <div style={{
            display: "flex", gap: 24, alignItems: "center",
            background: "white", borderRadius: 12,
            border: "1px solid #e2e8f0", padding: "12px 18px",
            opacity: calloutOpacity,
          }}>
            <div>
              <div style={{ fontSize: 11, color: "#64748b" }}>שולם החודש</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#16a34a" }}>₪2,440</div>
            </div>
            <div style={{ width: 1, height: 32, background: "#e2e8f0" }} />
            <div>
              <div style={{ fontSize: 11, color: "#64748b" }}>ממתין לגביה</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#d97706" }}>₪540</div>
            </div>
            <div style={{ fontSize: 11, color: "#64748b", flex: 1, textAlign: "left" }}>
              שלחו דרישת תשלום ישירות בוואטסאפ
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
