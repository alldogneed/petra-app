// src/scenes/BookingLinkScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { SettingsTabsBar } from "./SettingsTabsBar";
import { CursorOverlay, CursorWaypoint } from "./CursorOverlay";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

// Timeline (14s = 420 frames)
const COPY_CLICK   = 80;   // "העתק" button clicked
const COPIED_END   = 110;  // "הועתק!" flash ends
const CARD1_START  = 130;  // Instagram card slides in
const CARD2_START  = 160;  // WhatsApp card slides in
const CARD3_START  = 190;  // Facebook card slides in

const CURSOR_WAYPOINTS: CursorWaypoint[] = [
  { frame: 0,         x: 600, y: 300 },
  { frame: 50,        x: 500, y: 300 },
  { frame: COPY_CLICK,x: 180, y: 300, action: "click" },
];

const SHARE_CARDS = [
  { icon: "📸", name: "אינסטגרם",  sub: "שמרו בביו",        color: "#e1306c", start: CARD1_START },
  { icon: "💬", name: "וואטסאפ",   sub: "הוסיפו לחתימה",   color: "#25D366", start: CARD2_START },
  { icon: "📘", name: "פייסבוק",   sub: "פרסמו בדף",        color: "#1877F2", start: CARD3_START },
];

export const BookingLinkScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const copied = frame >= COPY_CLICK && frame < COPIED_END;
  const copiedOpacity = interpolate(frame, [COPY_CLICK, COPY_CLICK + 8, COPIED_END - 8, COPIED_END], [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="הגדרות" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>

        {/* Page header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          opacity: headerOpacity,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הגדרות</div>
        </div>

        <div style={{ opacity: headerOpacity }}>
          <SettingsTabsBar activeTab="הזמנות" />
        </div>

        {/* Link section */}
        <div style={{ padding: "20px 28px", opacity: headerOpacity }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>הלינק שלך להזמנות</div>
          <div style={{
            background: "white", borderRadius: 12, border: "1px solid #e2e8f0",
            padding: "16px 18px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            marginBottom: 32,
          }}>
            <span style={{
              fontSize: 14, fontWeight: 700, color: ORANGE,
              fontFamily: "monospace", flex: 1, direction: "ltr", textAlign: "left",
            }}>
              petra-app.com/book/happy-dog-boarding
            </span>
            <div style={{
              background: copied ? "#22c55e" : ORANGE,
              color: "white", borderRadius: 8, padding: "8px 16px",
              fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0,
              position: "relative",
            }}>
              {copied ? "הועתק! ✓" : "העתק"}
              {copied && (
                <div style={{
                  position: "absolute", top: -30, right: "50%",
                  transform: "translateX(50%)",
                  background: "#22c55e", color: "white",
                  borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700,
                  opacity: copiedOpacity, whiteSpace: "nowrap",
                }}>
                  הועתק ללוח ✓
                </div>
              )}
            </div>
          </div>

          {/* Share cards */}
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>שתפו את הלינק</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {SHARE_CARDS.map((card) => {
              const cardP = spring({ frame: frame - card.start, fps, config: { damping: 200 } });
              const cardX = interpolate(cardP, [0, 1], [40, 0]);
              const cardOpacity = interpolate(frame, [card.start, card.start + 15], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={card.name} style={{
                  background: "white", borderRadius: 14, padding: "18px 22px",
                  border: "1px solid #e2e8f0",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  width: 160,
                  opacity: cardOpacity, transform: `translateX(${cardX}px)`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}>
                  <span style={{ fontSize: 36 }}>{card.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: card.color }}>{card.name}</span>
                  <span style={{ fontSize: 12, color: "#64748b", textAlign: "center" }}>{card.sub}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <CursorOverlay waypoints={CURSOR_WAYPOINTS} />
    </AbsoluteFill>
  );
};
