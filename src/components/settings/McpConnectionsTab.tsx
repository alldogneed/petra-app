"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, Plus, Trash2, Copy, Bot, Clock, CheckCircle2, AlertCircle, Key, Eye, Pencil,
  Users, CalendarDays, Home, ShieldCheck, User, CalendarClock, AlertTriangle, Zap, RefreshCw,
} from "lucide-react";
import { formatRelativeTime, copyToClipboard } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { useAuth } from "@/providers/auth-provider";
import { usePermissions } from "@/hooks/usePermissions";
import { PetraLoader } from "@/components/ui/PetraLoader";

// NOTE: the labels/descriptions (messages: settings.mcpConnectionsTab.profiles.*) mirror
// MCP_PROFILE_LABELS in src/lib/mcp-auth.ts. That module imports prisma (server-only)
// so it can't be imported from a client component — keep them in sync when
// adding/renaming a profile.
type McpProfile = "read" | "intake" | "calendar" | "boarding" | "full";
const PROFILE_ORDER: McpProfile[] = ["read", "intake", "calendar", "boarding", "full"];
const PROFILE_ICONS: Record<McpProfile, React.ComponentType<{ className?: string }>> = {
  read: Eye,
  intake: Users,
  calendar: CalendarDays,
  boarding: Home,
  full: ShieldCheck,
};
const isMcpProfile = (v: string | null | undefined): v is McpProfile =>
  !!v && (PROFILE_ORDER as string[]).includes(v);

interface McpConnection {
  id: string;
  name: string;
  scopes: string[];
  profile: string | null;
  createdByUserId: string | null;
  createdByRole: string | null;
  createdBy: { name: string; email: string } | null;
  expiresAt: string | null;
  isExpired: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  /** Set when the connection was created via OAuth auto-login (URL-only connect). */
  oauthClientId?: string | null;
  _count: { auditLogs: number };
}

interface NewConnection {
  id: string;
  name: string;
  scopes: string[];
  profile: string;
  expiresAt: string | null;
  createdAt: string;
  scopesCapped: boolean;
  token: string;
  error?: string;
}

/** A connection is read-only when none of its scopes grant writes. */
const isReadOnlyConnection = (scopes: string[]) => !scopes.some((s) => s.startsWith("write:"));

/** Profile badge. Legacy rows (profile = null) are derived from their scopes. */
function ProfileBadge({ profile, scopes }: { profile: string | null; scopes: string[] }) {
  const t = useTranslations("settings.mcpConnectionsTab");
  if (isMcpProfile(profile)) {
    const Icon = PROFILE_ICONS[profile];
    const cls =
      profile === "read"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : profile === "full"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-indigo-50 text-indigo-700 border-indigo-200";
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md border ${cls}`}>
        <Icon className="w-3 h-3" />
        {t(`profiles.labels.${profile}`)}
      </span>
    );
  }
  return isReadOnlyConnection(scopes) ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
      <Eye className="w-3 h-3" />
      {t("profiles.labels.read")}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
      <Pencil className="w-3 h-3" />
      {t("badges.legacyFull")}
    </span>
  );
}

/** Badge for connections created via OAuth auto-login (client pasted the URL + logged in). */
function OAuthBadge() {
  const t = useTranslations("settings.mcpConnectionsTab");
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md border bg-sky-50 text-sky-700 border-sky-200">
      <Zap className="w-3 h-3" />
      {t("badges.oauth")}
    </span>
  );
}

/** Minter + expiry metadata line, shared by active and revoked rows. */
function GovernanceMeta({ conn }: { conn: McpConnection }) {
  const t = useTranslations("settings.mcpConnectionsTab");
  const { locale } = useBusinessLocale();
  if (!conn.createdBy && !conn.expiresAt) return null;
  return (
    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
      {conn.createdBy && (
        <span className="flex items-center gap-1 text-xs text-slate-500" title={conn.createdBy.email}>
          <User className="w-3 h-3" />
          {t("meta.createdBy", { name: conn.createdBy.name || conn.createdBy.email })}
        </span>
      )}
      {conn.expiresAt && (
        conn.isExpired ? (
          <span className="flex items-center gap-1 text-xs font-medium text-red-600">
            <AlertTriangle className="w-3 h-3" />
            {t("meta.expired")}
          </span>
        ) : conn.oauthClientId ? (
          // OAuth grants: expiresAt is a sliding 90-day refresh window — renewed on every token refresh.
          <span
            className="flex items-center gap-1 text-xs text-slate-500"
            title={t("meta.autoRenewTitle", { date: formatDate(conn.expiresAt, { locale }) })}
          >
            <RefreshCw className="w-3 h-3" />
            {t("meta.autoRenew")}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <CalendarClock className="w-3 h-3" />
            {t("meta.validUntil", { date: formatDate(conn.expiresAt, { locale }) })}
          </span>
        )
      )}
    </div>
  );
}

export function McpConnectionsTab() {
  const t = useTranslations("settings.mcpConnectionsTab");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const { user, isManager, isOwner } = useAuth();
  const { canUseAiAssistant } = usePermissions();
  // Mirrors the server gates: create = owner / manager with AI access / platform admin;
  // revoke = owner / platform admin, or the member who created that connection.
  const canCreate = isOwner || (isManager && canUseAiAssistant) || user?.isAdmin === true;
  const canRevoke = (conn: McpConnection) => isOwner || user?.isAdmin === true || (!!conn.createdByUserId && conn.createdByUserId === user?.id);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newProfile, setNewProfile] = useState<McpProfile>("read");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [, setNewConnectionId] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  // Real app origin (preview/staging/prod) — resolved after mount to avoid SSR mismatch.
  const [appOrigin, setAppOrigin] = useState("https://petra-app.com");
  useEffect(() => {
    if (typeof window !== "undefined" && window.location?.origin) setAppOrigin(window.location.origin);
  }, []);
  const mcpUrl = `${appOrigin}/api/mcp`;

  const { data: connections, isLoading } = useQuery<McpConnection[]>({
    queryKey: ["mcp-connections"],
    queryFn: () => fetch("/api/mcp/connections").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (input: { name: string; profile: McpProfile }) =>
      fetch("/api/mcp/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }).then(async (r) => {
        const data = (await r.json()) as NewConnection;
        if (!r.ok || !data.token) throw new Error(data.error || t("toasts.createError"));
        return data;
      }),
    onSuccess: (data: NewConnection) => {
      queryClient.invalidateQueries({ queryKey: ["mcp-connections"] });
      setNewToken(data.token);
      setNewConnectionId(data.id);
      setNewName("");
      setNewProfile("read");
      setShowCreate(false);
      if (data.scopesCapped) {
        toast.info(t("toasts.scopesCapped"));
      }
    },
    onError: (err: Error) => toast.error(err.message || t("toasts.createError")),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/mcp/connections/${id}`, { method: "DELETE" }).then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || t("toasts.revokeError"));
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-connections"] });
      setConfirmRevoke(null);
      toast.success(t("toasts.revoked"));
    },
    onError: (err: Error) => toast.error(err.message || t("toasts.revokeError")),
  });

  const submitCreate = () => {
    if (!newName.trim()) return;
    createMutation.mutate({ name: newName.trim(), profile: newProfile });
  };

  const resetCreateForm = () => {
    setShowCreate(false);
    setNewName("");
    setNewProfile("read");
  };

  const activeConnections = connections?.filter((c) => !c.revokedAt) ?? [];
  const revokedConnections = connections?.filter((c) => c.revokedAt) ?? [];

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-base">{t("intro.title")}</h3>
            <p className="text-slate-600 text-sm mt-1 leading-relaxed">
              {t("intro.body")}
            </p>
            <Link
              href="/help/connect-ai"
              className="inline-block mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              {t("intro.guideLink")}
            </Link>
          </div>
        </div>
      </div>

      {/* Easiest way — URL only, OAuth auto-login (no token needed) */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-600" />
          <h4 className="font-semibold text-emerald-800 text-sm">{t("easy.title")}</h4>
        </div>
        <p className="text-sm text-emerald-900/80 leading-relaxed">
          {t("easy.body")}
        </p>
        <div className="bg-white border border-emerald-200 rounded-lg p-2 flex items-center gap-2 font-mono text-xs break-all" dir="ltr">
          <span className="flex-1 text-slate-700 select-all">{mcpUrl}</span>
          <button
            onClick={() => { copyToClipboard(mcpUrl); toast.success(t("toasts.urlCopied")); }}
            className="text-emerald-600 hover:text-emerald-800 flex-shrink-0"
            title={t("easy.copyUrlTitle")}
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <Link
          href="/help/connect-ai"
          className="inline-block text-sm font-medium text-emerald-700 hover:text-emerald-900 hover:underline"
        >
          {t("easy.instructionsLink")}
        </Link>
        <p className="text-xs text-slate-500">
          {t("easy.manualNote")}
        </p>
      </div>

      {/* Token reveal — shown immediately after creation */}
      {newToken && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-600" />
            <h4 className="font-semibold text-amber-800">{t("token.title")}</h4>
          </div>
          <p className="text-amber-700 text-sm">
            {t.rich("token.onceNotice", { strong: (c) => <strong>{c}</strong> })}
          </p>
          <div className="bg-white border border-amber-200 rounded-lg p-3 flex items-center gap-3 font-mono text-sm break-all">
            <span className="flex-1 text-slate-700 select-all">{newToken}</span>
            <button
              onClick={() => { copyToClipboard(newToken); toast.success(t("toasts.tokenCopied")); }}
              className="text-amber-600 hover:text-amber-800 flex-shrink-0"
              title={t("token.copyTitle")}
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
          {/* Easy method — paste one URL into Claude Desktop's Connectors UI */}
          <div className="bg-white border border-emerald-200 rounded-lg p-3 space-y-2">
            <p className="text-emerald-800 text-sm font-semibold">{t("token.easyTitle")}</p>
            <ol className="list-decimal list-inside space-y-0.5 text-xs text-slate-600">
              <li>{t.rich("token.easyStep1", { strong: (c) => <strong>{c}</strong> })}</li>
              <li>{t.rich("token.easyStep2", { strong: (c) => <strong>{c}</strong>, code: (c) => <code>{c}</code> })}</li>
              <li>{t.rich("token.easyStep3", { strong: (c) => <strong>{c}</strong> })}</li>
            </ol>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center gap-2 font-mono text-xs break-all">
              <span dir="ltr" className="flex-1 min-w-0 text-left text-slate-700 select-all">
                {appOrigin}/api/mcp/u/{newToken}
              </span>
              <button
                onClick={() => {
                  copyToClipboard(`${appOrigin}/api/mcp/u/${newToken}`);
                  toast.success(t("toasts.urlCopied"));
                }}
                className="text-emerald-600 hover:text-emerald-800 flex-shrink-0"
                title={t("easy.copyUrlTitle")}
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">{t.rich("token.easyDone", { strong: (c) => <strong>{c}</strong> })}</p>
          </div>

          {/* Advanced method — config file with header auth */}
          <details className="text-amber-700 text-sm">
            <summary className="font-medium cursor-pointer select-none">{t("token.advancedSummary")}</summary>
            <div className="space-y-1 mt-2">
              <ol className="list-decimal list-inside space-y-0.5 text-xs">
                <li>{t.rich("token.advancedStep1", { strong: (c) => <strong>{c}</strong> })}</li>
                <li>{t.rich("token.advancedStep2", { code: (c) => <code>{c}</code> })}</li>
              </ol>
              <pre dir="ltr" className="bg-white border border-amber-200 rounded p-2 text-xs text-left overflow-x-auto mt-1 whitespace-pre-wrap">
{`"petra": {
  "url": "${mcpUrl}",
  "headers": {
    "Authorization": "Bearer ${newToken}"
  }
}`}
              </pre>
              <p className="text-xs text-amber-600">{t("token.restartNote")}</p>
            </div>
          </details>
          <button
            onClick={() => { setNewToken(null); setNewConnectionId(null); }}
            className="btn-secondary text-sm w-full mt-2"
          >
            {t("token.dismiss")}
          </button>
        </div>
      )}

      {/* Active connections */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-slate-700">{t("list.activeTitle", { count: activeConnections.length })}</h4>
          {!showCreate && canCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary text-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              {t("list.newButton")}
            </button>
          )}
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
            <h5 className="text-sm font-medium text-slate-700">{t("create.title")}</h5>
            <p className="text-xs text-slate-500">{t("create.hint")}</p>
            <input
              className="input w-full"
              placeholder={t("create.placeholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCreate()}
              autoFocus
            />

            {/* Access profile — read-only is the safe default */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-slate-600">{t("create.profileLabel")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label={t("create.profileLabel")}>
                {PROFILE_ORDER.map((p) => {
                  const Icon = PROFILE_ICONS[p];
                  const selected = newProfile === p;
                  return (
                    <label
                      key={p}
                      className={`flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer select-none transition-colors ${
                        selected
                          ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="mcp-profile"
                        value={p}
                        checked={selected}
                        onChange={() => setNewProfile(p)}
                        className="mt-1 w-4 h-4 border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                          <Icon className={`w-4 h-4 ${p === "read" ? "text-emerald-600" : p === "full" ? "text-amber-600" : "text-indigo-600"}`} />
                          {t(`profiles.labels.${p}`)}
                          {p === "read" && <span className="text-[11px] font-normal text-emerald-700">{t("create.recommended")}</span>}
                        </span>
                        <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
                          {t(`profiles.descriptions.${p}`)}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {newProfile !== "read" && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <Pencil className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    {t("create.writeWarning")}
                  </p>
                </div>
              )}
              {isManager && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    {t("create.managerWarning")}
                  </p>
                </div>
              )}
              <p className="text-[11px] text-slate-400">{t("create.expiryNote")}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={submitCreate}
                disabled={!newName.trim() || createMutation.isPending}
                className="btn-primary text-sm"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("create.submit")}
              </button>
              <button onClick={resetCreateForm} className="btn-secondary text-sm">
                {tc("actions.cancel")}
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <PetraLoader />
        ) : activeConnections.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Bot className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">{t("list.empty")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeConnections.map((conn) => (
              <div key={conn.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-800 text-sm">{conn.name}</p>
                        <ProfileBadge profile={conn.profile} scopes={conn.scopes} />
                        {conn.oauthClientId && <OAuthBadge />}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {conn.isExpired ? (
                          <span className="flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle className="w-3 h-3" />
                            {t("meta.expired")}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            {t("list.active")}
                          </span>
                        )}
                        {conn.lastUsedAt ? (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="w-3 h-3" />
                            {t("list.lastUsed", { time: formatRelativeTime(conn.lastUsedAt) })}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">{t("list.neverUsed")}</span>
                        )}
                        <span className="text-xs text-slate-400">{t("list.actionsCount", { count: conn._count.auditLogs })}</span>
                      </div>
                      <GovernanceMeta conn={conn} />
                    </div>
                  </div>
                  {!canRevoke(conn) ? null : confirmRevoke === conn.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600">{t("list.confirmRevoke")}</span>
                      <button
                        onClick={() => revokeMutation.mutate(conn.id)}
                        className="text-xs bg-red-500 text-white px-2 py-1 rounded"
                        disabled={revokeMutation.isPending}
                      >
                        {revokeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : t("list.confirmYes")}
                      </button>
                      <button onClick={() => setConfirmRevoke(null)} className="text-xs text-slate-500">
                        {t("list.confirmNo")}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRevoke(conn.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      title={t("list.disconnectTitle")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoked connections (collapsed) */}
      {revokedConnections.length > 0 && (
        <details className="text-sm">
          <summary className="text-slate-500 cursor-pointer select-none">
            {t("revoked.title", { count: revokedConnections.length })}
          </summary>
          <div className="mt-2 space-y-2">
            {revokedConnections.map((conn) => (
              <div key={conn.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-slate-500 text-sm line-through">{conn.name}</p>
                    <ProfileBadge profile={conn.profile} scopes={conn.scopes} />
                    {conn.oauthClientId && <OAuthBadge />}
                  </div>
                  <p className="text-xs text-slate-400">
                    {t("revoked.revokedAt", { time: conn.revokedAt ? formatRelativeTime(conn.revokedAt) : "" })}
                    {conn.createdBy ? t("revoked.createdBy", { name: conn.createdBy.name || conn.createdBy.email }) : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
