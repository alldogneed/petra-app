"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ArrowRight, Bot, Key, Settings, Terminal, CheckCircle2, Zap, Copy, MessageSquare, Code2, LogIn } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { copyToClipboard } from "@/lib/utils";

const FALLBACK_ORIGIN = "https://petra-app.com";

/** Copyable LTR code line (URL / shell command). */
function CodeLine({ text }: { text: string }) {
  const t = useTranslations("help.helpConnectAiPage");
  return (
    <div className="mt-2 bg-slate-900 text-slate-100 rounded-xl px-4 py-3 text-xs font-mono flex items-center gap-3" dir="ltr">
      <span className="flex-1 break-all select-all text-left">{text}</span>{/* rtl-ok: code line is always LTR */}
      <button
        onClick={() => { copyToClipboard(text); toast.success(t("codeLine.copied")); }}
        className="text-slate-400 hover:text-white flex-shrink-0"
        title={t("codeLine.copy")}
      >
        <Copy className="w-4 h-4" />
      </button>
    </div>
  );
}

type ConnectAiT = ReturnType<typeof useTranslations<"help.helpConnectAiPage">>;

const richTags = {
  strong: (c: React.ReactNode) => <strong>{c}</strong>,
  code: (c: React.ReactNode) => <code>{c}</code>,
};

const settingsLink = (c: React.ReactNode) => (
  <Link href="/settings?tab=ai-agents" className="text-indigo-600 underline">{c}</Link>
);

/** Recommended: URL-only connection — the client discovers OAuth and opens Petra's login. */
function easyClients(mcpUrl: string, t: ConnectAiT) {
  return [
    {
      key: "claude",
      title: "Claude (claude.ai / Claude Desktop)",
      icon: MessageSquare,
      body: (
        <>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>{t.rich("easy.claude.openSettings", richTags)}</li>
            <li>{t.rich("easy.claude.nameAndUrl", richTags)}</li>
          </ol>
          <CodeLine text={mcpUrl} />
          <ol className="list-decimal list-inside space-y-0.5 mt-2" start={3}>
            <li>{t.rich("easy.claude.addConnect", richTags)}</li>
            <li>{t.rich("easy.claude.loginApprove", richTags)}</li>
          </ol>
        </>
      ),
    },
    {
      key: "claude-code",
      title: "Claude Code",
      icon: Terminal,
      body: (
        <>
          <p>{t("easy.runInTerminal")}</p>
          <CodeLine text={`claude mcp add --transport http petra ${mcpUrl}`} />
          <p className="mt-2">
            {t.rich("easy.claudeCode.authenticate", richTags)}
          </p>
        </>
      ),
    },
    {
      key: "codex",
      title: "Codex",
      icon: Code2,
      body: (
        <>
          <p>{t("easy.runInTerminal")}</p>
          <CodeLine text={`codex mcp add petra --url ${mcpUrl}`} />
          <CodeLine text="codex mcp login petra" />
          <p className="mt-2">{t("easy.codex.browserOpens")}</p>
        </>
      ),
    },
  ];
}

function buildSteps(t: ConnectAiT) {
  return [
  {
    number: 1,
    title: t("steps.step1.title"),
    description: <>{t.rich("steps.step1.description", { link: settingsLink })}</>,
    icon: Settings,
  },
  {
    number: 2,
    title: t("steps.step2.title"),
    description: (
      <>
        {t("steps.step2.name")}
        <br />
        {t.rich("steps.step2.profile", richTags)}
        <br />
        {t.rich("steps.step2.expiry", richTags)}
      </>
    ),
    icon: Bot,
  },
  {
    number: 3,
    title: t("steps.step3.title"),
    description: t("steps.step3.description"),
    icon: Key,
  },
  {
    number: 4,
    title: t("steps.step4.title"),
    description: (
      <>
        {t.rich("steps.step4.intro", richTags)}
        <ul className="list-disc list-inside text-sm text-slate-600 mt-2 space-y-0.5">
          <li><strong>Name:</strong> <code>Petra</code></li>
          <li>{t.rich("steps.step4.url", richTags)}</li>
        </ul>
        <pre className="mt-2 bg-slate-900 text-slate-100 rounded-xl p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono text-right" dir="ltr">
{`https://petra-app.com/api/mcp/u/YOUR_TOKEN_HERE`}
        </pre>
        <p className="text-sm text-slate-500 mt-2">{t.rich("steps.step4.add", richTags)}</p>
        <details className="text-sm text-slate-500 mt-3">
          <summary className="cursor-pointer select-none font-medium text-slate-600">{t("steps.step4.advanced")}</summary>
          <pre className="mt-2 bg-slate-900 text-slate-100 rounded-xl p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono text-right" dir="ltr">
{`"petra": {
  "url": "https://petra-app.com/api/mcp",
  "headers": {
    "Authorization": "Bearer YOUR_TOKEN_HERE"
  }
}`}
          </pre>
        </details>
      </>
    ),
    icon: Terminal,
  },
  {
    number: 5,
    title: t("steps.step5.title"),
    description: t("steps.step5.description"),
    icon: CheckCircle2,
  },
  ];
}

const capabilities = [
  { emoji: "👥", id: "clients" },
  { emoji: "📅", id: "appointments" },
  { emoji: "📊", id: "stats" },
  { emoji: "✅", id: "createAppointment" },
  { emoji: "📝", id: "addNote" },
  { emoji: "💬", id: "sendReminder" },
] as const;

export default function ConnectAiPage() {
  const t = useTranslations("help.helpConnectAiPage");
  const { user, loading } = useAuth();
  // Real app origin (preview/staging/prod); resolved after mount to avoid SSR mismatch.
  const [origin, setOrigin] = useState(FALLBACK_ORIGIN);
  useEffect(() => {
    if (typeof window !== "undefined" && window.location?.origin) setOrigin(window.location.origin);
  }, []);
  const mcpUrl = `${origin}/api/mcp`;
  const steps = buildSteps(t);
  // MCP private beta — page hidden for non-allowlisted accounts
  if (loading) return null;
  if (!user?.mcpAllowed) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-slate-500">{t("unavailable")}</p>
      </div>
    );
  }
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <Link href="/settings?tab=ai-agents" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowRight className="w-4 h-4 ltr:-scale-x-100" />
          {t("backToSettings")}
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">{t("title")}</h1>
        </div>
        <p className="text-slate-600">
          {t("intro")}
        </p>
      </div>

      {/* Capabilities */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
        <h2 className="font-semibold text-indigo-800 mb-3">{t("capabilities.title")}</h2>
        <div className="grid grid-cols-2 gap-3">
          {capabilities.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <span className="text-xl">{c.emoji}</span>
              <div>
                <p className="text-sm font-medium text-slate-800">{t(`capabilities.${c.id}.title`)}</p>
                <p className="text-xs text-slate-500">{t(`capabilities.${c.id}.desc`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommended: URL only (OAuth auto-login) */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-emerald-800">{t("easy.title")}</h2>
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md border bg-white text-emerald-700 border-emerald-200">{t("easy.recommended")}</span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            {t.rich("easy.intro", { link: settingsLink })}
          </p>
        </div>
        {easyClients(mcpUrl, t).map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.key} className="bg-white border border-emerald-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-emerald-600" />
                <h3 className="font-medium text-slate-800">{c.title}</h3>
              </div>
              <div className="text-sm text-slate-600 leading-relaxed">{c.body}</div>
            </div>
          );
        })}
        <div className="flex items-start gap-2 text-xs text-slate-500">
          <LogIn className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{t("easy.rolesNote")}</p>
        </div>
      </div>

      {/* Advanced: manual token */}
      <div>
        <h2 className="font-semibold text-slate-700 mb-1">{t("advanced.title")}</h2>
        <p className="text-sm text-slate-500 mb-4">
          {t("advanced.intro")}
        </p>
        <div className="space-y-6">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {step.number}
                  </div>
                  {step.number < steps.length && <div className="w-0.5 flex-1 bg-slate-200 mt-2" />}
                </div>
                <div className="pb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-indigo-500" />
                    <h3 className="font-medium text-slate-800">{step.title}</h3>
                  </div>
                  <div className="text-sm text-slate-600 leading-relaxed">{step.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center space-y-3">
        <p className="text-slate-700 font-medium">{t("cta.ready")}</p>
        <p className="text-sm text-slate-500">{t.rich("cta.pasteUrl", { url: mcpUrl, code: (c) => <code dir="ltr">{c}</code> })}</p>
        <Link href="/settings?tab=ai-agents" className="btn-primary inline-flex items-center gap-2">
          <Bot className="w-4 h-4" />
          {t("cta.connectNow")}
        </Link>
        <p className="text-xs text-slate-400">
          {t("cta.disconnectAnytime")}
        </p>
      </div>
    </div>
  );
}
