// src/TeaserVideo.tsx
import {
  AbsoluteFill,
  Audio,
  Series,
  interpolate,
  staticFile,
  useVideoConfig,
} from "remotion";
import { TeaserHookScene } from "./scenes/teaser/TeaserHookScene";
import { TeaserLogoSceneV2 } from "./scenes/teaser/TeaserLogoSceneV2";
import { TeaserLeadsSceneV2 } from "./scenes/teaser/TeaserLeadsSceneV2";
import { TeaserBoardingSceneV2 } from "./scenes/teaser/TeaserBoardingSceneV2";
import { TeaserBookingSceneV2 } from "./scenes/teaser/TeaserBookingSceneV2";
import { TeaserRemindersScene } from "./scenes/teaser/TeaserRemindersScene";
import { TeaserUSPScene } from "./scenes/teaser/TeaserUSPScene";
import { TeaserCTASceneV2 } from "./scenes/teaser/TeaserCTASceneV2";

// Frame counts (30fps):
// Scene 1 hook:       240f  (8s)
// Scene 2 logo:       150f  (5s)
// Scene 3 leads:      450f (15s)
// Scene 4 boarding:   450f (15s)
// Scene 5 booking:    450f (15s)
// Scene 6 reminders:  450f (15s)
// Scene 7 usp:        270f  (9s)
// Scene 8 cta:        240f  (8s)
// Total:             2700f (90s)

export const TeaserVideo: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Audio
        src={staticFile("teaser-music.mp3")}
        loop
        volume={(f) =>
          interpolate(
            f,
            [0, fps, durationInFrames - fps, durationInFrames],
            [0, 0.18, 0.18, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          )
        }
      />

      <Series>
        <Series.Sequence durationInFrames={240}>
          <TeaserHookScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={150}>
          <TeaserLogoSceneV2 />
        </Series.Sequence>

        <Series.Sequence durationInFrames={450} premountFor={fps}>
          <TeaserLeadsSceneV2 />
        </Series.Sequence>

        <Series.Sequence durationInFrames={450} premountFor={fps}>
          <TeaserBoardingSceneV2 />
        </Series.Sequence>

        <Series.Sequence durationInFrames={450} premountFor={fps}>
          <TeaserBookingSceneV2 />
        </Series.Sequence>

        <Series.Sequence durationInFrames={450} premountFor={fps}>
          <TeaserRemindersScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={270}>
          <TeaserUSPScene />
        </Series.Sequence>

        <Series.Sequence durationInFrames={240}>
          <TeaserCTASceneV2 />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
