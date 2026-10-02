"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { X, FileText, Trash2, Download, Send, Loader2, PenLine, Copy, RefreshCw, RotateCcw, Eye } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { cn, copyToClipboard } from "@/lib/utils";

export interface ContractTemplate {
  id: string;
  name: string;
}

export interface ContractReq {
  id: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
  openedAt: string | null;
  signedAt: string | null;
  signedFileUrl: string | null;
  signUrl: string | null;
  ipAddress: string | null;
  expiresAt: string;
  templateId: string;
  template: { name: string };
}

export function getEffectiveStatus(req: ContractReq): "SIGNED" | "EXPIRED" | "VIEWED" | "PENDING" {
  if (req.status === "SIGNED") return "SIGNED";
  if (req.status === "EXPIRED" || new Date(req.expiresAt) < new Date()) return "EXPIRED";
  if (req.openedAt) return "VIEWED";
  return "PENDING";
}

export function getDaysUntilExpiry(expiresAt: string): number {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function SendContractSection({ customerId, customerName, pets }: { customerId: string; customerName: string; pets: { id: string; name: string }[] }) {
  const queryClient = useQueryClient();
  const { canSendMessages } = usePermissions();
  const [showModal, setShowModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedPetId, setSelectedPetId] = useState("");
  const [deletingContract, setDeletingContract] = useState<ContractReq | null>(null);
  const [viewingContract, setViewingContract] = useState<ContractReq | null>(null);

  const { data: templates = [] } = useQuery<ContractTemplate[]>({
    queryKey: ["contract-templates"],
    // Non-ok (e.g. 403) or a non-array body → empty list, never an error object.
    queryFn: async () => {
      const r = await fetch("/api/contracts/templates");
      if (!r.ok) return [];
      const d = await r.json().catch(() => null);
      return Array.isArray(d) ? (d as ContractTemplate[]) : [];
    },
  });

  const { data: requests = [] } = useQuery<ContractReq[]>({
    queryKey: ["contract-requests", customerId],
    queryFn: () => fetch(`/api/contracts/requests?customerId=${customerId}`).then((r) => r.json()),
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      fetch("/api/contracts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, templateId: selectedTemplateId, petId: selectedPetId || undefined }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה"); return d; }),
    onSuccess: (d: { waDelivered?: boolean; signUrl?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["contract-requests", customerId] });
      if (d?.waDelivered === false) {
        toast.warning("החוזה נוצר אך לא נשלח בוואטסאפ", {
          duration: 8000,
          action: d.signUrl
            ? {
                label: "העתק קישור",
                onClick: () => {
                  copyToClipboard(d.signUrl!);
                  toast.success("הקישור הועתק!");
                },
              }
            : undefined,
        });
      } else {
        toast.success("החוזה נשלח לחתימה!");
      }
      setShowModal(false);
      setSelectedTemplateId("");
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בשליחה"),
  });

  const deleteContractMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/contracts/requests/${id}`, { method: "DELETE" }).then(async (r) => {
        if (!r.ok) { const d = await r.json(); throw new Error(d.error || "שגיאה במחיקה"); }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-requests", customerId] });
      toast.success("החוזה נמחק");
      setDeletingContract(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/contracts/requests/${id}/resend`, { method: "POST" }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "שגיאה");
        return d;
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contract-requests", customerId] });
      toast.success(data.renewed ? "חוזה חדש נשלח!" : "תזכורת נשלחה!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusLabel: Record<string, string> = { PENDING: "ממתין", VIEWED: "נצפה", SIGNED: "נחתם", EXPIRED: "פג תוקף" };
  const statusColor: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-700",
    VIEWED: "bg-blue-100 text-blue-700",
    SIGNED: "bg-emerald-100 text-emerald-700",
    EXPIRED: "bg-slate-100 text-slate-500",
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
          <PenLine className="w-4 h-4 text-petra-muted" />
          חוזים ({requests.length})
        </h2>
        {canSendMessages && (
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl btn-ghost text-petra-muted"
          disabled={templates.length === 0}
          title={templates.length === 0 ? "הוסף תבניות חוזים בהגדרות → חוזים" : undefined}
        >
          <Send className="w-3.5 h-3.5" />
          שלח לחתימה
        </button>
        )}
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-petra-muted text-center py-4">לא נשלחו חוזים</p>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => {
            const effective = getEffectiveStatus(req);
            const daysLeft = getDaysUntilExpiry(req.expiresAt);
            return (
            <div key={req.id} className="rounded-xl border border-slate-100 hover:border-slate-200 transition-colors overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <FileText className="w-4 h-4 text-petra-muted flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-petra-text">{req.template.name}</p>
                  <p className="text-xs text-petra-muted">
                    {new Date(req.createdAt).toLocaleDateString("he-IL")}
                  </p>
                </div>
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0", statusColor[effective] ?? "bg-slate-100 text-slate-500")}>
                  {statusLabel[effective] ?? effective}
                </span>
                {req.signUrl && (effective === "PENDING" || effective === "VIEWED") && (
                  <button
                    type="button"
                    className="text-xs text-petra-muted hover:text-petra-text px-2 py-0.5 rounded hover:bg-slate-100 transition-colors flex items-center gap-1 flex-shrink-0"
                    title={req.signUrl}
                    onClick={() => { copyToClipboard(req.signUrl!); toast.success("הקישור הועתק!"); }}
                  >
                    <Copy className="w-3 h-3" />
                    העתק קישור
                  </button>
                )}
                {canSendMessages && (effective === "PENDING" || effective === "VIEWED") && (
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-800 px-2 py-0.5 rounded hover:bg-blue-50 transition-colors flex items-center gap-1 flex-shrink-0"
                    title="שלח תזכורת WhatsApp"
                    disabled={resendMutation.isPending}
                    onClick={() => resendMutation.mutate(req.id)}
                  >
                    <RefreshCw className={cn("w-3 h-3", resendMutation.isPending && "animate-spin")} />
                    תזכורת
                  </button>
                )}
                {canSendMessages && effective === "EXPIRED" && (
                  <button
                    type="button"
                    className="text-xs text-amber-600 hover:text-amber-800 px-2 py-0.5 rounded hover:bg-amber-50 transition-colors flex items-center gap-1 flex-shrink-0"
                    title="שלח חוזה חדש"
                    disabled={resendMutation.isPending}
                    onClick={() => resendMutation.mutate(req.id)}
                  >
                    <RotateCcw className={cn("w-3 h-3", resendMutation.isPending && "animate-spin")} />
                    שלח מחדש
                  </button>
                )}
                {req.signedFileUrl && (
                  <>
                    <button
                      type="button"
                      onClick={() => setViewingContract(req)}
                      className="text-xs text-emerald-600 hover:text-emerald-800 px-2 py-0.5 rounded hover:bg-emerald-50 transition-colors flex items-center gap-1 flex-shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      צפה
                    </button>
                    <a
                      href={`/api/contracts/requests/${req.id}/download`}
                      className="text-xs text-brand-500 hover:text-brand-600 px-2 py-0.5 rounded hover:bg-brand-50 transition-colors flex items-center gap-1 flex-shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      הורד
                    </a>
                  </>
                )}
                <button
                  onClick={() => setDeletingContract(req)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-petra-muted hover:text-red-600 transition-colors flex-shrink-0"
                  title="מחק חוזה"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Audit trail */}
              <div className="px-3 pb-3 space-y-0.5">
                {req.sentAt && (
                  <p className="text-xs text-petra-muted flex items-center gap-1.5">
                    <span>✉️</span> נשלח: {new Date(req.sentAt).toLocaleString("he-IL", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                  </p>
                )}
                {req.openedAt && (
                  <p className="text-xs text-petra-muted flex items-center gap-1.5">
                    <span>👁</span> נפתח: {new Date(req.openedAt).toLocaleString("he-IL", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                  </p>
                )}
                {req.signedAt && (
                  <p className="text-xs text-petra-muted flex items-center gap-1.5">
                    <span>✍️</span> נחתם: {new Date(req.signedAt).toLocaleString("he-IL", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                    {req.ipAddress && <span className="text-petra-muted/70">· IP: {req.ipAddress}</span>}
                  </p>
                )}
                {(effective === "PENDING" || effective === "VIEWED") && daysLeft > 0 && (
                  <p className={cn("text-xs flex items-center gap-1.5", daysLeft <= 3 ? "text-red-500" : "text-emerald-600")}>
                    <span>⏳</span> יפוג בעוד {daysLeft} ימים
                  </p>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setShowModal(false)} />
          <div className="modal-content max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-petra-text">שלח חוזה לחתימה</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">בחר תבנית חוזה</label>
                <select className="input w-full" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                  <option value="">בחר תבנית...</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              {pets.length > 0 && (
                <div>
                  <label className="label">שייך לכלב (אופציונלי)</label>
                  <select className="input w-full" value={selectedPetId} onChange={(e) => setSelectedPetId(e.target.value)}>
                    <option value="">ללא שיוך לכלב</option>
                    {pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <p className="text-xs text-petra-muted mt-1">פרטי הכלב (שם, גזע, שבב, מין, צבע) יוטבעו אוטומטית בחוזה</p>
                </div>
              )}
              <div className="text-sm text-petra-muted bg-slate-50 rounded-xl p-3">
                ישלח ל: <span className="font-medium text-petra-text">{customerName}</span> ב-WhatsApp
              </div>
              <div className="flex gap-3">
                <button
                  className="btn-primary flex-1"
                  disabled={!selectedTemplateId || sendMutation.isPending}
                  onClick={() => sendMutation.mutate()}
                >
                  {sendMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />שולח...</> : <><Send className="w-4 h-4" />שלח</>}
                </button>
                <button className="btn-secondary" onClick={() => setShowModal(false)}>ביטול</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        open={!!deletingContract}
        onClose={() => setDeletingContract(null)}
        onConfirm={() => deletingContract && deleteContractMutation.mutate(deletingContract.id)}
        title="מחיקת חוזה"
        confirmText={deletingContract?.template.name ?? ""}
        description="מחיקת החוזה תסיר אותו לצמיתות. פעולה זו אינה ניתנת לביטול."
        loading={deleteContractMutation.isPending}
      />

      {/* ── Signed contract viewer modal ── */}
      {viewingContract && viewingContract.signedFileUrl && (
        <div className="modal-overlay" onClick={() => setViewingContract(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl flex flex-col mx-4 overflow-hidden"
            style={{ width: "min(860px, 100%)", height: "min(90vh, 800px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-petra-text">{viewingContract.template.name}</h2>
                {viewingContract.signedAt && (
                  <p className="text-xs text-petra-muted mt-0.5">
                    ✍️ נחתם: {new Date(viewingContract.signedAt).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/contracts/requests/${viewingContract.id}/download`}
                  className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl btn-primary"
                >
                  <Download className="w-4 h-4" />
                  הורד PDF
                </a>
                <button
                  onClick={() => setViewingContract(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* PDF viewer */}
            <div className="flex-1 overflow-hidden bg-slate-50">
              <object
                data={`/api/contracts/requests/${viewingContract.id}/download?inline=1`}
                type="application/pdf"
                className="w-full h-full"
              >
                <div className="flex flex-col items-center justify-center h-full gap-4 text-petra-muted">
                  <FileText className="w-10 h-10" />
                  <p className="text-sm">הדפדפן שלך לא תומך בתצוגת PDF מוטבעת</p>
                  <a
                    href={`/api/contracts/requests/${viewingContract.id}/download`}
                    className="btn-primary text-sm px-4 py-2"
                  >
                    <Download className="w-4 h-4" />
                    הורד PDF
                  </a>
                </div>
              </object>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Document categories ─────────────────────────────────────────────────────

export const DOC_CATEGORY_LABELS: Record<string, string> = {
  contract: "חוזה",
  invoice: "חשבונית",
  receipt: "קבלה",
  agreement: "הסכם",
  medical: "רפואי",
  insurance: "ביטוח",
  other: "אחר",
};

export const DOC_CATEGORY_COLORS: Record<string, string> = {
  contract: "bg-blue-100 text-blue-700 border-blue-200",
  invoice: "bg-emerald-100 text-emerald-700 border-emerald-200",
  receipt: "bg-green-100 text-green-700 border-green-200",
  agreement: "bg-violet-100 text-violet-700 border-violet-200",
  medical: "bg-red-100 text-red-700 border-red-200",
  insurance: "bg-cyan-100 text-cyan-700 border-cyan-200",
  other: "bg-stone-100 text-stone-600 border-stone-200",
};
