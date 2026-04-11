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

interface CheckItem {
  label: string;
  sub: string;
  icon: string;
  completedAt: number; // frame when it shows as completed
  delay: number;
}

const ITEMS: CheckItem[] = [
  { label: "הגדרת פרטי העסק", sub: "שם, טלפון וכתובת", icon: "🏪", completedAt: 50, delay: 25 },
  { label: "הוספת שירות ראשון", sub: "מחיר, משך ותיאור", icon: "✂️", completedAt: 75, delay: 42 },
  { label: "הוספת לקוח ראשון", sub: "שם, טלפון וחיות", icon: "👤", completedAt: 100, delay: 59 },
  { label: "קביעת תור ראשון", sub: "בלוח השנה", icon: "📅", completedAt: 125, delay: 76 },
  { label: "יצירת הזמנה", sub: "וחיבור לתשלום", icon: "📋", completedAt: 0, delay: 93 },
  { label: "הגדרת חוזה לדוגמה", sub: "תבנית לחתימה דיגיטלית", icon: "📄", completedAt: 0, delay: 110 },
  { label: "הפעלת תזכורות WhatsApp", sub: "אוטומטיות לתורים", icon: "💬", completedAt: 0, delay: 127 },
];

const ChecklistItem: React.FC<{
  item: CheckItem;
  frame: number;
  fps: number;
}> = ({ item, frame, fps }) => {
  const progress = spring({ frame: frame - item.delay, fps, config: { damping: 200 } });
  const rowX = interpolate(progress, [0, 1], [40, 0]);
  const rowOpacity = interpolate(frame, [item.delay, item.delay + 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  const isCompleted = item.completedAt > 0 && frame >= item.completedAt;
  const checkProgress = isCompleted
    ? spring({ frame: frame - item.completedAt, fps, config: { damping: 200 } })
    : 0;
  const checkScale = interpolate(checkProgress, [0, 1], [0, 1]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 20px",
        background: isCompleted ? "#f0fdf4" : "white",
        borderRadius: 12,
        border: `1px solid ${isCompleted ? "#86efac" : "#e2e8f0"}`,
        opacity: rowOpacity,
        transform: `translateX(${rowX}px)`,
        direction: "rtl",
      }}
    >
      {/* Checkbox */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          border: `2px solid ${isCompleted ? "#16a34a" : "#d1d5db"}`,
          background: isCompleted ? "#16a34a" : "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transform: `scale(${isCompleted ? checkScale : 1})`,
        }}
      >
        {isCompleted && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{ transform: `scale(${checkScale})` }}
          >
            <path
              d="M2 7L5.5 10.5L12 3.5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Icon */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: isCompleted ? "#dcfce7" : "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        {item.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: isCompleted ? "#166534" : "#0f172a",
            textDecoration: isCompleted ? "line-through" : "none",
            opacity: isCompleted ? 0.8 : 1,
          }}
        >
          {item.label}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{item.sub}</div>
      </div>

      {/* Status */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: isCompleted ? "#16a34a" : "#94a3b8",
        }}
      >
        {isCompleted ? "✓ הושלם" : "○ טרם הושלם"}
      </div>
    </div>
  );
};

export const ChecklistScene: React.FC = () => {
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

  // Progress bar
  const completedCount = ITEMS.filter(
    (item) => item.completedAt > 0 && frame >= item.completedAt
  ).length;
  const progressWidth = interpolate(completedCount, [0, 7], [0, 100], {
    extrapolateRight: "clamp",
  });

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
        <div
          style={{
            marginRight: "auto",
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 8,
            padding: "4px 12px",
            fontSize: 13,
            color: "#9a3412",
            fontWeight: 600,
          }}
        >
          🚀 רשימת ההתחלה שלך
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "24px 48px" }}>
        {/* Section + progress */}
        <div
          style={{
            marginBottom: 20,
            opacity: interpolate(frame, [10, 25], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 4, height: 24, background: ORANGE, borderRadius: 4 }} />
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                צ'קליסט הקמה
              </h2>
            </div>
            <div style={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>
              {completedCount}/7 הושלמו
            </div>
          </div>

          {/* Progress bar */}
          <div
            style={{
              height: 8,
              background: "#e2e8f0",
              borderRadius: 99,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressWidth}%`,
                background: "linear-gradient(90deg, #ea580c, #16a34a)",
                borderRadius: 99,
              }}
            />
          </div>
        </div>

        {/* Checklist items */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ITEMS.map((item) => (
            <ChecklistItem key={item.label} item={item} frame={frame} fps={fps} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
