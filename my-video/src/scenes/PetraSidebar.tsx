import { Img, staticFile } from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

const NAV_ITEMS = [
  { label: "דשבורד" },
  { label: "לקוחות" },
  { label: "מערכת מכירות" },
  { label: "ניהול משימות" },
  { label: "ניהול תורים אונליין" },
  { label: "פנסיון" },
  { label: "פיננסים" },
  { label: "ניהול כלבי שירות" },
  { label: "ניהול תהליכי אילוף" },
  { label: "חיות מחמד" },
  { label: "יומן" },
  { label: "דוחות" },
  { label: "ניהול ובקרה" },
  { label: "הגדרות" },
];

export const PetraSidebar: React.FC<{ width?: number; activeLabel?: string }> = ({
  width = 210,
  activeLabel = "מערכת מכירות",
}) => {
  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width,
        background: "#0f172a",
        display: "flex",
        flexDirection: "column",
        fontFamily: FONT,
        direction: "rtl",
        zIndex: 10,
        borderLeft: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Img
          src={staticFile("petra-icon.png")}
          style={{ width: 32, height: 32, objectFit: "contain" }}
        />
        <div>
          <div
            style={{
              color: "white",
              fontSize: 15,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            Petra
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.35)",
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: 1,
              marginTop: 2,
            }}
          >
            PET BUSINESS
          </div>
        </div>
      </div>

      {/* Nav items */}
      <div
        style={{
          flex: 1,
          padding: "10px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 1,
          overflowY: "hidden",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = item.label === activeLabel;
          return (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 10px",
                borderRadius: 8,
                background: isActive
                  ? "rgba(234,88,12,0.18)"
                  : "transparent",
                borderRight: isActive
                  ? "3px solid #ea580c"
                  : "3px solid transparent",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? "#fb923c" : "rgba(255,255,255,0.55)",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Extra items */}
      <div style={{ padding: "4px 8px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "7px 10px",
            borderRadius: 8,
            cursor: "pointer",
            opacity: 0.45,
          }}
        >
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>תכונות נוספות</span>
          <span style={{ marginRight: "auto", fontSize: 10, background: "#334155", color: "#94a3b8", borderRadius: 99, padding: "1px 6px", fontWeight: 700 }}>5</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "7px 10px",
            borderRadius: 8,
            cursor: "pointer",
            opacity: 0.45,
          }}
        >
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>עזרה</span>
        </div>
      </div>

      {/* Upgrade button */}
      <div style={{ padding: "8px 10px 10px" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #ea580c, #c2410c)",
            borderRadius: 8,
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: "white" }}>שדרג מנוי</span>
        </div>
      </div>
    </div>
  );
};
