// src/scenes/teaser/TeaserRemindersScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "../PetraSidebar";
import { TeaserPainPhase } from "../../components/teaser/TeaserPainPhase";
import { BenefitTag } from "../../components/teaser/BenefitTag";
import { CursorAnimation } from "../../components/teaser/CursorAnimation";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;
const PAIN_FRAMES = 120;
const CLICK_HOURS_FRAME = 210; // absolute frame when cursor clicks "48 שעות"

const TABS = ["פרטי העסק", "הזמנות", "פנסיון", "תשלומים", "צוות", "הודעות", "נתונים"];

export const TeaserRemindersScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const uiFrame = Math.max(0, frame - PAIN_FRAMES);
  const painVisible = frame <= 120;

  const uiOpacity = interpolate(frame, [112, 128], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerOpacity = interpolate(uiFrame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const sidebarBlur = interpolate(uiFrame, [5, 22], [0, 3.5], { extrapolateRight: "clamp" });

  const zoomP = spring({ frame: uiFrame - 8, fps, config: { damping: 320, stiffness: 45 } });
  const zoomScale = interpolate(zoomP, [0, 1], [1.0, 1.08]);

  const waCardOpacity = interpolate(uiFrame, [12, 28], [0, 1], { extrapolateRight: "clamp" });
  const timingCardOpacity = interpolate(uiFrame, [22, 38], [0, 1], { extrapolateRight: "clamp" });
  const templatesCardOpacity = interpolate(uiFrame, [18, 34], [0, 1], { extrapolateRight: "clamp" });

  // "48 שעות" becomes selected after cursor clicks
  const is48Selected = frame >= CLICK_HOURS_FRAME + 4;

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>

      <div style={{ position: "absolute", inset: 0, opacity: uiOpacity }}>
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SIDEBAR_W, filter: `blur(${sidebarBlur}px)` }}>
          <PetraSidebar width={SIDEBAR_W} activeLabel="הגדרות" />
        </div>

        <div style={{ marginRight: SIDEBAR_W, display: "flex", flexDirection: "column", height: "100%" }}>

          {/* Header */}
          <div style={{
            background: "white", borderBottom: "1px solid #e2e8f0",
            padding: "0 28px", height: 58,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            opacity: headerOpacity,
          }}>
            <div style={{ background: ORANGE, color: "white", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700 }}>
              שמור שינויים
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הגדרות</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>ניהול העסק שלך</span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            background: "white", borderBottom: "1px solid #e2e8f0",
            display: "flex", padding: "0 28px", opacity: headerOpacity,
          }}>
            {TABS.map((tab) => (
              <div key={tab} style={{
                padding: "12px 14px 10px",
                fontSize: 12,
                fontWeight: tab === "הודעות" ? 700 : 500,
                color: tab === "הודעות" ? ORANGE : "#64748b",
                borderBottom: tab === "הודעות" ? `2px solid ${ORANGE}` : "2px solid transparent",
                whiteSpace: "nowrap",
              }}>
                {tab}
              </div>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, padding: "20px 28px", overflowY: "hidden" }}>
            <div style={{
              transform: `scale(${zoomScale})`,
              transformOrigin: "700px 200px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
            }}>

              {/* Right col: WhatsApp + timing */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* WhatsApp toggle */}
                <div style={{
                  background: "white", borderRadius: 12, border: "1px solid #e2e8f0",
                  padding: "18px 22px", opacity: waCardOpacity,
                }}>
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

                {/* Reminder timing */}
                <div style={{
                  background: "white", borderRadius: 12, border: "1px solid #e2e8f0",
                  padding: "18px 22px", opacity: timingCardOpacity,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>זמן שליחת תזכורת</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["24 שעות", "48 שעות", "72 שעות"].map((h, i) => {
                      const isSelected = i === 1 && is48Selected;
                      return (
                        <div key={h} style={{
                          padding: "7px 12px", borderRadius: 7,
                          background: isSelected ? ORANGE : "white",
                          border: `1px solid ${isSelected ? ORANGE : "#e2e8f0"}`,
                          fontSize: 11, fontWeight: 700,
                          color: isSelected ? "white" : "#64748b",
                        }}>
                          {h}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Left col: message templates */}
              <div style={{
                background: "white", borderRadius: 12, border: "1px solid #e2e8f0",
                padding: "20px 22px", opacity: templatesCardOpacity,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>תבניות הודעות</div>
                {[
                  { name: "תזכורת לתור", trigger: "48 שעות לפני תור", active: true },
                  { name: "אישור הזמנה", trigger: "בעת יצירת הזמנה", active: true },
                  { name: "צ׳ק-אאוט מפנסיון", trigger: "ביום הצ׳ק-אאוט", active: true },
                  { name: "הודעת ברוכים הבאים", trigger: "לאחר הוספת לקוח", active: false },
                ].map((t, i) => {
                  const tOpacity = interpolate(uiFrame, [28 + i * 8, 42 + i * 8], [0, 1], { extrapolateRight: "clamp" });
                  return (
                    <div key={t.name} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", borderRadius: 8,
                      background: "#f8fafc", border: "1px solid #e2e8f0",
                      marginBottom: 8, opacity: tOpacity,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 28, height: 16, borderRadius: 99,
                          background: t.active ? "#22c55e" : "#e2e8f0",
                          position: "relative", flexShrink: 0,
                        }}>
                          <div style={{
                            position: "absolute", top: 2,
                            left: t.active ? 14 : 2,
                            width: 12, height: 12, borderRadius: "50%", background: "white",
                          }} />
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

        {/* Cursor: moves to "48 שעות" button and clicks */}
        <CursorAnimation
          startX={615} startY={250}
          endX={928} endY={281}
          appearAt={188}
          clickAt={CLICK_HOURS_FRAME}
        />

        <BenefitTag text="תזכורת אוטומטית לכל תור" appearAt={275} />
      </div>

      {painVisible && (
        <TeaserPainPhase
          mainText="ביטול ברגע האחרון?"
          subText="כי שכחו. ואתה לא הזכרת."
        />
      )}
    </AbsoluteFill>
  );
};
