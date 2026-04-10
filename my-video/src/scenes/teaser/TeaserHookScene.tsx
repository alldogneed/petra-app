// src/scenes/teaser/TeaserHookScene.tsx
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

export const TeaserHookScene: React.FC = () => {
  const frame = useCurrentFrame();

  const sceneOpacity = interpolate(
    frame,
    [0, 20, 210, 240],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const line1Opacity = interpolate(frame, [15, 40], [0, 1], { extrapolateRight: "clamp" });
  const line1X = interpolate(frame, [15, 42], [30, 0], { extrapolateRight: "clamp" });

  const line2Opacity = interpolate(frame, [45, 70], [0, 1], { extrapolateRight: "clamp" });
  const line2X = interpolate(frame, [45, 72], [30, 0], { extrapolateRight: "clamp" });

  const pulse = 1 + interpolate(
    frame,
    [90, 150, 210],
    [0, 0.03, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
        opacity: sceneOpacity,
      }}
    >
      <div
        style={{
          width: 52, height: 3, background: "#ef4444",
          borderRadius: 2, marginBottom: 22, opacity: line1Opacity,
        }}
      />
      <div
        style={{
          opacity: line1Opacity,
          transform: `translateX(${line1X}px)`,
          fontSize: 48,
          fontWeight: 800,
          color: "white",
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        לנהל עסק עם בע״ח
      </div>
      <div
        style={{
          opacity: line2Opacity,
          transform: `translateX(${line2X}px) scale(${pulse})`,
          fontSize: 68,
          fontWeight: 900,
          color: "#ef4444",
          textAlign: "center",
          textShadow: "0 0 40px rgba(239,68,68,0.4)",
        }}
      >
        זה כאוס
      </div>
    </AbsoluteFill>
  );
};
