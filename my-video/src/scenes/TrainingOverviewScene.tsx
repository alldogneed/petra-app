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

const STAT_CARDS = [
  { value: "17", label: "כלבים באימון", color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
  { value: "17", label: "אימון אישי", color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
  { value: "0", label: "אימון בפנסיון", color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe" },
  { value: "0", label: "קבוצות וסדנאות", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
];

const ROWS = [
  { dog: "כוכב", owner: "ספיר מזרחי", type: "אילוף בבית הלקוח", sessions: "1/1", daysAgo: "19 ימים", alert: true },
  { dog: "טרזן", owner: "ליעד", type: "אילוף בבית הלקוח", sessions: "0/1", daysAgo: "—", alert: true },
  { dog: "רומן", owner: "אהרון ברגר", type: "אילוף בבית הלקוח", sessions: "0/1", daysAgo: "—", alert: true },
  { dog: "לי׳צ׳י", owner: "רחלי רבינוביץ׳", type: "אילוף בבית הלקוח", sessions: "—", daysAgo: "—", alert: false },
  { dog: "מאיה", owner: "רחל גולד", type: "אילוף בבית הלקוח", sessions: "0/2", daysAgo: "—", alert: true },
];

export const TrainingOverviewScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });
  const statsOpacity = interpolate(frame, [15, 30], [0, 1], { extrapolateRight: "clamp" });
  const tabsOpacity = interpolate(frame, [28, 42], [0, 1], { extrapolateRight: "clamp" });
  const tableOpacity = interpolate(frame, [40, 55], [0, 1], { extrapolateRight: "clamp" });

  // auto-badge animates in to highlight the key feature
  const badgeProgress = spring({ frame: frame - 90, fps, config: { damping: 180 } });
  const badgeScale = interpolate(badgeProgress, [0, 1], [0.7, 1]);
  const badgeOpacity = interpolate(frame, [90, 105], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול תהליכי אילוף" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{
          background: "white",
          borderBottom: "1px solid #e2e8f0",
          padding: "0 24px",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: headerOpacity,
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>אימונים וניהול כלבים</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>קבוצות ותוכניות אימון</div>
          </div>
          <div style={{
            background: ORANGE, color: "white", borderRadius: 8,
            padding: "7px 14px", fontSize: 12, fontWeight: 700,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            + הוסף תהליך ידני
          </div>
        </div>

        {/* Stat cards */}
        <div style={{
          display: "flex", gap: 12, padding: "16px 24px 0",
          opacity: statsOpacity, flexShrink: 0,
        }}>
          {STAT_CARDS.map((s, i) => {
            const p = spring({ frame: frame - 15 - i * 6, fps, config: { damping: 200 } });
            const scale = interpolate(p, [0, 1], [0.9, 1]);
            return (
              <div key={s.label} style={{
                flex: 1, background: s.bg, border: `1px solid ${s.border}`,
                borderRadius: 12, padding: "14px 16px",
                transform: `scale(${scale})`,
              }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{s.label}</div>
              </div>
            );
          })}
        </div>

        {/* Auto-badge highlight */}
        <div style={{
          padding: "10px 24px 0",
          opacity: badgeOpacity,
          transform: `scale(${badgeScale})`,
          transformOrigin: "right center",
          flexShrink: 0,
        }}>
          <div style={{
            background: "#f0fdf4",
            border: "1.5px solid #86efac",
            borderRadius: 8,
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span style={{ fontSize: 14 }}>✅</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#15803d" }}>הזמנת אילוף שולחת כלב אוטומטית לתוכנית</span>
            <span style={{ fontSize: 11, color: "#16a34a", marginRight: "auto" }}>ללא פעולה ידנית נדרשת</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          padding: "10px 24px 0",
          display: "flex", gap: 8,
          opacity: tabsOpacity, flexShrink: 0,
        }}>
          {["סקירה", "אילוף בבית הלקוח", "אילוף בתנאי פנסיון", "אילוף קבוצתי", "ארכיון"].map((tab) => (
            <div key={tab} style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: tab === "סקירה" ? ORANGE : "white",
              color: tab === "סקירה" ? "white" : "#64748b",
              border: tab === "סקירה" ? "none" : "1px solid #e2e8f0",
            }}>
              {tab}
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ flex: 1, padding: "12px 24px", opacity: tableOpacity }}>
          {/* Table header */}
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 2fr 2fr 1fr 1fr 80px",
            padding: "8px 12px", fontSize: 11, color: "#94a3b8", fontWeight: 600,
            borderBottom: "1px solid #e2e8f0", background: "white",
            borderRadius: "8px 8px 0 0",
          }}>
            <span>כלב</span>
            <span>בעלים</span>
            <span>סוג אימון</span>
            <span>מפגשים</span>
            <span>מפגש אחרון</span>
            <span></span>
          </div>

          {/* Rows */}
          {ROWS.map((row, i) => {
            const rOpacity = interpolate(frame, [45 + i * 8, 58 + i * 8], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div key={row.dog + i} style={{
                display: "grid", gridTemplateColumns: "2fr 2fr 2fr 1fr 1fr 80px",
                padding: "10px 12px",
                borderBottom: "1px solid #f1f5f9",
                background: "white",
                opacity: rOpacity,
                alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {row.alert && <span style={{ color: "#f59e0b", fontSize: 11 }}>⚠</span>}
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{row.dog}</span>
                </div>
                <span style={{ fontSize: 12, color: "#475569" }}>{row.owner}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  background: "#eff6ff", color: "#3b82f6",
                  borderRadius: 6, padding: "3px 8px",
                  display: "inline-block",
                }}>
                  {row.type}
                </span>
                <span style={{ fontSize: 12, color: "#0f172a", fontWeight: 600 }}>{row.sessions}</span>
                <span style={{ fontSize: 12, color: row.daysAgo === "—" ? "#94a3b8" : "#f59e0b", fontWeight: row.daysAgo !== "—" ? 700 : 400 }}>
                  {row.daysAgo}
                </span>
                <div style={{
                  background: "#f0fdf4", border: "1px solid #bbf7d0",
                  borderRadius: 6, padding: "4px 10px",
                  fontSize: 11, fontWeight: 700, color: "#16a34a",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  ✈ שלח
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
