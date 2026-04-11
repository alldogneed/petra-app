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
import { BoardingIntroScene } from "./scenes/BoardingIntroScene";
import { BoardingRoomsScene } from "./scenes/BoardingRoomsScene";
import { BoardingAutoStayScene } from "./scenes/BoardingAutoStayScene";
import { BoardingCheckinScene } from "./scenes/BoardingCheckinScene";
import { BoardingDailyScene } from "./scenes/BoardingDailyScene";
import { BoardingYardsScene } from "./scenes/BoardingYardsScene";
import { BoardingTabsScene } from "./scenes/BoardingTabsScene";
import { BoardingOutroScene } from "./scenes/BoardingOutroScene";
import { getAudioDuration } from "./get-audio-duration";
import { BOARDING_SCENES } from "../voiceover-boarding-config";

export type BoardingTutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;
const DEFAULT_DURATIONS_FRAMES = BOARDING_SCENES.map((s) => s.defaultDurationSec * FPS);
const AUDIO_FILES = BOARDING_SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculateBoardingMetadata: CalculateMetadataFunction<BoardingTutorialProps> =
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

const SceneAudio: React.FC<{ file: string }> = ({ file }) => (
  <Sequence layout="none">
    <Audio src={staticFile(file)} />
  </Sequence>
);

export const BoardingTutorial: React.FC<BoardingTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [intro, rooms, autoStay, checkin, daily, yards, tabs, outro] =
    sceneDurationsFrames;

  return (
    <AbsoluteFill>
      {/* Background music */}
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
      <Series>
        <Series.Sequence durationInFrames={intro} premountFor={fps}>
          <BoardingIntroScene />
          <SceneAudio file="voiceover/boarding-intro.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={rooms} premountFor={fps}>
          <BoardingRoomsScene />
          <SceneAudio file="voiceover/boarding-rooms.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={autoStay} premountFor={fps}>
          <BoardingAutoStayScene />
          <SceneAudio file="voiceover/boarding-auto-stay.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={checkin} premountFor={fps}>
          <BoardingCheckinScene />
          <SceneAudio file="voiceover/boarding-checkin.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={daily} premountFor={fps}>
          <BoardingDailyScene />
          <SceneAudio file="voiceover/boarding-daily.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={yards} premountFor={fps}>
          <BoardingYardsScene />
          <SceneAudio file="voiceover/boarding-yards.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={tabs} premountFor={fps}>
          <BoardingTabsScene />
          <SceneAudio file="voiceover/boarding-tabs.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <BoardingOutroScene />
          <SceneAudio file="voiceover/boarding-outro.wav" />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
