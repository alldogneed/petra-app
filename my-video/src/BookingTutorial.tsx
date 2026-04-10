// src/BookingTutorial.tsx
import {
  AbsoluteFill,
  Audio,
  CalculateMetadataFunction,
  interpolate,
  staticFile,
  useVideoConfig,
} from "remotion";
import { getAudioDuration } from "./get-audio-duration";
// TODO: uncomment after scenes are built
import { Series, Sequence } from "remotion";
import { BookingIntroScene } from "./scenes/BookingIntroScene";
import { BookingCustomerFlowScene } from "./scenes/BookingCustomerFlowScene";
import { BookingCustomerDetailsScene } from "./scenes/BookingCustomerDetailsScene";
import { BookingSetupScene } from "./scenes/BookingSetupScene";
// import { BookingLinkScene } from "./scenes/BookingLinkScene";
// import { BookingNotificationsScene } from "./scenes/BookingNotificationsScene";
// import { BookingOutroScene } from "./scenes/BookingOutroScene";
import { BOOKING_SCENES } from "../voiceover-booking-config";

export type BookingTutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;
const DEFAULT_DURATIONS_FRAMES = BOOKING_SCENES.map((s) => s.defaultDurationSec * FPS);
const AUDIO_FILES = BOOKING_SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculateBookingMetadata: CalculateMetadataFunction<BookingTutorialProps> =
  async () => {
    const durationsFrames = await Promise.all(
      AUDIO_FILES.map(async (file, i) => {
        try {
          const durationSec = await getAudioDuration(staticFile(file));
          return Math.ceil((durationSec + 0.5) * FPS);
        } catch {
          return DEFAULT_DURATIONS_FRAMES[i];
        }
      })
    );
    return {
      durationInFrames: durationsFrames.reduce((sum, d) => sum + d, 0),
      props: { sceneDurationsFrames: durationsFrames },
    };
  };

// TODO: uncomment after scenes are built
const SceneAudio: React.FC<{ file: string }> = ({ file }) => (
  <Sequence layout="none">
    <Audio src={staticFile(file)} />
  </Sequence>
);

export const BookingTutorial: React.FC<BookingTutorialProps> = ({
  sceneDurationsFrames: _sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  // TODO: uncomment after scenes are built
  const [intro, customerFlow, customerDetails, setup] =
    _sceneDurationsFrames;

  return (
    <AbsoluteFill>
      <Audio
        src={staticFile("bg-music.mp3")}
        loop
        volume={(f) =>
          interpolate(
            f,
            [0, fps, durationInFrames - fps * 2, durationInFrames],
            [0, 0.13, 0.13, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          )
        }
      />
      {/* TODO: uncomment after scenes are built */}
      <Series>
        <Series.Sequence durationInFrames={intro} premountFor={fps}>
          <BookingIntroScene />
          <SceneAudio file="voiceover/booking-intro.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={customerFlow} premountFor={fps}>
          <BookingCustomerFlowScene />
          <SceneAudio file="voiceover/booking-customer-flow.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={customerDetails} premountFor={fps}>
          <BookingCustomerDetailsScene />
          <SceneAudio file="voiceover/booking-customer-details.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={setup} premountFor={fps}>
          <BookingSetupScene />
          <SceneAudio file="voiceover/booking-setup.wav" />
        </Series.Sequence>
        {/* TODO: uncomment after scenes are built */}
        {/* <Series.Sequence durationInFrames={link} premountFor={fps}>
          <BookingLinkScene />
          <SceneAudio file="voiceover/booking-link.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={notifications} premountFor={fps}>
          <BookingNotificationsScene />
          <SceneAudio file="voiceover/booking-notifications.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <BookingOutroScene />
          <SceneAudio file="voiceover/booking-outro.wav" />
        </Series.Sequence> */}
      </Series>
    </AbsoluteFill>
  );
};
