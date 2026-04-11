import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface CursorAnimationProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  appearAt: number;
  clickAt?: number;
}

export const CursorAnimation: React.FC<CursorAnimationProps> = ({
  startX, startY, endX, endY,
  appearAt, clickAt,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [appearAt, appearAt + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (opacity <= 0) return null;

  const moveP = spring({ frame: frame - appearAt, fps, config: { damping: 280, stiffness: 75 } });
  const x = interpolate(moveP, [0, 1], [startX, endX]);
  const y = interpolate(moveP, [0, 1], [startY, endY]);

  const clickScale = clickAt
    ? interpolate(
        frame,
        [clickAt, clickAt + 4, clickAt + 10],
        [1, 0.78, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 1;

  const rippleOpacity = clickAt
    ? interpolate(frame, [clickAt, clickAt + 6, clickAt + 22], [0, 0.65, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  const rippleSize = clickAt
    ? interpolate(frame, [clickAt, clickAt + 22], [6, 44], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 88 }}>
      {/* Click ripple */}
      {rippleOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: rippleSize,
            height: rippleSize,
            borderRadius: "50%",
            border: "2px solid rgba(234,88,12,0.7)",
            transform: "translate(-50%, -50%)",
            opacity: rippleOpacity,
          }}
        />
      )}

      {/* Cursor SVG */}
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          opacity,
          transform: `scale(${clickScale})`,
          filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.45))",
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M4.5 2.5 L4.5 19 L8.5 15.5 L11.2 21.5 L13.4 20.6 L10.7 14.5 L17 14.5 Z"
            fill="white"
            stroke="#1e293b"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};
