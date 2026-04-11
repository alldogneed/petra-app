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

// Real tabs from BoardingTabs.tsx
const TABS = [
  { label: "לוח יומי",     active: false },
  { label: "ניהול חדרים",  active: false },
  { label: "ניהול חצרות",  active: false },
  { label: "האכלה",        active: false },
  { label: "תרופות",       active: false },
  { label: "חיסונים",      active: true  },
  { label: "טפסי קליטה",  active: false },
];

const FEATURE_CARDS = [
  {
    tab: "לוח יומי",
    desc: "ניהול הטיפול השוטף — האכלות, תרופות, טיולים",
    color: "#ea580c", bg: "#fff7ed", border: "#fed7aa", delay: 50,
  },
  {
    tab: "האכלה",
    desc: "תפריט תזונה לכל כלב — כמות, מועדים, הערות",
    color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", delay: 68,
  },
  {
    tab: "תרופות",
    desc: "מעקב מתן תרופות — מינון, תדירות, תאריכי סיום",
    color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd", delay: 86,
  },
  {
    tab: "חיסונים",
    desc: "תיק חיסונים עדכני — תאריכי תוקף והתראות",
    color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0", delay: 104,
  },
  {
    tab: "טפסי קליטה",
    desc: "טופס קליטה דיגיטלי — הצהרת בריאות ורשאויות",
    color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", delay: 122,
  },
];

export const BoardingTabsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" });
  const sidebarBlur = interpolate(frame, [20, 38], [0, 3], { extrapolateRight: "clamp" });
  const tabsOpacity = interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" });

  // Active tab index animates: 0 → 1 → 2 → ... → 6
  const activeTabIndex = Math.min(
    Math.floor(interpolate(frame, [40, 145], [0, 6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })),
    6
  );

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>
      {/* Sidebar */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SIDEBAR_W, filter: `blur(${sidebarBlur}px)` }}>
        <PetraSidebar width={SIDEBAR_W} activeLabel="פנסיון" />
      </div>

      {/* Main content */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0 }}>

        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center",
          opacity: headerOpacity,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>פנסיון</div>
        </div>

        {/* Tab bar — pill style matching real UI */}
        <div style={{
          margin: "14px 24px 0",
          background: "#f1f5f9", borderRadius: 12, padding: 4,
          display: "flex", gap: 2,
          opacity: tabsOpacity,
        }}>
          {TABS.map((tab, i) => {
            const isActive = i === activeTabIndex;
            const tabP = spring({ frame: frame - (30 + i * 10), fps, config: { damping: 200 } });
            const tabScale = interpolate(tabP, [0, 1], [0.9, 1]);
            const tabOpacity = interpolate(frame, [30 + i * 8, 42 + i * 8], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div key={tab.label} style={{
                flex: 1, textAlign: "center", padding: "8px 4px",
                borderRadius: 8, fontSize: 10, fontWeight: isActive ? 700 : 500,
                background: isActive ? "white" : "transparent",
                color: isActive ? "#0f172a" : "#64748b",
                boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                opacity: tabOpacity, transform: `scale(${tabScale})`,
                whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}>
                {tab.label}
              </div>
            );
          })}
        </div>

        {/* Feature cards */}
        <div style={{ padding: "14px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
          {FEATURE_CARDS.map((card, i) => {
            const cardP = spring({ frame: frame - card.delay, fps, config: { damping: 200 } });
            const y = interpolate(cardP, [0, 1], [14, 0]);
            const cardOpacity = interpolate(frame, [card.delay, card.delay + 14], [0, 1], { extrapolateRight: "clamp" });

            // Highlight as the active tab passes over it
            const isHighlighted = TABS.findIndex((t) => t.label === card.tab) === activeTabIndex;
            const highlightScale = isHighlighted ? interpolate(
              spring({ frame: frame - (40 + TABS.findIndex((t) => t.label === card.tab) * 15), fps, config: { damping: 200 } }),
              [0, 1], [1, 1.01]
            ) : 1;

            return (
              <div key={card.tab} style={{
                background: isHighlighted ? card.bg : "white",
                border: `1px solid ${isHighlighted ? card.border : "#e2e8f0"}`,
                borderRight: `3px solid ${card.color}`,
                borderRadius: 10, padding: "12px 16px",
                opacity: cardOpacity, transform: `translateY(${y}px) scale(${highlightScale})`,
                display: "flex", alignItems: "center", gap: 12,
                boxShadow: isHighlighted ? `0 2px 12px ${card.color}22` : "none",
                transition: "background 0.3s, border 0.3s",
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: card.color, flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: card.color }}>{card.tab}</div>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{card.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
