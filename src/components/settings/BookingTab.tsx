"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Save, CheckCircle2, MessageCircle, ExternalLink, CheckCircle, Info, Copy, CreditCard, CalendarRange } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { cn, fetchJSON, copyToClipboard } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import { usePlan } from "@/hooks/usePlan";
import { Business } from "./shared";
import AvailabilityTab from "./AvailabilityTab";

function BookingLinkBox() {
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const slug = user?.businessSlug || user?.businessId || "";
  const bookingUrl = typeof window !== "undefined"
    ? `${window.location.origin}/book/${slug}`
    : `/book/${slug}`;

  function copyLink() {
    copyToClipboard(bookingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const waMsg = `היי! 🐾\nרוצה לקבוע תור? אפשר לעשות את זה בקלות דרך הלינק הזה:\n${bookingUrl}`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(waMsg)}`;

  return (
    <div className="flex gap-2 items-center">
      <div className="flex-1 input text-xs text-petra-muted bg-slate-50 truncate cursor-default select-all"
        onClick={copyLink}
        title="לחץ להעתקה"
      >
        {bookingUrl}
      </div>
      <button
        onClick={copyLink}
        className={cn(
          "btn-secondary text-xs flex items-center gap-1.5 flex-shrink-0 transition-colors",
          copied && "bg-emerald-50 text-emerald-600 border-emerald-200"
        )}
        title="העתק לינק"
      >
        {copied ? <><CheckCircle2 className="w-3.5 h-3.5" /> הועתק</> : <><Copy className="w-3.5 h-3.5" /> העתק</>}
      </button>
      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex-shrink-0 transition-colors"
        title="שתף בוואטסאפ"
      >
        <MessageCircle className="w-4 h-4" />
      </a>
      <a
        href={bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-50 text-brand-500 hover:bg-brand-100 flex-shrink-0 transition-colors"
        title="פתח עמוד הזמנה"
      >
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  );
}


// ─── Booking Tab ─────────────────────────────────────────────────────────────

export function BookingTab() {
  const queryClient = useQueryClient();
  const { can } = usePlan();
  const { data: biz, isLoading } = useQuery<Business>({
    queryKey: ["settings"],
    queryFn: () => fetchJSON<Business>("/api/settings"),
  });

  const [form, setForm] = useState<Partial<Business> | null>(null);
  const [saved, setSaved] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const editing = form ?? biz;

  const mutation = useMutation({
    mutationFn: (data: Partial<Business>) =>
      fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast.success("הגדרות ההזמנות נשמרו");
    },
    onError: () => toast.error("שגיאה בשמירת ההגדרות"),
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
            <h3 className="text-sm font-semibold text-petra-text">הגדרות הזמנה אונליין</h3>
          </div>
        </div>
        {!editing ? null : !can('online_bookings') ? (
          <p className="text-sm text-petra-muted bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
            <a href="/upgrade" className="text-brand-600 hover:underline font-medium">שדרג לפרו</a> כדי להפעיל הזמנות אונליין, להגדיר קישור הזמנה ומדיניות ביטול.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <label className="label flex items-center gap-1.5 mb-2">
                <ExternalLink className="w-3.5 h-3.5" />
                קישור להזמנה אונליין
              </label>
              {biz?.slug ? (
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-petra-text font-mono bg-white border border-slate-200 rounded-lg px-3 py-2 truncate select-all">
                    {`${process.env.NEXT_PUBLIC_APP_URL || "https://petra-app.com"}/book/${biz.slug}`}
                  </span>
                  <button
                    type="button"
                    className="flex-shrink-0 p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                    onClick={() => {
                      copyToClipboard(`${process.env.NEXT_PUBLIC_APP_URL || "https://petra-app.com"}/book/${biz.slug}`);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    title="העתק קישור"
                  >
                    {copiedLink ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-petra-muted" />}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-amber-600">הגדר כתובת הזמנה (slug) כדי לשתף את הקישור:</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-petra-muted font-mono">petra-app.com/book/</span>
                    <input
                      type="text"
                      className="input flex-1"
                      placeholder="my-business"
                      value={editing.slug ?? ""}
                      onChange={(e) => setForm({ ...editing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 mt-0.5 shrink-0"
                  checked={editing.bookingRequiresApproval ?? false}
                  onChange={(e) => setForm({ ...editing, bookingRequiresApproval: e.target.checked })}
                />
                <span>
                  <span className="font-medium text-sm">תורים אונליין דורשים אישור שלי</span>
                  <span className="block text-xs text-petra-muted mt-1">
                    כשהאפשרות דולקת — כל תור שנקבע באתר נכנס כ״ממתין לאישור״, מגיע אליך בוואטסאפ ובפעמון,
                    ונכנס ליומן רק אחרי שתאשר אותו במודול תורים אונליין. כשהיא כבויה — התור מאושר אוטומטית.
                  </span>
                </span>
              </label>
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                טקסט פתיחה לדף ההזמנה
              </label>
              <textarea
                className="input resize-none"
                rows={2}
                placeholder="ברוכים הבאים! אנו שמחים לקבל הזמנות אונליין..."
                value={editing.bookingWelcomeText ?? ""}
                onChange={(e) => setForm({ ...editing, bookingWelcomeText: e.target.value })}
              />
              <p className="text-xs text-petra-muted mt-1">יוצג ללקוחות בראש דף ההזמנה</p>
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                מדיניות ביטול
              </label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="ביטול עד 24 שעות לפני התור – ללא עלות. ביטול מאוחר יותר – יגבה דמי ביטול..."
                value={editing.cancellationPolicy ?? ""}
                onChange={(e) => setForm({ ...editing, cancellationPolicy: e.target.value })}
              />
              <p className="text-xs text-petra-muted mt-1">יוצג ללקוחות לפני אישור ההזמנה</p>
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                הוראות תשלום מקדמה
              </label>
              <textarea
                className="input resize-none"
                rows={2}
                placeholder="יש לשלם את המקדמה דרך Bit / Paybox למספר 050-0000000..."
                value={editing.depositInstructions ?? ""}
                onChange={(e) => setForm({ ...editing, depositInstructions: e.target.value })}
              />
              <p className="text-xs text-petra-muted mt-1">מוצג כשלשירות יש מקדמה אך אין קישור תשלום</p>
            </div>
            <button
              className={cn("btn-primary flex items-center gap-2 transition-all", saved && "bg-emerald-500 hover:brightness-100")}
              style={saved ? { background: "#10B981" } : undefined}
              disabled={mutation.isPending || !form}
              onClick={() => { if (form) mutation.mutate(form); }}
            >
              {saved ? <><CheckCircle2 className="w-4 h-4" /> נשמר!</> : <><Save className="w-4 h-4" /> שמור שינויים</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
