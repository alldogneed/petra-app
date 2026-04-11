import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;

// Drag animation: "בובו" card moves from yard A to yard B at frame 110
const DRAG_START = 108;
const DRAG_END = 128;

const YARDS = [
  {
    name: "חצר א׳",
    type: "קטנים",
    color: "#3b82f6",
    bg: "#eff6ff",
    dogs: [
      { name: "לונה", breed: "פודל", room: "חדר 2", delay: 55 },
      { name: "בובו", breed: "לברדור", room: "חדר 3", delay: 65, isDragged: true },
    ],
  },
  {
    name: "חצר ב׳",
    type: "גדולים",
    color: "#10b981",
    bg: "#f0fdf4",
    dogs: [
      { name: "מקס", breed: "גרמני", room: "חדר 5", delay: 70 },
    ],
  },
  {
    name: "חצר ג׳",
    type: "מיוחד",
    color: "#f59e0b",
    bg: "#fffbeb",
    dogs: [],
  },
];

export const BoardingYardsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" });
  const sidebarBlur = interpolate(frame, [20, 38], [0, 3], { extrapolateRight: "clamp" });

  // Drag progress for "בובו"
  const dragP = interpolate(frame, [DRAG_START, DRAG_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dragSpring = spring({ frame: frame - DRAG_START, fps, config: { damping: 200, stiffness: 80 } });
  const draggedX = interpolate(dragSpring, [0, 1], [0, 280]); // moves right to next yard
  const draggedY = interpolate(dragSpring, [0, 1], [0, -20]);
  const draggedScale = interpolate(dragP, [0, 0.3, 0.7, 1], [1, 1.06, 1.06, 1]);
  const draggedRotate = interpolate(dragP, [0, 0.2, 0.8, 1], [0, -4, -4, 0]);
  const draggedShadow = interpolate(dragP, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>
      {/* Sidebar */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SIDEBAR_W, filter: `blur(${sidebarBlur}px)` }}>
        <PetraSidebar width={SIDEBAR_W} activeLabel="פנסיון" />
      </div>

      {/* Main content */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0 }}>

        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>ניהול חצרות</div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>3 חצרות פעילות</div>
        </div>

        {/* Yards grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, padding: "20px 24px" }}>
          {YARDS.map((yard, yi) => {
            const yardDelay = 38 + yi * 10;
            const yardP = spring({ frame: frame - yardDelay, fps, config: { damping: 200 } });
            const yardY = interpolate(yardP, [0, 1], [16, 0]);
            const yardOpacity = interpolate(frame, [yardDelay, yardDelay + 14], [0, 1], { extrapolateRight: "clamp" });

            // Drop zone glow when dragged card approaches yard B
            const isDropTarget = yi === 1;
            const dropGlow = isDropTarget ? interpolate(frame, [DRAG_START, DRAG_START + 12], [0, 1], { extrapolateRight: "clamp" }) : 0;

            return (
              <div key={yard.name} style={{
                background: "white", borderRadius: 14,
                border: dropGlow > 0.1 ? `2px dashed ${yard.color}` : "1.5px solid #e2e8f0",
                padding: "14px", minHeight: 220,
                opacity: yardOpacity, transform: `translateY(${yardY}px)`,
                boxShadow: dropGlow > 0.1 ? `0 0 20px rgba(16,185,129,${dropGlow * 0.25})` : "0 1px 6px rgba(0,0,0,0.04)",
                transition: "border 0.2s, box-shadow 0.2s",
              }}>
                {/* Yard header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: yard.color }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{yard.name}</span>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 700, background: yard.bg, color: yard.color,
                    borderRadius: 99, padding: "2px 8px", border: `1px solid ${yard.color}33`,
                  }}>{yard.type}</span>
                </div>

                {/* Dog cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {yard.dogs.map((dog) => {
                    const dogDelay = dog.delay;
                    const dogP = spring({ frame: frame - dogDelay, fps, config: { damping: 200 } });
                    const dogY = interpolate(dogP, [0, 1], [10, 0]);
                    const dogOpacity = interpolate(frame, [dogDelay, dogDelay + 12], [0, 1], { extrapolateRight: "clamp" });

                    const isDragged = dog.isDragged && frame >= DRAG_START;

                    return (
                      <div key={dog.name} style={{
                        background: isDragged ? "rgba(234,88,12,0.06)" : "#f8fafc",
                        borderRadius: 8, border: `1px solid ${isDragged ? "#fed7aa" : "#e2e8f0"}`,
                        padding: "9px 11px",
                        opacity: isDragged ? Math.max(0, dogOpacity - dragP) : dogOpacity,
                        transform: isDragged
                          ? `translateX(${draggedX}px) translateY(${draggedY}px) scale(${draggedScale}) rotate(${draggedRotate}deg)`
                          : `translateY(${dogY}px)`,
                        boxShadow: isDragged && draggedShadow > 0.1 ? `0 8px 24px rgba(234,88,12,${draggedShadow * 0.35})` : "none",
                        zIndex: isDragged ? 10 : 1,
                        position: "relative",
                        cursor: "grab",
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{dog.name}</div>
                        <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>{dog.breed} · {dog.room}</div>
                      </div>
                    );
                  })}

                  {yard.dogs.length === 0 && (
                    <div style={{
                      borderRadius: 8, border: "1.5px dashed #e2e8f0",
                      padding: "16px", textAlign: "center",
                      fontSize: 11, color: "#cbd5e1",
                    }}>
                      גרור כלב לכאן
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
