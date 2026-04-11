// src/PetsTutorial.tsx
import {
  AbsoluteFill,
  Audio,
  CalculateMetadataFunction,
  Series,
  interpolate,
  staticFile,
  useVideoConfig,
} from "remotion";
import { getAudioDuration } from "./get-audio-duration";
// import { PetsIntroScene } from "./scenes/PetsIntroScene";
// import { PetsSpeciesScene } from "./scenes/PetsSpeciesScene";
// import { PetsAddScene } from "./scenes/PetsAddScene";
// import { PetsProfileScene } from "./scenes/PetsProfileScene";
// import { PetsFamilyScene } from "./scenes/PetsFamilyScene";
// import { PetsOutroScene } from "./scenes/PetsOutroScene";
import { PETS_SCENES } from "../voiceover-pets-config";

export type PetsTutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;
const DEFAULT_DURATIONS_FRAMES = PETS_SCENES.map((s) => s.defaultDurationSec * FPS);
const AUDIO_FILES = PETS_SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculatePetsMetadata: CalculateMetadataFunction<PetsTutorialProps> =
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

export const PetraPetsTutorial: React.FC<PetsTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const totalFrames = durationInFrames;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [intro, species, add, profile, family, outro] = sceneDurationsFrames;

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
        <Series.Sequence durationInFrames={intro + species + add + profile + family + outro}>
          {/* placeholder — scenes will be wired in Task 9 */}
          <AbsoluteFill style={{ background: "#0f172a" }} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
