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

// At some frame threshold we "switch" from נתונים to כלבי שירות tab
const SWITCH_FRAME = 420; // ~14s into the 19.9s voiceover, where כלבי שירות is mentioned

// RTL 2-col: export card (first DOM) → right col x=545–1042 | import card (second DOM) → left col x=28–525
// After SWITCH_FRAME: SD content maxWidth:640 → right-aligned: x≈1042-640=402 to x=1042
const CURSOR_WAYPOINTS: CursorWaypoint[] = [
  { frame: 0,   x: 535, y: 360 },
  { frame: 42,  x: 800, y: 258 },                      // ייצוא לקוחות button (right col)
  { frame: 78,  x: 800, y: 258, action: "click" },
  { frame: 122, x: 800, y: 297 },                      // ייצוא הזמנות
  { frame: 158, x: 800, y: 297, action: "click" },
  { frame: 198, x: 295, y: 328 },                      // import card (left col)
  { frame: 242, x: 295, y: 375 },                      // drag zone center
  { frame: 285, x: 310, y: 415 },                      // בחר קובץ button
  { frame: 318, x: 310, y: 415, action: "click" },
  { frame: 368, x: 535, y: 360 },                      // center before switch
  // After SWITCH_FRAME=420:
  { frame: 432, x: 660, y: 152 },                      // SD badge
  { frame: 472, x: 660, y: 152 },
  { frame: 512, x: 720, y: 300 },                      // שלבי אימון row "הגדר" button
  { frame: 548, x: 720, y: 300, action: "click" },
  { frame: 588, x: 720, y: 340 },                      // פרוטוקולים רפואיים row
  { frame: 625, x: 720, y: 340 },
  { frame: 680, x: 535, y: 400 },
];

export const SettingsDataScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const showServiceDogs = frame >= SWITCH_FRAME;

  // Content cross-fade
  const dataOpacity = interpolate(frame, [SWITCH_FRAME - 12, SWITCH_FRAME], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sdOpacity = interpolate(frame, [SWITCH_FRAME, SWITCH_FRAME + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const activeTab = showServiceDogs ? "כלבי שירות" : "נתונים";

  // Zoom shifts focus: data phase → right col | SD phase → SD content
  const zoomFocusX = interpolate(
    frame,
    [SWITCH_FRAME - 30, SWITCH_FRAME + 30],
    [680, 720],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const zoomScale = interpolate(frame, [0, durationInFrames], [1.0, 1.04], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", overflow: "hidden", opacity }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${zoomScale})`,
          transformOrigin: `${zoomFocusX}px 320px`,
        }}
      >
        {/* Vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 70% 70% at 64% 45%, transparent 44%, rgba(15,23,42,0.09) 100%)",
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
            <div style={{ width: 80 }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הגדרות</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>ניהול העסק שלך</span>
            </div>
          </div>

          <SettingsTabsBar activeTab={activeTab} opacity={headerOpacity} />

          {/* Data tab content */}
          <div
            style={{
              position: "absolute",
              top: 58 + 44,
              right: SIDEBAR_W,
              left: 0,
              bottom: 0,
              padding: "20px 28px",
              opacity: dataOpacity,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 700 }}>

              {/* Export card — right col */}
              <div
                style={{
                  background: "white",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "20px 24px",
                  opacity: interpolate(frame, [15, 30], [0, 1], { extrapolateRight: "clamp" }),
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>ייצוא נתונים</div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16, lineHeight: 1.5 }}>
                  ייצוא רשימת הלקוחות, ההזמנות, או הפיננסים לקובץ Excel.
                </div>
                {["ייצוא לקוחות", "ייצוא הזמנות", "ייצוא פיננסי"].map((btn, i) => {
                  const bOpacity = interpolate(frame, [32 + i * 8, 46 + i * 8], [0, 1], { extrapolateRight: "clamp" });
                  return (
                    <div
                      key={btn}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: 8,
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        marginBottom: 8,
                        opacity: bOpacity,
                      }}
                    >
                      <div
                        style={{
                          background: "#22c55e",
                          color: "white",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        Excel
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{btn}</span>
                    </div>
                  );
                })}
              </div>

              {/* Import card — left col */}
              <div
                style={{
                  background: "white",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "20px 24px",
                  opacity: interpolate(frame, [22, 38], [0, 1], { extrapolateRight: "clamp" }),
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>ייבוא נתונים</div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16, lineHeight: 1.5 }}>
                  ייבוא לקוחות מקובץ Excel קיים לתוך המערכת.
                </div>
                <div
                  style={{
                    border: "2px dashed #e2e8f0",
                    borderRadius: 10,
                    padding: "28px 20px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 10,
                    background: "#f8fafc",
                    opacity: interpolate(frame, [45, 60], [0, 1], { extrapolateRight: "clamp" }),
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "rgba(234,88,12,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div style={{ width: 16, height: 16, background: ORANGE, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>גרור קובץ לכאן</span>
                  <div
                    style={{
                      background: ORANGE,
                      color: "white",
                      borderRadius: 7,
                      padding: "7px 16px",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    בחר קובץ
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Service dogs tab content */}
          <div
            style={{
              position: "absolute",
              top: 58 + 44,
              right: SIDEBAR_W,
              left: 0,
              bottom: 0,
              padding: "20px 28px",
              opacity: sdOpacity,
            }}
          >
            <div style={{ maxWidth: 640 }}>
              {/* Special badge */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(124,58,237,0.08)",
                  border: "1px solid rgba(124,58,237,0.3)",
                  borderRadius: 99,
                  padding: "6px 16px",
                  marginBottom: 16,
                  opacity: interpolate(frame, [SWITCH_FRAME + 5, SWITCH_FRAME + 20], [0, 1], { extrapolateRight: "clamp" }),
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed" }}>
                  מנוי מיוחד — מרכזי אילוף כלבי שירות
                </span>
              </div>

              <div
                style={{
                  background: "white",
                  borderRadius: 12,
                  border: "1px solid rgba(124,58,237,0.2)",
                  padding: "24px 28px",
                  opacity: interpolate(frame, [SWITCH_FRAME + 8, SWITCH_FRAME + 22], [0, 1], { extrapolateRight: "clamp" }),
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
                  הגדרות כלבי שירות
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20, lineHeight: 1.6 }}>
                  לשונית זו זמינה רק למנויים המיוחדים של פטרה עבור מרכזי אילוף כלבי שירות. כאן תגדירו את מסגרת העבודה עם הכלבים, הזכאים, ופרוטוקולי הסמכה.
                </div>

                {[
                  { label: "שלבי אימון", desc: "הגדרת שלבי התקדמות הכלב" },
                  { label: "פרוטוקולים רפואיים", desc: "מרכיבי תיק הבריאות לכל כלב" },
                  { label: "סוגי כלבי שירות", desc: "קוגניטיבי, ניידות, עיוורים ועוד" },
                ].map((item, i) => {
                  const iOpacity = interpolate(frame, [SWITCH_FRAME + 18 + i * 10, SWITCH_FRAME + 32 + i * 10], [0, 1], { extrapolateRight: "clamp" });
                  return (
                    <div
                      key={item.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 14px",
                        borderRadius: 8,
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        marginBottom: 8,
                        opacity: iOpacity,
                      }}
                    >
                      <div
                        style={{
                          background: "white",
                          border: "1px solid #e2e8f0",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 10,
                          color: "#7c3aed",
                          fontWeight: 600,
                        }}
                      >
                        הגדר
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{item.label}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>{item.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Highlights */}
        {/* Export card buttons — maxWidth:700 RTL right-aligned grid → export col x=702-1042 (340px wide) */}
        <HighlightBox x={702} y={209} width={340} height={138} startFrame={55} endFrame={175} borderRadius={8} />
        {/* Import card — import col x=342-682, card bottom at y=397 */}
        <HighlightBox x={342} y={122} width={340} height={275} startFrame={192} endFrame={385} borderRadius={12} />
        {/* SD badge + card — badge(y=122,h=26,mb=16) → card at y=164, card h≈295, total from y=122 h≈337 */}
        <HighlightBox x={402} y={122} width={640} height={337} startFrame={438} endFrame={640} borderRadius={12} />

        <CursorOverlay waypoints={CURSOR_WAYPOINTS} />
      </div>
    </AbsoluteFill>
  );
};
