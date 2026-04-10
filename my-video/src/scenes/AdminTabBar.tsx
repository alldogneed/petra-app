// src/scenes/AdminTabBar.tsx

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

const TABS = [
  { label: "סקירה" },
  { label: "פעילות" },
  { label: "צוות" },
  { label: "סשנים" },
  { label: "הודעות מערכת" },
  { label: "מנוי וחיוב" },
];

export const AdminTabBar: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  return (
    <div style={{
      background: "white",
      borderBottom: "1px solid #e2e8f0",
      padding: "0 24px",
      display: "flex",
      gap: 2,
      fontFamily: FONT,
      direction: "rtl",
    }}>
      {TABS.map((tab) => {
        const isActive = tab.label === activeTab;
        return (
          <div
            key={tab.label}
            style={{
              padding: "10px 14px",
              fontSize: 12,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? "#ea580c" : "#64748b",
              borderBottom: isActive ? "2px solid #ea580c" : "2px solid transparent",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </div>
        );
      })}
    </div>
  );
};
