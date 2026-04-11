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
import { CustomersIntroScene } from "./scenes/CustomersIntroScene";
import { CustomersListScene } from "./scenes/CustomersListScene";
import { CustomersAddScene } from "./scenes/CustomersAddScene";
import { CustomersProfileScene } from "./scenes/CustomersProfileScene";
import { CustomersAddPetScene } from "./scenes/CustomersAddPetScene";
import { CustomersPetDetailsScene } from "./scenes/CustomersPetDetailsScene";
import { CustomersActionsScene } from "./scenes/CustomersActionsScene";
import { CustomersTimelineScene } from "./scenes/CustomersTimelineScene";
import { CustomersOutroScene } from "./scenes/CustomersOutroScene";
import { getAudioDuration } from "./get-audio-duration";
import { CUSTOMERS_SCENES } from "../voiceover-customers-config";

export type CustomersTutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;
const DEFAULT_DURATIONS_FRAMES = CUSTOMERS_SCENES.map((s) => s.defaultDurationSec * FPS);
const AUDIO_FILES = CUSTOMERS_SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculateCustomersMetadata: CalculateMetadataFunction<CustomersTutorialProps> =
  async () => {
    const durationsFrames = await Promise.all(
      AUDIO_FILES.map(async (file, i) => {
        try {
          const durationSec = await getAudioDuration(staticFile(file));
          return Math.ceil((durationSec + 1.0) * FPS);
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

export const CustomersTutorial: React.FC<CustomersTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [intro, list, add, profile, addPet, petDetails, actions, timeline, outro] =
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
          <CustomersIntroScene />
          <SceneAudio file="voiceover/customers-intro.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={list} premountFor={fps}>
          <CustomersListScene />
          <SceneAudio file="voiceover/customers-list.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={add} premountFor={fps}>
          <CustomersAddScene />
          <SceneAudio file="voiceover/customers-add.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={profile} premountFor={fps}>
          <CustomersProfileScene />
          <SceneAudio file="voiceover/customers-profile.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={addPet} premountFor={fps}>
          <CustomersAddPetScene />
          <SceneAudio file="voiceover/customers-add-pet.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={petDetails} premountFor={fps}>
          <CustomersPetDetailsScene />
          <SceneAudio file="voiceover/customers-pet-details.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={actions} premountFor={fps}>
          <CustomersActionsScene />
          <SceneAudio file="voiceover/customers-actions.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={timeline} premountFor={fps}>
          <CustomersTimelineScene />
          <SceneAudio file="voiceover/customers-timeline.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <CustomersOutroScene />
          <SceneAudio file="voiceover/customers-outro.wav" />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
