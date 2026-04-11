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
import { FinancesIntroScene } from "./scenes/FinancesIntroScene";
import { FinancesPriceListScene } from "./scenes/FinancesPriceListScene";
import { FinancesAddItemScene } from "./scenes/FinancesAddItemScene";
import { FinancesOrdersScene } from "./scenes/FinancesOrdersScene";
import { FinancesOrderDetailScene } from "./scenes/FinancesOrderDetailScene";
import { FinancesPaymentRequestScene } from "./scenes/FinancesPaymentRequestScene";
import { FinancesPaymentsScene } from "./scenes/FinancesPaymentsScene";
import { FinancesOutroScene } from "./scenes/FinancesOutroScene";
import { getAudioDuration } from "./get-audio-duration";
import { FINANCES_SCENES } from "../voiceover-finances-config";

export type FinancesTutorialProps = {
  sceneDurationsFrames: number[];
};

const FPS = 30;
const DEFAULT_DURATIONS_FRAMES = FINANCES_SCENES.map((s) => s.defaultDurationSec * FPS);
const AUDIO_FILES = FINANCES_SCENES.map((s) => `voiceover/${s.id}.wav`);

export const calculateFinancesMetadata: CalculateMetadataFunction<FinancesTutorialProps> =
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

export const FinancesTutorial: React.FC<FinancesTutorialProps> = ({
  sceneDurationsFrames,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const [intro, pricelist, addItem, orders, orderDetail, paymentRequest, payments, outro] =
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
          <FinancesIntroScene />
          <SceneAudio file="voiceover/finances-intro.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={pricelist} premountFor={fps}>
          <FinancesPriceListScene />
          <SceneAudio file="voiceover/finances-pricelist.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={addItem} premountFor={fps}>
          <FinancesAddItemScene />
          <SceneAudio file="voiceover/finances-add-item.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={orders} premountFor={fps}>
          <FinancesOrdersScene />
          <SceneAudio file="voiceover/finances-orders.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={orderDetail} premountFor={fps}>
          <FinancesOrderDetailScene />
          <SceneAudio file="voiceover/finances-order-detail.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={paymentRequest} premountFor={fps}>
          <FinancesPaymentRequestScene />
          <SceneAudio file="voiceover/finances-payment-request.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={payments} premountFor={fps}>
          <FinancesPaymentsScene />
          <SceneAudio file="voiceover/finances-payments.wav" />
        </Series.Sequence>

        <Series.Sequence durationInFrames={outro} premountFor={fps}>
          <FinancesOutroScene />
          <SceneAudio file="voiceover/finances-outro.wav" />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
