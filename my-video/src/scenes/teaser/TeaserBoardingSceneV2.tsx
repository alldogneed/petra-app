// src/scenes/teaser/TeaserBoardingSceneV2.tsx
import React from "react";
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
const SIDEBAR_W = 210;
const PAIN_FRAMES = 120;

const ROOMS = [
  {
    id: "1", name: "חדר 1 — VIP", type: "סוויט", price: 220,
    status: "occupied", delay: 12,
    stays: [
      { pet: "קיירה", owner: "ענבל כהן", type: "checkedin", date: "יציאה: 9.4" },
      { pet: "מקס", owner: "יוסי גולן", type: "checkedin", date: "יציאה: 10.4" },
    ],
  },
  {
    id: "2", name: "חדר 2", type: "רגיל", price: 150,
    status: "mixed", delay: 26,
    stays: [
      { pet: "לונה", owner: "עמית שפירא", type: "checkedin", date: "יציאה: 8.4" },
      { pet: "נובה", owner: "אורלי מזרחי", type: "reserved", date: "כניסה: 11.4" },
    ],
  },
  {
    id: "3", name: "חדר 3", type: "רגיל", price: 150,
    status: "available", delay: 40,
    stays: [],
  },
];

const STAY_STYLE = {
  checkedin: { bg: "#FFF7ED", border: "#FDBA74", dotColor: "#f97316", dateColor: "#ea580c" },
  reserved:  { bg: "#F5F3FF", border: "#C4B5FD", dotColor: "#a855f7", dateColor: "#7c3aed" },
};

const ROOM_STATUS = {
  occupied:  { barColor: "#f97316", badgeBg: "#fff7ed", badgeColor: "#ea580c", badgeText: "תפוס" },
  mixed:     { barColor: "#f97316", badgeBg: "#fff7ed", badgeColor: "#ea580c", badgeText: "תפוס" },
  available: { barColor: "#22c55e", badgeBg: "#f0fdf4", badgeColor: "#16a34a", badgeText: "פנוי" },
};

export const TeaserBoardingSceneV2: React.FC = () => {
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
  const zoomScale = interpolate(zoomP, [0, 1], [1.0, 1.18]);

  return (
    <AbsoluteFill style={{ background: "#f8fafc", fontFamily: FONT, direction: "rtl" }}>

      <div style={{ position: "absolute", inset: 0, opacity: uiOpacity }}>
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SIDEBAR_W, filter: `blur(${sidebarBlur}px)` }}>
          <PetraSidebar width={SIDEBAR_W} activeLabel="פנסיון" />
        </div>

        <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
          <div style={{ transform: `scale(${zoomScale})`, transformOrigin: "82% 52%", width: "100%", height: "100%" }}>

            <div style={{
              background: "white", borderBottom: "1px solid #e2e8f0",
              padding: "0 24px", height: 52,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              opacity: headerOpacity, flexShrink: 0,
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>פנסיון</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>לוח חדרים</span>
                <div style={{
                  background: "#f0fdf4", border: "1px solid #86efac",
                  borderRadius: 8, padding: "4px 10px",
                  fontSize: 11, fontWeight: 700, color: "#16a34a",
                }}>
                  2/3 חדרים תפוסים
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, padding: "18px 24px" }}>
              {ROOMS.map((room) => {
                const cardP = spring({ frame: uiFrame - room.delay, fps, config: { damping: 200 } });
                const cardY = interpolate(cardP, [0, 1], [16, 0]);
                const cardOpacity = interpolate(uiFrame, [room.delay, room.delay + 14], [0, 1], { extrapolateRight: "clamp" });
                const st = ROOM_STATUS[room.status as keyof typeof ROOM_STATUS];

                return (
                  <div key={room.id} style={{
                    background: "white", borderRadius: 12,
                    border: "1px solid #e2e8f0", overflow: "hidden",
                    opacity: cardOpacity, transform: `translateY(${cardY}px)`,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  }}>
                    <div style={{ height: 5, background: st.barColor }} />
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{ width: 14, height: 14, borderRadius: 2, border: `2px solid ${st.barColor}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ width: 3, height: 3, borderRadius: "50%", background: st.barColor }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>{room.name}</span>
                        </div>
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          background: st.badgeBg, color: st.badgeColor,
                          borderRadius: 99, padding: "2px 7px",
                          border: `1px solid ${st.barColor}22`,
                        }}>
                          {st.badgeText}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 9, color: "#94a3b8" }}>
                        <span>{room.stays.length}/2</span>
                        <span style={{ background: "#f1f5f9", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>{room.type}</span>
                        <span style={{ marginRight: "auto", color: "#ea580c", fontWeight: 700 }}>₪{room.price}/לילה</span>
                      </div>

                      {room.stays.length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          {room.stays.map((stay, si) => {
                            const sStyle = STAY_STYLE[stay.type as keyof typeof STAY_STYLE];
                            const stayDelay = room.delay + 14 + si * 8;
                            const stayOpacity = interpolate(uiFrame, [stayDelay, stayDelay + 10], [0, 1], { extrapolateRight: "clamp" });
                            const stayP = spring({ frame: uiFrame - stayDelay, fps, config: { damping: 200 } });
                            const stayY = interpolate(stayP, [0, 1], [8, 0]);

                            return (
                              <div key={si} style={{
                                background: sStyle.bg,
                                border: `1px solid ${sStyle.border}`,
                                borderRadius: 8, padding: "7px 8px",
                                opacity: stayOpacity,
                                transform: `translateY(${stayY}px)`,
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: sStyle.dotColor, flexShrink: 0 }} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stay.pet}</div>
                                    <div style={{ fontSize: 9, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stay.owner}</div>
                                  </div>
                                </div>
                                <div style={{ fontSize: 9, fontWeight: 600, color: sStyle.dateColor }}>{stay.date}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {room.stays.length === 0 && (
                        <div style={{
                          textAlign: "center", padding: "14px 0",
                          opacity: interpolate(uiFrame, [room.delay + 12, room.delay + 24], [0, 1], { extrapolateRight: "clamp" }),
                        }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%", background: "#f0fdf4",
                            margin: "0 auto 6px", display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#22c55e" }} />
                          </div>
                          <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>פנוי לאורחים</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cursor: clicks on קיירה stay card in VIP room */}
        <CursorAnimation
          startX={640} startY={480}
          endX={960} endY={133}
          appearAt={260}
          clickAt={290}
        />

        <BenefitTag text="מפת חדרים בזמן אמת" appearAt={285} />
      </div>

      {painVisible && (
        <TeaserPainPhase
          mainText="איזה כלב באיזה חדר?"
          subText="אל תסמוך על הזיכרון"
        />
      )}
    </AbsoluteFill>
  );
};
