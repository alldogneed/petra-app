import { useCurrentFrame } from "remotion";

export type CursorWaypoint = {
  frame: number;
  x: number;
  y: number;
  action?: "click";
};

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export const CursorOverlay: React.FC<{ waypoints: CursorWaypoint[] }> = ({ waypoints }) => {
  const frame = useCurrentFrame();
  if (!waypoints.length) return null;

  let curX = waypoints[0].x;
  let curY = waypoints[0].y;

  if (frame >= waypoints[waypoints.length - 1].frame) {
    curX = waypoints[waypoints.length - 1].x;
    curY = waypoints[waypoints.length - 1].y;
  } else {
    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];
      if (frame >= from.frame && frame < to.frame) {
        const t = (frame - from.frame) / (to.frame - from.frame);
        const e = easeInOut(t);
        curX = from.x + (to.x - from.x) * e;
        curY = from.y + (to.y - from.y) * e;
        break;
      }
    }
  }

  // Click ripple: triggered for 22 frames after a "click" waypoint
  let clickProgress = -1;
  for (const wp of waypoints) {
    if (wp.action === "click" && frame >= wp.frame && frame < wp.frame + 22) {
      clickProgress = (frame - wp.frame) / 22;
      break;
    }
  }
  const isClicking = clickProgress >= 0;

  return (
    <div
      style={{
        position: "absolute",
        left: curX - 3,
        top: curY - 2,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      {/* Outer ring */}
      {isClicking && (
        <div
          style={{
            position: "absolute",
            left: -(22 * clickProgress) + 3,
            top: -(22 * clickProgress) + 2,
            width: 44 * clickProgress,
            height: 44 * clickProgress,
            borderRadius: "50%",
            border: `2px solid rgba(234,88,12,${(1 - clickProgress) * 0.9})`,
            pointerEvents: "none",
          }}
        />
      )}
      {/* Inner fill */}
      {isClicking && clickProgress < 0.6 && (
        <div
          style={{
            position: "absolute",
            left: -(10 * clickProgress) + 3,
            top: -(10 * clickProgress) + 2,
            width: 20 * clickProgress,
            height: 20 * clickProgress,
            borderRadius: "50%",
            background: `rgba(234,88,12,${(1 - clickProgress) * 0.35})`,
            pointerEvents: "none",
          }}
        />
      )}
      {/* Cursor arrow */}
      <svg
        width="22"
        height="24"
        viewBox="0 0 16 22"
        style={{
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
          transform: isClicking ? `scale(${1 - clickProgress * 0.1})` : "none",
          transformOrigin: "3px 2px",
        }}
      >
        <path
          d="M0.5 0.5 L0.5 16 L4.5 12.5 L7 19 L10 17.5 L7.5 10.5 H14.5 Z"
          fill="white"
          stroke="#1e293b"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
