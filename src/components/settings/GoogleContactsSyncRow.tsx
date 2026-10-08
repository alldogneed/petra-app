"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn, fetchJSON } from "@/lib/utils";

type ContactsSyncState = { enabled: boolean; canManage: boolean };
type ToggleResult = { enabled: boolean; needsConsent?: boolean; consentUrl?: string };

const QUERY_KEY = ["google-contacts-sync"];

/**
 * "סנכרון לידים ל-Google Contacts" toggle, rendered inside the connected Google card.
 * Off by default. Turning it on for the first time sends the owner to Google's consent
 * screen for the contacts scope (incremental authorization); the callback enables it.
 */
export function GoogleContactsSyncRow() {
  const queryClient = useQueryClient();

  const { data } = useQuery<ContactsSyncState>({
    queryKey: QUERY_KEY,
    queryFn: () => fetchJSON<ContactsSyncState>("/api/integrations/google/contacts"),
  });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      fetchJSON<ToggleResult>("/api/integrations/google/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: (result) => {
      if (result.needsConsent && result.consentUrl) {
        window.location.href = result.consentUrl;
        return;
      }
      queryClient.setQueryData<ContactsSyncState>(QUERY_KEY, (prev) =>
        prev ? { ...prev, enabled: result.enabled } : prev
      );
      toast.success(result.enabled ? "הסנכרון ל-Google Contacts הופעל" : "הסנכרון ל-Google Contacts כובה");
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בעדכון הסנכרון"),
  });

  if (!data) return null;
  const enabled = toggleMutation.isPending ? !!toggleMutation.variables : data.enabled;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-petra-text">סנכרון לידים ל-Google Contacts</span>
        <button
          onClick={() => toggleMutation.mutate(!data.enabled)}
          disabled={toggleMutation.isPending || !data.canManage}
          role="switch"
          aria-checked={enabled}
          aria-label="סנכרון לידים ל-Google Contacts"
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0",
            enabled ? "bg-emerald-500" : "bg-slate-300",
            !data.canManage && "opacity-50 cursor-not-allowed"
          )}
          title={enabled ? "כבה סנכרון" : "הפעל סנכרון"}
        >
          <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform", enabled ? "-translate-x-4" : "-translate-x-0.5")} />
        </button>
      </div>
      <p className="text-xs text-petra-muted mt-1.5 leading-relaxed">
        כל ליד שנוצר או מתעדכן בפטרה יישמר כאיש קשר ב-Google Contacts שלך. פטרה רק יוצרת ומעדכנת את אנשי הקשר של הלידים — היא לא קוראת את אנשי הקשר הקיימים שלך.
        {data.canManage
          ? " בהפעלה הראשונה תתבקש לאשר את הגישה במסך ההרשאות של Google."
          : " רק בעל העסק יכול להפעיל או לכבות."}
      </p>
    </div>
  );
}
