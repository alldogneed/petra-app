import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const BG = "#f1f5f9";

interface Order {
  customer: string;
  pet: string;
  service: string;
  amount: string;
  status: "paid" | "pending";
  date: string;
  delay: number;
}

const ORDERS: Order[] = [
  { customer: "דני כהן", pet: "מקס", service: "אילוף בסיסי × 4", amount: "₪480", status: "paid", date: "היום", delay: 30 },
  { customer: "שרה לוי", pet: "בלה", service: "טיפוח ועיצוב", amount: "₪180", status: "pending", date: "אתמול", delay: 52 },
  { customer: "מיכל ברנשטיין", pet: "רקי", service: "חבילת אילוף מלאה", amount: "₪1,200", status: "paid", date: "23/03", delay: 74 },
  { customer: "דוד אברהם", pet: "קפה", service: "פנסיון 3 לילות", amount: "₪360", status: "pending", date: "21/03", delay: 96 },
  { customer: "יוסי מזרחי", pet: "לונה", service: "בדיקת בריאות", amount: "₪220", status: "paid", date: "18/03", delay: 118 },
];

const StatusBadge: React.FC<{ status: "paid" | "pending" }> = ({ status }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      background: status === "paid" ? "#f0fdf4" : "#fefce8",
      border: `1px solid ${status === "paid" ? "#86efac" : "#fde047"}`,
      borderRadius: 20,
      padding: "3px 12px",
      fontSize: 12,
      fontWeight: 600,
      color: status === "paid" ? "#166534" : "#854d0e",
      whiteSpace: "nowrap",
    }}
  >
    {status === "paid" ? "✓ שולם" : "⏳ ממתין"}
  </div>
);

const OrderRow: React.FC<{ order: Order; frame: number; fps: number; index: number }> = ({
  order,
  frame,
  fps,
  index,
}) => {
  const progress = spring({ frame: frame - order.delay, fps, config: { damping: 200 } });
  const rowX = interpolate(progress, [0, 1], [50, 0]);
  const rowOpacity = interpolate(frame, [order.delay, order.delay + 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr 2fr 1fr 1fr",
        gap: 12,
        alignItems: "center",
        padding: "14px 20px",
        background: index % 2 === 0 ? "white" : "#fafafa",
        borderBottom: "1px solid #f1f5f9",
        opacity: rowOpacity,
        transform: `translateX(${rowX}px)`,
        direction: "rtl",
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{order.customer}</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>{order.pet}</div>
      </div>
      <div style={{ fontSize: 13, color: "#475569" }}>{order.date}</div>
      <div style={{ fontSize: 13, color: "#475569" }}>{order.service}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{order.amount}</div>
      <StatusBadge status={order.status} />
    </div>
  );
};

export const OrdersScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps * 0.4, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" }
  );
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const headerY = interpolate(
    spring({ frame: frame - 5, fps, config: { damping: 200 } }),
    [0, 1],
    [-30, 0]
  );

  const tableHeaderOpacity = interpolate(frame, [18, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const totalOpacity = interpolate(frame, [135, 155], [0, 1], {
    extrapolateRight: "clamp",
  });
  const totalScale = spring({ frame: frame - 135, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ background: BG, opacity, direction: "rtl", fontFamily: FONT }}>
      {/* Header */}
      <div
        style={{
          background: "white",
          borderBottom: "1px solid #e2e8f0",
          padding: "18px 48px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: headerOpacity,
          transform: `translateY(${headerY}px)`,
        }}
      >
        <Img
          src={staticFile("petra-icon.png")}
          style={{ width: 32, height: 32, objectFit: "contain" }}
        />
        <span style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>פטרה</span>
      </div>

      {/* Content */}
      <div style={{ padding: "28px 48px" }}>
        {/* Section label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
            opacity: tableHeaderOpacity,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 24, background: ORANGE, borderRadius: 4 }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0 }}>
              הזמנות אחרונות
            </h2>
          </div>
          <div
            style={{
              fontSize: 13,
              color: ORANGE,
              fontWeight: 600,
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            לכל ההזמנות ←
          </div>
        </div>

        {/* Table */}
        <div
          style={{
            background: "white",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
            border: "1px solid #e2e8f0",
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 2fr 1fr 1fr",
              gap: 12,
              padding: "12px 20px",
              background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
              opacity: tableHeaderOpacity,
              direction: "rtl",
            }}
          >
            {["לקוח / חיה", "תאריך", "שירות", "סכום", "סטטוס"].map((col) => (
              <div
                key={col}
                style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}
              >
                {col}
              </div>
            ))}
          </div>

          {/* Rows */}
          {ORDERS.map((order, i) => (
            <OrderRow key={order.customer} order={order} frame={frame} fps={fps} index={i} />
          ))}
        </div>

        {/* Summary callout */}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            gap: 16,
            opacity: totalOpacity,
            transform: `scale(${totalScale})`,
          }}
        >
          <div
            style={{
              flex: 1,
              background: "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: 12,
              padding: "14px 20px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 800, color: "#16a34a" }}>₪2,440</div>
            <div style={{ fontSize: 13, color: "#166534", fontWeight: 600 }}>שולם החודש</div>
          </div>
          <div
            style={{
              flex: 1,
              background: "#fefce8",
              border: "1px solid #fde047",
              borderRadius: 12,
              padding: "14px 20px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 800, color: "#854d0e" }}>₪540</div>
            <div style={{ fontSize: 13, color: "#854d0e", fontWeight: 600 }}>ממתין לגביה</div>
          </div>
          <div
            style={{
              flex: 2,
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: 12,
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 20 }}>💡</span>
            <span style={{ fontSize: 14, color: "#9a3412", fontWeight: 500 }}>
              שלחו דרישת תשלום ב-WhatsApp ישירות מעמוד ההזמנה
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
