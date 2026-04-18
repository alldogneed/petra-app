import "./index.css";
import { Composition } from "remotion";
import { TeaserVideoLong } from "./TeaserVideoLong";
import { TeaserVideoShort } from "./TeaserVideoShort";
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
import { OrdersTutorial, calculateOrdersMetadata } from "./OrdersTutorial";
import {
  BoardingTutorial,
  calculateBoardingMetadata,
} from "./BoardingTutorial";
import { TeaserVideo } from "./TeaserVideo";
import {
  TrainingTutorial,
  calculateTrainingMetadata,
} from "./TrainingTutorial";
import {
  SettingsTutorial,
  SettingsTutorialProps,
  calculateSettingsMetadata,
} from "./SettingsTutorial";
import { SALES_SCENES } from "../voiceover-sales-config";
import { CUSTOMERS_SCENES } from "../voiceover-customers-config";
import { FINANCES_SCENES } from "../voiceover-finances-config";
import { ORDERS_SCENES } from "../voiceover-orders-config";
import { BOARDING_SCENES } from "../voiceover-boarding-config";
import { TRAINING_SCENES } from "../voiceover-training-config";
import { SETTINGS_SCENES } from "../voiceover-settings-config";
import {
  TasksTutorial,
  TasksTutorialProps,
  calculateTasksMetadata,
} from "./TasksTutorial";
import { TASKS_SCENES } from "../voiceover-tasks-config";
import {
  BookingTutorial,
  BookingTutorialProps,
  calculateBookingMetadata,
} from "./BookingTutorial";
import { BOOKING_SCENES } from "../voiceover-booking-config";
import {
  PetraDashboardTutorial,
  DashboardTutorialProps,
  calculateDashboardMetadata,
} from "./DashboardTutorial";
import { DASHBOARD_SCENES } from "../voiceover-dashboard-config";
import {
  PetraAdminTutorial,
  AdminTutorialProps,
  calculateAdminMetadata,
} from "./AdminTutorial";
import { ADMIN_SCENES } from "../voiceover-admin-config";
import {
  PetraPetsTutorial,
  PetsTutorialProps,
  calculatePetsMetadata,
} from "./PetsTutorial";
import { PETS_SCENES } from "../voiceover-pets-config";
import { PetraCalendarTutorial, CalendarTutorialProps, calculateCalendarMetadata } from "./CalendarTutorial";
import { CALENDAR_SCENES } from "../voiceover-calendar-config";
import { GoogleContactsDemo, GOOGLE_CONTACTS_DURATION } from "./GoogleContactsDemo";
import { GoogleContactsOAuthDemo, OAUTH_DEMO_DURATION } from "./GoogleContactsOAuthDemo";

const FPS = 30;

const salesDefaultProps: SalesTutorialProps = {
  sceneDurationsFrames: SALES_SCENES.map((s) => s.defaultDurationSec * FPS),
};

const customersDefaultProps: CustomersTutorialProps = {
  sceneDurationsFrames: CUSTOMERS_SCENES.map((s) => s.defaultDurationSec * FPS),
};

const financesDefaultProps: FinancesTutorialProps = {
  sceneDurationsFrames: FINANCES_SCENES.map((s) => s.defaultDurationSec * FPS),
};

const settingsDefaultProps: SettingsTutorialProps = {
  sceneDurationsFrames: SETTINGS_SCENES.map((s) => s.defaultDurationSec * FPS),
};

const tasksDefaultProps: TasksTutorialProps = {
  sceneDurationsFrames: TASKS_SCENES.map((s) => s.defaultDurationSec * FPS),
};

const bookingDefaultProps: BookingTutorialProps = {
  sceneDurationsFrames: BOOKING_SCENES.map((s) => s.defaultDurationSec * FPS),
};

const dashboardDefaultProps: DashboardTutorialProps = {
  sceneDurationsFrames: DASHBOARD_SCENES.map((s) => s.defaultDurationSec * FPS),
};

const adminDefaultProps: AdminTutorialProps = {
  sceneDurationsFrames: ADMIN_SCENES.map((s) => s.defaultDurationSec * FPS),
};

const petsDefaultProps: PetsTutorialProps = {
  sceneDurationsFrames: PETS_SCENES.map((s) => s.defaultDurationSec * FPS),
};

const calendarDefaultProps: CalendarTutorialProps = {
  sceneDurationsFrames: CALENDAR_SCENES.map((s) => s.defaultDurationSec * FPS),
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
          FINANCES_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) *
          FPS
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
          sceneDurationsFrames: ORDERS_SCENES.map(
            (s) => s.defaultDurationSec * FPS,
          ),
        }}
      />
      <Composition
        id="PetraBoardingTutorial"
        component={BoardingTutorial}
        calculateMetadata={calculateBoardingMetadata}
        durationInFrames={
          BOARDING_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) *
          FPS
        }
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={{
          sceneDurationsFrames: BOARDING_SCENES.map(
            (s) => s.defaultDurationSec * FPS,
          ),
        }}
      />
      <Composition
        id="PetraTrainingTutorial"
        component={TrainingTutorial}
        calculateMetadata={calculateTrainingMetadata}
        durationInFrames={
          TRAINING_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) *
          FPS
        }
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={{
          sceneDurationsFrames: TRAINING_SCENES.map(
            (s) => s.defaultDurationSec * FPS,
          ),
        }}
      />
      <Composition
        id="PetraSettingsTutorial"
        component={SettingsTutorial}
        calculateMetadata={calculateSettingsMetadata}
        durationInFrames={
          SETTINGS_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) *
          FPS
        }
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={settingsDefaultProps}
      />
      <Composition
        id="PetraTeaserVideowebsite"
        component={TeaserVideo}
        durationInFrames={2700}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="PetraTasksTutorial"
        component={TasksTutorial}
        calculateMetadata={calculateTasksMetadata}
        durationInFrames={
          TASKS_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) * FPS
        }
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={tasksDefaultProps}
      />
      <Composition
        id="PetraBookingTutorial"
        component={BookingTutorial}
        calculateMetadata={calculateBookingMetadata}
        durationInFrames={
          BOOKING_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) * FPS
        }
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={bookingDefaultProps}
      />
      <Composition
        id="PetraDashboardTutorial"
        component={PetraDashboardTutorial}
        calculateMetadata={calculateDashboardMetadata}
        durationInFrames={
          DASHBOARD_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) * FPS
        }
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={dashboardDefaultProps}
      />
      <Composition
        id="PetraAdminTutorial"
        component={PetraAdminTutorial}
        calculateMetadata={calculateAdminMetadata}
        durationInFrames={
          ADMIN_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) * FPS
        }
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={adminDefaultProps}
      />
      <Composition
        id="PetraPetsTutorial"
        component={PetraPetsTutorial}
        calculateMetadata={calculatePetsMetadata}
        durationInFrames={PETS_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) * FPS}
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={petsDefaultProps}
      />
      <Composition
        id="PetraCalendarTutorial"
        component={PetraCalendarTutorial}
        calculateMetadata={calculateCalendarMetadata}
        durationInFrames={CALENDAR_SCENES.reduce((sum, s) => sum + s.defaultDurationSec, 0) * FPS}
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={calendarDefaultProps}
      />
      <Composition
        id="GoogleContactsOAuthDemo"
        component={GoogleContactsOAuthDemo}
        durationInFrames={OAUTH_DEMO_DURATION}
        fps={FPS}
        width={1280}
        height={720}
      />
      <Composition
        id="GoogleContactsDemo"
        component={GoogleContactsDemo}
        durationInFrames={GOOGLE_CONTACTS_DURATION}
        fps={FPS}
        width={1280}
        height={720}
      />
    </>
  );
};
