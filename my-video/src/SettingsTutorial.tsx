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
import { SettingsIntroScene } from "./scenes/SettingsIntroScene";
import { SettingsBusinessScene } from "./scenes/SettingsBusinessScene";
import { SettingsOrdersScene } from "./scenes/SettingsOrdersScene";
import { SettingsBoardingScene } from "./scenes/SettingsBoardingScene";
import { SettingsPaymentsScene } from "./scenes/SettingsPaymentsScene";
import { SettingsTeamScene } from "./scenes/SettingsTeamScene";
import { SettingsMessagesScene } from "./scenes/SettingsMessagesScene";
import { SettingsIntegrationsScene } from "./scenes/SettingsIntegrationsScene";
import { SettingsDataScene } from "./scenes/SettingsDataScene";
import { SettingsOutroScene } from "./scenes/SettingsOutroScene";
import { getAudioDuration } from "./get-audio-duration";
import { SETTINGS_SCENES } from "../voiceover-settings-config";

export type SettingsTutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;
const DEFAULT_DURATIONS_FRAMES = SETTINGS_SCENES.map((s) => s.defaultDurationSec * FPS);
const AUDIO_FILES = SETTINGS_SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculateSettingsMetadata: CalculateMetadataFunction<SettingsTutorialProps> =
  async () => {
    const durationsFrames = await Promise.all(
      AUDIO_FILES.map(async (file, i) => {
        try {
          const durationSec = await getAudioDuration(staticFile(file));
          return Math.max(Math.ceil((durationSec + 1.0) * FPS), DEFAULT_DURATIONS_FRAMES[i]);
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

export const SettingsTutorial: React.FC<SettingsTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [intro, business, orders, boarding, payments, team, messages, integrations, data, outro] =
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
          <SettingsIntroScene />
          <SceneAudio file="voiceover/settings-intro.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={business} premountFor={fps}>
          <SettingsBusinessScene />
          <SceneAudio file="voiceover/settings-business.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={orders} premountFor={fps}>
          <SettingsOrdersScene />
          <SceneAudio file="voiceover/settings-orders.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={boarding} premountFor={fps}>
          <SettingsBoardingScene />
          <SceneAudio file="voiceover/settings-boarding.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={payments} premountFor={fps}>
          <SettingsPaymentsScene />
          <SceneAudio file="voiceover/settings-payments.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={team} premountFor={fps}>
          <SettingsTeamScene />
          <SceneAudio file="voiceover/settings-team.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={messages} premountFor={fps}>
          <SettingsMessagesScene />
          <SceneAudio file="voiceover/settings-messages.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={integrations} premountFor={fps}>
          <SettingsIntegrationsScene />
          <SceneAudio file="voiceover/settings-integrations.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={data} premountFor={fps}>
          <SettingsDataScene />
          <SceneAudio file="voiceover/settings-data.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <SettingsOutroScene />
          <SceneAudio file="voiceover/settings-outro.wav" />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
