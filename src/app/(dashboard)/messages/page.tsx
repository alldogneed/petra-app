"use client";
import { PageTitle } from "@/components/ui/PageTitle";

import { MessagesPanel } from "@/components/messages/messages-panel";
import { TierGate } from "@/components/paywall/TierGate";
import { DesktopBanner } from "@/components/ui/DesktopBanner";

export default function MessagesPage() {
  return (
    <TierGate
      feature="custom_messages"
      title="תבניות הודעות מותאמות"
      description="צור ועורך תבניות WhatsApp מותאמות אישית. שלח הודעות בזמן הנכון לכל לקוח."
    >
      <div>
        <PageTitle title="הודעות" />
        <DesktopBanner />
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <h1 className="page-title">הודעות</h1>
        </div>
        <MessagesPanel />
      </div>
    </TierGate>
  );
}
