// src/TasksTutorial.tsx
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
import { TasksIntroScene } from "./scenes/TasksIntroScene";
import { TasksOverviewScene } from "./scenes/TasksOverviewScene";
import { TasksCreateScene } from "./scenes/TasksCreateScene";
import { TasksFiltersScene } from "./scenes/TasksFiltersScene";
import { TasksBulkScene } from "./scenes/TasksBulkScene";
import { TasksOutroScene } from "./scenes/TasksOutroScene";
import { TASKS_SCENES } from "../voiceover-tasks-config";

export type TasksTutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;
const DEFAULT_DURATIONS_FRAMES = TASKS_SCENES.map((s) => s.defaultDurationSec * FPS);
const AUDIO_FILES = TASKS_SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculateTasksMetadata: CalculateMetadataFunction<TasksTutorialProps> =
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

export const TasksTutorial: React.FC<TasksTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [intro, overview, create, filters, bulk, outro] = sceneDurationsFrames;

  return (
    <AbsoluteFill>
      <Audio
        src={staticFile("teaser-music.mp3")}
        loop
        volume={(f) =>
          interpolate(
            f,
            [0, fps, durationInFrames - fps * 2, durationInFrames],
            [0, 0.12, 0.12, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          )
        }
      />
      <Series>
        <Series.Sequence durationInFrames={intro} premountFor={fps}>
          <TasksIntroScene />
          <SceneAudio file="voiceover/tasks-intro.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={overview} premountFor={fps}>
          <TasksOverviewScene />
          <SceneAudio file="voiceover/tasks-overview.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={create} premountFor={fps}>
          <TasksCreateScene />
          <SceneAudio file="voiceover/tasks-create.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={filters} premountFor={fps}>
          <TasksFiltersScene />
          <SceneAudio file="voiceover/tasks-filters.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={bulk} premountFor={fps}>
          <TasksBulkScene />
          <SceneAudio file="voiceover/tasks-bulk.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <TasksOutroScene />
          <SceneAudio file="voiceover/tasks-outro.wav" />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
