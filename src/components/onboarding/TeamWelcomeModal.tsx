"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Users,
  Calendar,
  ListTodo,
  Sparkles,
  ChevronLeft,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  manager: "מנהל",
  user: "עובד",
};

const QUICK_LINKS = [
  { label: "לקוחות", href: "/customers", icon: Users, desc: "צפה ועדכן פרטי לקוחות" },
  { label: "יומן", href: "/calendar", icon: Calendar, desc: "ניהול תורים ופגישות" },
  { label: "משימות", href: "/tasks", icon: ListTodo, desc: "המשימות שלך היום" },
];

export function TeamWelcomeModal() {
  const { user, isOwner, loading } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (loading || !user || isOwner) return;

    const key = `petra_welcomed_${user.id}`;
    if (!localStorage.getItem(key)) {
      setVisible(true);
    }
  }, [user, isOwner, loading]);

  function dismiss() {
    if (user) {
      localStorage.setItem(`petra_welcomed_${user.id}`, "1");
    }
    setVisible(false);
  }

  function go(href: string) {
    dismiss();
    router.push(href);
  }

  if (!visible) return null;

  const roleLabel = ROLE_LABELS[user?.businessRole ?? ""] ?? "צוות";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-br from-brand-500 to-brand-600 px-6 pt-8 pb-6 text-white relative">
          <button
            onClick={dismiss}
            className="absolute top-4 left-4 p-1 rounded-lg hover:bg-white/20 transition-colors"
            aria-label="סגור"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-white/70">ברוך הבא ל-Petra</p>
              <h2 className="text-xl font-bold">{user?.name ?? "חבר צוות"} 👋</h2>
            </div>
          </div>

          <span className="inline-block text-xs bg-white/20 rounded-full px-3 py-1">
            תפקיד: {roleLabel} ב-{user?.businessName ?? "העסק"}
          </span>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-petra-muted mb-5">
            Petra היא מערכת ניהול העסק שלכם. כאן תוכל לנהל לקוחות, תורים, משימות ועוד — הכל במקום אחד.
          </p>

          <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-3">
            כניסה מהירה
          </p>

          <div className="space-y-2">
            {QUICK_LINKS.map(({ label, href, icon: Icon, desc }) => (
              <button
                key={href}
                onClick={() => go(href)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border border-petra-border",
                  "hover:border-brand-400 hover:bg-brand-50 transition-colors text-right"
                )}
              >
                <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-brand-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-petra-text">{label}</p>
                  <p className="text-xs text-petra-muted">{desc}</p>
                </div>
                <ChevronLeft className="w-4 h-4 text-petra-muted shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={dismiss}
            className="w-full btn-primary justify-center"
          >
            בואו נתחיל
          </button>
        </div>
      </div>
    </div>
  );
}
