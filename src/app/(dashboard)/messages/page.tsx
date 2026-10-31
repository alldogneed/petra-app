"use client";
import { PageTitle } from "@/components/ui/PageTitle";

import { MessagesPanel } from "@/components/messages/messages-panel";
import { TierGate } from "@/components/paywall/TierGate";
import { DesktopBanner } from "@/components/ui/DesktopBanner";
import { useTranslations } from "next-intl";

export default function MessagesPage() {
  const t = useTranslations("messages");
  return (
    <TierGate
      feature="custom_messages"
      title={t("messagesPage.tierGate.title")}
      description={t("messagesPage.tierGate.description")}
    >
      <div>
        <PageTitle title={t("messagesPage.title")} />
        <DesktopBanner />
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <h1 className="page-title">{t("messagesPage.title")}</h1>
        </div>
        <MessagesPanel />
      </div>
    </TierGate>
  );
}
