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
import { OrdersIntroScene } from "./scenes/OrdersIntroScene";
import { OrdersHubScene } from "./scenes/OrdersHubScene";
import { OrdersTypesScene } from "./scenes/OrdersTypesScene";
import { OrdersCustomerScene } from "./scenes/OrdersCustomerScene";
import { OrdersItemsScene } from "./scenes/OrdersItemsScene";
import { OrdersAutoScene } from "./scenes/OrdersAutoScene";
import { OrdersLifecycleScene } from "./scenes/OrdersLifecycleScene";
import { OrdersOutroScene } from "./scenes/OrdersOutroScene";
import { ORDERS_SCENES } from "../voiceover-orders-config";

export type OrdersTutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;
const DEFAULT_DURATIONS_FRAMES = ORDERS_SCENES.map((s) => s.defaultDurationSec * FPS);
const AUDIO_FILES = ORDERS_SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculateOrdersMetadata: CalculateMetadataFunction<OrdersTutorialProps> =
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

export const OrdersTutorial: React.FC<OrdersTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [intro, hub, types, customer, items, auto, lifecycle, outro] =
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
          <OrdersIntroScene />
          <SceneAudio file="voiceover/orders-intro.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={hub} premountFor={fps}>
          <OrdersHubScene />
          <SceneAudio file="voiceover/orders-hub.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={types} premountFor={fps}>
          <OrdersTypesScene />
          <SceneAudio file="voiceover/orders-types.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={customer} premountFor={fps}>
          <OrdersCustomerScene />
          <SceneAudio file="voiceover/orders-customer.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={items} premountFor={fps}>
          <OrdersItemsScene />
          <SceneAudio file="voiceover/orders-items.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={auto} premountFor={fps}>
          <OrdersAutoScene />
          <SceneAudio file="voiceover/orders-auto.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={lifecycle} premountFor={fps}>
          <OrdersLifecycleScene />
          <SceneAudio file="voiceover/orders-lifecycle.wav" />
        </Series.Sequence>
        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <OrdersOutroScene />
          <SceneAudio file="voiceover/orders-outro.wav" />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
