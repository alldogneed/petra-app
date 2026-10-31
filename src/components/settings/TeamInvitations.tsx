"use client";

// Team invitations — the owner invites by email; the member confirms from the link and
// chooses their own password. The link is also shown here so it can go out by WhatsApp
// when the email does not arrive (a resend issues a new link and kills the old one).

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AlertCircle, CheckCircle2, Copy, Loader2, Mail, MessageCircle, RotateCw, UserPlus, X } from "lucide-react";
import { cn, fetchJSON, formatRelativeTime } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type TeamT = ReturnType<typeof useTranslations<"settings.teamInvitations">>;

const ROLE_IDS = new Set(["owner", "manager", "user", "volunteer"]);

export interface TeamInvitation {
  id: string;
  email: string;
  name: string;
  role: string;
  status: "pending" | "expired" | "accepted" | "revoked";
  expiresAt: string;
  lastSentAt: string | null;
  emailFailed: boolean;
  createdAt: string;
}

interface InviteResult {
  invitation: TeamInvitation;
  emailSent: boolean;
  inviteUrl: string;
}

async function postJSON<T>(url: string, init: RequestInit, fallbackError: string): Promise<T> {
  const r = await fetch(url, init);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(typeof data.error === "string" ? data.error : fallbackError);
  return data as T;
}

function whatsappShareUrl(t: TeamT, name: string, businessName: string, url: string) {
  const text = t("whatsappShareText", { name, businessName, url });
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

/**
 * The async Clipboard API is refused in some contexts (embedded browsers, iOS in-app
 * views, a document that lost focus, missing permission). Fall back to the classic
 * select + execCommand("copy"), which works inside the click handler almost everywhere.
 */
function legacyCopy(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

async function copy(t: TeamT, text: string) {
  // Synchronous fallback first while still inside the user gesture, then the async API.
  if (legacyCopy(text)) {
    toast.success(t("copy.copied"));
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast.success(t("copy.copied"));
  } catch {
    toast.error(t("copy.failed"));
  }
}

/** Result card shared by the invite modal and "resend": status + link + share. */
function InviteLinkCard({ result, businessName }: { result: InviteResult; businessName: string }) {
  const t = useTranslations("settings.teamInvitations");
  return (
    <div className="space-y-3">
      {result.emailSent ? (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            {t.rich("linkCard.emailSent", {
              email: result.invitation.email,
              name: result.invitation.name,
              ltr: (c) => <span dir="ltr">{c}</span>,
            })}
          </span>
        </div>
      ) : (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{t("linkCard.emailFailed")}</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input className="input text-xs flex-1 min-w-0" dir="ltr" readOnly value={result.inviteUrl} onFocus={(e) => e.target.select()} aria-label={t("linkCard.linkAriaLabel")} />
        <button type="button" className="btn-secondary text-xs px-3 flex items-center gap-1" onClick={() => copy(t, result.inviteUrl)}>
          <Copy className="w-3.5 h-3.5" />
          {t("linkCard.copy")}
        </button>
      </div>
      <a
        href={whatsappShareUrl(t, result.invitation.name, businessName, result.inviteUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary w-full justify-center flex items-center gap-2 text-sm"
      >
        <MessageCircle className="w-4 h-4" />
        {t("linkCard.sendWhatsApp")}
      </a>
      <p className="text-xs text-petra-muted">{t("linkCard.validity")}</p>
    </div>
  );
}

// ─── Invite modal ────────────────────────────────────────────────────────────

export function InviteMemberModal({
  businessId,
  businessName,
  canAddOwner,
  onClose,
}: {
  businessId: string;
  businessName: string;
  canAddOwner: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("settings.teamInvitations");
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      if (!businessId) throw new Error(t("modal.missingBusinessId"));
      return postJSON<InviteResult>(`/api/admin/${businessId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), role }),
      }, t("errors.generic"));
    },
    onSuccess: (res) => {
      setResult(res);
      queryClient.invalidateQueries({ queryKey: ["team-invitations"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-petra-text">{result ? t("modal.titleReady") : t("modal.title")}</h2>
            <p className="text-sm text-petra-muted mt-0.5">
              {result ? t("modal.subtitleReady") : t("modal.subtitle")}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted" aria-label={t("modal.close")}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          <>
            <InviteLinkCard result={result} businessName={businessName} />
            <button className="btn-primary w-full justify-center mt-4" onClick={onClose}>{t("modal.done")}</button>
          </>
        ) : (
          <>
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="invite-member-name">{t("modal.nameLabel")}</label>
                <input id="invite-member-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("modal.namePlaceholder")} maxLength={100} />
              </div>
              <div>
                <label className="label" htmlFor="invite-member-email">{t("modal.emailLabel")}</label>
                <input id="invite-member-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" dir="ltr" />
              </div>
              <div>
                <label className="label" htmlFor="invite-member-role">{t("modal.roleLabel")}</label>
                <select id="invite-member-role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="user">{t("roles.user")}</option>
                  <option value="manager">{t("roles.manager")}</option>
                  {canAddOwner && <option value="owner">{t("roles.owner")}</option>}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                className="btn-primary flex-1 flex items-center justify-center gap-2"
                disabled={!name.trim() || !emailOk || mutation.isPending}
                onClick={() => { setError(null); mutation.mutate(); }}
              >
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {mutation.isPending ? t("modal.sending") : t("modal.send")}
              </button>
              <button className="btn-secondary" onClick={onClose}>{t("modal.cancel")}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Pending invitations list ────────────────────────────────────────────────

export function PendingInvitations({
  businessId,
  businessName,
  canManage,
}: {
  businessId: string;
  businessName: string;
  canManage: boolean;
}) {
  const t = useTranslations("settings.teamInvitations");
  const queryClient = useQueryClient();
  const [resent, setResent] = useState<InviteResult | null>(null);
  const [cancelTarget, setCancelTarget] = useState<TeamInvitation | null>(null);

  const { data: invitations = [] } = useQuery<TeamInvitation[]>({
    queryKey: ["team-invitations", businessId],
    queryFn: () => fetchJSON<TeamInvitation[]>(`/api/admin/${businessId}/invitations`),
    enabled: !!businessId,
  });

  const resend = useMutation({
    mutationFn: (id: string) =>
      postJSON<InviteResult>(`/api/admin/${businessId}/invitations/${id}`, { method: "POST" }, t("errors.generic")),
    onSuccess: (res) => {
      setResent(res);
      queryClient.invalidateQueries({ queryKey: ["team-invitations"] });
      if (res.emailSent) toast.success(t("pending.resent"));
      else toast.error(t("pending.resendEmailFailed"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: (id: string) =>
      postJSON<{ ok: true }>(`/api/admin/${businessId}/invitations/${id}`, { method: "DELETE" }, t("errors.generic")),
    onSuccess: () => {
      setCancelTarget(null);
      queryClient.invalidateQueries({ queryKey: ["team-invitations"] });
      toast.success(t("pending.cancelled"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (invitations.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-petra-muted">{t("pending.title", { count: invitations.length })}</h4>
      {invitations.map((inv) => {
        const expired = inv.status === "expired";
        return (
          <div key={inv.id} className="card p-4 border-dashed">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 text-slate-400 flex-shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-petra-text truncate max-w-full">{inv.name}</span>
                  <span className="badge badge-neutral text-xs">{ROLE_IDS.has(inv.role) ? t(`roles.${inv.role}` as "roles.user") : inv.role}</span>
                  {expired ? (
                    <span className="badge badge-danger text-xs">{t("pending.expired")}</span>
                  ) : inv.emailFailed ? (
                    <span className="badge badge-danger text-xs">{t("pending.emailNotSent")}</span>
                  ) : (
                    <span className="badge badge-warning text-xs">{t("pending.awaiting")}</span>
                  )}
                </div>
                <div className="flex items-center gap-x-3 gap-y-0.5 mt-0.5 flex-wrap min-w-0">
                  <span className="text-xs text-petra-muted truncate max-w-full" dir="ltr">{inv.email}</span>
                  {inv.lastSentAt && <span className="text-xs text-petra-muted">{t("pending.sentAgo", { time: formatRelativeTime(inv.lastSentAt) })}</span>}
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                  <button
                    className={cn("text-xs px-3 py-1.5 rounded-lg font-medium border border-slate-200 text-petra-text hover:bg-slate-50 flex items-center gap-1")}
                    onClick={() => resend.mutate(inv.id)}
                    disabled={resend.isPending}
                    title={t("pending.resendTitle")}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    {t("pending.resend")}
                  </button>
                  <button
                    className="text-xs px-3 py-1.5 rounded-lg font-medium text-red-600 hover:bg-red-50 border border-red-200"
                    onClick={() => setCancelTarget(inv)}
                  >
                    {t("pending.cancel")}
                  </button>
                </div>
              )}
            </div>
            {resent?.invitation.id === inv.id && (
              <div className="mt-4 pt-4 border-t">
                <InviteLinkCard result={resent} businessName={businessName} />
              </div>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={cancelTarget !== null}
        title={t("cancelDialog.title", { name: cancelTarget?.name ?? "" })}
        description={t("cancelDialog.description")}
        confirmLabel={t("cancelDialog.confirm")}
        danger
        loading={cancel.isPending}
        onConfirm={() => cancelTarget && cancel.mutate(cancelTarget.id)}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
