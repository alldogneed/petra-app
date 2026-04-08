// src/scenes/teaser/TeaserChaosScene.tsx
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

const LINES = [
  "לידים נופלים בין הכסאות",
  "תורים נשכחים ברגע האחרון",
];

export const TeaserChaosScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Line 1: frames 0–28
  const line1Opacity = interpolate(frame, [0, 6, 24, 30], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Line 2: frames 25–60
  const line2Opacity = interpolate(frame, [25, 32, 56, 60], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacities = [line1Opacity, line2Opacity];

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
        gap: 0,
      }}
    >
      {LINES.map((line, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            opacity: opacities[i],
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: "#ef4444",
            }}
          >
            ✗
          </span>
          <span
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: "white",
              textShadow: "0 0 30px rgba(239,68,68,0.4)",
            }}
          >
            {line}
          </span>
        </div>
      ))}
    </AbsoluteFill>
  );
};
