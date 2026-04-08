import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

interface PainOverlayProps {
  text: string; // e.g. "לידים נופלים בין הכסאות"
  fadeOutStart?: number; // frame when fade-out begins (default: 35)
  fadeOutEnd?: number; // frame when fully gone (default: 50)
}

export const PainOverlay: React.FC<PainOverlayProps> = ({
  text,
  fadeOutStart = 35,
  fadeOutEnd = 50,
}) => {
  const frame = useCurrentFrame();

  const overlayOpacity = interpolate(
    frame,
    [0, 8, fadeOutStart, fadeOutEnd],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const textScale = interpolate(
    frame,
    [0, 12],
    [0.92, 1],
    { extrapolateRight: "clamp" }
  );

  if (overlayOpacity <= 0) return null;

  return (
    <AbsoluteFill
      style={{
        background: "rgba(10, 14, 23, 0.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: overlayOpacity,
        zIndex: 100,
        fontFamily: FONT,
        direction: "rtl",
      }}
    >
      <div
        style={{
          transform: `scale(${textScale})`,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontWeight: 900,
            color: "#ef4444",
            lineHeight: 1,
          }}
        >
          ✗
        </span>
        <span
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "white",
            textAlign: "center",
            lineHeight: 1.3,
            textShadow: "0 2px 12px rgba(0,0,0,0.5)",
          }}
        >
          {text}
        </span>
      </div>
    </AbsoluteFill>
  );
};
