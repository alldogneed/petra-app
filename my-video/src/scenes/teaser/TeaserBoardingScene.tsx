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

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const ROOMS = [
  { id: "A1", dog: "קיירה", owner: "ענבל כהן", checkIn: "6.4", checkOut: "9.4", occupied: true, delay: 55 },
  { id: "A2", dog: "מקס", owner: "יוסי גולן", checkIn: "7.4", checkOut: "10.4", occupied: true, delay: 62 },
  { id: "A3", dog: "", owner: "", checkIn: "", checkOut: "", occupied: false, delay: 68 },
  { id: "B1", dog: "לונה", owner: "עמית שפירא", checkIn: "5.4", checkOut: "8.4", occupied: true, delay: 74 },
  { id: "B2", dog: "נובה", owner: "אורלי מזרחי", checkIn: "6.4", checkOut: "11.4", occupied: true, delay: 80 },
  { id: "B3", dog: "בוני", owner: "לואי מנסור", checkIn: "8.4", checkOut: "12.4", occupied: true, delay: 86 },
  { id: "C1", dog: "", owner: "", checkIn: "", checkOut: "", occupied: false, delay: 92 },
  { id: "C2", dog: "רוקי", owner: "מיכל אברהם", checkIn: "7.4", checkOut: "9.4", occupied: true, delay: 98 },
  { id: "C3", dog: "לילה", owner: "שירה אברמוב", checkIn: "8.4", checkOut: "13.4", occupied: true, delay: 104 },
];

export const TeaserBoardingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [52, 65], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="פנסיון" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity, flexShrink: 0,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>לוח פנסיון</div>
          <div style={{
            background: "#f0fdf4", border: "1px solid #86efac",
            borderRadius: 8, padding: "5px 12px",
            fontSize: 11, fontWeight: 700, color: "#16a34a",
          }}>
            7/9 חדרים תפוסים
          </div>
        </div>

        {/* Room grid */}
        <div style={{
          flex: 1, display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10, padding: "16px 24px",
        }}>
          {ROOMS.map((room) => {
            const p = spring({ frame: frame - room.delay, fps, config: { damping: 200 } });
            const scale = interpolate(p, [0, 1], [0.88, 1]);
            const roomOpacity = interpolate(frame, [room.delay, room.delay + 12], [0, 1], { extrapolateRight: "clamp" });

            return (
              <div key={room.id} style={{
                background: room.occupied ? "white" : "#f8fafc",
                borderRadius: 12,
                border: `1.5px solid ${room.occupied ? "#e2e8f0" : "#e2e8f0"}`,
                borderTop: `3px solid ${room.occupied ? ORANGE : "#e2e8f0"}`,
                padding: "12px 14px",
                opacity: roomOpacity,
                transform: `scale(${scale})`,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>חדר {room.id}</span>
                  {room.occupied && (
                    <span style={{
                      fontSize: 9, background: "#fff7ed", color: ORANGE,
                      borderRadius: 4, padding: "1px 5px", fontWeight: 700,
                    }}>
                      תפוס
                    </span>
                  )}
                  {!room.occupied && (
                    <span style={{
                      fontSize: 9, background: "#f0fdf4", color: "#16a34a",
                      borderRadius: 4, padding: "1px 5px", fontWeight: 700,
                    }}>
                      פנוי
                    </span>
                  )}
                </div>
                {room.occupied ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{room.dog}</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>{room.owner}</div>
                    <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>
                      {room.checkIn} – {room.checkOut}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 500, marginTop: 4 }}>—</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <PainOverlay text="מי בא? מי יצא? איזה חדר?" fadeOutStart={35} fadeOutEnd={52} />
      <BenefitTag text="לוח פנסיון בזמן אמת" appearAt={68} />
    </AbsoluteFill>
  );
};
