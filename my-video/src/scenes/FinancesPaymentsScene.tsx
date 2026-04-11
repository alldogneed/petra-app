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
  { label: "שולם", value: "₪3,300", sub: "1 תשלומים", color: "#22c55e", delay: 18 },
  { label: "ממתין", value: "₪0", sub: "0 תשלומים", color: "#f59e0b", delay: 24 },
  { label: "סה\"כ", value: "₪3,300", sub: "1 תשלומים", color: "#3b82f6", delay: 30 },
  { label: "ממוצע", value: "₪3,300", sub: "לתשלום", color: "#64748b", delay: 36 },
];

const PAYMENTS = [
  { customer: "רחלי רבינוביץ'", phone: "0526363171", amount: "₪3,300", method: "ביט", ref: "הזמנה #09E41046", status: "שולם", delay: 58 },
  { customer: "ספיר מזרחי", phone: "050-3333333", amount: "₪400", method: "מזומן", ref: "הזמנה #FD226115", status: "ממתין", delay: 70 },
  { customer: "ליעד", phone: "0528690214", amount: "₪350", method: "כרטיס", ref: "הזמנה #21519018", status: "שולם", delay: 82 },
];

export const FinancesPaymentsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });
  const filterOpacity = interpolate(frame, [42, 55], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="פיננסים" />

      <div style={{ marginRight: SIDEBAR_W, display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Tabs */}
        <div style={{ background: "white", borderBottom: "1px solid #e2e8f0", display: "flex", opacity: headerOpacity }}>
          {[
            { tab: "מחירון", active: false },
            { tab: "הזמנות", active: false },
            { tab: "בקשות תשלום", active: false },
            { tab: "תשלומים", active: true },
          ].map(({ tab, active }) => (
            <div
              key={tab}
              style={{
                padding: "14px 20px",
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
                + תשלום חדש
              </div>
              <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>
                ↓ ייצוא CSV
              </div>
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>תשלומים</h1>
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
                    gap: 2,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{card.label}</span>
                  </div>
                  <span style={{ fontSize: 20, fontWeight: 800, color: card.color }}>{card.value}</span>
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>{card.sub}</span>
                </div>
              );
            })}
          </div>

          {/* Filters */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
              opacity: filterOpacity,
            }}
          >
            <div style={{ marginRight: "auto", display: "flex", gap: 6 }}>
              {["כל הזמן", "החודש", "השבוע", "היום"].map((t, i) => (
                <span
                  key={t}
                  style={{
                    fontSize: 12,
                    padding: "5px 10px",
                    borderRadius: 6,
                    background: i === 0 ? "#0f172a" : "#f1f5f9",
                    color: i === 0 ? "white" : "#64748b",
                    cursor: "pointer",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
            {["הכל", "ממתין", "שולם", "בוטל"].map((s, i) => (
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
          </div>

          {/* Payments table */}
          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 90px 90px 1fr 90px",
                padding: "10px 16px",
                borderBottom: "1px solid #e2e8f0",
                opacity: filterOpacity,
              }}
            >
              {["לקוח", "סכום", "אמצעי תשלום", "שיוך", "סטטוס"].map((h) => (
                <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textAlign: "right" }}>{h}</span>
              ))}
            </div>

            {PAYMENTS.map((pay) => {
              const pOpacity = interpolate(frame, [pay.delay, pay.delay + 12], [0, 1], { extrapolateRight: "clamp" });
              const isPaid = pay.status === "שולם";
              return (
                <div
                  key={pay.customer}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 90px 90px 1fr 90px",
                    padding: "12px 16px",
                    borderBottom: "1px solid #f1f5f9",
                    alignItems: "center",
                    opacity: pOpacity,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: ORANGE }}>{pay.customer}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{pay.phone}</div>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", textAlign: "right" }}>{pay.amount}</span>
                  <span style={{ fontSize: 12, color: "#374151", textAlign: "right" }}>{pay.method}</span>
                  <span style={{ fontSize: 12, color: "#3b82f6", textAlign: "right" }}>{pay.ref}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      background: isPaid ? "#f0fdf4" : "#fefce8",
                      color: isPaid ? "#16a34a" : "#ca8a04",
                      borderRadius: 6,
                      padding: "3px 8px",
                      textAlign: "center",
                      display: "inline-block",
                    }}
                  >
                    {isPaid ? "שולם" : "ממתין"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
