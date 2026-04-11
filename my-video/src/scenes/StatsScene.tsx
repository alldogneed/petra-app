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

interface StatCardData {
  icon: string;
  value: string | number;
  label: string;
  sub: string;
  color: string;
  delay: number;
  isNumber?: boolean;
  rawValue?: number;
}

const CARDS: StatCardData[] = [
  {
    icon: "₪",
    value: 12450,
    rawValue: 12450,
    label: "הכנסות החודש",
    sub: "היום: ₪680",
    color: "#ea580c",
    delay: 30,
    isNumber: true,
  },
  {
    icon: "📅",
    value: 6,
    rawValue: 6,
    label: "תורים היום",
    sub: "הבא: 10:30",
    color: "#2563eb",
    delay: 50,
    isNumber: true,
  },
  {
    icon: "🐾",
    value: 48,
    rawValue: 48,
    label: "לקוחות פעילים",
    sub: "+3 החודש",
    color: "#16a34a",
    delay: 70,
    isNumber: true,
  },
  {
    icon: "⏳",
    value: 3,
    rawValue: 3,
    label: "תשלומים ממתינים",
    sub: "סה״כ ₪1,230",
    color: "#d97706",
    delay: 90,
    isNumber: true,
  },
];

const StatCard: React.FC<{ card: StatCardData; globalFrame: number; fps: number }> = ({
  card,
  globalFrame,
  fps,
}) => {
  const progress = spring({
    frame: globalFrame - card.delay,
    fps,
    config: { damping: 200 },
  });

  const cardY = interpolate(progress, [0, 1], [60, 0]);
  const cardOpacity = interpolate(globalFrame, [card.delay, card.delay + 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const numberProgress = interpolate(
    globalFrame,
    [card.delay + 10, card.delay + 50],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  const displayValue =
    card.isNumber && card.rawValue !== undefined
      ? card.label === "הכנסות החודש"
        ? `₪${Math.round(numberProgress * card.rawValue).toLocaleString("he-IL")}`
        : String(Math.round(numberProgress * card.rawValue))
      : card.value;

  return (
    <div
      style={{
        background: "white",
        borderRadius: 16,
        padding: "28px 24px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        opacity: cardOpacity,
        transform: `translateY(${cardY}px)`,
        direction: "rtl",
        fontFamily: FONT,
        border: `1px solid rgba(0,0,0,0.06)`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Color accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          left: 0,
          height: 4,
          background: card.color,
          borderRadius: "16px 16px 0 0",
        }}
      />

      {/* Icon circle */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: `${card.color}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          marginBottom: 16,
        }}
      >
        {card.icon}
      </div>

      {/* Value */}
      <div
        style={{
          fontSize: 36,
          fontWeight: 800,
          color: "#0f172a",
          marginBottom: 4,
          lineHeight: 1,
        }}
      >
        {displayValue}
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "#475569",
          marginBottom: 6,
        }}
      >
        {card.label}
      </div>

      {/* Sub */}
      <div
        style={{
          fontSize: 13,
          color: card.color,
          fontWeight: 500,
        }}
      >
        {card.sub}
      </div>
    </div>
  );
};

export const StatsScene: React.FC = () => {
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

  const headerProgress = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const headerY = interpolate(headerProgress, [0, 1], [-30, 0]);
  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const sectionLabelOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: BG, opacity, direction: "rtl", fontFamily: FONT }}>
      {/* Top header bar */}
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
        <span
          style={{
            marginRight: "auto",
            fontSize: 14,
            color: "#64748b",
            fontWeight: 400,
          }}
        >
          שלום, שרה 👋
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: "32px 48px" }}>
        {/* Section label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 24,
            opacity: sectionLabelOpacity,
          }}
        >
          <div
            style={{
              width: 4,
              height: 24,
              background: ORANGE,
              borderRadius: 4,
            }}
          />
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#0f172a",
              margin: 0,
            }}
          >
            סטטיסטיקות — מבט על
          </h2>
        </div>

        {/* Cards grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 20,
          }}
        >
          {CARDS.map((card) => (
            <StatCard key={card.label} card={card} globalFrame={frame} fps={fps} />
          ))}
        </div>

        {/* Callout */}
        <div
          style={{
            marginTop: 32,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 12,
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            opacity: interpolate(frame, [110, 130], [0, 1], { extrapolateRight: "clamp" }),
            transform: `translateY(${interpolate(
              interpolate(frame, [110, 130], [0, 1], { extrapolateRight: "clamp" }),
              [0, 1],
              [15, 0]
            )}px)`,
          }}
        >
          <span style={{ fontSize: 20 }}>💡</span>
          <span style={{ fontSize: 15, color: "#9a3412", fontWeight: 500 }}>
            הנתונים מתעדכנים בזמן אמת — כל תשלום ותור מתווסף אוטומטית
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
