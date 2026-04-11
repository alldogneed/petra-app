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
import { HighlightBox } from "./HighlightBox";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;
const ORANGE = "#ea580c";

const TEAM = [
  { name: "דנה לוי", role: "בעלים", email: "dana@petra-app.com", status: "פעיל", statusColor: "#22c55e", roleColor: "#7c3aed", roleBg: "#f5f3ff" },
  { name: "אמיר שלום", role: "מנהל", email: "amir@petra-app.com", status: "פעיל", statusColor: "#22c55e", roleColor: "#3b82f6", roleBg: "#eff6ff" },
  { name: "רותי כהן", role: "עובד", email: "ruti@petra-app.com", status: "פעיל", statusColor: "#22c55e", roleColor: "#64748b", roleBg: "#f1f5f9" },
  { name: "נועה ברק", role: "עובד", email: "noa@petra-app.com", status: "ממתין לאישור", statusColor: "#f59e0b", roleColor: "#64748b", roleBg: "#f1f5f9" },
];

// Team card maxWidth:700 → right-aligned in RTL: x=1042-700=342 to x=1042
// Grid cols RTL (right→left): שם(2fr≈190px) | תפקיד(1fr≈95px) | אימייל(2fr≈190px) | סטטוס(1fr≈95px) | פעולות(0.8fr≈76px)
// "+ הוסף עובד" button: first child in RTL flex header → x≈985
// Dana name center ≈ x=940, role badge center ≈ x=800, edit button ≈ x=390
const CURSOR_WAYPOINTS: CursorWaypoint[] = [
  { frame: 0,   x: 535, y: 360 },
  { frame: 22,  x: 990, y: 30 },                       // + הוסף עובד (right side RTL)
  { frame: 52,  x: 990, y: 30, action: "click" },
  { frame: 92,  x: 930, y: 188 },                      // Dana name (first row, שם col = rightmost)
  { frame: 132, x: 800, y: 188 },                      // role badge
  { frame: 162, x: 800, y: 188 },
  { frame: 195, x: 390, y: 188 },                      // edit button (leftmost col)
  { frame: 225, x: 390, y: 188, action: "click" },
  { frame: 265, x: 930, y: 255 },                      // Amir row
  { frame: 302, x: 930, y: 318 },                      // Noa (pending) row
  { frame: 338, x: 450, y: 318 },                      // status "ממתין לאישור"
  { frame: 372, x: 930, y: 318 },
];

export const SettingsTeamScene: React.FC = () => {
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
          transformOrigin: "690px 280px",
        }}
      >
        {/* Vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 70% 70% at 63% 42%, transparent 42%, rgba(15,23,42,0.09) 100%)",
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
              + הוסף עובד
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הגדרות</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>ניהול העסק שלך</span>
            </div>
          </div>

          <SettingsTabsBar activeTab="צוות" opacity={headerOpacity} />

          <div style={{ flex: 1, padding: "20px 28px", overflowY: "hidden" }}>

            {/* Team members card */}
            <div
              style={{
                background: "white",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                padding: "20px 24px",
                opacity: interpolate(frame, [15, 30], [0, 1], { extrapolateRight: "clamp" }),
                maxWidth: 700,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>
                חברי הצוות ({TEAM.length})
              </div>

              {/* Table header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 2fr 1fr 0.8fr",
                  gap: 8,
                  padding: "6px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#94a3b8",
                  letterSpacing: "0.04em",
                  marginBottom: 6,
                }}
              >
                <span>שם</span>
                <span>תפקיד</span>
                <span>אימייל</span>
                <span>סטטוס</span>
                <span></span>
              </div>

              {TEAM.map((member, i) => {
                const mOpacity = interpolate(frame, [28 + i * 10, 42 + i * 10], [0, 1], { extrapolateRight: "clamp" });
                const mX = interpolate(
                  spring({ frame: frame - 28 - i * 10, fps, config: { damping: 200 } }),
                  [0, 1],
                  [12, 0]
                );
                return (
                  <div
                    key={member.name}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 2fr 1fr 0.8fr",
                      gap: 8,
                      padding: "10px 12px",
                      borderBottom: "1px solid #f1f5f9",
                      alignItems: "center",
                      opacity: mOpacity,
                      transform: `translateX(${mX}px)`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #ea580c, #c2410c)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{member.name[0]}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{member.name}</span>
                    </div>

                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: member.roleColor,
                        background: member.roleBg,
                        borderRadius: 99,
                        padding: "2px 8px",
                        display: "inline-block",
                      }}
                    >
                      {member.role}
                    </span>

                    <span style={{ fontSize: 11, color: "#64748b", direction: "ltr", textAlign: "left" }}>{member.email}</span>

                    <span style={{ fontSize: 11, fontWeight: 600, color: member.statusColor }}>{member.status}</span>

                    <div style={{ display: "flex", gap: 4 }}>
                      <div
                        style={{
                          background: "white",
                          border: "1px solid #e2e8f0",
                          borderRadius: 5,
                          padding: "3px 8px",
                          fontSize: 10,
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        עריכה
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Highlights */}
        {/* Dana (first row) — card top=122, inner=142, title+mb=175, header(h=25,mb=6)=206 */}
        <HighlightBox x={342} y={206} width={700} height={52} startFrame={85} endFrame={220} borderRadius={6} />
        {/* Noa pending row — 3 rows × 53px below Dana → y=206+159=365 */}
        <HighlightBox x={342} y={365} width={700} height={52} startFrame={295} endFrame={375} borderRadius={6} />

        <CursorOverlay waypoints={CURSOR_WAYPOINTS} />
      </div>
    </AbsoluteFill>
  );
};
