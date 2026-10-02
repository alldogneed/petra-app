"use client";
/** Add / remove ANY tag on the selected customers — one POST /api/customers/bulk call. */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tag, X } from "lucide-react";
import { toast } from "sonner";
import { fetchJSON } from "@/lib/utils";
import { TAG_MAX_LEN } from "@/lib/customer-filters";

export function BulkTagModal({
  ids,
  presetTags,
  onClose,
  onDone,
}: {
  ids: string[];
  presetTags: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [tag, setTag] = useState("");
  const trimmed = tag.trim();

  const mutation = useMutation({
    mutationFn: (action: "add_tag" | "remove_tag") =>
      fetchJSON<{ updated: number }>("/api/customers/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, tag: trimmed, ids }),
      }),
    onSuccess: (res, action) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(
        action === "add_tag"
          ? `התגית "${trimmed}" נוספה ל-${res.updated} לקוחות`
          : `התגית "${trimmed}" הוסרה מ-${res.updated} לקוחות`
      );
      onDone();
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה בעדכון הלקוחות. נסה שוב."),
  });

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !mutation.isPending) onClose(); }}>
      <div className="modal-content max-w-sm w-full mx-4 p-5" role="dialog" aria-modal="true" aria-labelledby="bulk-tag-title">
        <div className="flex items-center justify-between mb-4">
          <h2 id="bulk-tag-title" className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Tag className="w-4 h-4" /> תגיות ל-{ids.length} לקוחות
          </h2>
          <button onClick={onClose} aria-label="סגור" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="label" htmlFor="bulk-tag-input">תגית</label>
        <input
          id="bulk-tag-input"
          className="input"
          value={tag}
          maxLength={TAG_MAX_LEN}
          onChange={(e) => setTag(e.target.value)}
          placeholder="בחר או הקלד תגית"
        />
        {presetTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {presetTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(t)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  trimmed === t ? "bg-[#3D2E1F] text-white border-[#3D2E1F]" : "bg-[#FAF7F3] text-[#8B7355] border-[#E8DFD5] hover:border-[#C4956A]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-5">
          <button
            className="btn-primary flex-1"
            disabled={!trimmed || mutation.isPending}
            onClick={() => mutation.mutate("add_tag")}
          >
            הוסף תגית
          </button>
          <button
            className="btn-secondary flex-1"
            disabled={!trimmed || mutation.isPending}
            onClick={() => mutation.mutate("remove_tag")}
          >
            הסר תגית
          </button>
        </div>
      </div>
    </div>
  );
}
