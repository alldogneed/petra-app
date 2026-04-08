import "./index.css";
import { Composition } from "remotion";
import {
  DashboardTutorial,
  TutorialProps,
  calculateMetadata,
} from "./DashboardTutorial";
import {
  SalesTutorial,
  SalesTutorialProps,
  calculateSalesMetadata,
} from "./SalesTutorial";
import {
  CustomersTutorial,
  CustomersTutorialProps,
  calculateCustomersMetadata,
} from "./CustomersTutorial";
import {
  FinancesTutorial,
  FinancesTutorialProps,
  calculateFinancesMetadata,
} from "./FinancesTutorial";
import {
  OrdersTutorial,
  calculateOrdersMetadata,
} from "./OrdersTutorial";
import { SCENES } from "../voiceover-config";
import { SALES_SCENES } from "../voiceover-sales-config";
import { CUSTOMERS_SCENES } from "../voiceover-customers-config";
import { FINANCES_SCENES } from "../voiceover-finances-config";
import { ORDERS_SCENES } from "../voiceover-orders-config";

const FPS = 30;

const defaultProps: TutorialProps = {
  sceneDurationsFrames: SCENES.map((s) => s.defaultDurationSec * FPS),
};

const salesDefaultProps: SalesTutorialProps = {
  sceneDurationsFrames: SALES_SCENES.map((s) => s.defaultDurationSec * FPS),
};

const customersDefaultProps: CustomersTutorialProps = {
  sceneDurationsFrames: CUSTOMERS_SCENES.map((s) => s.defaultDurationSec * FPS),
};

const financesDefaultProps: FinancesTutorialProps = {
  sceneDurationsFrames: FINANCES_SCENES.map((s) => s.defaultDurationSec * FPS),
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PetraSalesTutorial"
        component={SalesTutorial}
        calculateMetadata={calculateSalesMetadata}
        durationInFrames={
          SALES_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) * FPS
        }
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={salesDefaultProps}
      />
      <Composition
        id="PetraCustomersTutorial"
        component={CustomersTutorial}
        calculateMetadata={calculateCustomersMetadata}
        durationInFrames={
          CUSTOMERS_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) *
          FPS
        }
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={customersDefaultProps}
      />
      <Composition
        id="PetraFinancesTutorial"
        component={FinancesTutorial}
        calculateMetadata={calculateFinancesMetadata}
        durationInFrames={
          FINANCES_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) * FPS
        }
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={financesDefaultProps}
      />
      <Composition
        id="PetraOrdersTutorial"
        component={OrdersTutorial}
        calculateMetadata={calculateOrdersMetadata}
        durationInFrames={
          ORDERS_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) * FPS
        }
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={{
          sceneDurationsFrames: ORDERS_SCENES.map((s) => s.defaultDurationSec * FPS),
        }}
      />
    </>
  );
};
