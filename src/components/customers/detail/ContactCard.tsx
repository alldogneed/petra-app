"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, MapPin, MessageCircle, Pencil, Phone, Plus, Send, X } from "lucide-react";
import { toast } from "sonner";
import { fetchJSON } from "@/lib/utils";
import { DEFAULT_CUSTOMER_TAGS } from "./EditCustomerModal";
import { waLink } from "./customer-actions";
import { parseTags, type CustomerDetail } from "./types";

export function ContactCard({
  customer,
  canEdit,
  canSendMessages,
  onEdit,
  onCompose,
}: {
  customer: CustomerDetail;
  /** CUSTOMERS_PII + CONTENT_WRITE (edit details, tags). */
  canEdit: boolean;
  canSendMessages: boolean;
  onEdit: () => void;
  onCompose: () => void;
}) {
  const hasPhone = !!customer.phone?.trim();
  const counts = customer.summary?.counts;

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-petra-text">פרטי קשר</h2>
        {canEdit && (
          <button
            onClick={onEdit}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted transition-colors"
            title="ערוך לקוח"
            aria-label="ערוך לקוח"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Phone className="w-4 h-4 text-petra-muted flex-shrink-0" />
          {hasPhone ? (
            <>
              <a href={`tel:${customer.phone}`} className="text-sm hover:underline" dir="ltr">{customer.phone}</a>
              <div className="ms-auto flex items-center gap-1 flex-shrink-0">
                {canSendMessages && (
                  <button
                    onClick={onCompose}
                    className="flex items-center gap-1 rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                    title="שלח הודעת WhatsApp מהמערכת"
                  >
                    <Send className="w-3 h-3" />
                    שלח הודעה
                  </button>
                )}
                <a
                  href={waLink(customer.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                  title="פתח צ׳אט WhatsApp"
                  aria-label="פתח צ׳אט WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </a>
              </div>
            </>
          ) : (
            <span className="text-sm text-slate-300">אין טלפון</span>
          )}
        </div>
        {customer.email && (
          <a
            href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(customer.email)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 group"
          >
            <Mail className="w-4 h-4 text-petra-muted flex-shrink-0 group-hover:text-brand-600 transition-colors" />
            <span className="text-sm break-all text-brand-600 group-hover:text-brand-700 group-hover:underline transition-colors">
              {customer.email}
            </span>
          </a>
        )}
        <div className="flex items-center gap-2.5">
          <MapPin className="w-4 h-4 text-petra-muted flex-shrink-0" />
          {customer.address ? <span className="text-sm">{customer.address}</span> : <span className="text-sm text-slate-300">—</span>}
        </div>
      </div>

      <InlineTags customerId={customer.id} rawTags={customer.tags} canEdit={canEdit} />

      {customer.notes && (
        <div className="pt-2 border-t border-slate-100">
          <p className="text-sm text-petra-muted whitespace-pre-line">{customer.notes}</p>
        </div>
      )}

      <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2">
        <Stat value={counts?.appointments ?? 0} label="תורים" />
        <Stat value={counts?.pets ?? customer.pets.length} label="חיות" />
        <Stat value={counts?.orders ?? 0} label="הזמנות" />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center p-2 rounded-xl bg-slate-50">
      <p className="text-lg font-bold text-petra-text">{value}</p>
      <p className="text-[10px] text-petra-muted">{label}</p>
    </div>
  );
}

// ─── Inline tags ─────────────────────────────────────────────────────────────

const MAX_TAG_LEN = 50;

function InlineTags({ customerId, rawTags, canEdit }: { customerId: string; rawTags: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const tags = useMemo(() => parseTags(rawTags), [rawTags]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  // Business preset tags — fetched only while the add box is open.
  const { data: settings } = useQuery<{ customerTags?: string }>({
    queryKey: ["settings"],
    queryFn: () => fetchJSON<{ customerTags?: string }>("/api/settings"),
    staleTime: 60_000,
    enabled: adding,
  });
  const suggestions = useMemo(() => {
    const preset = parseTags(settings?.customerTags);
    const pool = Array.from(new Set([...(preset.length ? preset : DEFAULT_CUSTOMER_TAGS), ...DEFAULT_CUSTOMER_TAGS]));
    const q = draft.trim();
    return pool.filter((t) => !tags.includes(t) && (!q || t.includes(q))).slice(0, 8);
  }, [settings?.customerTags, tags, draft]);

  const mutation = useMutation({
    mutationFn: (next: string[]) =>
      fetchJSON(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: JSON.stringify(next) }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בעדכון התגיות"),
  });

  const addTag = (raw: string) => {
    const tag = raw.trim().slice(0, MAX_TAG_LEN);
    if (!tag) return;
    if (tags.includes(tag)) {
      setDraft("");
      return;
    }
    mutation.mutate([...tags, tag], { onSuccess: () => setDraft("") });
  };

  if (!canEdit && tags.length === 0) return null;

  return (
    <div className="pt-2 border-t border-slate-100 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="badge-brand inline-flex items-center gap-1">
            {tag}
            {canEdit && (
              <button
                type="button"
                onClick={() => mutation.mutate(tags.filter((t) => t !== tag))}
                disabled={mutation.isPending}
                className="rounded-full hover:bg-black/10 p-0.5 disabled:opacity-50"
                aria-label={`הסר תגית ${tag}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </span>
        ))}
        {canEdit && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] text-slate-500 hover:border-brand-300 hover:text-brand-600 transition-colors"
          >
            <Plus className="w-3 h-3" />
            תגית
          </button>
        )}
      </div>
      {canEdit && adding && (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <input
              className="input text-sm py-1.5 flex-1 min-w-0"
              placeholder="תגית חדשה..."
              value={draft}
              maxLength={MAX_TAG_LEN}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addTag(draft); }
                if (e.key === "Escape") { setAdding(false); setDraft(""); }
              }}
            />
            <button
              type="button"
              className="btn-primary text-xs py-1.5 px-3"
              disabled={!draft.trim() || mutation.isPending}
              onClick={() => addTag(draft)}
            >
              הוסף
            </button>
            <button
              type="button"
              className="w-8 flex items-center justify-center rounded-lg text-petra-muted hover:bg-slate-100"
              onClick={() => { setAdding(false); setDraft(""); }}
              aria-label="סגור"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => addTag(s)}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
