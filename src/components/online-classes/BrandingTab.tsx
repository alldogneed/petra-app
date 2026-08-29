"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Palette, AlertTriangle, Dog } from "lucide-react";
import { fetchJSON } from "@/lib/utils";
import { unwrapObject, type BrandingData } from "./shared";

const DEFAULT_PRIMARY = "#f97316"; // petra orange fallback
const DEFAULT_SECONDARY = "#1e293b";

interface BrandingForm {
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  senderName: string;
  paymentLinkUrl: string;
  aboutText: string;
}

function isHex(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

export function BrandingTab({ businessName }: { businessName?: string | null }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BrandingForm | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["oc-branding"],
    queryFn: () => fetchJSON("/api/online-classes/branding"),
  });
  const branding = unwrapObject<BrandingData>(data, "branding", "settings");

  useEffect(() => {
    if (branding && form === null) {
      setForm({
        logoUrl: branding.logoUrl ?? "",
        primaryColor: branding.primaryColor ?? DEFAULT_PRIMARY,
        secondaryColor: branding.secondaryColor ?? DEFAULT_SECONDARY,
        senderName: branding.senderName ?? "",
        paymentLinkUrl: branding.paymentLinkUrl ?? "",
        aboutText: branding.aboutText ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branding]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form) throw new Error("אין נתונים לשמירה");
      return fetchJSON("/api/online-classes/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl: form.logoUrl.trim() || null,
          primaryColor: form.primaryColor,
          secondaryColor: form.secondaryColor,
          senderName: form.senderName.trim() || null,
          paymentLinkUrl: form.paymentLinkUrl.trim() || null,
          aboutText: form.aboutText.trim() || null,
        }),
      });
    },
    onSuccess: () => {
      toast.success("המיתוג נשמר");
      queryClient.invalidateQueries({ queryKey: ["oc-branding"] });
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בשמירת המיתוג"),
  });

  if (isError) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-400" />
        <p className="text-red-600 font-medium mb-2">שגיאה בטעינת הגדרות המיתוג</p>
        <button className="btn-secondary text-sm" onClick={() => refetch()}>נסה שוב</button>
      </div>
    );
  }

  if (isLoading || !form) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6 animate-pulse h-80" />
        <div className="card p-6 animate-pulse h-80" />
      </div>
    );
  }

  const primary = isHex(form.primaryColor) ? form.primaryColor : DEFAULT_PRIMARY;
  const secondary = isHex(form.secondaryColor) ? form.secondaryColor : DEFAULT_SECONDARY;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {/* Form */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-4 h-4 text-brand-500" />
          <h2 className="text-base font-bold text-petra-text">מיתוג הפורטל</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">צבע ראשי</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-10 h-10 rounded-lg border border-petra-border cursor-pointer p-0.5"
                value={primary}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
              />
              <input
                className="input flex-1"
                dir="ltr"
                value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                placeholder={DEFAULT_PRIMARY}
              />
            </div>
          </div>
          <div>
            <label className="label">צבע משני</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-10 h-10 rounded-lg border border-petra-border cursor-pointer p-0.5"
                value={secondary}
                onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
              />
              <input
                className="input flex-1"
                dir="ltr"
                value={form.secondaryColor}
                onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                placeholder={DEFAULT_SECONDARY}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="label">שם שולח (בהודעות ללקוחות)</label>
          <input
            className="input"
            value={form.senderName}
            onChange={(e) => setForm({ ...form, senderName: e.target.value })}
            placeholder={businessName || "שם העסק"}
          />
        </div>

        <div>
          <label className="label">קישור לתשלום מנוי</label>
          <input
            className="input"
            dir="ltr"
            value={form.paymentLinkUrl}
            onChange={(e) => setForm({ ...form, paymentLinkUrl: e.target.value })}
            placeholder="https://... (ביט / פייבוקס / דף סליקה)"
          />
          <p className="text-[11px] text-petra-muted mt-1">
            הקישור מוצג ללקוחות בבקשת הצטרפות ובתזכורות חידוש מנוי
          </p>
        </div>

        <div>
          <label className="label">טקסט אודות</label>
          <textarea
            className="input min-h-[90px]"
            value={form.aboutText}
            onChange={(e) => setForm({ ...form, aboutText: e.target.value })}
            placeholder="כמה מילים על העסק שיוצגו בעמוד הבית של הפורטל..."
          />
        </div>

        <div>
          <label className="label">קישור ללוגו</label>
          <input
            className="input"
            dir="ltr"
            value={form.logoUrl}
            onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
            placeholder="https://..."
          />
          <p className="text-[11px] text-petra-muted mt-1">אם ריק — ישתמש בלוגו העסק</p>
        </div>

        <button
          className="btn-primary w-full justify-center"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? "שומר..." : "שמור מיתוג"}
        </button>
      </div>

      {/* Live preview */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-sm font-semibold text-petra-text">תצוגה מקדימה של הפורטל</p>
        </div>
        <div className="p-5 bg-slate-50">
          <div className="rounded-2xl overflow-hidden shadow-sm bg-white max-w-sm mx-auto">
            {/* Mini portal header */}
            <div
              className="px-5 py-6 text-white"
              style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
            >
              <div className="flex items-center gap-3">
                {form.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.logoUrl}
                    alt="לוגו"
                    className="w-12 h-12 rounded-xl bg-white/90 object-contain p-1"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <Dog className="w-6 h-6 text-white" />
                  </div>
                )}
                <div>
                  <p className="font-bold">{form.senderName || businessName || "שם העסק"}</p>
                  <p className="text-xs text-white/80">פורטל חברים</p>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {form.aboutText && (
                <p className="text-xs text-slate-500 line-clamp-3">{form.aboutText}</p>
              )}
              <div
                className="rounded-xl px-4 py-2.5 text-center text-white text-sm font-medium"
                style={{ backgroundColor: primary }}
              >
                הצטרפות למנוי
              </div>
              <div className="rounded-xl border border-slate-100 px-4 py-3">
                <p className="text-xs font-semibold text-slate-700">שיעור חי הקרוב</p>
                <p className="text-[11px] text-slate-400 mt-0.5">יום ראשון · 20:00 · בזום</p>
              </div>
              <p className="text-center text-[10px] text-slate-300 pt-1">Powered by Petra</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
