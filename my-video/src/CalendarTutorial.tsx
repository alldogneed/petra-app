// src/CalendarTutorial.tsx
import {
  AbsoluteFill,
  Audio,
  CalculateMetadataFunction,
  Series,
  Sequence,
  interpolate,
  staticFile,
  useVideoConfig,
} from "remotion";
import { getAudioDuration } from "./get-audio-duration";
import { CalendarIntroScene } from "./scenes/CalendarIntroScene";
import { CalendarWeekScene } from "./scenes/CalendarWeekScene";
import { CalendarAddScene } from "./scenes/CalendarAddScene";
import { CalendarRecurringScene } from "./scenes/CalendarRecurringScene";
import { CalendarAvailabilityScene } from "./scenes/CalendarAvailabilityScene";
// import { CalendarOutroScene } from "./scenes/CalendarOutroScene";
import { CALENDAR_SCENES } from "../voiceover-calendar-config";

export type CalendarTutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;
const DEFAULT_DURATIONS_FRAMES = CALENDAR_SCENES.map((s) => s.defaultDurationSec * FPS);
const AUDIO_FILES = CALENDAR_SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculateCalendarMetadata: CalculateMetadataFunction<CalendarTutorialProps> =
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

export const PetraCalendarTutorial: React.FC<CalendarTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const totalFrames = durationInFrames;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [intro, week, add, recurring, availability, outro] = sceneDurationsFrames;

  return (
    <AbsoluteFill>
      {/* Background music — fades in over 1s, fades out over last 2s */}
      <Audio
        src={staticFile("bg-music.mp3")}
        loop
        volume={(f) =>
          interpolate(
            f,
            [0, fps, totalFrames - fps * 2, totalFrames],
            [0, 0.13, 0.13, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          )
        }
      />
      <Series>
        <Series.Sequence durationInFrames={intro} premountFor={fps}>
          <CalendarIntroScene />
          <Sequence layout="none"><Audio src={staticFile("voiceover/calendar-intro.wav")} /></Sequence>
        </Series.Sequence>
        <Series.Sequence durationInFrames={week} premountFor={fps}>
          <CalendarWeekScene />
          <Sequence layout="none"><Audio src={staticFile("voiceover/calendar-week.wav")} /></Sequence>
        </Series.Sequence>
        <Series.Sequence durationInFrames={add} premountFor={fps}>
          <CalendarAddScene />
          <Sequence layout="none"><Audio src={staticFile("voiceover/calendar-add.wav")} /></Sequence>
        </Series.Sequence>
        <Series.Sequence durationInFrames={recurring} premountFor={fps}>
          <CalendarRecurringScene />
          <Sequence layout="none"><Audio src={staticFile("voiceover/calendar-recurring.wav")} /></Sequence>
        </Series.Sequence>
        <Series.Sequence durationInFrames={availability} premountFor={fps}>
          <CalendarAvailabilityScene />
          <Sequence layout="none"><Audio src={staticFile("voiceover/calendar-availability.wav")} /></Sequence>
        </Series.Sequence>
        <Series.Sequence durationInFrames={outro}>
          {/* placeholder for scene 6 */}
          <AbsoluteFill style={{ background: "#0f172a" }} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
