// src/TeaserVideoShort.tsx — ~25s social version, hard cuts, strongest scenes
import {
  AbsoluteFill,
  Audio,
  interpolate,
  staticFile,
  useVideoConfig,
} from "remotion";
import { Series } from "remotion";
import { TeaserLogoScene } from "./scenes/teaser/TeaserLogoScene";
import { TeaserBookingScene } from "./scenes/teaser/TeaserBookingScene";
import { TeaserCalendarScene } from "./scenes/teaser/TeaserCalendarScene";
import { TeaserWhatsAppScene } from "./scenes/teaser/TeaserWhatsAppScene";
import { TeaserOrdersScene } from "./scenes/teaser/TeaserOrdersScene";
import { TeaserCTAScene } from "./scenes/teaser/TeaserCTAScene";

// Logo:     60f  (2s)
// Booking: 150f  (5s)
// Calendar:150f  (5s)
// WhatsApp:150f  (5s)
// Orders:  150f  (5s)
// CTA:      75f  (2.5s)
// Total:   735f ≈ 24.5s

export const TeaserVideoShort: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Audio
        src={staticFile("teaser-music.mp3")}
        loop
        volume={(f) =>
          interpolate(
            f,
            [0, fps * 0.5, durationInFrames - fps * 0.5, durationInFrames],
            [0, 0.18, 0.18, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          )
        }
      />

      <Series>
        <Series.Sequence durationInFrames={60}>
          <TeaserLogoScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={150}>
          <TeaserBookingScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={150}>
          <TeaserCalendarScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={150}>
          <TeaserWhatsAppScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={150}>
          <TeaserOrdersScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={75}>
          <TeaserCTAScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
