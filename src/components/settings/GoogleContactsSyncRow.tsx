"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { cn, fetchJSON } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type ContactsSyncState = { enabled: boolean; canManage: boolean; pendingLeads: number };
type ToggleResult = { enabled: boolean; needsConsent?: boolean; consentUrl?: string };
type BulkResult = { synced: number; failed: number; remaining: number };

const QUERY_KEY = ["google-contacts-sync"];

/**
 * "סנכרון לידים ל-Google Contacts" toggle, rendered inside the connected Google card.
 * Off by default. Turning it on for the first time sends the owner to Google's consent
 * screen for the contacts scope (incremental authorization); the callback enables it.
 * Once on, "סנכרן לידים קיימים" backfills leads created before the sync was enabled.
 */
export function GoogleContactsSyncRow() {
  const queryClient = useQueryClient();
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

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
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(result.enabled ? "הסנכרון ל-Google Contacts הופעל" : "הסנכרון ל-Google Contacts כובה");
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בעדכון הסנכרון"),
  });

  // The server syncs one chunk per call; keep calling until nothing is left.
  const runBulkSync = async (total: number) => {
    setConfirmBulk(false);
    setBulkProgress({ done: 0, total });
    let done = 0;
    let failed = 0;
    try {
      for (;;) {
        const result = await fetchJSON<BulkResult>("/api/integrations/google/contacts/sync-all", { method: "POST" });
        done += result.synced;
        failed += result.failed;
        setBulkProgress({ done, total });
        // Stop when finished, or when a chunk made no progress (avoids looping on rejected leads).
        if (result.remaining === 0 || result.synced === 0) break;
      }
      if (failed > 0) toast.warning(`${done} לידים סונכרנו, ${failed} נכשלו`);
      else toast.success(`${done} לידים סונכרנו ל-Google Contacts`);
    } catch (e) {
      toast.error((e as Error).message || "שגיאה בסנכרון הלידים");
    } finally {
      setBulkProgress(null);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    }
  };

  if (!data) return null;
  const enabled = toggleMutation.isPending ? !!toggleMutation.variables : data.enabled;
  const showBulk = data.enabled && data.canManage && (data.pendingLeads > 0 || bulkProgress !== null);

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-petra-text">סנכרון לידים ל-Google Contacts</span>
        <button
          onClick={() => toggleMutation.mutate(!data.enabled)}
          disabled={toggleMutation.isPending || !data.canManage || bulkProgress !== null}
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

      {showBulk && (
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <span className="text-xs text-petra-muted">
            {bulkProgress
              ? `מסנכרן… ${bulkProgress.done} מתוך ${bulkProgress.total}`
              : `${data.pendingLeads} לידים קיימים עדיין לא נמצאים ב-Google Contacts`}
          </span>
          <button
            className="btn-secondary text-xs flex items-center gap-1.5 flex-shrink-0"
            onClick={() => setConfirmBulk(true)}
            disabled={bulkProgress !== null}
          >
            {bulkProgress ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
            סנכרן לידים קיימים
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmBulk}
        title="לסנכרן את כל הלידים הקיימים?"
        description={`${data.pendingLeads} אנשי קשר חדשים ייווצרו ב-Google Contacts שלך — אחד לכל ליד שעדיין לא סונכרן. לידים שכבר סונכרנו לא ישוכפלו.`}
        confirmLabel="סנכרן"
        onConfirm={() => runBulkSync(data.pendingLeads)}
        onCancel={() => setConfirmBulk(false)}
      />
    </div>
  );
}
