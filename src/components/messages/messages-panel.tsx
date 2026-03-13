"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Plus,
  X,
  MessageSquare,
  Mail,
  Phone,
  Trash2,
  Edit3,
  Zap,
  Clock,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Send,
  Users,
  ExternalLink,
  Copy,
  CheckCheck,
  Check,
  Wand2,
  Eye,
} from "lucide-react";
import { cn, fetchJSON, toWhatsAppPhone } from "@/lib/utils";
import { toast } from "sonner";
import { TEMPLATE_VARIABLES } from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AutomationRuleInline {
  id: string;
  trigger: string;
  triggerOffset: number;
  isActive: boolean;
}


interface MessageTemplate {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
  variables: string;
  isActive: boolean;
  createdAt: string;
  automationRules: AutomationRuleInline[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CHANNELS = [
  { id: "all", label: "הכל" },
  { id: "whatsapp", label: "וואטסאפ", icon: Phone },
  { id: "sms", label: "SMS", icon: MessageSquare },
  { id: "email", label: "אימייל", icon: Mail },
];

const AUTOMATION_TRIGGERS = [
  { id: "appointment_reminder", label: "תזכורת לפני תור", description: "שלח הודעה X שעות לפני התור" },
  { id: "appointment_followup", label: "מעקב אחרי תור", description: "שלח הודעה X שעות אחרי התור" },
  { id: "lead_followup", label: "ליד חדש", description: "שלח הודעה X שעות אחרי יצירת ליד" },
  { id: "birthday_reminder", label: "יום הולדת לכלב", description: "שלח הודעה X ימים לפני יום ההולדת" },
];

const TRIGGER_LABEL: Record<string, string> = Object.fromEntries(
  AUTOMATION_TRIGGERS.map((t) => [t.id, t.label])
);

function triggerOffsetLabel(trigger: string, offset: number): string {
  if (trigger === "appointment_reminder") return `${offset} שעות לפני`;
  if (trigger === "appointment_followup") return `${offset} שעות אחרי`;
  if (trigger === "lead_followup") return `${offset} שעות אחרי יצירה`;
  if (trigger === "birthday_reminder") return `${offset} ימים לפני`;
  return `${offset} שעות`;
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "וואטסאפ",
  sms: "SMS",
  email: "אימייל",
};

// Sample data used in the live preview
const SAMPLE_VARS: Record<string, string> = {
  customerName: "ישראל ישראלי",
  petName: "רקס",
  petAge: "3 שנים",
  date: "יום שני, 10 במרץ",
  time: "14:00",
  serviceName: "אילוף פרטני",
  businessPhone: "050-1234567",
};

function applyPreview(body: string): string {
  return body.replace(/\{(\w+)\}/g, (match, key) => SAMPLE_VARS[key] ?? match);
}

const AUTOMATED_FOOTER = "\n\n_הודעה אוטומטית – אין להשיב להודעה זו.\nלפניות ויצירת קשר ישיר עם בית העסק: {businessPhone}_";

const STARTER_TEMPLATES = [
  {
    label: "📅 תזכורת לפני תור",
    body: "שלום {customerName}! 🐾\n\nתזכורת לתור שלך ב-{date} בשעה {time}.\nשירות: {serviceName}" + " עם {petName}." + "\n\nמחכים לראות אתכם! 😊" + AUTOMATED_FOOTER,
  },
  {
    label: "✅ אישור קביעת תור",
    body: "שלום {customerName}! ✅\n\nהתור שלך נקבע בהצלחה!\n📅 תאריך: {date}\n🕐 שעה: {time}\nשירות: {serviceName}\n\nמחכים לראות את {petName}! 🐾" + AUTOMATED_FOOTER,
  },
  {
    label: "🌟 מעקב אחרי טיפול",
    body: "שלום {customerName}! 🌟\n\nרצינו לדעת איך {petName} מרגיש/ת לאחר הטיפול האחרון.\nאם הכל בסדר – נשמח לשמוע! ואם יש משהו שלא כשורה, חשוב לנו לדעת.\n\nתודה שבחרתם בנו 💛" + AUTOMATED_FOOTER,
  },
  {
    label: "🎂 יום הולדת לחיית המחמד",
    body: "יום הולדת שמח ל-{petName}! 🎂🐾\n\n{petName} מלא/ה {petAge} היום – כל הכבוד! 🎉\n\nכמתנה קטנה, נשמח להעניק לכם 10% הנחה על הטיפול הבא 🎁\n(ציינו שקיבלתם הודעה זו בעת קביעת התור)" + AUTOMATED_FOOTER,
  },
  {
    label: "👋 ברוכים הבאים",
    body: "שלום {customerName}! 😊\n\nברוכים הבאים! שמחים לקבל אתכם ואת {petName} אלינו.\n\nיש לנו הרבה מה לחגוג ביחד – מחכים לראות אתכם בביקור הראשון! 🐾" + AUTOMATED_FOOTER,
  },
  {
    label: "🏨 תזכורת איסוף מפנסיון",
    body: "שלום {customerName}! 🏨\n\nתזכורת – מחר ({date}) הוא יום האיסוף של {petName} מהפנסיון.\n\n{petName} נהנה/נהנתה מאוד ומחכה לכם! 🐕" + AUTOMATED_FOOTER,
  },
  {
    label: "⭐ בקשת ביקורת",
    body: "שלום {customerName}! ⭐\n\nתודה שסמכתם עלינו לטפל ב-{petName}.\n\nאם אהבתם, נשמח מאוד לביקורת קצרה – זה עוזר לנו ולבעלי חיות אחרים בחיפוש שירות מקצועי 🙏\n\nתודה מהלב!" + AUTOMATED_FOOTER,
  },
  {
    label: "💌 מעקב ליד חדש",
    body: "שלום {customerName}! 😊\n\nתודה על פנייתך! קיבלנו את הפרטים ונשמח לעזור.\nניצור איתך קשר בהקדם האפשרי לתיאום." + AUTOMATED_FOOTER,
  },
];

// ─── Send Modal ───────────────────────────────────────────────────────────────

interface SendCustomer { id: string; name: string; phone: string; email?: string | null }

function SendModal({ template, onClose }: { template: MessageTemplate; onClose: () => void }) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [selected, setSelected] = useState<SendCustomer | null>(null);

  const { data: customers = [] } = useQuery<SendCustomer[]>({
    queryKey: ["customers-basic"],
    queryFn: () => fetchJSON("/api/customers"),
  });

  const filtered = customers.filter((c) =>
    !customerSearch.trim() ||
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );

  function renderBody(body: string, customer: SendCustomer) {
    return body
      .replace(/\{customerName\}/g, customer.name)
      .replace(/\{businessPhone\}/g, "")
      .replace(/\{petName\}/g, "")
      .replace(/\{date\}/g, "")
      .replace(/\{time\}/g, "")
      .replace(/\{serviceName\}/g, "");
  }

  const preview = selected ? renderBody(template.body, selected) : template.body;

  function handleSend() {
    if (!selected) return;
    const text = encodeURIComponent(renderBody(template.body, selected));
    if (template.channel === "whatsapp") {
      window.open(`https://wa.me/${toWhatsAppPhone(selected.phone)}?text=${text}`, "_blank");
    } else if (template.channel === "sms") {
      window.open(`sms:${selected.phone}?body=${text}`, "_self");
    } else if (template.channel === "email" && selected.email) {
      const subject = template.subject ? encodeURIComponent(template.subject) : "";
      window.location.href = `mailto:${selected.email}?subject=${subject}&body=${text}`;
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-petra-text">שליחת הודעה</h2>
            <p className="text-xs text-petra-muted mt-0.5">{template.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Customer picker */}
        <div className="mb-4">
          <label className="label">בחר לקוח</label>
          <input
            className="input mb-2"
            placeholder="חפש לפי שם או טלפון..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-petra-border">
            {(filtered as SendCustomer[]).slice(0, 20).map((c) => (
              <button
                key={c.id}
                onClick={() => { setSelected(c); setCustomerSearch(c.name); }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors text-right",
                  selected?.id === c.id && "bg-brand-50 text-brand-700"
                )}
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-petra-muted text-xs">{c.phone}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-petra-muted text-center py-3">לא נמצאו לקוחות</p>
            )}
          </div>
        </div>

        {/* Preview */}
        {selected && (
          <div className="mb-4">
            <label className="label">תצוגה מקדימה</label>
            <div className="bg-slate-50 rounded-lg p-3 text-sm text-petra-text whitespace-pre-wrap border border-petra-border max-h-32 overflow-y-auto">
              {preview}
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
          <button
            className="btn-primary"
            disabled={!selected}
            onClick={handleSend}
          >
            <Send className="w-4 h-4" />
            {template.channel === "whatsapp" ? "פתח בוואטסאפ" : template.channel === "email" ? "שלח במייל" : "שלח SMS"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Send Modal ──────────────────────────────────────────────────────────

function BulkSendModal({ template, onClose }: { template: MessageTemplate; onClose: () => void }) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const { data: customers = [] } = useQuery<SendCustomer[]>({
    queryKey: ["customers-basic"],
    queryFn: () => fetchJSON("/api/customers"),
  });

  const filtered = customers.filter((c) =>
    !customerSearch.trim() ||
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );

  function renderBody(body: string, customer: SendCustomer) {
    return body
      .replace(/\{customerName\}/g, customer.name)
      .replace(/\{businessPhone\}/g, "")
      .replace(/\{petName\}/g, "")
      .replace(/\{date\}/g, "")
      .replace(/\{time\}/g, "")
      .replace(/\{serviceName\}/g, "");
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (filtered.every((c) => selectedIds.has(c.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  }

  function handleBulkSend() {
    const toSend = customers.filter((c) => selectedIds.has(c.id));
    toSend.forEach((c, i) => {
      setTimeout(() => {
        const text = encodeURIComponent(renderBody(template.body, c));
        if (template.channel === "whatsapp") {
          window.open(`https://wa.me/${toWhatsAppPhone(c.phone)}?text=${text}`, "_blank");
        } else if (template.channel === "sms") {
          window.open(`sms:${c.phone}?body=${text}`, "_self");
        }
        setSentIds((prev) => new Set([...prev, c.id]));
      }, i * 700);
    });
    toast.success(`שולחים ל-${toSend.length} לקוחות...`);
  }

  const allFiltered = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
  const selectedCount = selectedIds.size;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-petra-text">שליחה לקבוצה</h2>
            <p className="text-xs text-petra-muted mt-0.5">{template.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-2 flex items-center gap-2">
          <input
            className="input flex-1"
            placeholder="חפש לפי שם או טלפון..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            autoFocus
          />
          <button className="btn-secondary text-xs whitespace-nowrap" onClick={toggleAll}>
            {allFiltered ? "בטל הכל" : "בחר הכל"}
          </button>
        </div>

        <div className="max-h-52 overflow-y-auto space-y-1 rounded-lg border border-petra-border mb-4">
          {filtered.slice(0, 50).map((c) => (
            <button
              key={c.id}
              onClick={() => toggleSelect(c.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 transition-colors text-right",
                selectedIds.has(c.id) && "bg-brand-50"
              )}
            >
              <div className={cn(
                "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                selectedIds.has(c.id) ? "bg-brand-500 border-brand-500" : "border-slate-300"
              )}>
                {selectedIds.has(c.id) && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              <span className="font-medium flex-1 truncate">{c.name}</span>
              <span className="text-petra-muted text-xs" dir="ltr">{c.phone}</span>
              {sentIds.has(c.id) && <CheckCheck className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-petra-muted text-center py-3">לא נמצאו לקוחות</p>
          )}
        </div>

        <div className="flex gap-2 justify-between items-center">
          <span className="text-xs text-petra-muted">
            {selectedCount > 0 ? `${selectedCount} לקוחות נבחרו` : "לא נבחרו לקוחות"}
          </span>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={onClose}>ביטול</button>
            <button
              className="btn-primary"
              disabled={selectedCount === 0}
              onClick={handleBulkSend}
            >
              <Users className="w-4 h-4" />
              שלח ל-{selectedCount > 0 ? selectedCount : "..."} לקוחות
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

function TemplatesTab() {
  const [activeChannel, setActiveChannel] = useState("all");
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [sendingTemplate, setSendingTemplate] = useState<MessageTemplate | null>(null);
  const [bulkSendingTemplate, setBulkSendingTemplate] = useState<MessageTemplate | null>(null);
  const emptyForm = { name: "", channel: "whatsapp", subject: "", body: "", autoEnabled: false, autoTrigger: "appointment_reminder", autoOffset: 24, autoRuleId: null as string | null };
  const [form, setForm] = useState(emptyForm);
  const [cursorPos, setCursorPos] = useState(0);
  const [showStarters, setShowStarters] = useState(false);
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery<MessageTemplate[]>({
    queryKey: ["messages", activeChannel],
    queryFn: () => {
      const params = activeChannel !== "all" ? `?channel=${activeChannel}` : "";
      return fetchJSON<MessageTemplate[]>(`/api/messages${params}`);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      // 1. Save template
      const url = editingTemplate ? `/api/messages/${editingTemplate.id}` : "/api/messages";
      const method = editingTemplate ? "PATCH" : "POST";
      const templateRes = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, channel: data.channel, subject: data.subject, body: data.body }),
      });
      if (!templateRes.ok) throw new Error("Failed to save template");
      const savedTemplate = await templateRes.json();

      // 2. Handle linked automation rule
      const rulePayload = { name: data.name, trigger: data.autoTrigger, triggerOffset: data.autoOffset, templateId: savedTemplate.id, isActive: true };
      if (data.autoEnabled) {
        if (data.autoRuleId) {
          await fetch(`/api/automations/${data.autoRuleId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rulePayload) });
        } else {
          await fetch("/api/automations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rulePayload) });
        }
      } else if (data.autoRuleId) {
        await fetch(`/api/automations/${data.autoRuleId}`, { method: "DELETE" });
      }
      return savedTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      setShowEditor(false);
      toast.success(editingTemplate ? "התבנית עודכנה" : "התבנית נוצרה בהצלחה");
      setEditingTemplate(null);
      setForm(emptyForm);
    },
    onError: () => toast.error("שגיאה בשמירת התבנית. נסה שוב."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/messages/${id}`, { method: "DELETE" }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      toast.success("התבנית נמחקה");
    },
    onError: () => toast.error("שגיאה במחיקת התבנית. נסה שוב."),
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) =>
      fetch(`/api/automations/${ruleId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) })
        .then(r => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messages"] }),
    onError: () => toast.error("שגיאה בעדכון אוטומציה"),
  });

  function insertVariable(v: string) {
    const newBody = form.body.slice(0, cursorPos) + v + form.body.slice(cursorPos);
    setForm({ ...form, body: newBody });
    setCursorPos(cursorPos + v.length);
  }

  function openEditor(template?: MessageTemplate, withAuto = false) {
    if (template) {
      const rule = template.automationRules?.[0] ?? null;
      setEditingTemplate(template);
      setForm({
        name: template.name, channel: template.channel, subject: template.subject || "", body: template.body,
        autoEnabled: !!rule || withAuto,
        autoTrigger: rule?.trigger ?? "appointment_reminder",
        autoOffset: rule?.triggerOffset ?? 24,
        autoRuleId: rule?.id ?? null,
      });
    } else {
      setEditingTemplate(null);
      setForm({ ...emptyForm, autoEnabled: withAuto });
    }
    setShowEditor(true);
  }

  return (
    <>
      {/* Channel filter */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2">
          {CHANNELS.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                activeChannel === ch.id
                  ? "bg-brand-500 text-white"
                  : "bg-slate-100 text-petra-muted hover:bg-slate-200"
              )}
            >
              {ch.label}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => openEditor()}>
          <Plus className="w-4 h-4" />תבנית חדשה
        </button>
      </div>

      {/* Templates grid */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="card p-4 animate-pulse h-24" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><MessageSquare className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין תבניות</h3>
          <p className="text-sm text-petra-muted mb-4">צור תבנית הודעה ראשונה</p>
          <button className="btn-primary" onClick={() => openEditor()}><Plus className="w-4 h-4" />תבנית חדשה</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div key={template.id} className="card p-4 group">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-petra-text">{template.name}</h3>
                  <span className="badge-neutral text-[10px] mt-1">
                    {CHANNEL_LABELS[template.channel] ?? template.channel}
                  </span>
                </div>
                <div className="flex gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    onClick={() => setSendingTemplate(template)}
                    className="p-1.5 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600"
                    title="שלח ללקוח בודד"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                  {(template.channel === "whatsapp" || template.channel === "sms") && (
                    <button
                      onClick={() => setBulkSendingTemplate(template)}
                      className="p-1.5 rounded-lg hover:bg-brand-50 text-slate-400 hover:text-brand-600"
                      title="שלח לקבוצת לקוחות"
                    >
                      <Users className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => openEditor(template)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm("למחוק תבנית זו?")) deleteMutation.mutate(template.id); }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-petra-muted line-clamp-2 whitespace-pre-wrap mb-3">{template.body}</p>

              {/* Automation row */}
              <div className="border-t border-slate-100 pt-2.5">
                {(() => {
                  const rule = template.automationRules?.[0];
                  if (rule) {
                    return (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs min-w-0">
                          <Zap className="w-3 h-3 text-brand-500 flex-shrink-0" />
                          <span className={cn("truncate", rule.isActive ? "text-petra-text font-medium" : "text-petra-muted line-through")}>
                            {triggerOffsetLabel(rule.trigger, rule.triggerOffset)} · {TRIGGER_LABEL[rule.trigger] ?? rule.trigger}
                          </span>
                        </div>
                        <button
                          onClick={() => toggleRuleMutation.mutate({ ruleId: rule.id, isActive: !rule.isActive })}
                          className="p-0.5 hover:opacity-75 transition-opacity flex-shrink-0"
                          title={rule.isActive ? "כבה אוטומציה" : "הפעל אוטומציה"}
                        >
                          {rule.isActive
                            ? <ToggleRight className="w-5 h-5 text-brand-500" />
                            : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                        </button>
                      </div>
                    );
                  }
                  return (
                    <button
                      onClick={() => openEditor(template, true)}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-brand-500 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      הוסף אוטומציה
                    </button>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setShowEditor(false)} />
          <div className="modal-content max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-petra-text">
                {editingTemplate ? "ערוך תבנית" : "תבנית חדשה"}
              </h2>
              <button
                onClick={() => setShowEditor(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">שם התבנית *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">ערוץ</label>
                <select
                  className="input"
                  value={form.channel}
                  onChange={(e) => setForm({ ...form, channel: e.target.value })}
                >
                  <option value="whatsapp">וואטסאפ</option>
                  <option value="sms">SMS</option>
                  <option value="email">אימייל</option>
                </select>
              </div>
              {form.channel === "email" && (
                <div>
                  <label className="label">נושא</label>
                  <input
                    className="input"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  />
                </div>
              )}
              <div>
                {/* Label row: title + starter picker + char count */}
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">תוכן ההודעה *</label>
                  <div className="flex items-center gap-3">
                    {/* Starter templates */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowStarters((s) => !s)}
                        className="flex items-center gap-1 text-[11px] text-brand-500 hover:text-brand-700 font-medium"
                      >
                        <Wand2 className="w-3 h-3" />
                        טען דוגמה
                      </button>
                      {showStarters && (
                        <div className="absolute left-0 top-5 z-20 w-52 bg-white rounded-xl shadow-lg border border-petra-border p-1">
                          {STARTER_TEMPLATES.map((s) => (
                            <button
                              key={s.label}
                              type="button"
                              onClick={() => {
                                setForm((f) => ({ ...f, body: s.body }));
                                setShowStarters(false);
                              }}
                              className="w-full text-right px-3 py-2 text-xs rounded-lg hover:bg-slate-50 text-petra-text transition-colors"
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Char count */}
                    <span className={`text-[11px] font-medium ${form.body.length > 800 ? "text-amber-500" : "text-petra-muted"}`}>
                      {form.body.length} תווים
                    </span>
                  </div>
                </div>

                <textarea
                  className="input font-mono text-sm"
                  rows={5}
                  placeholder="שלום {customerName}, פגישתך עם {petName} נקבעה ל-{date} בשעה {time}."
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  onSelect={(e) => setCursorPos((e.target as HTMLTextAreaElement).selectionStart)}
                  onClick={() => setShowStarters(false)}
                />

                {/* Variable chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="px-2 py-0.5 rounded-md bg-brand-50 text-brand-600 text-[11px] font-medium hover:bg-brand-100 transition-colors"
                      title={`לחץ להוספת ${v} בנקודת הסמן`}
                    >
                      {v}
                    </button>
                  ))}
                </div>

                {/* Live preview */}
                {form.body.trim() && (
                  <div className="mt-3 rounded-xl bg-slate-50 border border-petra-border p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Eye className="w-3 h-3 text-petra-muted" />
                      <span className="text-[10px] text-petra-muted font-medium">תצוגה מקדימה (נתונים לדוגמה)</span>
                    </div>
                    <p className="text-sm text-petra-text whitespace-pre-wrap leading-relaxed">
                      {applyPreview(form.body)}
                    </p>
                  </div>
                )}
              </div>
            </div>
            {/* Automation section */}
            <div className="border-t border-slate-100 pt-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-petra-text flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-brand-500" />
                    שליחה אוטומטית
                  </p>
                  <p className="text-xs text-petra-muted mt-0.5">הפעל כדי לשלוח הודעה זו אוטומטית</p>
                </div>
                <button type="button" onClick={() => setForm(f => ({ ...f, autoEnabled: !f.autoEnabled }))}>
                  {form.autoEnabled
                    ? <ToggleRight className="w-7 h-7 text-brand-500" />
                    : <ToggleLeft className="w-7 h-7 text-slate-400" />}
                </button>
              </div>
              {form.autoEnabled && (
                <div className="space-y-3 p-3 bg-slate-50 rounded-xl">
                  <div>
                    <label className="label">מתי לשלוח?</label>
                    <select
                      className="input"
                      value={form.autoTrigger}
                      onChange={e => setForm(f => ({ ...f, autoTrigger: e.target.value }))}
                    >
                      {AUTOMATION_TRIGGERS.map(t => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-petra-muted mt-1">
                      {AUTOMATION_TRIGGERS.find(t => t.id === form.autoTrigger)?.description}
                    </p>
                  </div>
                  {["appointment_reminder", "appointment_followup", "lead_followup", "birthday_reminder"].includes(form.autoTrigger) && (
                    <div>
                      <label className="label">
                        {form.autoTrigger === "birthday_reminder" ? "ימים לפני" : "שעות"}
                      </label>
                      <input
                        type="number"
                        className="input"
                        min={1}
                        max={form.autoTrigger === "birthday_reminder" ? 30 : 168}
                        value={form.autoOffset}
                        onChange={e => setForm(f => ({ ...f, autoOffset: parseInt(e.target.value) || 1 }))}
                        dir="ltr"
                      />
                      <p className="text-xs text-petra-muted mt-1">
                        {form.autoTrigger === "birthday_reminder"
                          ? `שלח ${form.autoOffset} ימים לפני יום ההולדת`
                          : `שלח ${form.autoOffset} שעות ${form.autoTrigger === "appointment_reminder" ? "לפני" : "אחרי"} התור`}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                className="btn-primary flex-1"
                disabled={!form.name || !form.body || saveMutation.isPending}
                onClick={() => saveMutation.mutate(form)}
              >
                {saveMutation.isPending ? "שומר..." : editingTemplate ? "שמור שינויים" : "צור תבנית"}
              </button>
              <button className="btn-secondary" onClick={() => setShowEditor(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* Send Modal */}
      {sendingTemplate && (
        <SendModal
          template={sendingTemplate}
          onClose={() => setSendingTemplate(null)}
        />
      )}

      {/* Bulk Send Modal */}
      {bulkSendingTemplate && (
        <BulkSendModal
          template={bulkSendingTemplate}
          onClose={() => setBulkSendingTemplate(null)}
        />
      )}
    </>
  );
}


// ─── Bulk Send Tab ────────────────────────────────────────────────────────────

interface CustomerBasic {
  id: string;
  name: string;
  phone: string;
  email?: string;
  pets: Array<{ id: string; name: string }>;
}

const AUDIENCE_OPTIONS = [
  { id: "all", label: "כל הלקוחות" },
  { id: "with_pets", label: "לקוחות עם כלבים" },
  { id: "active_training", label: "תוכניות אילוף פעילות" },
];

function interpolateForCustomer(body: string, customer: CustomerBasic): string {
  const pet = customer.pets?.[0];
  return body
    .replace(/\{customerName\}/g, customer.name)
    .replace(/\{petName\}/g, pet?.name ?? "")
    .replace(/\{date\}/g, "")
    .replace(/\{time\}/g, "")
    .replace(/\{serviceName\}/g, "")
    .replace(/\{businessPhone\}/g, "");
}

function BulkSendTab() {
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [audience, setAudience] = useState("all");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: templates = [] } = useQuery<MessageTemplate[]>({
    queryKey: ["messages", "all"],
    queryFn: () => fetchJSON<MessageTemplate[]>("/api/messages"),
  });

  const whatsappTemplates = templates.filter(
    (t) => t.channel === "whatsapp" || t.channel === "sms"
  );

  const { data: allCustomers = [], isLoading } = useQuery<CustomerBasic[]>({
    queryKey: ["customers-bulk"],
    queryFn: () => fetchJSON<CustomerBasic[]>("/api/customers?fields=id,name,phone,pets"),
  });

  const selectedTemplate = whatsappTemplates.find((t) => t.id === selectedTemplateId);

  const filteredCustomers = allCustomers.filter((c) => {
    const matchSearch =
      !search ||
      c.name.includes(search) ||
      c.phone.includes(search);
    const matchAudience =
      audience === "all" ||
      (audience === "with_pets" && c.pets && c.pets.length > 0);
    return matchSearch && matchAudience;
  });

  function copyMessage(customer: CustomerBasic) {
    if (!selectedTemplate) return;
    const msg = interpolateForCustomer(selectedTemplate.body, customer);
    navigator.clipboard.writeText(msg).then(() => {
      setCopiedId(customer.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function openWhatsApp(customer: CustomerBasic) {
    if (!selectedTemplate) return;
    const msg = encodeURIComponent(interpolateForCustomer(selectedTemplate.body, customer));
    const phone = toWhatsAppPhone(customer.phone);
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  }

  return (
    <>
      {/* Setup row */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex-1 min-w-[200px]">
          <label className="label">תבנית הודעה</label>
          {whatsappTemplates.length === 0 ? (
            <div className="input text-petra-muted text-sm">אין תבניות WhatsApp/SMS — צור תבנית קודם</div>
          ) : (
            <select
              className="input"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
            >
              <option value="">בחר תבנית...</option>
              {whatsappTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({CHANNEL_LABELS[t.channel] ?? t.channel})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="min-w-[180px]">
          <label className="label">קהל יעד</label>
          <select
            className="input"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          >
            {AUDIENCE_OPTIONS.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[180px]">
          <label className="label">חיפוש לקוח</label>
          <input
            className="input"
            placeholder="שם או טלפון..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Template preview */}
      {selectedTemplate && (
        <div className="card p-4 mb-5 bg-green-50 border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-green-800">תצוגה מקדימה של ההודעה</span>
            <span className="badge-neutral text-[10px]">{CHANNEL_LABELS[selectedTemplate.channel]}</span>
          </div>
          <p className="text-sm text-green-900 whitespace-pre-wrap font-mono bg-white rounded-lg p-3 border border-green-100">
            {allCustomers[0]
              ? interpolateForCustomer(selectedTemplate.body, allCustomers[0])
              : selectedTemplate.body}
          </p>
          {allCustomers[0] && (
            <p className="text-xs text-green-700 mt-1">* תצוגה עבור הלקוח הראשון: {allCustomers[0].name}</p>
          )}
        </div>
      )}

      {/* Customer list */}
      {!selectedTemplateId ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Send className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">בחר תבנית להתחלה</h3>
          <p className="text-sm text-petra-muted">בחר תבנית הודעה כדי לראות את הלקוחות ולשלוח הודעות</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="card p-3 animate-pulse h-14" />)}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Users className="w-6 h-6 text-slate-400" /></div>
          <h3 className="text-base font-semibold text-petra-text mb-1">אין לקוחות</h3>
          <p className="text-sm text-petra-muted">לא נמצאו לקוחות עם הסינון הנוכחי</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-petra-muted" />
            <span className="text-sm text-petra-muted">{filteredCustomers.length} לקוחות</span>
          </div>
          <div className="space-y-2">
            {filteredCustomers.map((customer) => {
              const msg = selectedTemplate
                ? interpolateForCustomer(selectedTemplate.body, customer)
                : "";
              const waPhone = toWhatsAppPhone(customer.phone);
              const isCopied = copiedId === customer.id;

              return (
                <div key={customer.id} className="card p-3 flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-brand-600">
                      {customer.name.charAt(0)}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-petra-text truncate">{customer.name}</div>
                    <div className="text-xs text-petra-muted">{customer.phone}</div>
                  </div>

                  {/* Message preview */}
                  <div className="flex-1 min-w-0 hidden md:block">
                    <p className="text-xs text-petra-muted line-clamp-1">{msg}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {waPhone && (
                      <button
                        onClick={() => openWhatsApp(customer)}
                        className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                        title="פתח WhatsApp"
                      >
                        <ExternalLink className="w-3 h-3" />
                        WhatsApp
                      </button>
                    )}
                    <button
                      onClick={() => copyMessage(customer)}
                      className={cn(
                        "p-1.5 rounded-lg transition-colors",
                        isCopied
                          ? "bg-green-100 text-green-600"
                          : "hover:bg-slate-100 text-slate-400"
                      )}
                      title="העתק הודעה"
                    >
                      {isCopied
                        ? <CheckCheck className="w-4 h-4" />
                        : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function MessagesPanel() {
  const [activeTab, setActiveTab] = useState<"templates" | "bulk">("templates");

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("templates")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
            activeTab === "templates"
              ? "bg-white text-petra-text shadow-sm"
              : "text-petra-muted hover:text-petra-text"
          )}
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            תבניות
          </span>
        </button>
        <button
          onClick={() => setActiveTab("bulk")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
            activeTab === "bulk"
              ? "bg-white text-petra-text shadow-sm"
              : "text-petra-muted hover:text-petra-text"
          )}
        >
          <span className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            שליחה מרוכזת
          </span>
        </button>
      </div>

      {activeTab === "templates" && <TemplatesTab />}
      {activeTab === "bulk" && <BulkSendTab />}
    </div>
  );
}
