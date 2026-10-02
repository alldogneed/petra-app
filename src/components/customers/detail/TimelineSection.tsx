"use client";

import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn, fetchJSON, getTimelineIcon } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { CustomerTimelineEvent, PagedTimeline } from "./types";

const PAGE_SIZE = 30;
const MAX_NOTE = 2000;

type Filter = "all" | "notes" | "appointments" | "payments" | "messages";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "הכל" },
  { key: "notes", label: "הערות" },
  { key: "appointments", label: "תורים" },
  { key: "payments", label: "תשלומים" },
  { key: "messages", label: "הודעות" },
];

/** Notes are the only editable/deletable events (server: type note | MANUAL_NOTE). */
export function isNoteEvent(type: string): boolean {
  return type === "note" || type === "MANUAL_NOTE";
}

function eventCategory(type: string): Exclude<Filter, "all"> | null {
  if (isNoteEvent(type)) return "notes";
  const t = type.toLowerCase();
  if (t.includes("appointment") || t.includes("booking")) return "appointments";
  if (t.includes("payment") || t.includes("invoice") || t.includes("refund")) return "payments";
  if (t.includes("whatsapp") || t.includes("message") || t.includes("sms") || t.includes("reminder") || t.includes("email")) return "messages";
  return null;
}

const dateTimeFmt = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function TimelineSection({ customerId, canWrite }: { customerId: string; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [showNoteBox, setShowNoteBox] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const timelineKey = ["customer", customerId, "timeline"];
  const query = useInfiniteQuery<PagedTimeline>({
    queryKey: timelineKey,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ take: String(PAGE_SIZE) });
      if (pageParam) qs.set("cursor", String(pageParam));
      return fetchJSON<PagedTimeline>(`/api/customers/${customerId}/timeline?${qs}`);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });
  const events = query.data?.pages.flatMap((p) => p.events) ?? [];
  const visible = filter === "all" ? events : events.filter((e) => eventCategory(e.type) === filter);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: timelineKey });

  const addMutation = useMutation({
    mutationFn: (description: string) =>
      fetchJSON(`/api/customers/${customerId}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, type: "note" }),
      }),
    onSuccess: () => {
      invalidate();
      setNewNote("");
      setShowNoteBox(false);
      toast.success("ההערה נשמרה");
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בשמירת ההערה"),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, description }: { id: string; description: string }) =>
      fetchJSON(`/api/customers/${customerId}/timeline/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success("ההערה עודכנה");
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בעדכון ההערה"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchJSON(`/api/customers/${customerId}/timeline/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast.success("ההערה נמחקה");
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה במחיקת ההערה"),
    onSettled: () => setDeletingId(null),
  });

  return (
    <div id="timeline" className="card p-5 scroll-mt-32">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-petra-text">ציר זמן</h2>
        {canWrite && (
          <button
            onClick={() => setShowNoteBox((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all",
              showNoteBox ? "bg-brand-500 text-white" : "btn-ghost text-petra-muted"
            )}
          >
            <BookOpen className="w-3.5 h-3.5" />
            רשום הערה
          </button>
        )}
      </div>

      {canWrite && showNoteBox && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-100">
          <textarea
            className="w-full text-sm bg-transparent border-none outline-none resize-none placeholder:text-stone-400 text-petra-text min-h-[72px]"
            placeholder="הוסף הערת התקדמות, תצפית, או פעילות..."
            value={newNote}
            maxLength={MAX_NOTE}
            autoFocus
            onChange={(e) => setNewNote(e.target.value)}
          />
          <div className="flex gap-2 justify-end mt-2">
            <button
              onClick={() => { setShowNoteBox(false); setNewNote(""); }}
              className="text-xs text-petra-muted hover:text-petra-text px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
            >
              ביטול
            </button>
            <button
              onClick={() => addMutation.mutate(newNote.trim())}
              disabled={!newNote.trim() || addMutation.isPending}
              className="btn-primary text-xs py-1.5 px-4"
            >
              {addMutation.isPending ? "שומר..." : "שמור"}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-1.5 mb-4 overflow-x-auto max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "flex-shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
              filter === f.key ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <PetraLoader variant="inline" className="py-4" />
      ) : query.isError ? (
        <p className="text-sm text-red-500 py-4 text-center">שגיאה בטעינת ציר הזמן</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-petra-muted py-4 text-center">{filter === "all" ? "אין אירועים" : "אין אירועים מסוג זה בטווח שנטען"}</p>
      ) : (
        <div className="space-y-3">
          {visible.map((event) => (
            <TimelineRow
              key={event.id}
              event={event}
              canWrite={canWrite}
              editing={editing?.id === event.id ? editing.text : null}
              saving={editMutation.isPending}
              onStartEdit={() => setEditing({ id: event.id, text: event.description })}
              onChangeEdit={(text) => setEditing({ id: event.id, text })}
              onCancelEdit={() => setEditing(null)}
              onSaveEdit={() => editing && editing.text.trim() && editMutation.mutate({ id: event.id, description: editing.text.trim() })}
              onDelete={() => setDeletingId(event.id)}
            />
          ))}
        </div>
      )}
      {query.hasNextPage && (
        <button
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="w-full mt-3 py-2 text-xs text-petra-muted hover:text-petra-text transition-colors disabled:opacity-50"
        >
          {query.isFetchingNextPage ? "טוען..." : "טען עוד"}
        </button>
      )}

      <ConfirmDialog
        open={!!deletingId}
        title="מחיקת הערה"
        description="ההערה תימחק מציר הזמן. להמשיך?"
        confirmLabel="מחק"
        danger
        loading={deleteMutation.isPending}
        onCancel={() => setDeletingId(null)}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
      />
    </div>
  );
}

function TimelineRow({
  event,
  canWrite,
  editing,
  saving,
  onStartEdit,
  onChangeEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  event: CustomerTimelineEvent;
  canWrite: boolean;
  /** Current edit text, or null when not editing this row. */
  editing: string | null;
  saving: boolean;
  onStartEdit: () => void;
  onChangeEdit: (text: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = getTimelineIcon(event.type);
  const editable = canWrite && isNoteEvent(event.type);
  return (
    <div className="group flex items-start gap-3">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", isNoteEvent(event.type) ? "bg-amber-50" : "bg-slate-100")}>
        {isNoteEvent(event.type) ? <BookOpen className="w-4 h-4 text-amber-600" /> : <Icon className="w-4 h-4 text-slate-500" />}
      </div>
      <div className="flex-1 min-w-0">
        {editing !== null ? (
          <div className="space-y-2">
            <textarea
              className="input text-sm min-h-[64px] resize-none"
              value={editing}
              maxLength={MAX_NOTE}
              autoFocus
              onChange={(e) => onChangeEdit(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button className="text-xs text-petra-muted hover:text-petra-text px-3 py-1.5 rounded-lg hover:bg-slate-100" onClick={onCancelEdit}>
                ביטול
              </button>
              <button className="btn-primary text-xs py-1.5 px-4" disabled={!editing.trim() || saving} onClick={onSaveEdit}>
                {saving ? "שומר..." : "שמור"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-petra-text whitespace-pre-line break-words">{event.description}</p>
            <p className="text-xs text-petra-muted mt-0.5">{dateTimeFmt.format(new Date(event.createdAt))}</p>
          </>
        )}
      </div>
      {editable && editing === null && (
        <div className="flex items-center gap-1 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button onClick={onStartEdit} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted" title="ערוך הערה" aria-label="ערוך הערה">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600" title="מחק הערה" aria-label="מחק הערה">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
