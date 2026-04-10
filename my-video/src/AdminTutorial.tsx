// src/AdminTutorial.tsx
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
import { AdminIntroScene } from "./scenes/AdminIntroScene";
import { AdminOverviewScene } from "./scenes/AdminOverviewScene";
import { AdminActivityScene } from "./scenes/AdminActivityScene";
import { AdminTeamScene } from "./scenes/AdminTeamScene";
import { AdminSessionsScene } from "./scenes/AdminSessionsScene";
import { AdminMessagesScene } from "./scenes/AdminMessagesScene";
import { AdminSubscriptionScene } from "./scenes/AdminSubscriptionScene";
import { AdminOutroScene } from "./scenes/AdminOutroScene";
import { ADMIN_SCENES } from "../voiceover-admin-config";

export type AdminTutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;
const DEFAULT_DURATIONS_FRAMES = ADMIN_SCENES.map((s) => s.defaultDurationSec * FPS);
const AUDIO_FILES = ADMIN_SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculateAdminMetadata: CalculateMetadataFunction<AdminTutorialProps> =
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

export const PetraAdminTutorial: React.FC<AdminTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [intro, overview, activity, team, sessions, messages, subscription, outro] =
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
          <AdminIntroScene />
          <SceneAudio file="voiceover/admin-intro.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={overview} premountFor={fps}>
          <AdminOverviewScene />
          <SceneAudio file="voiceover/admin-overview.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={activity} premountFor={fps}>
          <AdminActivityScene />
          <SceneAudio file="voiceover/admin-activity.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={team} premountFor={fps}>
          <AdminTeamScene />
          <SceneAudio file="voiceover/admin-team.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sessions} premountFor={fps}>
          <AdminSessionsScene />
          <SceneAudio file="voiceover/admin-sessions.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={messages} premountFor={fps}>
          <AdminMessagesScene />
          <SceneAudio file="voiceover/admin-messages.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={subscription} premountFor={fps}>
          <AdminSubscriptionScene />
          <SceneAudio file="voiceover/admin-subscription.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <AdminOutroScene />
          <SceneAudio file="voiceover/admin-outro.wav" />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
