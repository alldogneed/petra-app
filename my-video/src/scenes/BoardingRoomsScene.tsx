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

// Real status map from boarding/page.tsx
const STATUS_MAP = {
  occupied:        { label: "תפוס",         color: "#F97316", bg: "#FFF7ED", border: "#FDBA74" },
  available:       { label: "פנוי",          color: "#22C55E", bg: "#F0FDF4", border: "#BBF7D0" },
  needs_cleaning:  { label: "דרוש ניקיון",  color: "#EAB308", bg: "#FEFCE8", border: "#FDE047" },
};

// Stay status colors (inside rooms)
const STAY_COLORS = {
  checked_in: { bg: "#FFF7ED", border: "#FDBA74", label: "נמצא", color: "#F97316" },
  reserved:   { bg: "#F5F3FF", border: "#C4B5FD", label: "הזמנה", color: "#8B5CF6" },
};

const ROOMS = [
  {
    name: "חדר 1",
    type: "רגיל",
    price: 120,
    capacity: 1,
    status: "occupied" as const,
    stay: { pet: "בובו", owner: "ענבל כהן", checkIn: "07/04", checkOut: "10/04", stayStatus: "checked_in" as const },
    delay: 55,
  },
  {
    name: "חדר 2",
    type: "פרמיום",
    price: 180,
    capacity: 1,
    status: "available" as const,
    stay: null,
    delay: 65,
  },
  {
    name: "חדר 3",
    type: "רגיל",
    price: 120,
    capacity: 1,
    status: "occupied" as const,
    stay: { pet: "מקס", owner: "יוסי גולן", checkIn: "08/04", checkOut: "11/04", stayStatus: "checked_in" as const },
    delay: 75,
  },
  {
    name: "חדר 4",
    type: "סוויט",
    price: 250,
    capacity: 2,
    status: "needs_cleaning" as const,
    stay: null,
    delay: 85,
  },
  {
    name: "חדר 5",
    type: "רגיל",
    price: 120,
    capacity: 1,
    status: "available" as const,
    stay: null,
    delay: 95,
  },
  {
    name: "חדר 6",
    type: "פרמיום",
    price: 180,
    capacity: 1,
    status: "occupied" as const,
    stay: { pet: "לונה", owner: "מיכל לוי", checkIn: "09/04", checkOut: "13/04", stayStatus: "reserved" as const },
    delay: 105,
  },
];

// "בובו" drag from room 1 toward room 2 — shows swap
const DRAG_START = 240;
const DRAG_END = 265;

export const BoardingRoomsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [25, 40], [0, 1], { extrapolateRight: "clamp" });
  const sidebarBlur = interpolate(frame, [25, 45], [0, 3], { extrapolateRight: "clamp" });

  const zoomP = spring({ frame: frame - 30, fps, config: { damping: 320, stiffness: 40 } });
  const zoomScale = interpolate(zoomP, [0, 1], [1.0, 1.07]);

  // Drag animation for "בובו" (room 1) after rooms appear
  const dragP = spring({ frame: frame - DRAG_START, fps, config: { damping: 200, stiffness: 80 } });
  const draggedX = interpolate(dragP, [0, 1], [0, -248]); // moves left to room 2 (RTL)
  const draggedY = interpolate(dragP, [0, 1], [0, -8]);
  const dragProgress = interpolate(frame, [DRAG_START, DRAG_END], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dragScale = interpolate(dragProgress, [0, 0.3, 0.7, 1], [1, 1.04, 1.04, 1]);
  const dragShadow = interpolate(dragProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const isDragging = frame >= DRAG_START;

  // Drop zone glow on room 2 during drag
  const dropGlow = isDragging
    ? interpolate(frame, [DRAG_START, DRAG_START + 10], [0, 1], { extrapolateRight: "clamp" })
    : 0;

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>
      {/* Sidebar */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SIDEBAR_W, filter: `blur(${sidebarBlur}px)` }}>
        <PetraSidebar width={SIDEBAR_W} activeLabel="פנסיון" />
      </div>

      {/* Main content */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0 }}>

        {/* Header — outside zoom so it never gets clipped */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity, flexShrink: 0,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>ניהול חדרים</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "4 תפוסים", color: "#F97316", bg: "#FFF7ED", border: "#FDBA74" },
              { label: "2 פנויים", color: "#22C55E", bg: "#F0FDF4", border: "#BBF7D0" },
              { label: "1 ניקיון", color: "#EAB308", bg: "#FEFCE8", border: "#FDE047" },
            ].map((s) => (
              <div key={s.label} style={{
                fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
                background: s.bg, color: s.color, border: `1px solid ${s.border}`,
              }}>{s.label}</div>
            ))}
          </div>
        </div>

        {/* Zoomable area — only room grid, header stays fixed above */}
        <div style={{ overflow: "hidden", flex: 1, height: "calc(100% - 52px)" }}>
        <div style={{ transform: `scale(${zoomScale})`, transformOrigin: "50% 30%", width: "100%", height: "100%" }}>

          {/* Room grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, padding: "16px 24px" }}>
            {ROOMS.map((room, i) => {
              const s = STATUS_MAP[room.status];
              const roomP = spring({ frame: frame - room.delay, fps, config: { damping: 200 } });
              const y = interpolate(roomP, [0, 1], [14, 0]);
              const roomOpacity = interpolate(frame, [room.delay, room.delay + 14], [0, 1], { extrapolateRight: "clamp" });

              const isDropTarget = i === 1 && isDragging;

              return (
                <div key={room.name} style={{
                  background: "white",
                  borderRadius: 10,
                  border: isDropTarget ? `2px dashed ${s.color}` : "1px solid #e2e8f0",
                  overflow: "hidden",
                  opacity: roomOpacity, transform: `translateY(${y}px)`,
                  boxShadow: isDropTarget ? `0 0 16px rgba(34,197,94,${dropGlow * 0.3})` : "0 1px 4px rgba(0,0,0,0.05)",
                }}>
                  {/* Color bar at top — matches real UI */}
                  <div style={{ height: 4, background: s.color }} />

                  {/* Room header */}
                  <div style={{ padding: "10px 12px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{room.name}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700,
                      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                      borderRadius: 99, padding: "2px 7px",
                    }}>{s.label}</span>
                  </div>

                  {/* Room meta */}
                  <div style={{
                    padding: "0 12px 8px",
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 9, color: "#94a3b8",
                  }}>
                    <span style={{ background: "#f1f5f9", borderRadius: 4, padding: "1px 5px" }}>{room.type}</span>
                    <span>1/{room.capacity}</span>
                    <span style={{ marginRight: "auto", color: "#ea580c", fontWeight: 700 }}>₪{room.price}/לילה</span>
                  </div>

                  {/* Stay card or empty drop zone */}
                  <div style={{ padding: "0 10px 10px" }}>
                    {room.stay && !(i === 0 && isDragging) ? (
                      <div style={{
                        background: STAY_COLORS[room.stay.stayStatus].bg,
                        border: `1px solid ${STAY_COLORS[room.stay.stayStatus].border}`,
                        borderRadius: 8, padding: "8px 10px",
                        transform: i === 0 && isDragging
                          ? `translateX(${draggedX}px) translateY(${draggedY}px) scale(${dragScale})`
                          : "none",
                        boxShadow: i === 0 && isDragging && dragShadow > 0.1
                          ? `0 6px 20px rgba(249,115,22,${dragShadow * 0.35})`
                          : "none",
                        position: "relative", zIndex: i === 0 && isDragging ? 20 : 1,
                        cursor: "grab",
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>{room.stay.pet}</div>
                        <div style={{ fontSize: 9, color: "#64748b", marginTop: 1 }}>{room.stay.owner}</div>
                        <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 3 }}>
                          {room.stay.checkIn} → {room.stay.checkOut}
                        </div>
                        <div style={{
                          marginTop: 5, fontSize: 8, fontWeight: 700,
                          color: STAY_COLORS[room.stay.stayStatus].color,
                          background: "rgba(255,255,255,0.7)", borderRadius: 4, padding: "1px 5px",
                          display: "inline-block",
                        }}>
                          {STAY_COLORS[room.stay.stayStatus].label}
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        border: isDropTarget ? `2px dashed #22c55e` : "1.5px dashed #e2e8f0",
                        borderRadius: 8, padding: "12px 0",
                        textAlign: "center", fontSize: 10, color: isDropTarget ? "#22c55e" : "#cbd5e1",
                        background: isDropTarget ? "#f0fdf4" : "transparent",
                        fontWeight: isDropTarget ? 700 : 400,
                      }}>
                        {isDropTarget ? "שחרר כאן ←" : "גרור שהייה לכאן"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Drag hint label */}
          {isDragging && (
            <div style={{
              position: "absolute", bottom: 24, left: 0, right: 0,
              display: "flex", justifyContent: "center",
              opacity: interpolate(frame, [DRAG_START, DRAG_START + 8], [0, 1], { extrapolateRight: "clamp" }),
            }}>
              <div style={{
                background: "#0f172a", color: "white", borderRadius: 8,
                padding: "8px 18px", fontSize: 11, fontWeight: 700,
                boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
              }}>
                גוררים כלב לחדר אחר — שינוי בזמן אמת לכל הצוות
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
