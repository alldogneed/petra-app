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

const TABS = ["תורים", "הזמנות", "מסמכים", "ציר זמן"];

export const CustomersProfileScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const cardOpacity = interpolate(frame, [18, 34], [0, 1], { extrapolateRight: "clamp" });
  const cardY = interpolate(spring({ frame: frame - 18, fps, config: { damping: 200 } }), [0, 1], [20, 0]);

  const statsOpacity = interpolate(frame, [35, 50], [0, 1], { extrapolateRight: "clamp" });
  const tabsOpacity = interpolate(frame, [55, 70], [0, 1], { extrapolateRight: "clamp" });

  // Appointment rows
  const appt1Opacity = interpolate(frame, [75, 88], [0, 1], { extrapolateRight: "clamp" });
  const appt2Opacity = interpolate(frame, [90, 103], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="לקוחות" />

      <div style={{ marginRight: SIDEBAR_W, display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header */}
        <div
          style={{
            background: "white",
            borderBottom: "1px solid #e2e8f0",
            padding: "0 32px",
            height: 60,
            display: "flex",
            alignItems: "center",
            gap: 10,
            opacity: headerOpacity,
          }}
        >
          <span style={{ color: "#64748b", fontSize: 13 }}>לקוחות</span>
          <span style={{ color: "#94a3b8" }}>›</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>דנה לוי</span>
        </div>

        <div style={{ display: "flex", gap: 20, padding: "20px 32px", flex: 1 }}>
          {/* Left column — profile card */}
          <div style={{ width: 240, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Profile card */}
            <div
              style={{
                background: "white",
                borderRadius: 14,
                padding: "20px",
                border: "1px solid #e2e8f0",
                opacity: cardOpacity,
                transform: `translateY(${cardY}px)`,
              }}
            >
              {/* Avatar + name */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16, gap: 10 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #ea580c, #c2410c)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 26,
                    color: "white",
                    fontWeight: 800,
                  }}
                >
                  ד
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "#0f172a" }}>דנה לוי</div>
                  <div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700, marginTop: 3 }}>VIP</div>
                </div>
              </div>

              {/* Contact info */}
              {[
                { value: "054-321-8876" },
                { value: "dana.levi@gmail.com" },
                { value: "תל אביב" },
              ].map((row) => (
                <div key={row.value} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: "#475569" }}>{row.value}</span>
                </div>
              ))}

              {/* WhatsApp button */}
              <div
                style={{
                  background: "#22c55e",
                  color: "white",
                  borderRadius: 8,
                  padding: "9px",
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: "center",
                  marginTop: 8,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                וואטסאפ
              </div>
            </div>

            {/* Financial card */}
            <div
              style={{
                background: "white",
                borderRadius: 14,
                padding: "16px",
                border: "1px solid #e2e8f0",
                opacity: statsOpacity,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                סטטוס כספי
              </div>
              {[
                { label: "הכנסות סה\"כ", value: "₪2,840", color: "#22c55e" },
                { label: "חוב פתוח", value: "₪0", color: "#64748b" },
                { label: "ביקורים", value: "12", color: "#3b82f6" },
              ].map((stat) => (
                <div key={stat.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "#64748b" }}>{stat.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: stat.color }}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — tabs + content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Tabs */}
            <div
              style={{
                display: "flex",
                gap: 0,
                borderBottom: "2px solid #e2e8f0",
                opacity: tabsOpacity,
                marginBottom: 16,
              }}
            >
              {TABS.map((tab, i) => (
                <div
                  key={tab}
                  style={{
                    padding: "10px 18px",
                    fontSize: 13,
                    fontWeight: i === 0 ? 700 : 400,
                    color: i === 0 ? ORANGE : "#64748b",
                    borderBottom: i === 0 ? `2px solid ${ORANGE}` : "2px solid transparent",
                    marginBottom: -2,
                    cursor: "pointer",
                  }}
                >
                  {tab}
                </div>
              ))}
            </div>

            {/* Appointment rows */}
            {[
              { date: "ראשון, 7.4.2026 10:00", service: "אילוף פרטי — מיקי", status: "מאושר", color: "#22c55e", bg: "#f0fdf4", opacity: appt1Opacity },
              { date: "שישי, 11.4.2026 09:00", service: "אילוף קבוצתי — מיקי", status: "ממתין", color: "#f59e0b", bg: "#fffbeb", opacity: appt2Opacity },
            ].map((appt) => (
              <div
                key={appt.date}
                style={{
                  background: "white",
                  borderRadius: 12,
                  padding: "14px 18px",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                  opacity: appt.opacity,
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 3 }}>{appt.service}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{appt.date}</div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: appt.color,
                    background: appt.bg,
                    borderRadius: 99,
                    padding: "3px 10px",
                  }}
                >
                  {appt.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
