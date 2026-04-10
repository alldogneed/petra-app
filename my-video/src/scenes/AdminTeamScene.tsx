// src/scenes/AdminTeamScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { AdminTabBar } from "./AdminTabBar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;

const TEAM = [
  { name: "דני כהן",          role: "בעלים",  roleColor: "#ea580c", online: true,  lastSeen: "אונליין עכשיו" },
  { name: "שרה לוי",          role: "מנהל",   roleColor: "#7c3aed", online: true,  lastSeen: "לפני 2 דק׳" },
  { name: "מיכל ברנשטיין",   role: "עובד",   roleColor: "#2563eb", online: false, lastSeen: "לפני 3 שע׳" },
  { name: "יוסי מזרחי",       role: "עובד",   roleColor: "#2563eb", online: false, lastSeen: "לפני יום" },
];

const ROLE_OPTIONS = ["בעלים", "מנהל", "עובד"];

export const AdminTeamScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 60, [0, 30, 60], [0, 1, 0]);
  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  // Edit dropdown appears after rows animate in (around frame 220)
  const dropdownOpacity = interpolate(frame, [220, 240], [0, 1], { extrapolateRight: "clamp" });
  const dropdownP = spring({ frame: frame - 220, fps, config: { damping: 200 } });
  const dropdownY = interpolate(dropdownP, [0, 1], [-8, 0]);

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול ובקרה" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", opacity: 0.6 + pulse * 0.4 }} />
            <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>ניטור פעיל</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>ניהול ובקרה</div>
        </div>
        <AdminTabBar activeTab="צוות" />

        <div style={{ padding: "20px 24px", position: "relative" }}>
          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            {/* Table header */}
            <div style={{
              display: "flex", padding: "10px 18px",
              borderBottom: "1px solid #f1f5f9",
              background: "#fafafa",
            }}>
              {["שם", "תפקיד", "סטטוס", ""].map((h) => (
                <div key={h} style={{ flex: h === "" ? "0 0 60px" : 1, fontSize: 11, fontWeight: 700, color: "#64748b" }}>{h}</div>
              ))}
            </div>

            {TEAM.map((member, i) => {
              const startFrame = 30 + i * 25;
              const rowP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const rowY = interpolate(rowP, [0, 1], [20, 0]);
              const rowOpacity = interpolate(frame, [startFrame, startFrame + 16], [0, 1], { extrapolateRight: "clamp" });
              const isEditing = i === 1; // שרה's row

              return (
                <div key={member.name} style={{ position: "relative" }}>
                  <div style={{
                    display: "flex", alignItems: "center", padding: "12px 18px",
                    borderBottom: i < TEAM.length - 1 ? "1px solid #f8fafc" : "none",
                    background: isEditing && frame >= 220 ? "rgba(234,88,12,0.03)" : "white",
                    opacity: rowOpacity, transform: `translateY(${rowY}px)`,
                  }}>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{member.name}</div>
                    <div style={{ flex: 1 }}>
                      <span style={{
                        background: `${member.roleColor}18`,
                        color: member.roleColor,
                        fontSize: 11, fontWeight: 700,
                        padding: "3px 10px", borderRadius: 99,
                      }}>{member.role}</span>
                    </div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: member.online ? "#22c55e" : "#94a3b8",
                      }} />
                      <span style={{ fontSize: 12, color: "#64748b" }}>{member.lastSeen}</span>
                    </div>
                    <div style={{
                      flex: "0 0 60px",
                      fontSize: 12, fontWeight: 600, color: "#ea580c",
                      cursor: "pointer",
                    }}>ערוך</div>
                  </div>

                  {/* Edit dropdown for שרה */}
                  {isEditing && (
                    <div style={{
                      position: "absolute", left: 60, top: 40,
                      background: "white", borderRadius: 8,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                      border: "1px solid #e2e8f0",
                      zIndex: 10, minWidth: 120,
                      opacity: dropdownOpacity, transform: `translateY(${dropdownY}px)`,
                    }}>
                      {ROLE_OPTIONS.map((opt, j) => (
                        <div key={opt} style={{
                          padding: "9px 14px",
                          fontSize: 13, color: j === 1 ? "#ea580c" : "#374151",
                          fontWeight: j === 1 ? 700 : 500,
                          borderBottom: j < ROLE_OPTIONS.length - 1 ? "1px solid #f1f5f9" : "none",
                          background: j === 1 ? "rgba(234,88,12,0.04)" : "white",
                        }}>
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
