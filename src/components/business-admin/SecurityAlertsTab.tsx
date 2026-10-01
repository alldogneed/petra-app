"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldAlert, Mail, MessageCircle, Save, ShieldCheck } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import {
  SECURITY_ALERT_RULE_INFO,
  SECURITY_ALERT_RULE_KEYS,
  type SecurityAlertPrefs,
  type SecurityAlertRuleKey,
} from "@/lib/security-alert-rules";
import { ActivityRow, type ActivityEntry } from "./shared";

interface SecurityAlertsResponse {
  prefs: SecurityAlertPrefs;
  tierAllowed: boolean;
  recent: ActivityEntry[];
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
        checked ? "bg-orange-500" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? "right-[1.375rem]" : "right-0.5"
        }`}
      />
    </button>
  );
}

function Row({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      {icon && <div className="mt-0.5 text-slate-400 flex-shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{title}</p>
        {description && <p className="text-xs text-petra-muted mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

export function SecurityAlertsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<SecurityAlertsResponse>({
    queryKey: ["ba-security-alerts"],
    queryFn: async () => {
      const r = await fetch("/api/business-admin/security-alerts");
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "שגיאה בטעינת ההתראות");
      return d;
    },
  });

  const [draft, setDraft] = useState<SecurityAlertPrefs | null>(null);
  useEffect(() => {
    if (data?.prefs) setDraft(data.prefs);
  }, [data?.prefs]);

  const save = useMutation({
    mutationFn: async (prefs: SecurityAlertPrefs) => {
      const r = await fetch("/api/business-admin/security-alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "שגיאה בשמירה");
      return d as SecurityAlertPrefs;
    },
    onSuccess: (prefs) => {
      setDraft(prefs);
      toast.success("הגדרות ההתראות נשמרו");
      queryClient.invalidateQueries({ queryKey: ["ba-security-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["ba-activity"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !draft) {
    return isLoading ? <PetraLoader /> : (
      <div className="card p-8 text-center text-sm text-petra-muted">לא ניתן לטעון את הגדרות ההתראות</div>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(data?.prefs);
  const set = (patch: Partial<SecurityAlertPrefs>) => setDraft({ ...draft, ...patch });
  const setRule = (k: SecurityAlertRuleKey, v: boolean) => setDraft({ ...draft, rules: { ...draft.rules, [k]: v } });
  const off = !draft.enabled;

  return (
    <div className="space-y-4">
      {data && !data.tierAllowed && (
        <div className="card p-4 border border-amber-200 bg-amber-50 text-sm text-amber-800 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>התראות אבטחה נשלחות רק במסלול הכולל ניהול צוות. ההגדרות נשמרות ויופעלו לאחר שדרוג.</span>
        </div>
      )}

      <div className="card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-5 h-5 text-orange-500" />
          <h3 className="font-semibold text-slate-800">התראות אבטחה</h3>
        </div>
        <p className="text-xs text-petra-muted mb-3">
          קבל/י הודעה כשמישהו בצוות מבצע פעולה רגישה. עד 20 התראות לשעה לעסק.
        </p>

        <Row title="הפעלת התראות" description="כיבוי עוצר את כל ההתראות (היומן ממשיך להירשם).">
          <Toggle label="הפעלת התראות" checked={draft.enabled} onChange={(v) => set({ enabled: v })} />
        </Row>
        <Row title="אימייל" description="נשלח לכתובת האימייל של כל בעלי העסק." icon={<Mail className="w-4 h-4" />}>
          <Toggle label="אימייל" checked={draft.email} disabled={off} onChange={(v) => set({ email: v })} />
        </Row>
        <Row
          title="WhatsApp"
          description="הודעה לטלפון של העסק (מוגדר בהגדרות → פרטי העסק). נשלח כמיטב היכולת."
          icon={<MessageCircle className="w-4 h-4" />}
        >
          <Toggle label="WhatsApp" checked={draft.whatsapp} disabled={off} onChange={(v) => set({ whatsapp: v })} />
        </Row>
        <Row
          title="גם על פעולות של בעלי העסק"
          description="כברירת מחדל לא נשלחת התראה על פעולות שביצעת בעצמך (חוץ מכניסה ממכשיר חדש)."
        >
          <Toggle
            label="גם על פעולות של בעלי העסק"
            checked={draft.includeOwnActions}
            disabled={off}
            onChange={(v) => set({ includeOwnActions: v })}
          />
        </Row>

        <h4 className="text-xs font-semibold text-petra-muted mt-4 mb-1">על מה להתריע</h4>
        {SECURITY_ALERT_RULE_KEYS.map((k) => (
          <Row key={k} title={SECURITY_ALERT_RULE_INFO[k].title} description={SECURITY_ALERT_RULE_INFO[k].description}>
            <Toggle
              label={SECURITY_ALERT_RULE_INFO[k].title}
              checked={draft.rules[k]}
              disabled={off}
              onChange={(v) => setRule(k, v)}
            />
          </Row>
        ))}

        <div className="flex flex-wrap justify-end gap-2 mt-4">
          {dirty && (
            <button className="btn-secondary text-sm" onClick={() => data && setDraft(data.prefs)} disabled={save.isPending}>
              ביטול שינויים
            </button>
          )}
          <button
            className="btn-primary text-sm flex items-center gap-1.5"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate(draft)}
          >
            <Save className="w-4 h-4" />
            {save.isPending ? "שומר..." : "שמור"}
          </button>
        </div>
      </div>

      <div className="card p-4 sm:p-5">
        <h3 className="font-semibold text-slate-800 mb-1">פעולות רגישות אחרונות</h3>
        <p className="text-xs text-petra-muted mb-3">14 הימים האחרונים · כל המשתמשים (כולל בעלים)</p>
        {!data?.recent?.length ? (
          <p className="text-sm text-petra-muted text-center py-6">לא בוצעו פעולות רגישות בתקופה זו</p>
        ) : (
          <div>
            {data.recent.map((e) => (
              <ActivityRow key={e.id} entry={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
