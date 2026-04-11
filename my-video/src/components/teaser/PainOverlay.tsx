import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

interface PainOverlayProps {
  text: string;
  fadeOutStart?: number;
  fadeOutEnd?: number;
}

export const PainOverlay: React.FC<PainOverlayProps> = ({
  text,
  fadeOutStart = 35,
  fadeOutEnd = 50,
}) => {
  const frame = useCurrentFrame();

  const overlayOpacity = interpolate(
    frame,
    [0, 6, fadeOutStart, fadeOutEnd],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const textY = interpolate(frame, [0, 10], [10, 0], { extrapolateRight: "clamp" });

  if (overlayOpacity <= 0) return null;

  return (
    <AbsoluteFill
      style={{
        background: "rgba(8, 12, 20, 0.93)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: overlayOpacity,
        zIndex: 100,
        fontFamily: FONT,
        direction: "rtl",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, transform: `translateY(${textY}px)` }}>
        {/* Red accent line */}
        <div style={{ width: 52, height: 3, background: "#ef4444", borderRadius: 2 }} />
        {/* Pain text */}
        <div style={{
          fontSize: 32,
          fontWeight: 900,
          color: "white",
          textAlign: "center",
          lineHeight: 1.3,
          textShadow: "0 2px 20px rgba(0,0,0,0.5)",
          maxWidth: 700,
        }}>
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
