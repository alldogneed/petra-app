// src/scenes/teaser/TeaserChaosScene.tsx
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

const LINES = [
  { text: "העסק גדל — ואתה מאבד שליטה?", start: 0, show: 24, hide: 30 },
  { text: "לקוחות נופלים, תורים נשכחים", start: 25, show: 49, hide: 58 },
];

export const TeaserChaosScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        background: "#080c14",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
      }}
    >
      {LINES.map((line, i) => {
        const opacity = interpolate(
          frame,
          [line.start, line.start + 7, line.show, line.hide],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        const y = interpolate(frame, [line.start, line.start + 10], [10, 0], { extrapolateRight: "clamp" });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              opacity,
              transform: `translateY(${y}px)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            {/* Red accent bar */}
            <div style={{ width: 44, height: 3, background: "#ef4444", borderRadius: 2 }} />
            <span
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: "white",
                textShadow: "0 0 40px rgba(239,68,68,0.35)",
                textAlign: "center",
              }}
            >
              {line.text}
            </span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
