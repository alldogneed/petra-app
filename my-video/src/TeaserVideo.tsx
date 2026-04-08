// src/TeaserVideo.tsx
import {
  AbsoluteFill,
  Audio,
  Series,
  interpolate,
  staticFile,
  useVideoConfig,
} from "remotion";
import { TeaserChaosScene } from "./scenes/teaser/TeaserChaosScene";
import { TeaserLogoScene } from "./scenes/teaser/TeaserLogoScene";
import { TeaserCRMScene } from "./scenes/teaser/TeaserCRMScene";
import { TeaserCalendarScene } from "./scenes/teaser/TeaserCalendarScene";
import { TeaserBoardingScene } from "./scenes/teaser/TeaserBoardingScene";
import { TeaserOrdersScene } from "./scenes/teaser/TeaserOrdersScene";
import { TeaserBookingScene } from "./scenes/teaser/TeaserBookingScene";
import { TeaserCTAScene } from "./scenes/teaser/TeaserCTAScene";

// Frame counts (30fps):
// Scene 1 chaos:    60f  (2s)
// Scene 2 logo:     60f  (2s)
// Scene 3 CRM:     150f  (5s)
// Scene 4 calendar:150f  (5s)
// Scene 5 boarding:150f  (5s)
// Scene 6 orders:  150f  (5s)
// Scene 7 booking: 120f  (4s)
// Scene 8 CTA:      60f  (2s)
// Total:           900f (30s)

export const TeaserVideo: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill>
      {/* Background music — low volume, fades out last 1s */}
      <Audio
        src={staticFile("bg-music.mp3")}
        loop
        volume={(f) =>
          interpolate(
            f,
            [0, fps, durationInFrames - fps, durationInFrames],
            [0, 0.12, 0.12, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          )
        }
      />

      <Series>
        <Series.Sequence durationInFrames={60}>
          <TeaserChaosScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={60}>
          <TeaserLogoScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={150} premountFor={fps}>
          <TeaserCRMScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={150} premountFor={fps}>
          <TeaserCalendarScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={150} premountFor={fps}>
          <TeaserBoardingScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={150} premountFor={fps}>
          <TeaserOrdersScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={120} premountFor={fps}>
          <TeaserBookingScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={60}>
          <TeaserCTAScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
