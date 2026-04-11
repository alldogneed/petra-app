import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;
const ORANGE = "#ea580c";

const STAT_CARDS = [
  { label: "סה\"כ הזמנות", value: "22", color: "#64748b", delay: 18 },
  { label: "טיוטות", value: "0", color: "#64748b", delay: 24 },
  { label: "פעילות", value: "20", color: "#3b82f6", delay: 30 },
  { label: "הושלמו", value: "1", color: "#22c55e", delay: 36 },
];

const ORDERS = [
  { id: "FD226115", customer: "ספיר מזרחי", type: "אילוף", status: "הושלמה", statusColor: "#22c55e", amount: "₪400", paid: "טרם שולם", delay: 52 },
  { id: "21519018", customer: "ליעד", type: "אילוף", status: "מאושרת", statusColor: "#3b82f6", amount: "₪350", paid: "טרם שולם", delay: 62 },
  { id: "6682F4F6", customer: "רחל גולד", type: "טיפוח", status: "מאושרת", statusColor: "#3b82f6", amount: "₪200", paid: "טרם שולם", delay: 72 },
  { id: "F586C16B", customer: "ספיר מזרחי", type: "פנסיון", status: "מאושרת", statusColor: "#3b82f6", amount: "₪100", paid: "טרם שולם", delay: 82 },
];

export const FinancesOrdersScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });
  const filterOpacity = interpolate(frame, [40, 52], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="פיננסים" />

      <div style={{ marginRight: SIDEBAR_W, display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Tabs */}
        <div style={{ background: "white", borderBottom: "1px solid #e2e8f0", display: "flex", opacity: headerOpacity }}>
          {[
            { tab: "מחירון", active: false },
            { tab: "הזמנות", active: true },
            { tab: "בקשות תשלום", active: false },
            { tab: "תשלומים", active: false },
          ].map(({ tab, active }) => (
            <div
              key={tab}
              style={{
                padding: "14px 22px",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? ORANGE : "#64748b",
                borderBottom: active ? `2px solid ${ORANGE}` : "2px solid transparent",
                whiteSpace: "nowrap",
              }}
            >
              {tab}
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflow: "hidden", padding: "20px 28px" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 18,
              opacity: headerOpacity,
            }}
          >
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ background: ORANGE, color: "white", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <span>+</span> הזמנה חדשה
              </div>
              <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>
                ↓ ייצוא
              </div>
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>הזמנות</h1>
          </div>

          {/* Stat cards */}
          <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
            {STAT_CARDS.map((card) => {
              const cOpacity = interpolate(frame, [card.delay, card.delay + 12], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div
                  key={card.label}
                  style={{
                    flex: 1,
                    background: "white",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    padding: "14px 16px",
                    opacity: cOpacity,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{card.label}</span>
                  <span style={{ fontSize: 26, fontWeight: 800, color: card.color }}>{card.value}</span>
                </div>
              );
            })}
          </div>

          {/* Filters */}
          <div
            style={{
              background: "white",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              padding: "12px 16px",
              marginBottom: 14,
              opacity: filterOpacity,
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {["כל הסטטוסים", "טיוטות", "מאושרות", "הושלמו", "בוטלו"].map((s, i) => (
              <span
                key={s}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "5px 12px",
                  borderRadius: 6,
                  background: i === 0 ? ORANGE : "#f1f5f9",
                  color: i === 0 ? "white" : "#475569",
                  cursor: "pointer",
                }}
              >
                {s}
              </span>
            ))}
            <div style={{ marginRight: "auto", display: "flex", gap: 8 }}>
              {["היום", "השבוע", "החודש", "הכל"].map((t, i) => (
                <span
                  key={t}
                  style={{
                    fontSize: 12,
                    padding: "5px 10px",
                    borderRadius: 6,
                    background: i === 3 ? "#0f172a" : "#f1f5f9",
                    color: i === 3 ? "white" : "#64748b",
                    cursor: "pointer",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Orders table */}
          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr 80px 100px 90px 80px",
                padding: "10px 16px",
                borderBottom: "1px solid #e2e8f0",
                opacity: filterOpacity,
              }}
            >
              {["מס' הזמנה", "לקוח", "סוג", "סטטוס", "סה\"כ", "תשלום"].map((h) => (
                <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textAlign: "right" }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            {ORDERS.map((order) => {
              const rOpacity = interpolate(frame, [order.delay, order.delay + 12], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div
                  key={order.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 1fr 80px 100px 90px 80px",
                    padding: "10px 16px",
                    borderBottom: "1px solid #f1f5f9",
                    alignItems: "center",
                    opacity: rOpacity,
                  }}
                >
                  <span style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>#{order.id}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: ORANGE }}>{order.customer}</span>
                  <span style={{ fontSize: 12, color: "#374151" }}>{order.type}</span>
                  <span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        background: order.statusColor + "20",
                        color: order.statusColor,
                        borderRadius: 6,
                        padding: "3px 8px",
                      }}
                    >
                      ✓ {order.status}
                    </span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{order.amount}</span>
                  <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>{order.paid}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
