const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

const TABS = [
  "פרטי העסק",
  "הזמנות",
  "פנסיון",
  "תשלומים",
  "צוות",
  "הודעות",
  "אינטגרציות",
  "כלבי שירות",
  "נתונים",
];

export const SettingsTabsBar: React.FC<{ activeTab: string; opacity?: number }> = ({
  activeTab,
  opacity = 1,
}) => {
  return (
    <div
      style={{
        background: "white",
        borderBottom: "1px solid #e2e8f0",
        padding: "0 28px",
        display: "flex",
        alignItems: "flex-end",
        gap: 0,
        opacity,
        fontFamily: FONT,
        direction: "rtl",
        overflowX: "hidden",
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <div
            key={tab}
            style={{
              padding: "12px 14px 10px",
              fontSize: 12,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? "#ea580c" : "#64748b",
              borderBottom: isActive ? "2px solid #ea580c" : "2px solid transparent",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {tab}
          </div>
        );
      })}
    </div>
  );
};
