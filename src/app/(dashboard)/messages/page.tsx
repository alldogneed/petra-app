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
} from "lucide-react";
import { cn, fetchJSON } from "@/lib/utils";
import { TEMPLATE_VARIABLES } from "@/lib/constants";

interface MessageTemplate {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
  variables: string;
  isActive: boolean;
  createdAt: string;
}

const CHANNELS = [
  { id: "all", label: "הכל" },
  { id: "whatsapp", label: "וואטסאפ", icon: Phone },
  { id: "sms", label: "SMS", icon: MessageSquare },
  { id: "email", label: "אימייל", icon: Mail },
];

export default function MessagesPage() {
  const [activeChannel, setActiveChannel] = useState("all");
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [form, setForm] = useState({ name: "", channel: "whatsapp", subject: "", body: "" });
  const [cursorPos, setCursorPos] = useState(0);
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery<MessageTemplate[]>({
    queryKey: ["messages", activeChannel],
    queryFn: () => {
      const params = activeChannel !== "all" ? `?channel=${activeChannel}` : "";
      return fetchJSON<MessageTemplate[]>(`/api/messages${params}`);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => {
      const url = editingTemplate ? `/api/messages/${editingTemplate.id}` : "/api/messages";
      const method = editingTemplate ? "PATCH" : "POST";
      return fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => {
        if (!r.ok) throw new Error("Failed"); return r.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      setShowEditor(false);
      setEditingTemplate(null);
      setForm({ name: "", channel: "whatsapp", subject: "", body: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/messages/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messages"] }),
  });

  function insertVariable(v: string) {
    const newBody = form.body.slice(0, cursorPos) + v + form.body.slice(cursorPos);
    setForm({ ...form, body: newBody });
    setCursorPos(cursorPos + v.length);
  }

  function openEditor(template?: MessageTemplate) {
    if (template) {
      setEditingTemplate(template);
      setForm({ name: template.name, channel: template.channel, subject: template.subject || "", body: template.body });
    } else {
      setEditingTemplate(null);
      setForm({ name: "", channel: "whatsapp", subject: "", body: "" });
    }
    setShowEditor(true);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">תבניות הודעות</h1>
          <p className="text-sm text-petra-muted mt-1">{templates.length} תבניות</p>
        </div>
        <button className="btn-primary" onClick={() => openEditor()}>
          <Plus className="w-4 h-4" />תבנית חדשה
        </button>
      </div>

      {/* Channel filter */}
      <div className="flex gap-2 mb-6">
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

      {/* Templates list */}
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
                    {template.channel === "whatsapp" ? "וואטסאפ" : template.channel === "sms" ? "SMS" : "אימייל"}
                  </span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditor(template)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Edit3 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteMutation.mutate(template.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <p className="text-xs text-petra-muted line-clamp-3 whitespace-pre-wrap">{template.body}</p>
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
              <h2 className="text-lg font-bold text-petra-text">{editingTemplate ? "ערוך תבנית" : "תבנית חדשה"}</h2>
              <button onClick={() => setShowEditor(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">שם התבנית *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">ערוץ</label>
                <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                  <option value="whatsapp">וואטסאפ</option>
                  <option value="sms">SMS</option>
                  <option value="email">אימייל</option>
                </select>
              </div>
              {form.channel === "email" && (
                <div>
                  <label className="label">נושא</label>
                  <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                </div>
              )}
              <div>
                <label className="label">תוכן ההודעה *</label>
                <textarea
                  className="input font-mono text-sm"
                  rows={5}
                  placeholder="שלום {customerName}, פגישתך עם {petName} נקבעה ל-{date} בשעה {time}."
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  onSelect={(e) => setCursorPos((e.target as HTMLTextAreaElement).selectionStart)}
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button key={v} onClick={() => insertVariable(v)} className="px-2 py-0.5 rounded-md bg-brand-50 text-brand-600 text-[11px] font-medium hover:bg-brand-100 transition-colors">
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-primary flex-1" disabled={!form.name || !form.body || saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
                {saveMutation.isPending ? "שומר..." : editingTemplate ? "שמור שינויים" : "צור תבנית"}
              </button>
              <button className="btn-secondary" onClick={() => setShowEditor(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
