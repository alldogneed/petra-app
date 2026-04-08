import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

interface BenefitTagProps {
  text: string;      // e.g. "כל ליד במקום אחד"
  appearAt?: number; // frame when slide-in begins (default: 55)
}

export const BenefitTag: React.FC<BenefitTagProps> = ({
  text,
  appearAt = 55,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - appearAt,
    fps,
    config: { damping: 180, stiffness: 200 },
  });

  const y = interpolate(progress, [0, 1], [20, 0]);
  const opacity = interpolate(frame, [appearAt, appearAt + 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 28,
        left: 32,
        opacity,
        transform: `translateY(${y}px)`,
        fontFamily: FONT,
        direction: "rtl",
      }}
    >
      <div
        style={{
          background: "#dcfce7",
          border: "1.5px solid #86efac",
          borderRadius: 99,
          padding: "8px 18px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "0 4px 16px rgba(22,163,74,0.2)",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 800, color: "#15803d" }}>✓</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#166534" }}>
          {text}
        </span>
      </div>
    </div>
  );
};
