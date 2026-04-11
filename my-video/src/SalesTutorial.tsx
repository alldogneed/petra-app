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
import { SalesIntroScene } from "./scenes/SalesIntroScene";
import { SalesProblemScene } from "./scenes/SalesProblemScene";
import { SalesKanbanScene } from "./scenes/SalesKanbanScene";
import { SalesLeadCardScene } from "./scenes/SalesLeadCardScene";
import { SalesActionsScene } from "./scenes/SalesActionsScene";
import { SalesStageSetupScene } from "./scenes/SalesStageSetupScene";
import { SalesAddLeadScene } from "./scenes/SalesAddLeadScene";
import { SalesOutroScene } from "./scenes/SalesOutroScene";
import { getAudioDuration } from "./get-audio-duration";
import { SALES_SCENES } from "../voiceover-sales-config";

export type SalesTutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;
const DEFAULT_DURATIONS_FRAMES = SALES_SCENES.map((s) => s.defaultDurationSec * FPS);
const AUDIO_FILES = SALES_SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculateSalesMetadata: CalculateMetadataFunction<SalesTutorialProps> =
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

export const SalesTutorial: React.FC<SalesTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [intro, problem, kanban, leadCard, actions, stages, addLead, outro] =
    sceneDurationsFrames;

  return (
    <AbsoluteFill>
      {/* Background music — fades in over 1s, fades out over last 2s */}
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
          <SalesIntroScene />
          <SceneAudio file="voiceover/sales-intro.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={problem} premountFor={fps}>
          <SalesProblemScene />
          <SceneAudio file="voiceover/sales-problem.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={kanban} premountFor={fps}>
          <SalesKanbanScene />
          <SceneAudio file="voiceover/sales-kanban.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={leadCard} premountFor={fps}>
          <SalesLeadCardScene />
          <SceneAudio file="voiceover/sales-lead-card.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={actions} premountFor={fps}>
          <SalesActionsScene />
          <SceneAudio file="voiceover/sales-actions.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={stages} premountFor={fps}>
          <SalesStageSetupScene />
          <SceneAudio file="voiceover/sales-stages.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={addLead} premountFor={fps}>
          <SalesAddLeadScene />
          <SceneAudio file="voiceover/sales-add-lead.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <SalesOutroScene />
          <SceneAudio file="voiceover/sales-outro.wav" />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
