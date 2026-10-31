"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, UserCheck, AlertTriangle, Pencil } from "lucide-react";
import { fetchJSON } from "@/lib/utils";
import { Modal, heDate, unwrapList, type MembershipItem } from "./shared";
import { StudentDossier } from "./StudentDossier";
import { PetraLoader } from "@/components/ui/PetraLoader";

// Labels: onlineClasses.membershipsTab.status.<id>
const STATUS_META: Record<string, { cls: string }> = {
  pending: { cls: "badge-warning" },
  active: { cls: "badge-success" },
  expired: { cls: "badge-neutral" },
  suspended: { cls: "badge-neutral" },
};

// Labels: onlineClasses.membershipsTab.filters.<labelKey>
const FILTERS: { id: string; labelKey: "all" | "pending" | "active" | "expired" | "suspended" }[] = [
  { id: "", labelKey: "all" },
  { id: "pending", labelKey: "pending" },
  { id: "active", labelKey: "active" },
  { id: "expired", labelKey: "expired" },
  { id: "suspended", labelKey: "suspended" },
];

interface ManualForm {
  name: string;
  phone: string;
  email: string;
  validUntil: string;
  paymentNote: string;
}

const EMPTY_MANUAL: ManualForm = { name: "", phone: "", email: "", validUntil: "", paymentNote: "" };

export function MembershipsTab() {
  const t = useTranslations("onlineClasses");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState<ManualForm>(EMPTY_MANUAL);
  const [approving, setApproving] = useState<MembershipItem | null>(null);
  const [editing, setEditing] = useState<MembershipItem | null>(null);
  const [editForm, setEditForm] = useState({ validUntil: "", paymentNote: "" });
  const [approveForm, setApproveForm] = useState({ validUntil: "", paymentNote: "" });
  const [dossierId, setDossierId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["oc-memberships", filter],
    queryFn: () =>
      fetchJSON(
        filter
          ? `/api/online-classes/memberships?status=${encodeURIComponent(filter)}`
          : "/api/online-classes/memberships"
      ),
  });
  const memberships = unwrapList<MembershipItem>(data, "memberships", "items");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["oc-memberships"] });

  const patchMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      fetchJSON(`/api/online-classes/memberships/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (_d, vars) => {
      toast.success(
        vars.body.action === "approve" ? t("membershipsTab.toasts.approved") : t("membershipsTab.toasts.updated")
      );
      setApproving(null);
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || t("membershipsTab.toasts.updateError")),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      fetchJSON("/api/online-classes/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: manualForm.name.trim(),
          phone: manualForm.phone.trim(),
          email: manualForm.email.trim().toLowerCase(),
          validUntil: manualForm.validUntil ? new Date(manualForm.validUntil).toISOString() : null,
          paymentNote: manualForm.paymentNote.trim() || null,
        }),
      }),
    onSuccess: () => {
      toast.success(t("membershipsTab.toasts.created"));
      setShowManual(false);
      setManualForm(EMPTY_MANUAL);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || t("membershipsTab.toasts.createError")),
  });

  if (isError) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-400" />
        <p className="text-red-600 font-medium mb-2">{t("membershipsTab.loadError")}</p>
        <button className="btn-secondary text-sm" onClick={() => refetch()}>{t("membershipsTab.retry")}</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={
                filter === f.id
                  ? "px-3.5 py-1.5 rounded-full text-xs font-medium bg-brand-500 text-white whitespace-nowrap"
                  : "px-3.5 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-petra-muted hover:bg-slate-200 whitespace-nowrap"
              }
            >
              {t(`membershipsTab.filters.${f.labelKey}`)}
            </button>
          ))}
        </div>
        <button className="btn-primary text-sm" onClick={() => setShowManual(true)}>
          <Plus className="w-4 h-4" />
          {t("membershipsTab.addManual")}
        </button>
      </div>

      {isLoading ? (
        <PetraLoader />
      ) : memberships.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">
            <UserCheck className="w-6 h-6 text-slate-400" />
          </div>
          <p className="font-medium text-petra-text mb-1">{t("membershipsTab.empty.title")}</p>
          <p className="text-sm text-petra-muted">
            {t("membershipsTab.empty.body")}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-petra-border">
                <tr>
                  <th className="table-header-cell">{t("membershipsTab.columns.name")}</th>
                  <th className="table-header-cell">{t("membershipsTab.columns.phone")}</th>
                  <th className="table-header-cell hidden md:table-cell">{t("membershipsTab.columns.email")}</th>
                  <th className="table-header-cell">{t("membershipsTab.columns.status")}</th>
                  <th className="table-header-cell">{t("membershipsTab.columns.validUntil")}</th>
                  <th className="table-header-cell hidden lg:table-cell">{t("membershipsTab.columns.paymentNote")}</th>
                  <th className="table-header-cell hidden lg:table-cell">{t("membershipsTab.columns.approvedAt")}</th>
                  <th className="table-header-cell">{t("membershipsTab.columns.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {memberships.map((m) => {
                  const status = m.status?.toLowerCase();
                  const meta = STATUS_META[status] ?? { cls: "badge-neutral" };
                  const statusLabel = STATUS_META[status] ? t(`membershipsTab.status.${status}`) : m.status;
                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-50/60 cursor-pointer"
                      onClick={() => setDossierId(m.id)}
                      title={t("membershipsTab.openDossier")}
                    >
                      <td className="table-cell font-medium text-petra-text">
                        {m.portalUser?.name || "—"}
                      </td>
                      <td className="table-cell" dir="ltr">{m.portalUser?.phone || "—"}</td>
                      <td className="table-cell hidden md:table-cell" dir="ltr">
                        {m.portalUser?.email || "—"}
                      </td>
                      <td className="table-cell">
                        <span className={meta.cls}>{statusLabel}</span>
                      </td>
                      <td className="table-cell">
                        {m.validUntil ? heDate(m.validUntil) : status === "active" ? t("membershipsTab.standingOrder") : "—"}
                      </td>
                      <td className="table-cell hidden lg:table-cell text-petra-muted max-w-[160px] truncate">
                        {m.paymentNote || "—"}
                      </td>
                      <td className="table-cell hidden lg:table-cell text-petra-muted">
                        {m.approvedAt ? heDate(m.approvedAt) : "—"}
                      </td>
                      <td className="table-cell">
                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {status === "pending" && (
                            <button
                              className="btn-primary text-xs py-1.5"
                              onClick={() => {
                                setApproveForm({ validUntil: "", paymentNote: "" });
                                setApproving(m);
                              }}
                            >
                              {t("membershipsTab.actions.approve")}
                            </button>
                          )}
                          {status === "active" && (
                            <button
                              className="btn-secondary text-xs py-1.5"
                              onClick={() =>
                                patchMutation.mutate({ id: m.id, body: { status: "suspended" } })
                              }
                            >
                              {t("membershipsTab.actions.suspend")}
                            </button>
                          )}
                          {status === "suspended" && (
                            <button
                              className="btn-secondary text-xs py-1.5"
                              onClick={() =>
                                patchMutation.mutate({ id: m.id, body: { status: "active" } })
                              }
                            >
                              {t("membershipsTab.actions.activate")}
                            </button>
                          )}
                          <button
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
                            title={t("membershipsTab.actions.editTitle")}
                            onClick={() => {
                              setEditForm({
                                validUntil: m.validUntil ? m.validUntil.slice(0, 10) : "",
                                paymentNote: m.paymentNote ?? "",
                              });
                              setEditing(m);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approve modal */}
      {approving && (
        <Modal title={t("membershipsTab.approveModal.title", { name: approving.portalUser?.name || "" })} onClose={() => setApproving(null)}>
          <div className="space-y-4">
            <p className="text-sm text-petra-muted">
              {t("membershipsTab.approveModal.body")}
            </p>
            <div>
              <label className="label">{t("membershipsTab.form.validUntilOptional")}</label>
              <input
                type="date"
                lang={cfg.lang}
                className="input"
                value={approveForm.validUntil}
                onChange={(e) => setApproveForm({ ...approveForm, validUntil: e.target.value })}
              />
              <p className="text-[11px] text-petra-muted mt-1">{t("membershipsTab.form.renewingHint")}</p>
            </div>
            <div>
              <label className="label">{t("membershipsTab.form.paymentNote")}</label>
              <input
                className="input"
                value={approveForm.paymentNote}
                onChange={(e) => setApproveForm({ ...approveForm, paymentNote: e.target.value })}
                placeholder={t("membershipsTab.form.paymentNotePlaceholder")}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                className="btn-primary flex-1 justify-center"
                disabled={patchMutation.isPending}
                onClick={() =>
                  patchMutation.mutate({
                    id: approving.id,
                    body: {
                      action: "approve",
                      validUntil: approveForm.validUntil
                        ? new Date(approveForm.validUntil).toISOString()
                        : null,
                      paymentNote: approveForm.paymentNote.trim() || undefined,
                    },
                  })
                }
              >
                {patchMutation.isPending ? t("membershipsTab.approveModal.approving") : t("membershipsTab.approveModal.submit")}
              </button>
              <button className="btn-secondary" onClick={() => setApproving(null)}>{tc("actions.cancel")}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal title={t("membershipsTab.editModal.title", { name: editing.portalUser?.name || "" })} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div>
              <label className="label">{t("membershipsTab.form.validUntil")}</label>
              <input
                type="date"
                lang={cfg.lang}
                className="input"
                value={editForm.validUntil}
                onChange={(e) => setEditForm({ ...editForm, validUntil: e.target.value })}
              />
              <p className="text-[11px] text-petra-muted mt-1">{t("membershipsTab.form.renewingHint")}</p>
            </div>
            <div>
              <label className="label">{t("membershipsTab.form.paymentNote")}</label>
              <input
                className="input"
                value={editForm.paymentNote}
                onChange={(e) => setEditForm({ ...editForm, paymentNote: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                className="btn-primary flex-1 justify-center"
                disabled={patchMutation.isPending}
                onClick={() =>
                  patchMutation.mutate({
                    id: editing.id,
                    body: {
                      validUntil: editForm.validUntil
                        ? new Date(editForm.validUntil).toISOString()
                        : null,
                      paymentNote: editForm.paymentNote.trim() || null,
                    },
                  })
                }
              >
                {patchMutation.isPending ? tc("progress.saving") : t("membershipsTab.editModal.submit")}
              </button>
              <button className="btn-secondary" onClick={() => setEditing(null)}>{tc("actions.cancel")}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Manual add modal */}
      {showManual && (
        <Modal title={t("membershipsTab.manualModal.title")} onClose={() => setShowManual(false)}>
          <div className="space-y-4">
            <p className="text-sm text-petra-muted">
              {t("membershipsTab.manualModal.body")}
            </p>
            <div>
              <label className="label">{t("membershipsTab.form.fullName")}</label>
              <input
                className="input"
                value={manualForm.name}
                onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{t("membershipsTab.form.phone")}</label>
                <input
                  className="input"
                  dir="ltr"
                  value={manualForm.phone}
                  onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                  placeholder="05X-XXXXXXX"
                />
              </div>
              <div>
                <label className="label">{t("membershipsTab.form.email")}</label>
                <input
                  type="email"
                  className="input"
                  dir="ltr"
                  value={manualForm.email}
                  onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">{t("membershipsTab.form.validUntilOptional")}</label>
              <input
                type="date"
                lang={cfg.lang}
                className="input"
                value={manualForm.validUntil}
                onChange={(e) => setManualForm({ ...manualForm, validUntil: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t("membershipsTab.form.paymentNote")}</label>
              <input
                className="input"
                value={manualForm.paymentNote}
                onChange={(e) => setManualForm({ ...manualForm, paymentNote: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                className="btn-primary flex-1 justify-center"
                disabled={
                  createMutation.isPending ||
                  !manualForm.name.trim() ||
                  !manualForm.phone.trim() ||
                  !manualForm.email.trim()
                }
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? t("membershipsTab.manualModal.adding") : t("membershipsTab.manualModal.submit")}
              </button>
              <button className="btn-secondary" onClick={() => setShowManual(false)}>{tc("actions.cancel")}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Student dossier */}
      {dossierId && (
        <StudentDossier membershipId={dossierId} onClose={() => setDossierId(null)} />
      )}
    </div>
  );
}
