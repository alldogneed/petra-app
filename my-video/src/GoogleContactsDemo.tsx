/**
 * Google Contacts Sync Demo — for Google OAuth verification.
 * ~30 seconds, no voiceover, 3 scenes showing the feature flow.
 */
import { AbsoluteFill, Series } from "remotion";
import { ContactsSettingsScene } from "./scenes/google-contacts/ContactsSettingsScene";
import { ContactsLeadCreateScene } from "./scenes/google-contacts/ContactsLeadCreateScene";
import { ContactsGoogleScene } from "./scenes/google-contacts/ContactsGoogleScene";

const FPS = 30;

// Scene durations in seconds
const SETTINGS_DUR = 8;   // Enable sync toggle
const LEAD_DUR = 10;      // Create a lead
const GOOGLE_DUR = 10;    // See it in Google Contacts
const TOTAL_DUR = SETTINGS_DUR + LEAD_DUR + GOOGLE_DUR;

export const GoogleContactsDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#f1f5f9" }}>
      <Series>
        <Series.Sequence durationInFrames={SETTINGS_DUR * FPS}>
          <ContactsSettingsScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={LEAD_DUR * FPS}>
          <ContactsLeadCreateScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={GOOGLE_DUR * FPS}>
          <ContactsGoogleScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

export const GOOGLE_CONTACTS_DURATION = TOTAL_DUR * FPS;
