"use client";

import { MessagesPanel } from "@/components/messages/messages-panel";
import { TierGate } from "@/components/paywall/TierGate";

export default function MessagesPage() {
  return (
    <TierGate
      feature="custom_messages"
      title="תבניות הודעות מותאמות"
      description="צור ועורך תבניות WhatsApp, SMS ואימייל מותאמות אישית. שלח הודעות בזמן הנכון לכל לקוח."
    >
      <div>
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <h1 className="page-title">הודעות</h1>
        </div>
        <MessagesPanel />
      </div>
    </TierGate>
  );
}
