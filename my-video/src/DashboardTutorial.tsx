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
import { IntroScene } from "./scenes/IntroScene";
import { StatsScene } from "./scenes/StatsScene";
import { AppointmentsScene } from "./scenes/AppointmentsScene";
import { OrdersScene } from "./scenes/OrdersScene";
import { ChecklistScene } from "./scenes/ChecklistScene";
import { OutroScene } from "./scenes/OutroScene";
import { getAudioDuration } from "./get-audio-duration";
import { SCENES } from "../voiceover-config";

export type TutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;

const DEFAULT_DURATIONS_FRAMES = SCENES.map((s) => s.defaultDurationSec * FPS);

const AUDIO_FILES = SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculateMetadata: CalculateMetadataFunction<TutorialProps> = async () => {
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

export const DashboardTutorial: React.FC<TutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps } = useVideoConfig();
  const [intro, stats, appointments, orders, checklist, outro] =
    sceneDurationsFrames;

  return (
    <AbsoluteFill>
      <Series>
        <Series.Sequence durationInFrames={intro} premountFor={fps}>
          <IntroScene />
          <SceneAudio file="voiceover/intro.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={stats} premountFor={fps}>
          <StatsScene />
          <SceneAudio file="voiceover/stats.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={appointments} premountFor={fps}>
          <AppointmentsScene />
          <SceneAudio file="voiceover/appointments.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={orders} premountFor={fps}>
          <OrdersScene />
          <SceneAudio file="voiceover/orders.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={checklist} premountFor={fps}>
          <ChecklistScene />
          <SceneAudio file="voiceover/checklist.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <OutroScene />
          <SceneAudio file="voiceover/outro.wav" />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

// ─── PetraDashboardTutorial (renovated, v2) ───────────────────────────────
import { DASHBOARD_SCENES } from "../voiceover-dashboard-config";

// Scene imports — uncommented as tasks complete:
import { DashboardIntroScene } from "./scenes/DashboardIntroScene";
// import { DashboardStatsScene } from "./scenes/DashboardStatsScene";
// import { DashboardAppointmentsScene } from "./scenes/DashboardAppointmentsScene";
// import { DashboardOrdersScene } from "./scenes/DashboardOrdersScene";
// import { DashboardChecklistScene } from "./scenes/DashboardChecklistScene";
// import { DashboardOutroScene } from "./scenes/DashboardOutroScene";

export type DashboardTutorialProps = {
  sceneDurationsFrames: number[];
};

const DASHBOARD_AUDIO_FILES = DASHBOARD_SCENES.map((s) => `voiceover/${s.id}.wav`);
const DASHBOARD_DEFAULT_FRAMES = DASHBOARD_SCENES.map((s) => s.defaultDurationSec * FPS);

export const calculateDashboardMetadata: CalculateMetadataFunction<DashboardTutorialProps> =
  async () => {
    const durationsFrames = await Promise.all(
      DASHBOARD_AUDIO_FILES.map(async (file, i) => {
        try {
          const durationSec = await getAudioDuration(staticFile(file));
          return Math.ceil((durationSec + 0.5) * FPS);
        } catch {
          return DASHBOARD_DEFAULT_FRAMES[i];
        }
      })
    );
    return {
      durationInFrames: durationsFrames.reduce((sum, d) => sum + d, 0),
      props: { sceneDurationsFrames: durationsFrames },
    };
  };

export const PetraDashboardTutorial: React.FC<DashboardTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [
    _intro = 360,
    _stats = 450,
    _appointments = 450,
    _orders = 390,
    _checklist = 390,
    _outro = 300,
  ] = sceneDurationsFrames;

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
        {/* Scene sequences — uncommented as tasks complete: */}
        <Series.Sequence durationInFrames={_intro} premountFor={fps}>
          <DashboardIntroScene />
          <SceneAudio file="voiceover/dashboard-intro.wav" />
        </Series.Sequence>
        {/*
        <Series.Sequence durationInFrames={_stats} premountFor={fps}>
          <DashboardStatsScene />
          <SceneAudio file="voiceover/dashboard-stats.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={_appointments} premountFor={fps}>
          <DashboardAppointmentsScene />
          <SceneAudio file="voiceover/dashboard-appointments.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={_orders} premountFor={fps}>
          <DashboardOrdersScene />
          <SceneAudio file="voiceover/dashboard-orders.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={_checklist} premountFor={fps}>
          <DashboardChecklistScene />
          <SceneAudio file="voiceover/dashboard-checklist.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={_outro} premountFor={fps}>
          <DashboardOutroScene />
          <SceneAudio file="voiceover/dashboard-outro.wav" />
        </Series.Sequence>
        */}
      </Series>
    </AbsoluteFill>
  );
};
