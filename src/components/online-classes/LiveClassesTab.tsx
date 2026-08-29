"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Video,
  Plus,
  Pencil,
  Trash2,
  Users,
  Clock,
  Link2,
  AlertTriangle,
} from "lucide-react";
import { fetchJSON } from "@/lib/utils";
import {
  Modal,
  heDateTime,
  toDatetimeLocal,
  unwrapList,
  type OnlineClassItem,
  type ClassRegistration,
} from "./shared";

const REG_STATUS: Record<string, { label: string; cls: string }> = {
  registered: { label: "רשום", cls: "badge-success" },
  waitlist: { label: "המתנה", cls: "badge-warning" },
  cancelled: { label: "בוטל", cls: "badge-neutral" },
};

interface ClassFormState {
  title: string;
  description: string;
  instructorName: string;
  startsAt: string; // datetime-local value
  durationMin: string;
  capacity: string;
  zoomLink: string;
}

const EMPTY_FORM: ClassFormState = {
  title: "",
  description: "",
  instructorName: "",
  startsAt: "",
  durationMin: "60",
  capacity: "20",
  zoomLink: "",
};

function waitlistCountOf(c: OnlineClassItem): number {
  return c.waitlistCount ?? 0;
}

export function LiveClassesTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingClass, setEditingClass] = useState<OnlineClassItem | null>(null);
  const [form, setForm] = useState<ClassFormState>(EMPTY_FORM);
  const [registrationsFor, setRegistrationsFor] = useState<OnlineClassItem | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["oc-classes"],
    queryFn: () => fetchJSON("/api/online-classes/classes"),
  });
  const classes = unwrapList<OnlineClassItem>(data, "classes", "items");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["oc-classes"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        instructorName: form.instructorName.trim() || null,
        startsAt: new Date(form.startsAt).toISOString(),
        durationMin: form.durationMin ? Number(form.durationMin) : null,
        capacity: Number(form.capacity),
        zoomLink: form.zoomLink.trim() || null,
      };
      if (editingClass) {
        return fetchJSON(`/api/online-classes/classes/${editingClass.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      return fetchJSON("/api/online-classes/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success(editingClass ? "השיעור עודכן" : "השיעור נוצר");
      setShowForm(false);
      setEditingClass(null);
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בשמירת השיעור"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJSON(`/api/online-classes/classes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("השיעור נמחק");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה במחיקת השיעור"),
  });

  const openCreate = () => {
    setEditingClass(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (c: OnlineClassItem) => {
    setEditingClass(c);
    setForm({
      title: c.title,
      description: c.description ?? "",
      instructorName: c.instructorName ?? "",
      startsAt: toDatetimeLocal(c.startsAt),
      durationMin: c.durationMin != null ? String(c.durationMin) : "60",
      capacity: String(c.capacity),
      zoomLink: c.zoomLink ?? "",
    });
    setShowForm(true);
  };

  const handleDelete = (c: OnlineClassItem) => {
    if (window.confirm(`למחוק את השיעור "${c.title}"? כל הרישומים אליו יימחקו.`)) {
      deleteMutation.mutate(c.id);
    }
  };

  if (isError) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-400" />
        <p className="text-red-600 font-medium mb-2">שגיאה בטעינת השיעורים</p>
        <button className="btn-secondary text-sm" onClick={() => refetch()}>נסה שוב</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-petra-text">שיעורים חיים בזום</h2>
        <button className="btn-primary text-sm" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          שיעור חדש
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse h-24" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">
            <Video className="w-6 h-6 text-slate-400" />
          </div>
          <p className="font-medium text-petra-text mb-1">אין שיעורים חיים עדיין</p>
          <p className="text-sm text-petra-muted mb-4">צור שיעור זום ראשון והחברים בפורטל יוכלו להירשם</p>
          <button className="btn-primary text-sm" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            שיעור חדש
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map((c) => {
            const waitlist = waitlistCountOf(c);
            const isPast = new Date(c.startsAt).getTime() < Date.now();
            return (
              <div key={c.id} className={`card p-4 sm:p-5 ${isPast ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <Video className="w-5 h-5 text-brand-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-petra-text">{c.title}</p>
                      {isPast && <span className="badge-neutral">הסתיים</span>}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap mt-1 text-sm text-petra-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {heDateTime(c.startsAt)}
                        {c.durationMin ? ` (${c.durationMin} דק׳)` : ""}
                      </span>
                      {c.instructorName && <span>מדריך: {c.instructorName}</span>}
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {c.spotsTaken}/{c.capacity}
                      </span>
                      {waitlist > 0 && (
                        <span className="badge-warning">{waitlist} בהמתנה</span>
                      )}
                      {c.zoomLink ? (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <Link2 className="w-3.5 h-3.5" />
                          קישור זום מוגדר
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Link2 className="w-3.5 h-3.5" />
                          חסר קישור זום
                        </span>
                      )}
                    </div>
                    {c.description && (
                      <p className="text-sm text-petra-muted mt-1.5 line-clamp-2">{c.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 ms-auto">
                    <button
                      className="btn-secondary text-xs"
                      onClick={() => setRegistrationsFor(c)}
                    >
                      <Users className="w-3.5 h-3.5" />
                      נרשמים
                    </button>
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
                      title="עריכה"
                      onClick={() => openEdit(c)}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-petra-muted hover:text-red-600"
                      title="מחיקה"
                      onClick={() => handleDelete(c)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {showForm && (
        <Modal
          title={editingClass ? "עריכת שיעור" : "שיעור חדש"}
          onClose={() => {
            setShowForm(false);
            setEditingClass(null);
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="label">שם השיעור *</label>
              <input
                className="input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="למשל: שיעור חיברות לגורים"
              />
            </div>
            <div>
              <label className="label">תיאור</label>
              <textarea
                className="input min-h-[70px]"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className="label">שם המדריך</label>
              <input
                className="input"
                value={form.instructorName}
                onChange={(e) => setForm({ ...form, instructorName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">תאריך ושעה *</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                />
              </div>
              <div>
                <label className="label">משך (דקות)</label>
                <input
                  type="number"
                  min={5}
                  className="input"
                  value={form.durationMin}
                  onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">קיבולת *</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                />
              </div>
              <div>
                <label className="label">קישור זום</label>
                <input
                  className="input"
                  dir="ltr"
                  value={form.zoomLink}
                  onChange={(e) => setForm({ ...form, zoomLink: e.target.value })}
                  placeholder="https://zoom.us/j/..."
                />
              </div>
            </div>
            <p className="text-[11px] text-petra-muted">
              קישור הזום נשלח אוטומטית לנרשמים כשעה לפני תחילת השיעור.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                className="btn-primary flex-1 justify-center"
                disabled={
                  saveMutation.isPending ||
                  !form.title.trim() ||
                  !form.startsAt ||
                  !form.capacity ||
                  Number(form.capacity) < 1
                }
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? "שומר..." : editingClass ? "שמור שינויים" : "צור שיעור"}
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowForm(false);
                  setEditingClass(null);
                }}
              >
                ביטול
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Registrations modal */}
      {registrationsFor && (
        <RegistrationsModal
          cls={registrationsFor}
          onClose={() => setRegistrationsFor(null)}
        />
      )}
    </div>
  );
}

function RegistrationsModal({
  cls,
  onClose,
}: {
  cls: OnlineClassItem;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["oc-registrations", cls.id],
    queryFn: () => fetchJSON(`/api/online-classes/classes/${cls.id}/registrations`),
  });
  const registrations = unwrapList<ClassRegistration>(data, "registrations", "items");

  return (
    <Modal title={`נרשמים — ${cls.title}`} onClose={onClose} maxWidth="max-w-lg">
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : registrations.length === 0 ? (
        <div className="empty-state py-10">
          <div className="empty-state-icon">
            <Users className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm text-petra-muted">אין נרשמים לשיעור זה עדיין</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
          {registrations.map((r) => {
            const badge = REG_STATUS[r.status?.toLowerCase()] ?? {
              label: r.status,
              cls: "badge-neutral",
            };
            return (
              <div key={r.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-petra-text text-sm">{r.portalUser?.name || "—"}</p>
                  <p className="text-xs text-petra-muted" dir="ltr">
                    {r.portalUser?.phone}
                    {r.portalUser?.email ? ` · ${r.portalUser.email}` : ""}
                  </p>
                </div>
                <span className={badge.cls}>{badge.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
