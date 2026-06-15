"use client";

import Link from "next/link";
import { ArrowRight, Bot, Key, Settings, Terminal, CheckCircle2, ExternalLink } from "lucide-react";

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
    title: "תן שם לחיבור",
    description: 'תן שם שיזכיר לך איפה תשתמש בו, כמו "Claude Desktop" או "ChatGPT Plugin".',
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
        פתח את Claude Desktop, לך להגדרות → Developer → Edit Config. הוסף את הקוד הבא תחת mcpServers:
        <pre className="mt-3 bg-slate-900 text-slate-100 rounded-xl p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono text-right" dir="ltr">
{`"petra": {
  "url": "https://petra-app.com/api/mcp",
  "headers": {
    "Authorization": "Bearer YOUR_TOKEN_HERE"
  }
}`}
        </pre>
        <p className="text-sm text-slate-500 mt-2">החלף <code>YOUR_TOKEN_HERE</code> בטוקן שקיבלת בשלב הקודם.</p>
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

      {/* Steps */}
      <div>
        <h2 className="font-semibold text-slate-700 mb-4">שלבי חיבור</h2>
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
