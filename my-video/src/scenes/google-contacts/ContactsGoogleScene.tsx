/**
 * Scene 3: Google Contacts view — the lead appears as a new contact.
 * Shows a Google Contacts-style UI with the synced lead highlighted.
 */
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile } from "remotion";
import { CursorOverlay } from "../CursorOverlay";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

const EXISTING_CONTACTS = [
  { name: "אבי ישראלי", phone: "050-1111111", initials: "אי", color: "#6366f1" },
  { name: "גלית שמעוני", phone: "052-2222222", initials: "גש", color: "#0ea5e9" },
  { name: "חיים ברק", phone: "054-3333333", initials: "חב", color: "#f59e0b" },
];

const NEW_CONTACT = { name: "דנה אברהם", phone: "054-7891234", initials: "דא", color: "#ea580c" };

export const ContactsGoogleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateRight: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  // New contact highlight at ~2s
  const highlightFrame = Math.round(fps * 2);
  const highlightP = spring({ frame: frame - highlightFrame, fps, config: { damping: 12, stiffness: 100 } });

  // Detail panel at ~3s
  const detailFrame = Math.round(fps * 3);
  const detailP = spring({ frame: frame - detailFrame, fps, config: { damping: 15 } });

  const stepOpacity = interpolate(frame, [0, fps * 0.8], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#ffffff", fontFamily: FONT, direction: "rtl", opacity }}>
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
        Step 3 of 3 — Contact Synced
      </div>

      {/* Google Contacts header */}
      <div
        style={{
          borderBottom: "1px solid #e5e7eb",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#4285f4">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
        <div style={{ fontSize: 20, fontWeight: 400, color: "#202124" }}>Google Contacts</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: "#5f6368" }}>or.rabinovich@gmail.com</div>
      </div>

      <div style={{ display: "flex", height: "calc(100% - 65px)" }}>
        {/* Contact list */}
        <div style={{ width: "55%", borderLeft: "1px solid #e5e7eb", padding: "16px 0" }}>
          <div style={{ padding: "0 24px 12px", fontSize: 12, color: "#5f6368", fontWeight: 500, letterSpacing: 0.5 }}>
            אנשי קשר ({EXISTING_CONTACTS.length + (frame >= highlightFrame ? 1 : 0)})
          </div>

          {/* Existing contacts */}
          {EXISTING_CONTACTS.map((contact, i) => (
            <div
              key={i}
              style={{
                padding: "10px 24px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                borderBottom: "1px solid #f3f4f6",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  background: contact.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {contact.initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: "#202124" }}>{contact.name}</div>
                <div style={{ fontSize: 12, color: "#5f6368", direction: "ltr", textAlign: "right" }}>{contact.phone}</div>
              </div>
            </div>
          ))}

          {/* NEW synced contact */}
          {frame >= highlightFrame && (
            <div
              style={{
                padding: "10px 24px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: interpolate(highlightP, [0, 1], [0, 1]) > 0.5 ? "#fff7ed" : "transparent",
                borderBottom: "1px solid #f3f4f6",
                borderRight: `3px solid #ea580c`,
                transform: `translateX(${interpolate(highlightP, [0, 1], [60, 0])}px)`,
                opacity: highlightP,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  background: NEW_CONTACT.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {NEW_CONTACT.initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: "#202124", fontWeight: 600 }}>{NEW_CONTACT.name}</div>
                <div style={{ fontSize: 12, color: "#5f6368", direction: "ltr", textAlign: "right" }}>{NEW_CONTACT.phone}</div>
              </div>
              <div style={{ fontSize: 10, background: "#ea580c", color: "white", padding: "3px 10px", borderRadius: 12, fontWeight: 600 }}>
                NEW — Synced from Petra
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div
          style={{
            flex: 1,
            padding: "40px 32px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: detailP,
            transform: `translateY(${interpolate(detailP, [0, 1], [20, 0])}px)`,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              background: "#ea580c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 28,
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            דא
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, color: "#202124", marginBottom: 4 }}>דנה אברהם</div>
          <div style={{ fontSize: 13, color: "#5f6368", marginBottom: 24 }}>Synced from Petra CRM</div>

          {/* Phone detail */}
          <div style={{ width: "100%", maxWidth: 300, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#5f6368", fontWeight: 500, marginBottom: 4 }}>Phone — Mobile</div>
            <div style={{ fontSize: 15, color: "#1a73e8", direction: "ltr", textAlign: "right" }}>054-7891234</div>
          </div>

          {/* Notes */}
          <div style={{ width: "100%", maxWidth: 300, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#5f6368", fontWeight: 500, marginBottom: 4 }}>Notes</div>
            <div style={{ fontSize: 13, color: "#202124", lineHeight: 1.5 }}>
              שירות מבוקש: טיפוח{"\n"}
              מקור: Petra CRM
            </div>
          </div>

          {/* Petra badge */}
          <div
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              padding: "8px 16px",
              borderRadius: 8,
            }}
          >
            <Img src={staticFile("petra-icon.png")} style={{ width: 20, height: 20 }} />
            <div style={{ fontSize: 12, color: "#9a3412", fontWeight: 600 }}>Auto-synced by Petra</div>
          </div>
        </div>
      </div>
      {/* Animated cursor */}
      <CursorOverlay
        waypoints={[
          { frame: 0, x: 300, y: 150 },
          { frame: Math.round(fps * 1.5), x: 400, y: 280 },
          { frame: highlightFrame, x: 400, y: 280, action: "click" },
          { frame: Math.round(fps * 4), x: 400, y: 280 },
          { frame: Math.round(fps * 6), x: 850, y: 300 },
          { frame: Math.round(fps * 8), x: 850, y: 300 },
        ]}
      />
    </AbsoluteFill>
  );
};
