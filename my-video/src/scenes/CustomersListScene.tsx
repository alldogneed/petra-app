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

const CUSTOMERS = [
  { name: "דנה לוי", phone: "054-321-8876", status: "VIP", statusColor: "#f59e0b", statusBg: "#fffbeb", pets: "מיקי", tags: ["VIP", "קבוע"], balance: "₪2,840", delay: 35 },
  { name: "אמיר שלום", phone: "052-445-6632", status: "פעיל", statusColor: "#22c55e", statusBg: "#f0fdf4", pets: "תאו", tags: ["קבוע"], balance: "₪1,200", delay: 50 },
  { name: "רותי כהן", phone: "050-887-2341", status: "רדום", statusColor: "#94a3b8", statusBg: "#f8fafc", pets: "ביסקוויט", tags: ["מזדמן"], balance: "₪480", delay: 65 },
  { name: "נועה ברק", phone: "052-540-9453", status: "פעיל", statusColor: "#22c55e", statusBg: "#f0fdf4", pets: "לונה, בוני", tags: ["קבוע"], balance: "₪3,100", delay: 80 },
  { name: "שמעון גרין", phone: "053-201-7654", status: "פעיל", statusColor: "#22c55e", statusBg: "#f0fdf4", pets: "רקסי", tags: ["פוטנציאל"], balance: "₪650", delay: 95 },
];

const TAGS = ["VIP", "קבוע", "מזדמן", "פוטנציאל", "לשעבר", "עסקי"];

export const CustomersListScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const headerY = interpolate(spring({ frame: frame - 5, fps, config: { damping: 200 } }), [0, 1], [-16, 0]);

  const searchOpacity = interpolate(frame, [18, 30], [0, 1], { extrapolateRight: "clamp" });
  const filtersOpacity = interpolate(frame, [22, 35], [0, 1], { extrapolateRight: "clamp" });
  const tagsOpacity = interpolate(frame, [28, 42], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="לקוחות" />

      <div style={{ marginRight: SIDEBAR_W, display: "flex", flexDirection: "column", height: "100%" }}>

        {/* Top header bar (page title + actions) */}
        <div
          style={{
            background: "white",
            borderBottom: "1px solid #e2e8f0",
            padding: "0 28px",
            height: 58,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: headerOpacity,
            transform: `translateY(${headerY}px)`,
          }}
        >
          {/* Left: action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <div
              style={{
                background: ORANGE,
                color: "white",
                borderRadius: 8,
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              + לקוח חדש
            </div>
            <div
              style={{
                background: ORANGE,
                color: "white",
                borderRadius: 8,
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              הזמנה חדשה
            </div>
            <div
              style={{
                background: "white",
                color: "#475569",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              ייצוא Excel
            </div>
          </div>

          {/* Right: title */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>לקוחות</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>ניהול בסיס הלקוחות</span>
          </div>
        </div>

        {/* Search + filters area */}
        <div style={{ background: "white", borderBottom: "1px solid #e2e8f0", padding: "10px 28px" }}>
          {/* Search bar */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13,
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
              opacity: searchOpacity,
            }}
          >
            <span style={{ fontSize: 12, color: "#94a3b8" }}>חיפוש לפי שם לקוח, טלפון, אימייל או שם חיה...</span>
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", opacity: filtersOpacity, flexWrap: "nowrap", overflow: "hidden" }}>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, flexShrink: 0 }}>סינון:</span>
            {["הכל", "פעילים", "רדומים", "VIP"].map((f) => (
              <div
                key={f}
                style={{
                  background: f === "הכל" ? "#0f172a" : "white",
                  color: f === "הכל" ? "white" : "#475569",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  padding: "4px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {f}
              </div>
            ))}
            {["סוג שירות ▾", "חוב", "מאוזן", "ביקור אחרון ▾", "א-ב ▾"].map((f) => (
              <div
                key={f}
                style={{
                  background: "white",
                  color: "#475569",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 500,
                  flexShrink: 0,
                }}
              >
                {f}
              </div>
            ))}
          </div>

          {/* Tags row */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, opacity: tagsOpacity }}>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>תגיות:</span>
            {TAGS.map((tag) => (
              <div
                key={tag}
                style={{
                  background: "white",
                  color: "#475569",
                  border: "1px solid #e2e8f0",
                  borderRadius: 99,
                  padding: "3px 10px",
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>

        {/* Table header */}
        <div style={{ padding: "0 28px", background: "#f8fafc" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.2fr 0.7fr 1fr 1fr 0.8fr",
              gap: 8,
              padding: "8px 16px",
              fontSize: 11,
              fontWeight: 700,
              color: "#94a3b8",
              letterSpacing: "0.04em",
              opacity: filtersOpacity,
            }}
          >
            <span>שם</span>
            <span>טלפון</span>
            <span>סטטוס</span>
            <span>חיות</span>
            <span>תגיות</span>
            <span>יתרה</span>
          </div>
        </div>

        {/* Customer rows */}
        <div style={{ padding: "0 28px", flex: 1 }}>
          {CUSTOMERS.map((c) => {
            const rowOpacity = interpolate(frame, [c.delay, c.delay + 14], [0, 1], { extrapolateRight: "clamp" });
            const rowX = interpolate(
              spring({ frame: frame - c.delay, fps, config: { damping: 200 } }),
              [0, 1],
              [16, 0]
            );
            return (
              <div
                key={c.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1.2fr 0.7fr 1fr 1fr 0.8fr",
                  gap: 8,
                  padding: "10px 16px",
                  borderBottom: "1px solid #f1f5f9",
                  background: "white",
                  alignItems: "center",
                  opacity: rowOpacity,
                  transform: `translateX(${rowX}px)`,
                  marginBottom: 2,
                  borderRadius: 8,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{c.name}</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>{c.phone}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: c.statusColor,
                    background: c.statusBg,
                    borderRadius: 99,
                    padding: "2px 8px",
                    display: "inline-block",
                    border: `1px solid ${c.statusColor}30`,
                  }}
                >
                  {c.status}
                </span>
                <span style={{ fontSize: 12, color: "#475569" }}>{c.pets}</span>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {c.tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 10,
                        background: "#f1f5f9",
                        color: "#475569",
                        borderRadius: 4,
                        padding: "1px 6px",
                        fontWeight: 600,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: c.balance.startsWith("₪0") ? "#94a3b8" : "#22c55e",
                  }}
                >
                  {c.balance}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
