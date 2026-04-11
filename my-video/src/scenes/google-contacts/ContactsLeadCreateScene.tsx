/**
 * Scene 2: Leads page — user creates a new lead with name + phone.
 * The lead appears in the kanban board.
 */
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { PetraSidebar } from "../PetraSidebar";
import { CursorOverlay } from "../CursorOverlay";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;

const STAGE_COLORS = ["#3b82f6", "#f59e0b", "#8b5cf6", "#10b981"];
const STAGES = ["חדש", "נוצר קשר", "הצעת מחיר", "סגירה"];

const EXISTING_LEADS = [
  { name: "יוסי כהן", phone: "050-1234567", service: "אילוף" },
  { name: "מיכל לוי", phone: "052-9876543", service: "פנסיון" },
];

export const ContactsLeadCreateScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateRight: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  // Modal appears at ~1.5s
  const modalFrame = Math.round(fps * 1.5);
  const modalP = spring({ frame: frame - modalFrame, fps, config: { damping: 15 } });
  const showModal = frame >= modalFrame;

  // Form fills at ~3s
  const fillFrame = Math.round(fps * 3);
  const nameProgress = interpolate(frame, [fillFrame, fillFrame + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const phoneProgress = interpolate(frame, [fillFrame + 15, fillFrame + 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const serviceProgress = interpolate(frame, [fillFrame + 30, fillFrame + 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Submit at ~5s
  const submitFrame = Math.round(fps * 5);
  const submitted = frame >= submitFrame;

  // New card appears in kanban at ~5.5s
  const cardFrame = Math.round(fps * 5.5);
  const cardP = spring({ frame: frame - cardFrame, fps, config: { damping: 12 } });

  const stepOpacity = interpolate(frame, [0, fps * 0.8], [0, 1], { extrapolateRight: "clamp" });

  const nameText = "דנה אברהם";
  const phoneText = "054-7891234";
  const serviceText = "טיפוח";
  const visibleName = nameText.slice(0, Math.round(nameProgress * nameText.length));
  const visiblePhone = phoneText.slice(0, Math.round(phoneProgress * phoneText.length));

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="מערכת מכירות" />

      {/* Step indicator */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          background: "#ea580c",
          color: "white",
          padding: "6px 18px",
          borderRadius: 20,
          fontSize: 14,
          fontWeight: 700,
          opacity: stepOpacity,
          zIndex: 20,
        }}
      >
        Step 2 of 3 — Create a Lead
      </div>

      {/* Main content */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: SIDEBAR_W,
          left: 0,
          bottom: 0,
          padding: "24px 32px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a" }}>מערכת מכירות — לידים</div>
          <div
            style={{
              background: "#ea580c",
              color: "white",
              padding: "8px 20px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            + ליד חדש
          </div>
        </div>

        {/* Kanban columns */}
        <div style={{ display: "flex", gap: 12, height: "calc(100% - 70px)" }}>
          {STAGES.map((stage, i) => (
            <div key={stage} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 5, background: STAGE_COLORS[i] }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{stage}</div>
              </div>
              {/* Existing leads in first column */}
              {i === 0 && EXISTING_LEADS.map((lead, j) => (
                <div
                  key={j}
                  style={{
                    background: "white",
                    borderRadius: 8,
                    padding: "12px 14px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{lead.name}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{lead.phone}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>{lead.service}</div>
                </div>
              ))}
              {/* New lead card */}
              {i === 0 && frame >= cardFrame && (
                <div
                  style={{
                    background: "white",
                    borderRadius: 8,
                    padding: "12px 14px",
                    boxShadow: "0 2px 8px rgba(234,88,12,0.15)",
                    border: "2px solid #ea580c",
                    transform: `scale(${interpolate(cardP, [0, 1], [0.8, 1])})`,
                    opacity: cardP,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>דנה אברהם</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>054-7891234</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>טיפוח</div>
                  <div style={{ fontSize: 9, color: "#ea580c", fontWeight: 600, marginTop: 4 }}>
                    + נוסף ל-Google Contacts
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal overlay */}
      {showModal && !submitted && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `rgba(0,0,0,${interpolate(modalP, [0, 1], [0, 0.4])})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 30,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: "28px 32px",
              width: 380,
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
              transform: `scale(${interpolate(modalP, [0, 1], [0.9, 1])})`,
              opacity: modalP,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 20 }}>ליד חדש</div>

            {/* Name field */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>שם</div>
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 12px", fontSize: 14, color: "#0f172a", minHeight: 20 }}>
                {visibleName}
                {nameProgress > 0 && nameProgress < 1 && <span style={{ borderRight: "2px solid #0f172a", marginRight: 1 }} />}
              </div>
            </div>

            {/* Phone field */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>טלפון</div>
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 12px", fontSize: 14, color: "#0f172a", direction: "ltr", textAlign: "right", minHeight: 20 }}>
                {visiblePhone}
              </div>
            </div>

            {/* Service field */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>שירות מבוקש</div>
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 12px", fontSize: 14, color: serviceProgress > 0.5 ? "#0f172a" : "#94a3b8", minHeight: 20 }}>
                {serviceProgress > 0.5 ? serviceText : ""}
              </div>
            </div>

            {/* Submit button */}
            <div
              style={{
                background: "#ea580c",
                color: "white",
                padding: "10px 0",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 700,
                textAlign: "center",
              }}
            >
              שמור ליד
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {submitted && frame < cardFrame && (
        <div
          style={{
            position: "absolute",
            bottom: 30,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#166534",
            color: "white",
            padding: "10px 24px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            zIndex: 30,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          ליד נוצר בהצלחה — מסנכרן ל-Google Contacts...
        </div>
      )}
      {/* Animated cursor */}
      <CursorOverlay
        waypoints={[
          { frame: 0, x: 500, y: 300 },
          { frame: Math.round(fps * 0.8), x: 190, y: 48 },
          { frame: Math.round(fps * 1.2), x: 190, y: 48 },
          { frame: modalFrame, x: 190, y: 48, action: "click" },
          { frame: Math.round(fps * 2.5), x: 580, y: 295 },
          { frame: fillFrame, x: 580, y: 295, action: "click" },
          { frame: Math.round(fps * 3.5), x: 580, y: 355 },
          { frame: Math.round(fps * 3.8), x: 580, y: 355, action: "click" },
          { frame: Math.round(fps * 4.2), x: 580, y: 415 },
          { frame: Math.round(fps * 4.5), x: 580, y: 415, action: "click" },
          { frame: Math.round(fps * 4.8), x: 580, y: 470 },
          { frame: submitFrame, x: 580, y: 470, action: "click" },
          { frame: Math.round(fps * 6), x: 400, y: 300 },
        ]}
      />
    </AbsoluteFill>
  );
};
