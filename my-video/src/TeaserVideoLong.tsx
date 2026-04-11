// src/TeaserVideoLong.tsx — ~48s website version with slide transitions
import {
  AbsoluteFill,
  Audio,
  interpolate,
  staticFile,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { TeaserChaosScene } from "./scenes/teaser/TeaserChaosScene";
import { TeaserLogoScene } from "./scenes/teaser/TeaserLogoScene";
import { TeaserCRMScene } from "./scenes/teaser/TeaserCRMScene";
import { TeaserCalendarScene } from "./scenes/teaser/TeaserCalendarScene";
import { TeaserBoardingScene } from "./scenes/teaser/TeaserBoardingScene";
import { TeaserOrdersScene } from "./scenes/teaser/TeaserOrdersScene";
import { TeaserBookingScene } from "./scenes/teaser/TeaserBookingScene";
import { TeaserWhatsAppScene } from "./scenes/teaser/TeaserWhatsAppScene";
import { TeaserDashboardScene } from "./scenes/teaser/TeaserDashboardScene";
import { TeaserCTAScene } from "./scenes/teaser/TeaserCTAScene";

// Scene durations (30fps):
// Chaos:    60f  (2s)
// Logo:     60f  (2s)
// CRM:     150f  (5s)
// Calendar:150f  (5s)
// Boarding:150f  (5s)
// Orders:  150f  (5s)
// Booking: 150f  (5s)
// WhatsApp:150f  (5s)
// Dashboard:150f (5s)
// CTA:      90f  (3s)
// 9 transitions × 18f = 162f overlap
// Total: 1260 + 162 = 1422f ≈ 47.4s

const TRANSITION = linearTiming({ durationInFrames: 18 });
const SLIDE = slide({ direction: "from-left" });

export const TeaserVideoLong: React.FC = () => {
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

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={60}>
          <TeaserChaosScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={SLIDE} timing={TRANSITION} />

        <TransitionSeries.Sequence durationInFrames={60}>
          <TeaserLogoScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={SLIDE} timing={TRANSITION} />

        <TransitionSeries.Sequence durationInFrames={150}>
          <TeaserCRMScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={SLIDE} timing={TRANSITION} />

        <TransitionSeries.Sequence durationInFrames={150}>
          <TeaserCalendarScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={SLIDE} timing={TRANSITION} />

        <TransitionSeries.Sequence durationInFrames={150}>
          <TeaserBoardingScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={SLIDE} timing={TRANSITION} />

        <TransitionSeries.Sequence durationInFrames={150}>
          <TeaserOrdersScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={SLIDE} timing={TRANSITION} />

        <TransitionSeries.Sequence durationInFrames={150}>
          <TeaserBookingScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={SLIDE} timing={TRANSITION} />

        <TransitionSeries.Sequence durationInFrames={150}>
          <TeaserWhatsAppScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={SLIDE} timing={TRANSITION} />

        <TransitionSeries.Sequence durationInFrames={150}>
          <TeaserDashboardScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={SLIDE} timing={TRANSITION} />

        <TransitionSeries.Sequence durationInFrames={90}>
          <TeaserCTAScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
