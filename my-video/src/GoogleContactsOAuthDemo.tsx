/**
 * Google Contacts OAuth Demo — real screenshots walkthrough.
 * For Google OAuth verification — shows the full consent flow.
 */
import { AbsoluteFill, Series, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { CursorOverlay, CursorWaypoint } from "./scenes/CursorOverlay";

const FPS = 30;

type SlideConfig = {
  image: string;
  durationSec: number;
  label: string;
  cursor?: CursorWaypoint[];
};

const SLIDES: SlideConfig[] = [
  {
    image: "oauth-flow/03-disconnected.png",
    durationSec: 5,
    label: "Settings → Integrations: Click \"Connect\" to link Google account",
    cursor: [
      { frame: 0, x: 800, y: 400 },
      { frame: 60, x: 628, y: 270 },
      { frame: 90, x: 628, y: 270 },
      { frame: 120, x: 628, y: 270, action: "click" },
    ],
  },
  {
    image: "oauth-flow/04-account-picker.png",
    durationSec: 4,
    label: "Google Account Picker: User selects their Google account",
    cursor: [
      { frame: 0, x: 700, y: 200 },
      { frame: 40, x: 650, y: 275 },
      { frame: 70, x: 650, y: 275 },
      { frame: 90, x: 650, y: 275, action: "click" },
    ],
  },
  {
    image: "oauth-flow/07-consent-scopes.png",
    durationSec: 8,
    label: "Google OAuth Consent Screen: App requests Calendar + Contacts permissions",
    cursor: [
      { frame: 0, x: 500, y: 300 },
      { frame: 60, x: 265, y: 455 },
      { frame: 90, x: 265, y: 455 },
      { frame: 100, x: 265, y: 455, action: "click" },
      { frame: 140, x: 265, y: 455 },
    ],
  },
  {
    image: "oauth-flow/07-consent-scopes-full.png",
    durationSec: 6,
    label: "User reviews all requested scopes and clicks \"Continue\"",
    cursor: [
      { frame: 0, x: 400, y: 300 },
      { frame: 60, x: 190, y: 660 },
      { frame: 100, x: 190, y: 660 },
      { frame: 130, x: 190, y: 660, action: "click" },
    ],
  },
  {
    image: "oauth-flow/09-connected-success.png",
    durationSec: 5,
    label: "Redirected back to Petra — Google Calendar connected successfully",
    cursor: [
      { frame: 0, x: 900, y: 250 },
      { frame: 60, x: 820, y: 462 },
      { frame: 90, x: 820, y: 462 },
      { frame: 100, x: 820, y: 462, action: "click" },
    ],
  },
  {
    image: "oauth-flow/02-integrations.png",
    durationSec: 5,
    label: "Google Contacts sync toggle is now available — user enables it",
    cursor: [
      { frame: 0, x: 800, y: 350 },
      { frame: 60, x: 820, y: 395 },
      { frame: 90, x: 820, y: 395 },
      { frame: 100, x: 820, y: 395, action: "click" },
    ],
  },
  {
    image: "oauth-flow/10-leads-page.png",
    durationSec: 5,
    label: "Leads page: new leads are automatically synced to Google Contacts",
    cursor: [
      { frame: 0, x: 800, y: 300 },
      { frame: 60, x: 335, y: 116 },
      { frame: 90, x: 335, y: 116 },
      { frame: 100, x: 335, y: 116, action: "click" },
    ],
  },
];

/** Single slide: screenshot + label bar + cursor */
const Slide: React.FC<{ config: SlideConfig }> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, Math.round(fps * 0.3)], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - Math.round(fps * 0.3), durationInFrames], [1, 0], { extrapolateRight: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Screenshot */}
      <Img
        src={staticFile(config.image)}
        style={{ width: "100%", height: "100%", objectFit: "contain", background: "#f1f5f9" }}
      />
      {/* Label bar at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(0,0,0,0.75)",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            background: "#ea580c",
            color: "white",
            padding: "3px 12px",
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          Step {SLIDES.indexOf(config) + 1} / {SLIDES.length}
        </div>
        <div style={{ color: "white", fontSize: 14, fontWeight: 500, fontFamily: "'Segoe UI', Arial, sans-serif" }}>
          {config.label}
        </div>
      </div>
      {/* Cursor */}
      {config.cursor && <CursorOverlay waypoints={config.cursor} />}
    </AbsoluteFill>
  );
};

export const GoogleContactsOAuthDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#f1f5f9" }}>
      <Series>
        {SLIDES.map((slide, i) => (
          <Series.Sequence key={i} durationInFrames={slide.durationSec * FPS}>
            <Slide config={slide} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};

export const OAUTH_DEMO_DURATION = SLIDES.reduce((sum, s) => sum + s.durationSec, 0) * FPS;
