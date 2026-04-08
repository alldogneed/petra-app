import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;
const ORANGE = "#ea580c";

const STATUSES = [
  { id: "draft",     label: "טיוטה",    color: "#94a3b8", bg: "#f1f5f9" },
  { id: "confirmed", label: "אושרה",    color: "#3b82f6", bg: "#eff6ff" },
  { id: "completed", label: "הושלמה",   color: "#22c55e", bg: "#f0fdf4" },
];

export const OrdersLifecycleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });
  const cardProgress = spring({ frame: frame - 15, fps, config: { damping: 200 } });
  const cardOpacity = interpolate(frame, [15, 28], [0, 1], { extrapolateRight: "clamp" });
  const cardY = interpolate(cardProgress, [0, 1], [20, 0]);

  // Status progresses: draft (0-80) → confirmed (80-180) → completed (180+)
  const activeStatusIndex = frame < 80 ? 0 : frame < 200 ? 1 : 2;
  const confirmBtnOpacity = interpolate(frame, [40, 55], [0, 1], { extrapolateRight: "clamp" });
  const confirmBtnPulse = frame < 80
    ? interpolate(frame % 45, [0, 22, 45], [1, 1.04, 1])
    : 1;

  const paymentOpacity = interpolate(frame, [210, 228], [0, 1], { extrapolateRight: "clamp" });
  const paymentProgress = spring({ frame: frame - 210, fps, config: { damping: 200 } });
  const paymentY = interpolate(paymentProgress, [0, 1], [16, 0]);

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="פיננסים" />

      <div style={{
        position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0,
        display: "flex", flexDirection: "column",
      }}>
        {/* Topbar */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>← הזמנות</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>#A3F2B1</span>
          </div>
          <div style={{
            background: STATUSES[activeStatusIndex].bg,
            color: STATUSES[activeStatusIndex].color,
            border: `1.5px solid ${STATUSES[activeStatusIndex].color}44`,
            borderRadius: 99, padding: "4px 14px",
            fontSize: 12, fontWeight: 700,
          }}>
            {STATUSES[activeStatusIndex].label}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "20px 24px", overflowY: "hidden" }}>

          {/* Status stepper */}
          <div style={{
            background: "white", borderRadius: 12,
            border: "1px solid #e2e8f0", padding: "16px 20px",
            marginBottom: 16,
            opacity: cardOpacity, transform: `translateY(${cardY}px)`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              {STATUSES.map((status, i) => {
                const isActive = i === activeStatusIndex;
                const isDone = i < activeStatusIndex;
                return (
                  <React.Fragment key={status.id}>
                    <div style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      flex: 1,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: isActive ? ORANGE : isDone ? "#22c55e" : "#f1f5f9",
                        border: isActive ? `2px solid ${ORANGE}` : isDone ? "2px solid #22c55e" : "2px solid #e2e8f0",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 800,
                        color: isActive || isDone ? "white" : "#94a3b8",
                        transform: isActive ? `scale(${confirmBtnPulse})` : "scale(1)",
                      }}>
                        {isDone ? "✓" : i + 1}
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: isActive ? 700 : 500,
                        color: isActive ? ORANGE : isDone ? "#22c55e" : "#94a3b8",
                      }}>
                        {status.label}
                      </span>
                    </div>
                    {i < STATUSES.length - 1 && (
                      <div style={{
                        flex: 1, height: 2, marginTop: -20,
                        background: isDone ? "#22c55e" : "#e2e8f0",
                      }} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Order info */}
          <div style={{
            background: "white", borderRadius: 12,
            border: "1px solid #e2e8f0", padding: "16px 20px",
            marginBottom: 16,
            opacity: cardOpacity, transform: `translateY(${cardY}px)`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>פרטי הזמנה</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>לקוח</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>דנה כהן</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>שירות</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>לינה פנסיון × 3</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>סה"כ</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>₪450</span>
            </div>
          </div>

          {/* Action button */}
          {activeStatusIndex === 0 && (
            <div style={{
              opacity: confirmBtnOpacity,
              background: ORANGE,
              borderRadius: 12, padding: "14px 24px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              marginBottom: 16, cursor: "pointer",
              boxShadow: "0 4px 16px rgba(234,88,12,0.35)",
              transform: `scale(${confirmBtnPulse})`,
            }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "white" }}>אשר הזמנה</span>
            </div>
          )}

          {/* Payment section */}
          <div style={{
            opacity: paymentOpacity,
            transform: `translateY(${paymentY}px)`,
            background: "white", borderRadius: 12,
            border: "1px solid #e2e8f0", padding: "16px 20px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>תשלום</div>
              <div style={{
                background: "#dcfce7", color: "#16a34a",
                border: "1px solid #bbf7d0",
                borderRadius: 99, padding: "3px 10px",
                fontSize: 11, fontWeight: 700,
              }}>
                שולם ✓
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>₪450 • מזומן • 08.04.2026</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#16a34a" }}>₪450</span>
            </div>
            <div style={{
              background: "#dcfce7",
              border: "1.5px solid #25d366",
              borderRadius: 10, padding: "10px 16px",
              display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#15803d" }}>
                שלח דרישת תשלום בוואטסאפ
              </span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
