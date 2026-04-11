// src/scenes/teaser/TeaserBoardingScene.tsx
import React from "react";
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
import { CursorAnimation } from "../../components/teaser/CursorAnimation";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;

// Room data — matches real boarding board structure
const ROOMS = [
  {
    id: "1", name: "חדר 1 — VIP", type: "סוויט", price: 220,
    status: "occupied", delay: 55,
    stays: [
      { pet: "קיירה", owner: "ענבל כהן", type: "checkedin", date: "יציאה: 9.4" },
      { pet: "מקס", owner: "יוסי גולן", type: "checkedin", date: "יציאה: 10.4" },
    ],
  },
  {
    id: "2", name: "חדר 2", type: "רגיל", price: 150,
    status: "mixed", delay: 70,
    stays: [
      { pet: "לונה", owner: "עמית שפירא", type: "checkedin", date: "יציאה: 8.4" },
      { pet: "נובה", owner: "אורלי מזרחי", type: "reserved", date: "כניסה: 11.4" },
    ],
  },
  {
    id: "3", name: "חדר 3", type: "רגיל", price: 150,
    status: "available", delay: 85,
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

export const TeaserBoardingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [52, 65], [0, 1], { extrapolateRight: "clamp" });
  const sidebarBlur = interpolate(frame, [52, 70], [0, 3.5], { extrapolateRight: "clamp" });

  // Zoom into Room 1 (occupied, right side in RTL)
  const zoomP = spring({ frame: frame - 54, fps, config: { damping: 320, stiffness: 45 } });
  const zoomScale = interpolate(zoomP, [0, 1], [1.0, 1.2]);

  return (
    <AbsoluteFill style={{ background: "#f8fafc", fontFamily: FONT, direction: "rtl" }}>
      {/* Sidebar with blur */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SIDEBAR_W, filter: `blur(${sidebarBlur}px)` }}>
        <PetraSidebar width={SIDEBAR_W} activeLabel="פנסיון" />
      </div>

      {/* Zoomable content area */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
        <div style={{ transform: `scale(${zoomScale})`, transformOrigin: "82% 52%", width: "100%", height: "100%" }}>

          {/* Page header */}
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

          {/* Room grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14, padding: "18px 24px",
          }}>
            {ROOMS.map((room) => {
              const cardP = spring({ frame: frame - room.delay, fps, config: { damping: 200 } });
              const cardY = interpolate(cardP, [0, 1], [16, 0]);
              const cardOpacity = interpolate(frame, [room.delay, room.delay + 14], [0, 1], { extrapolateRight: "clamp" });
              const st = ROOM_STATUS[room.status as keyof typeof ROOM_STATUS];

              return (
                <div key={room.id} style={{
                  background: "white", borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                  opacity: cardOpacity, transform: `translateY(${cardY}px)`,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}>
                  {/* Colored top bar */}
                  <div style={{ height: 5, background: st.barColor }} />

                  <div style={{ padding: "12px 14px" }}>
                    {/* Room header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        {/* Door icon (simplified) */}
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

                    {/* Meta row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 9, color: "#94a3b8" }}>
                      <span>{room.stays.length}/{room.status === "available" ? 2 : 2}</span>
                      <span style={{ background: "#f1f5f9", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>{room.type}</span>
                      <span style={{ marginRight: "auto", color: "#ea580c", fontWeight: 700 }}>₪{room.price}/לילה</span>
                    </div>

                    {/* Stay mini-cards in 2-column grid */}
                    {room.stays.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                        {room.stays.map((stay, si) => {
                          const sStyle = STAY_STYLE[stay.type as keyof typeof STAY_STYLE];
                          const stayDelay = room.delay + 14 + si * 8;
                          const stayOpacity = interpolate(frame, [stayDelay, stayDelay + 10], [0, 1], { extrapolateRight: "clamp" });
                          const stayP = spring({ frame: frame - stayDelay, fps, config: { damping: 200 } });
                          const stayY = interpolate(stayP, [0, 1], [8, 0]);

                          // Glow on stay cards when they appear
                          const glowProgress = interpolate(frame, [stayDelay + 8, stayDelay + 30], [0, 1], { extrapolateRight: "clamp" });
                          const glowOpacity = interpolate(glowProgress, [0, 0.3, 1], [0, 1, 0]);

                          return (
                            <div key={si} style={{
                              background: sStyle.bg,
                              border: `1px solid ${sStyle.border}`,
                              borderRadius: 8,
                              padding: "7px 8px",
                              opacity: stayOpacity,
                              transform: `translateY(${stayY}px)`,
                              boxShadow: glowOpacity > 0.05
                                ? `0 0 12px ${stay.type === "checkedin" ? `rgba(249,115,22,${glowOpacity * 0.4})` : `rgba(168,85,247,${glowOpacity * 0.4})`}`
                                : "none",
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                                {/* PawPrint dot */}
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

                    {/* Empty state */}
                    {room.stays.length === 0 && (
                      <div style={{
                        textAlign: "center", padding: "14px 0",
                        opacity: interpolate(frame, [room.delay + 12, room.delay + 24], [0, 1], { extrapolateRight: "clamp" }),
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: "#f0fdf4",
                          margin: "0 auto 6px",
                          display: "flex", alignItems: "center", justifyContent: "center",
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

      {/* Cursor hovering over Room 1 stay card */}
      <CursorAnimation
        startX={640} startY={480}
        endX={870} endY={270}
        appearAt={62}
      />

      <PainOverlay text="מי בא? מי יצא? איזה חדר?" fadeOutStart={35} fadeOutEnd={52} />
      <BenefitTag text="לוח פנסיון בזמן אמת" appearAt={68} />
    </AbsoluteFill>
  );
};
