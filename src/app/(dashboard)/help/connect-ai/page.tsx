"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Bot, Key, Settings, Terminal, CheckCircle2, Zap, Copy, MessageSquare, Code2, LogIn } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { copyToClipboard } from "@/lib/utils";

const FALLBACK_ORIGIN = "https://petra-app.com";

/** Copyable LTR code line (URL / shell command). */
function CodeLine({ text }: { text: string }) {
  return (
    <div className="mt-2 bg-slate-900 text-slate-100 rounded-xl px-4 py-3 text-xs font-mono flex items-center gap-3" dir="ltr">
      <span className="flex-1 break-all select-all text-left">{text}</span>
      <button
        onClick={() => { copyToClipboard(text); toast.success("הועתק"); }}
        className="text-slate-400 hover:text-white flex-shrink-0"
        title="העתק"
      >
        <Copy className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Recommended: URL-only connection — the client discovers OAuth and opens Petra's login. */
function easyClients(mcpUrl: string) {
  return [
    {
      key: "claude",
      title: "Claude (claude.ai / Claude Desktop)",
      icon: MessageSquare,
      body: (
        <>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>פתח <strong>Settings → Connectors → Add custom connector</strong></li>
            <li>ב-<strong>Name</strong> כתוב <code>Petra</code>, וב-<strong>Remote MCP server URL</strong> הדבק:</li>
          </ol>
          <CodeLine text={mcpUrl} />
          <ol className="list-decimal list-inside space-y-0.5 mt-2" start={3}>
            <li>לחץ <strong>Add</strong> ואז <strong>Connect</strong></li>
            <li>ייפתח דף הכניסה של פטרה — התחבר, בחר עסק ופרופיל גישה ולחץ <strong>אשר חיבור</strong></li>
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
          <p>הרץ בטרמינל:</p>
          <CodeLine text={`claude mcp add --transport http petra ${mcpUrl}`} />
          <p className="mt-2">
            ואז בתוך Claude Code הקלד <code>/mcp</code>, בחר <strong>petra</strong> ← <strong>Authenticate</strong> — הדפדפן ייפתח להתחברות ואישור.
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
          <p>הרץ בטרמינל:</p>
          <CodeLine text={`codex mcp add petra --url ${mcpUrl}`} />
          <CodeLine text="codex mcp login petra" />
          <p className="mt-2">הדפדפן ייפתח להתחברות לפטרה ואישור החיבור.</p>
        </>
      ),
    },
  ];
}

const steps = [
  {
    number: 1,
    title: "פתח את הגדרות העסק",
    description: (
      <>
        עבור אל <Link href="/settings?tab=ai-agents" className="text-indigo-600 underline">הגדרות → עוזרי AI</Link> ולחץ על &quot;חבר עוזר חדש&quot;.
      </>
    ),
    icon: Settings,
  },
  {
    number: 2,
    title: "תן שם לחיבור ובחר פרופיל גישה",
    description: (
      <>
        תן שם שיזכיר לך איפה תשתמש בו, כמו &quot;Claude Desktop&quot; או &quot;ChatGPT Plugin&quot;.
        <br />
        בחר פרופיל גישה — <strong>מומלץ להתחיל ב&quot;קריאה בלבד&quot;</strong>; פרופילים ממוקדים (קבלה / יומן / פנסיון) נותנים לסוכן יצירה ועדכון רק בתחום אחד, ו&quot;מלא&quot; מיועד לבעלים בלבד. כשתצטרך יותר — צור חיבור נפרד עם פרופיל אחר.
        <br />
        לתשומת לבך: הטוקן תקף ל-<strong>180 יום</strong> מיום היצירה; אחרי זה פשוט צור חיבור חדש ועדכן את הכתובת בעוזר ה-AI.
      </>
    ),
    icon: Bot,
  },
  {
    number: 3,
    title: "שמור את הטוקן",
    description: "המערכת תייצר טוקן גישה. שמור אותו במקום בטוח — הוא יוצג פעם אחת בלבד!",
    icon: Key,
  },
  {
    number: 4,
    title: "הגדר את Claude Desktop",
    description: (
      <>
        ב-Claude Desktop פתח <strong>Settings → Connectors → Add custom connector</strong>, ומלא:
        <ul className="list-disc list-inside text-sm text-slate-600 mt-2 space-y-0.5">
          <li><strong>Name:</strong> <code>Petra</code></li>
          <li><strong>Remote MCP server URL:</strong> הדבק את הכתובת הבאה, והחלף את <code>YOUR_TOKEN_HERE</code> בטוקן שקיבלת:</li>
        </ul>
        <pre className="mt-2 bg-slate-900 text-slate-100 rounded-xl p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono text-right" dir="ltr">
{`https://petra-app.com/api/mcp/u/YOUR_TOKEN_HERE`}
        </pre>
        <p className="text-sm text-slate-500 mt-2">לחץ <strong>Add</strong> — וזהו. אין צורך לערוך קבצים.</p>
        <details className="text-sm text-slate-500 mt-3">
          <summary className="cursor-pointer select-none font-medium text-slate-600">דרך מתקדמת — דרך קובץ הגדרות (Developer → Edit Config)</summary>
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
    title: "התחל לשוחח!",
    description: 'הפעל מחדש את Claude Desktop. עכשיו תוכל לשאול: "מה הלקוחות שלי הפעילים?" או "קבע לי תור לדני ביום שלישי הקרוב".',
    icon: CheckCircle2,
  },
];

const capabilities = [
  { emoji: "👥", title: "רשימת לקוחות", desc: "ראה את כל הלקוחות שלך, חפש לפי שם" },
  { emoji: "📅", title: "תורים קרובים", desc: "מי מגיע השבוע? מה הלוח שלך?" },
  { emoji: "📊", title: "סטטיסטיקות", desc: "כמה לקוחות יש לי? מה ההכנסות החודש?" },
  { emoji: "✅", title: "יצירת תור", desc: "קבע תור חדש ישירות מהשיחה" },
  { emoji: "📝", title: "הוספת הערה", desc: "הוסף הערה לתיק הלקוח" },
  { emoji: "💬", title: "שליחת תזכורת", desc: "שלח תזכורת WhatsApp ללקוח לפני הפגישה" },
];

export default function ConnectAiPage() {
  const { user, loading } = useAuth();
  // Real app origin (preview/staging/prod); resolved after mount to avoid SSR mismatch.
  const [origin, setOrigin] = useState(FALLBACK_ORIGIN);
  useEffect(() => {
    if (typeof window !== "undefined" && window.location?.origin) setOrigin(window.location.origin);
  }, []);
  const mcpUrl = `${origin}/api/mcp`;
  // MCP private beta — page hidden for non-allowlisted accounts
  if (loading) return null;
  if (!user?.mcpAllowed) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-slate-500">העמוד אינו זמין.</p>
      </div>
    );
  }
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <Link href="/settings?tab=ai-agents" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowRight className="w-4 h-4 rotate-180" />
          חזרה להגדרות
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">חבר עוזר AI לפטרה</h1>
        </div>
        <p className="text-slate-600">
          עוזר AI מחובר לפטרה יודע הכל על העסק שלך ויכול לבצע פעולות בשמך — כמו לקבוע תורים, לשלוח תזכורות, ולענות על שאלות על הלקוחות שלך.
        </p>
      </div>

      {/* Capabilities */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
        <h2 className="font-semibold text-indigo-800 mb-3">מה העוזר יכול לעשות?</h2>
        <div className="grid grid-cols-2 gap-3">
          {capabilities.map((c) => (
            <div key={c.title} className="flex items-start gap-2">
              <span className="text-xl">{c.emoji}</span>
              <div>
                <p className="text-sm font-medium text-slate-800">{c.title}</p>
                <p className="text-xs text-slate-500">{c.desc}</p>
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
            <h2 className="font-semibold text-emerald-800">הדרך הקלה: רק כתובת</h2>
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md border bg-white text-emerald-700 border-emerald-200">מומלץ</span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            אין צורך ליצור טוקן. מוסיפים את הכתובת של פטרה, מתחברים עם המייל והסיסמה הרגילים, בוחרים עסק ופרופיל גישה — והחיבור מוכן.
            החיבור מתחדש אוטומטית כל עוד משתמשים בו, ומופיע ב<Link href="/settings?tab=ai-agents" className="text-indigo-600 underline">הגדרות → עוזרי AI</Link> עם התג &quot;התחברות אוטומטית&quot; — שם אפשר לנתק אותו בכל רגע.
          </p>
        </div>
        {easyClients(mcpUrl).map((c) => {
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
          <p>רק בעלים או מנהלים יכולים לאשר חיבור. כמנהל, החיבור לא יכלול אנליטיקה/הכנסות, תשלומים ומחיקות.</p>
        </div>
      </div>

      {/* Advanced: manual token */}
      <div>
        <h2 className="font-semibold text-slate-700 mb-1">מתקדם: חיבור עם טוקן ידני</h2>
        <p className="text-sm text-slate-500 mb-4">
          לעוזרים שלא תומכים בהתחברות אוטומטית, או כשצריך טוקן קבוע (אוטומציות, סקריפטים).
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
        <p className="text-slate-700 font-medium">מוכן להתחיל?</p>
        <p className="text-sm text-slate-500">הדבק בעוזר ה-AI את הכתובת <code dir="ltr">{mcpUrl}</code> — או צור טוקן ידני בהגדרות.</p>
        <Link href="/settings?tab=ai-agents" className="btn-primary inline-flex items-center gap-2">
          <Bot className="w-4 h-4" />
          חבר עוזר AI עכשיו
        </Link>
        <p className="text-xs text-slate-400">
          תוכל לנתק בכל עת מדף ההגדרות.
        </p>
      </div>
    </div>
  );
}
