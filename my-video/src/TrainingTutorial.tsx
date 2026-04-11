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
import { TrainingIntroScene } from "./scenes/TrainingIntroScene";
import { TrainingOverviewScene } from "./scenes/TrainingOverviewScene";
import { TrainingProgramListScene } from "./scenes/TrainingProgramListScene";
import { TrainingProgramDetailScene } from "./scenes/TrainingProgramDetailScene";
import { TrainingLogSessionScene } from "./scenes/TrainingLogSessionScene";
import { TrainingAddManualScene } from "./scenes/TrainingAddManualScene";
import { TrainingGroupScene } from "./scenes/TrainingGroupScene";
import { TrainingOutroScene } from "./scenes/TrainingOutroScene";
import { getAudioDuration } from "./get-audio-duration";
import { TRAINING_SCENES } from "../voiceover-training-config";

export type TrainingTutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;
const DEFAULT_DURATIONS_FRAMES = TRAINING_SCENES.map((s) => s.defaultDurationSec * FPS);
const AUDIO_FILES = TRAINING_SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculateTrainingMetadata: CalculateMetadataFunction<TrainingTutorialProps> =
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

export const TrainingTutorial: React.FC<TrainingTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [intro, overview, programList, programDetail, logSession, addManual, group, outro] =
    sceneDurationsFrames;

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
      <Series>
        <Series.Sequence durationInFrames={intro} premountFor={fps}>
          <TrainingIntroScene />
          <SceneAudio file="voiceover/training-intro.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={overview} premountFor={fps}>
          <TrainingOverviewScene />
          <SceneAudio file="voiceover/training-overview.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={programList} premountFor={fps}>
          <TrainingProgramListScene />
          <SceneAudio file="voiceover/training-program-list.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={programDetail} premountFor={fps}>
          <TrainingProgramDetailScene />
          <SceneAudio file="voiceover/training-program-detail.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={logSession} premountFor={fps}>
          <TrainingLogSessionScene />
          <SceneAudio file="voiceover/training-log-session.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={addManual} premountFor={fps}>
          <TrainingAddManualScene />
          <SceneAudio file="voiceover/training-add-manual.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={group} premountFor={fps}>
          <TrainingGroupScene />
          <SceneAudio file="voiceover/training-group.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <TrainingOutroScene />
          <SceneAudio file="voiceover/training-outro.wav" />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
