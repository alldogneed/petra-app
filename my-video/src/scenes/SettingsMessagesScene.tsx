import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { SettingsTabsBar } from "./SettingsTabsBar";
import { CursorOverlay, CursorWaypoint } from "./CursorOverlay";
import { HighlightBox } from "./HighlightBox";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;
const ORANGE = "#ea580c";

const TEMPLATES = [
  { name: "תזכורת לתור", trigger: "48 שעות לפני תור", active: true },
  { name: "אישור הזמנה", trigger: "בעת יצירת הזמנה", active: true },
  { name: "צ׳ק-אאוט מפנסיון", trigger: "ביום הצ׳ק-אאוט", active: true },
  { name: "הודעת ברוכים הבאים", trigger: "לאחר הוספת לקוח", active: false },
];

// RTL 2-col: WA settings (first DOM) → right col x=545–1042 | templates (second DOM) → left col x=28–525
// Toggle inside WA card: last child (right flex end) in RTL → on LEFT side x≈610
// Templates toggles: left col, left edge x≈175
const CURSOR_WAYPOINTS: CursorWaypoint[] = [
  { frame: 0,   x: 535, y: 360 },
  { frame: 32,  x: 615, y: 155 },                      // WA toggle (RTL left side)
  { frame: 65,  x: 615, y: 155, action: "click" },
  { frame: 108, x: 700, y: 250 },                      // reminder hours card
  { frame: 145, x: 700, y: 250 },                      // hover 48h button
  { frame: 168, x: 700, y: 250, action: "click" },
  { frame: 210, x: 180, y: 172 },                      // first template toggle (left col)
  { frame: 242, x: 180, y: 172 },
  { frame: 272, x: 180, y: 228 },                      // third template (צ׳ק-אאוט)
  { frame: 302, x: 180, y: 228, action: "click" },
  { frame: 350, x: 760, y: 165 },                      // back to WA section
];

export const SettingsMessagesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const zoomScale = interpolate(frame, [0, durationInFrames], [1.0, 1.05], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", overflow: "hidden", opacity }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${zoomScale})`,
          transformOrigin: "700px 250px",
        }}
      >
        {/* Vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 70% 70% at 65% 42%, transparent 44%, rgba(15,23,42,0.09) 100%)",
            pointerEvents: "none",
            zIndex: 98,
          }}
        />

        <PetraSidebar activeLabel="הגדרות" />

        <div style={{ marginRight: SIDEBAR_W, display: "flex", flexDirection: "column", height: "100%" }}>

          <div
            style={{
              background: "white",
              borderBottom: "1px solid #e2e8f0",
              padding: "0 28px",
              height: 58,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              opacity: headerOpacity,
            }}
          >
            <div
              style={{
                background: ORANGE,
                color: "white",
                borderRadius: 8,
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              שמור שינויים
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הגדרות</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>ניהול העסק שלך</span>
            </div>
          </div>

          <SettingsTabsBar activeTab="הודעות" opacity={headerOpacity} />

          <div style={{ flex: 1, padding: "20px 28px", overflowY: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

              {/* WhatsApp toggle + reminder hours — right col in RTL */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div
                  style={{
                    background: "white",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    padding: "18px 22px",
                    opacity: interpolate(frame, [15, 28], [0, 1], { extrapolateRight: "clamp" }),
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>פעיל</span>
                      <div style={{ width: 32, height: 18, borderRadius: 99, background: "#22c55e", position: "relative" }}>
                        <div style={{ position: "absolute", top: 2, left: 16, width: 14, height: 14, borderRadius: "50%", background: "white" }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>תזכורות ב-WhatsApp</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
                    שליחת תזכורות אוטומטיות ללקוחות לפני תורים ואירועים.
                  </div>
                </div>

                <div
                  style={{
                    background: "white",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    padding: "18px 22px",
                    opacity: interpolate(frame, [30, 44], [0, 1], { extrapolateRight: "clamp" }),
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>זמן שליחת תזכורת</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["24 שעות", "48 שעות", "72 שעות"].map((h, i) => (
                      <div
                        key={h}
                        style={{
                          padding: "7px 12px",
                          borderRadius: 7,
                          background: i === 1 ? ORANGE : "white",
                          border: `1px solid ${i === 1 ? ORANGE : "#e2e8f0"}`,
                          fontSize: 11,
                          fontWeight: 700,
                          color: i === 1 ? "white" : "#64748b",
                        }}
                      >
                        {h}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Automation templates — left col in RTL */}
              <div
                style={{
                  background: "white",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "20px 22px",
                  opacity: interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" }),
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>תבניות הודעות</div>
                {TEMPLATES.map((t, i) => {
                  const tOpacity = interpolate(frame, [32 + i * 8, 46 + i * 8], [0, 1], { extrapolateRight: "clamp" });
                  return (
                    <div
                      key={t.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: 8,
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        marginBottom: 8,
                        opacity: tOpacity,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            width: 28,
                            height: 16,
                            borderRadius: 99,
                            background: t.active ? "#22c55e" : "#e2e8f0",
                            position: "relative",
                            flexShrink: 0,
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: 2,
                              left: t.active ? 14 : 2,
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              background: "white",
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ flex: 1, marginRight: 12, textAlign: "right" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{t.name}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>{t.trigger}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Highlights */}
        {/* WhatsApp toggle card — right col top=122, card h≈88 */}
        <HighlightBox x={545} y={122} width={497} height={88} startFrame={48} endFrame={140} borderRadius={12} />
        {/* Reminder hours card — starts after WA card(88) + gap(14) = y=224, h≈90 */}
        <HighlightBox x={545} y={224} width={497} height={90} startFrame={135} endFrame={215} borderRadius={12} />
        {/* Templates card — left col top=122, 4 templates, h≈280 */}
        <HighlightBox x={28} y={122} width={497} height={280} startFrame={205} endFrame={360} borderRadius={12} />

        <CursorOverlay waypoints={CURSOR_WAYPOINTS} />
      </div>
    </AbsoluteFill>
  );
};
