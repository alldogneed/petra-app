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
const TABS = [
  { label: "מחירון", sub: "שירותים ומחירים", delay: 18 },
  { label: "הזמנות", sub: "מעקב הזמנות", delay: 30 },
  { label: "בקשות תשלום", sub: "גבייה בוואטסאפ", delay: 42 },
  { label: "תשלומים", sub: "מעקב הכנסות", delay: 54 },
];

export const FinancesIntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const logoProgress = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const logoScale = interpolate(logoProgress, [0, 1], [0.7, 1]);
  const logoOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const titleProgress = spring({ frame: frame - 22, fps, config: { damping: 200 } });
  const titleY = interpolate(titleProgress, [0, 1], [24, 0]);
  const titleOpacity = interpolate(frame, [22, 36], [0, 1], { extrapolateRight: "clamp" });

  const pulse = interpolate(frame % 90, [0, 45, 90], [0, 1, 0]);

  return (
    <AbsoluteFill
      style={{
        opacity,
        background: `radial-gradient(ellipse at 50% 40%, rgba(234,88,12,${0.1 + pulse * 0.04}) 0%, transparent 55%), linear-gradient(145deg, #0f172a 0%, #1e293b 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
      }}
    >
      {/* Stars */}
      {[...Array(10)].map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: `${10 + i * 8}%`,
            left: `${3 + i * 10}%`,
            width: i % 3 === 0 ? 3 : 2,
            height: i % 3 === 0 ? 3 : 2,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.18)",
          }}
        />
      ))}

      {/* Logo */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          marginBottom: 28,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Img src={staticFile("petra-icon.png")} style={{ width: 44, height: 44, objectFit: "contain" }} />
        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 24, fontWeight: 700, letterSpacing: 1 }}>PETRA</span>
      </div>

      {/* Title */}
      <h1
        style={{
          color: "white",
          fontSize: 44,
          fontWeight: 800,
          margin: 0,
          marginBottom: 8,
          textAlign: "center",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          lineHeight: 1.2,
        }}
      >
        מערכת הפיננסים
      </h1>
      <p
        style={{
          color: "white",
          fontSize: 20,
          fontWeight: 700,
          margin: 0,
          marginBottom: 48,
          textAlign: "center",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        ניהול הכנסות מקצה לקצה
      </p>

      {/* 4 Tabs */}
      <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
        {TABS.map((tab) => {
          const tOpacity = interpolate(frame, [tab.delay, tab.delay + 14], [0, 1], { extrapolateRight: "clamp" });
          const tScale = interpolate(
            spring({ frame: frame - tab.delay, fps, config: { damping: 200 } }),
            [0, 1],
            [0.85, 1]
          );
          return (
            <div
              key={tab.label}
              style={{
                opacity: tOpacity,
                transform: `scale(${tScale})`,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 14,
                padding: "18px 22px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                minWidth: 130,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>{tab.label}</span>
              <span style={{ fontSize: 11, color: "#94a3b8", textAlign: "center" }}>{tab.sub}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
