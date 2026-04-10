// src/scenes/teaser/TeaserLeadsSceneV2.tsx
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
import { HighlightBox } from "../HighlightBox";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;
const PAIN_FRAMES = 120;

const COLUMNS = [
  {
    label: "ליד חדש", color: "#ef4444", bg: "#fef2f2", delay: 12,
    cards: [
      { name: "ענבל כהן", service: "אילוף גורים", overdue: false },
      { name: "מיכל אברהם", service: "חרדת נטישה", overdue: true },
    ],
  },
  {
    label: "נוצר קשר", color: "#3b82f6", bg: "#eff6ff", delay: 26,
    cards: [
      { name: "עמית שפירא", service: "אילוף גורים", overdue: false },
      { name: "נמרוד בן-דוד", service: "שיעור הגנה", overdue: false },
    ],
  },
  {
    label: "סגור", color: "#22c55e", bg: "#f0fdf4", delay: 40,
    cards: [
      { name: "שירה אברמוב", service: "אילוף גורים", overdue: false },
    ],
  },
];

export const TeaserLeadsSceneV2: React.FC = () => {
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
  const zoomScale = interpolate(zoomP, [0, 1], [1.0, 1.14]);

  return (
    <AbsoluteFill style={{ background: "#f8fafc", fontFamily: FONT, direction: "rtl" }}>

      <div style={{ position: "absolute", inset: 0, opacity: uiOpacity }}>
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SIDEBAR_W, filter: `blur(${sidebarBlur}px)` }}>
          <PetraSidebar width={SIDEBAR_W} activeLabel="מערכת מכירות" />
        </div>

        <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
          <div style={{ transform: `scale(${zoomScale})`, transformOrigin: "84% 42%", width: "100%", height: "100%" }}>

            <div style={{
              background: "white", borderBottom: "1px solid #e2e8f0",
              padding: "0 24px", height: 52,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              opacity: headerOpacity, flexShrink: 0,
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>לידים</div>
              <div style={{ background: ORANGE, color: "white", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700 }}>
                + ליד חדש
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", gap: 12, padding: "16px 24px", alignItems: "flex-start" }}>
              {COLUMNS.map((col) => {
                const colP = spring({ frame: uiFrame - col.delay, fps, config: { damping: 200 } });
                const colY = interpolate(colP, [0, 1], [18, 0]);
                const colOpacity = interpolate(uiFrame, [col.delay, col.delay + 12], [0, 1], { extrapolateRight: "clamp" });

                return (
                  <div key={col.label} style={{ flex: 1, opacity: colOpacity, transform: `translateY(${colY}px)`, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{
                      background: "white", borderRadius: 8, padding: "8px 12px",
                      border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 7,
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", flex: 1 }}>{col.label}</span>
                      <span style={{ background: col.bg, color: col.color, borderRadius: 99, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                        {col.cards.length}
                      </span>
                    </div>

                    {col.cards.map((card, ci) => {
                      const cardDelay = col.delay + 15 + ci * 12;
                      const cardP = spring({ frame: uiFrame - cardDelay, fps, config: { damping: 200 } });
                      const cardY = interpolate(cardP, [0, 1], [14, 0]);
                      const cardOpacity = interpolate(uiFrame, [cardDelay, cardDelay + 10], [0, 1], { extrapolateRight: "clamp" });

                      return (
                        <div key={card.name} style={{
                          background: "white", borderRadius: 8,
                          border: "1px solid #e8edf2",
                          borderRight: `3px solid ${col.color}`,
                          padding: "10px 12px",
                          opacity: cardOpacity,
                          transform: `translateY(${cardY}px)`,
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{card.name}</div>
                          <div style={{
                            fontSize: 10, fontWeight: 600,
                            background: "#fff7ed", color: ORANGE,
                            borderRadius: 4, padding: "2px 6px",
                            display: "inline-block", border: "1px solid #fed7aa",
                          }}>
                            {card.service}
                          </div>
                          {card.overdue && (
                            <div style={{ fontSize: 9, color: "#dc2626", fontWeight: 700, marginTop: 4 }}>לא קיבל מענה</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cursor: appears at absolute frame 260, clicks at 290 */}
        <CursorAnimation
          startX={640} startY={460}
          endX={940} endY={175}
          appearAt={260}
          clickAt={290}
        />

        {/* BenefitTag appears at absolute frame 280 */}
        <BenefitTag text="כל ליד מתועד ועוקב אוטומטית" appearAt={280} />
      </div>

      {/* HighlightBox: first card in ליד חדש column — adjust x/y after preview if needed */}
      <HighlightBox x={660} y={130} width={250} height={82} startFrame={265} endFrame={390} borderRadius={8} />

      {painVisible && (
        <TeaserPainPhase
          mainText="לידים שנעלמים בין הצ׳אטים"
          subText="כמה פניות השבוע לא קיבלו מענה?"
        />
      )}
    </AbsoluteFill>
  );
};
