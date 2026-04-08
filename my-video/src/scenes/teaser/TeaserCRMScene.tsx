// src/scenes/teaser/TeaserCRMScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "../PetraSidebar";
import { PainOverlay } from "../../components/teaser/PainOverlay";
import { BenefitTag } from "../../components/teaser/BenefitTag";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const COLUMNS = [
  {
    label: "ליד חדש",
    color: "#ef4444",
    bg: "#fef2f2",
    delay: 55,
    cards: [
      { name: "ענבל כהן", service: "אילוף גורים", overdue: false },
      { name: "מיכל אברהם", service: "חרדת נטישה", overdue: true },
    ],
  },
  {
    label: "נוצר קשר",
    color: "#3b82f6",
    bg: "#eff6ff",
    delay: 70,
    cards: [
      { name: "עמית שפירא", service: "אילוף גורים", overdue: false },
      { name: "נמרוד בן-דוד", service: "שיעור הגנה", overdue: false },
    ],
  },
  {
    label: "סגור",
    color: "#22c55e",
    bg: "#f0fdf4",
    delay: 85,
    cards: [
      { name: "שירה אברמוב", service: "אילוף גורים", overdue: false },
    ],
  },
];

export const TeaserCRMScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [52, 65], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="מערכת מכירות" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity, flexShrink: 0,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>לידים</div>
          <div style={{
            background: ORANGE, color: "white", borderRadius: 8,
            padding: "6px 14px", fontSize: 12, fontWeight: 700,
          }}>
            + ליד חדש
          </div>
        </div>

        {/* Kanban columns */}
        <div style={{ flex: 1, display: "flex", gap: 12, padding: "16px 24px", alignItems: "flex-start" }}>
          {COLUMNS.map((col) => {
            const colP = spring({ frame: frame - col.delay, fps, config: { damping: 200 } });
            const colY = interpolate(colP, [0, 1], [18, 0]);
            const colOpacity = interpolate(frame, [col.delay, col.delay + 12], [0, 1], { extrapolateRight: "clamp" });

            return (
              <div key={col.label} style={{
                flex: 1, opacity: colOpacity, transform: `translateY(${colY}px)`,
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                {/* Column header */}
                <div style={{
                  background: "white", borderRadius: 8, padding: "8px 12px",
                  border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 7,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", flex: 1 }}>{col.label}</span>
                  <span style={{
                    background: col.bg, color: col.color, borderRadius: 99,
                    padding: "1px 7px", fontSize: 10, fontWeight: 700,
                  }}>
                    {col.cards.length}
                  </span>
                </div>

                {/* Cards */}
                {col.cards.map((card, ci) => {
                  const cardDelay = col.delay + 15 + ci * 12;
                  const cardP = spring({ frame: frame - cardDelay, fps, config: { damping: 200 } });
                  const cardY = interpolate(cardP, [0, 1], [14, 0]);
                  const cardOpacity = interpolate(frame, [cardDelay, cardDelay + 10], [0, 1], { extrapolateRight: "clamp" });
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
                        display: "inline-block",
                        border: "1px solid #fed7aa",
                      }}>
                        {card.service}
                      </div>
                      {card.overdue && (
                        <div style={{ fontSize: 9, color: "#dc2626", fontWeight: 700, marginTop: 4 }}>
                          לא קיבל מענה
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pain overlay — fades out by frame 52 */}
      <PainOverlay text="לידים נופלים בין הכסאות" fadeOutStart={35} fadeOutEnd={52} />

      {/* Benefit tag — appears at frame 68 */}
      <BenefitTag text="כל ליד במקום אחד" appearAt={68} />
    </AbsoluteFill>
  );
};
