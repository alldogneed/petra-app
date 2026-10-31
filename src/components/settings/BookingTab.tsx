"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, MessageCircle, ExternalLink, Info, Copy, CreditCard, CalendarRange } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { cn, copyToClipboard } from "@/lib/utils";
import { usePlan } from "@/hooks/usePlan";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { ReadOnlyNotice, SettingsFieldset, SettingsSaveBar } from "./settings-ui";
import AvailabilityTab from "./AvailabilityTab";

const PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://petra-app.com";

/** Public booking link: copy, share on WhatsApp, open. Read-only — safe for every member. */
function BookingLinkBox({ slug }: { slug: string }) {
  const t = useTranslations("settings.bookingTab");
  const [copied, setCopied] = useState(false);
  const bookingUrl = `${PUBLIC_APP_URL}/book/${slug}`;

  function copyLink() {
    copyToClipboard(bookingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const waMsg = `היי! 🐾\nרוצה לקבוע תור? אפשר לעשות את זה בקלות דרך הלינק הזה:\n${bookingUrl}`; // i18n-ok — share text sent to clients via WhatsApp (Phase 3)
  const waLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(waMsg)}`;

  return (
    <div className="flex gap-2 items-center min-w-0">
      <div
        className="flex-1 min-w-0 text-sm text-petra-text font-mono bg-white border border-slate-200 rounded-lg px-3 py-2 truncate cursor-pointer select-all"
        onClick={copyLink}
        title={t("linkBox.clickToCopy")}
        dir="ltr"
      >
        {bookingUrl}
      </div>
      <button
        type="button"
        onClick={copyLink}
        className={cn(
          "btn-secondary text-xs flex items-center gap-1.5 flex-shrink-0 transition-colors",
          copied && "bg-emerald-50 text-emerald-600 border-emerald-200"
        )}
        title={t("linkBox.copyLink")}
      >
        {copied ? <><CheckCircle2 className="w-3.5 h-3.5" /> {t("linkBox.copied")}</> : <><Copy className="w-3.5 h-3.5" /> {t("linkBox.copy")}</>}
      </button>
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex-shrink-0 transition-colors"
        title={t("linkBox.shareWhatsApp")}
        aria-label={t("linkBox.shareWhatsApp")}
      >
        <MessageCircle className="w-4 h-4" />
      </a>
      <a
        href={bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-50 text-brand-500 hover:bg-brand-100 flex-shrink-0 transition-colors"
        title={t("linkBox.openBookingPage")}
        aria-label={t("linkBox.openBookingPage")}
      >
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  );
}


// ─── Booking Tab ─────────────────────────────────────────────────────────────

export function BookingTab() {
  const t = useTranslations("settings.bookingTab");
  const { can } = usePlan();
  const { biz, values, isLoading, set, save, reset, dirty, isSaving, canEdit } = useBusinessSettings({
    dirtyKey: "booking",
    successMessage: t("saved"),
  });

  if (isLoading) return <PetraLoader />;

  return (
    <div className="space-y-8">
      {/* Availability section */}
      <AvailabilityTab />

      {/* Online Booking Settings */}
      <div className="border-t border-slate-100 pt-6 max-w-xl">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-brand-500" />
            <h3 className="text-sm font-semibold text-petra-text">{t("title")}</h3>
          </div>
        </div>
        {!values ? null : !can('online_bookings') ? (
          <p className="text-sm text-petra-muted bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
            {t.rich("upgradeNotice", {
              link: (chunks) => <a href="/upgrade" className="text-brand-600 hover:underline font-medium">{chunks}</a>,
            })}
          </p>
        ) : (
          <div className="space-y-4">
            {!canEdit && <ReadOnlyNotice />}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <label className="label flex items-center gap-1.5 mb-2">
                <ExternalLink className="w-3.5 h-3.5" />
                {t("bookingLink")}
              </label>
              {biz?.slug ? (
                <BookingLinkBox slug={biz.slug} />
              ) : (
                <SettingsFieldset readOnly={!canEdit}>
                  <div className="space-y-2">
                    <p className="text-xs text-amber-600">{t("setSlugHint")}</p>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm text-petra-muted font-mono flex-shrink-0" dir="ltr">petra-app.com/book/</span>
                      <input
                        type="text"
                        dir="ltr"
                        className="input flex-1 min-w-0"
                        placeholder="my-business"
                        value={values.slug ?? ""}
                        onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                      />
                    </div>
                  </div>
                </SettingsFieldset>
              )}
            </div>
            <SettingsFieldset readOnly={!canEdit} className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 mt-0.5 shrink-0"
                    checked={values.bookingRequiresApproval ?? false}
                    onChange={(e) => set("bookingRequiresApproval", e.target.checked)}
                  />
                  <span>
                    <span className="font-medium text-sm">{t("requiresApproval.label")}</span>
                    <span className="block text-xs text-petra-muted mt-1">
                      {t("requiresApproval.description")}
                    </span>
                  </span>
                </label>
              </div>
              <div>
                <label className="label flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  {t("welcomeText.label")}
                </label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder={t("welcomeText.placeholder")}
                  value={values.bookingWelcomeText ?? ""}
                  onChange={(e) => set("bookingWelcomeText", e.target.value)}
                />
                <p className="text-xs text-petra-muted mt-1">{t("welcomeText.hint")}</p>
              </div>
              <div>
                <label className="label flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  {t("cancellationPolicy.label")}
                </label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder={t("cancellationPolicy.placeholder")}
                  value={values.cancellationPolicy ?? ""}
                  onChange={(e) => set("cancellationPolicy", e.target.value)}
                />
                <p className="text-xs text-petra-muted mt-1">{t("cancellationPolicy.hint")}</p>
              </div>
              <div>
                <label className="label flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  {t("deposit.label")}
                </label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder={t("deposit.placeholder")}
                  value={values.depositInstructions ?? ""}
                  onChange={(e) => set("depositInstructions", e.target.value)}
                />
                <p className="text-xs text-petra-muted mt-1">{t("deposit.hint")}</p>
              </div>
            </SettingsFieldset>
            <SettingsSaveBar dirty={dirty} saving={isSaving} onSave={save} onReset={reset} canEdit={canEdit} />
          </div>
        )}
      </div>
    </div>
  );
}
