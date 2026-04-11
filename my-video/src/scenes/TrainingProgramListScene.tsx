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

const PROGRAMS = [
  { dog: "כוכב", owner: "ספיר מזרחי", type: "משמעת בסיסית", price: "₪400", done: 1, total: 1, alert: true, delay: 50 },
  { dog: "טרזן", owner: "ליעד", type: "משמעת בסיסית", price: "₪400", done: 0, total: 1, alert: true, delay: 64 },
  { dog: "לי׳צ׳י", owner: "רחלי רבינוביץ׳", type: "משמעת בסיסית", price: "₪1,800", done: null, total: null, alert: false, delay: 78 },
  { dog: "מאיה", owner: "רחל גולד", type: "משמעת בסיסית", price: "₪750", done: 0, total: 2, alert: true, delay: 92 },
  { dog: "ברונו", owner: "עמית כהן", type: "מותאם אישית", price: "₪400", done: 0, total: 1, alert: true, delay: 106 },
];

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  "משמעת בסיסית": { bg: "#dbeafe", color: "#1d4ed8" },
  "מותאם אישית": { bg: "#ede9fe", color: "#7c3aed" },
  "תגובתיות": { bg: "#fee2e2", color: "#dc2626" },
  "גורים": { bg: "#fff7ed", color: "#ea580c" },
};

export const TrainingProgramListScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });
  const tabsOpacity = interpolate(frame, [12, 26], [0, 1], { extrapolateRight: "clamp" });
  const subTabsOpacity = interpolate(frame, [22, 36], [0, 1], { extrapolateRight: "clamp" });

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
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>אימונים וניהול כלבים</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>קבוצות ותוכניות אימון</div>
          </div>
          <div style={{
            background: ORANGE, color: "white", borderRadius: 8,
            padding: "7px 14px", fontSize: 12, fontWeight: 700,
          }}>
            + הוסף תהליך ידני
          </div>
        </div>

        {/* Main tabs */}
        <div style={{
          padding: "10px 24px 0", display: "flex", gap: 8,
          opacity: tabsOpacity, flexShrink: 0,
        }}>
          {["סקירה", "אילוף בבית הלקוח", "אילוף בתנאי פנסיון", "אילוף קבוצתי", "ארכיון"].map((tab) => (
            <div key={tab} style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: tab === "אילוף בבית הלקוח" ? ORANGE : "white",
              color: tab === "אילוף בבית הלקוח" ? "white" : "#64748b",
              border: tab === "אילוף בבית הלקוח" ? "none" : "1px solid #e2e8f0",
            }}>
              {tab}
            </div>
          ))}
        </div>

        {/* Sub-tabs */}
        <div style={{
          padding: "8px 24px 0", display: "flex", gap: 0,
          opacity: subTabsOpacity, flexShrink: 0,
        }}>
          {["אילוף פרטני", "חבילת אילוף"].map((tab, i) => (
            <div key={tab} style={{
              padding: "7px 20px", fontSize: 12, fontWeight: 600,
              background: i === 0 ? "white" : "#f8fafc",
              color: i === 0 ? "#0f172a" : "#94a3b8",
              borderBottom: i === 0 ? `2px solid ${ORANGE}` : "2px solid #e2e8f0",
              cursor: "pointer",
            }}>
              {tab}
            </div>
          ))}
          <div style={{ flex: 1, borderBottom: "2px solid #e2e8f0" }} />
          <div style={{
            padding: "7px 0", fontSize: 11, color: "#94a3b8",
            borderBottom: "2px solid #e2e8f0",
            alignSelf: "stretch", display: "flex", alignItems: "center",
          }}>
            16 תוכניות אילוף
          </div>
        </div>

        {/* Program cards */}
        <div style={{ flex: 1, padding: "12px 24px", display: "flex", flexDirection: "column", gap: 8, overflowY: "hidden" }}>
          {PROGRAMS.map((p, i) => {
            const prog = spring({ frame: frame - p.delay, fps, config: { damping: 200 } });
            const y = interpolate(prog, [0, 1], [16, 0]);
            const cardOpacity = interpolate(frame, [p.delay, p.delay + 14], [0, 1], { extrapolateRight: "clamp" });
            const typeStyle = TYPE_COLORS[p.type] ?? TYPE_COLORS["מותאם אישית"];
            const pct = p.done != null && p.total ? (p.done / p.total) * 100 : 0;

            return (
              <div key={p.dog + i} style={{
                background: "white",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: "12px 16px",
                opacity: cardOpacity,
                transform: `translateY(${y}px)`,
                display: "flex",
                alignItems: "center",
                gap: 12,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}>
                {/* Expand icon */}
                <div style={{ color: "#94a3b8", fontSize: 12, flexShrink: 0 }}>▼</div>

                {/* Progress + sessions */}
                <div style={{ width: 60, flexShrink: 0, textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: pct === 100 ? "#16a34a" : ORANGE }}>
                    {p.done != null ? `${p.done}/${p.total}` : "—"}
                  </div>
                  <div style={{
                    height: 4, background: "#f1f5f9", borderRadius: 99, marginTop: 4, overflow: "hidden",
                  }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#22c55e" : ORANGE, borderRadius: 99 }} />
                  </div>
                </div>

                {/* Dog + owner */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {p.alert && <span style={{ fontSize: 11, color: "#f59e0b" }}>⚠</span>}
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{p.dog}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, borderRadius: 99,
                      padding: "2px 8px", background: "#dcfce7", color: "#16a34a",
                    }}>פעיל</span>
                    {p.alert && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, background: "#fff7ed",
                        color: "#ea580c", borderRadius: 99, padding: "1px 7px", border: "1px solid #fed7aa",
                      }}>מפגשים נמוכים</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    {p.owner && <span>{p.owner} · </span>}
                    <span style={{
                      fontWeight: 600, background: typeStyle.bg, color: typeStyle.color,
                      borderRadius: 4, padding: "1px 6px", fontSize: 10,
                    }}>{p.type}</span>
                  </div>
                </div>

                {/* Price */}
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", flexShrink: 0 }}>{p.price}</div>

                {/* Send button */}
                <div style={{
                  background: "#f0fdf4", border: "1px solid #bbf7d0",
                  borderRadius: 6, padding: "5px 12px",
                  fontSize: 11, fontWeight: 700, color: "#16a34a",
                  flexShrink: 0,
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
