"use client";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { Check, GripVertical, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";

// ─── Manage Tags Popover ─────────────────────────────────────────

export function ManageTagsPopover({
  tags,
  onSave,
  isSaving,
}: {
  tags: string[];
  onSave: (tags: string[]) => void;
  isSaving: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [localTags, setLocalTags] = useState<string[]>(tags);
  const [newTag, setNewTag] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync when tags prop changes
  useEffect(() => {
    setLocalTags(tags);
  }, [tags]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setEditingIndex(null);
        setEditValue("");
        setConfirmDeleteIndex(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const addTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed || localTags.includes(trimmed)) return;
    const updated = [...localTags, trimmed];
    setLocalTags(updated);
    setNewTag("");
    onSave(updated);
    inputRef.current?.focus();
  };

  const removeTag = (index: number) => {
    const updated = localTags.filter((_, i) => i !== index);
    setLocalTags(updated);
    setConfirmDeleteIndex(null);
    onSave(updated);
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(localTags[index]);
    setConfirmDeleteIndex(null);
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    const trimmed = editValue.trim();
    if (!trimmed || localTags.some((t, i) => i !== editingIndex && t === trimmed)) {
      setEditingIndex(null);
      setEditValue("");
      return;
    }
    const updated = localTags.map((t, i) => (i === editingIndex ? trimmed : t));
    setLocalTags(updated);
    setEditingIndex(null);
    setEditValue("");
    onSave(updated);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditValue("");
  };

  // ── Drag to reorder ────────────────────────────────────────────
  const handleDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = dragIndexRef.current;
    if (fromIndex === null || fromIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }
    const updated = [...localTags];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(dropIndex, 0, moved);
    setLocalTags(updated);
    setDragOverIndex(null);
    dragIndexRef.current = null;
    onSave(updated);
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
    dragIndexRef.current = null;
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isOpen
          ? "bg-[#3D2E1F] text-white"
          : "text-[#A0845C] hover:bg-[#F3EDE6] hover:text-[#8B7355]"
          }`}
        title="ניהול תוויות"
      >
        <Settings2 className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-[#E8DFD5] p-4 z-50 w-[280px] animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-petra-text">ניהול תוויות</h3>
            <span className="text-[10px] text-petra-muted">{localTags.length} תוויות</span>
          </div>

          {/* Add new tag */}
          <div className="flex gap-2 mb-3">
            <input
              ref={inputRef}
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="תווית חדשה..."
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[#E8DFD5] bg-[#FAF7F3] focus:outline-none focus:border-[#C4956A] focus:ring-1 focus:ring-[#C4956A]/20"
            />
            <button
              onClick={addTag}
              disabled={!newTag.trim() || localTags.includes(newTag.trim())}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#3D2E1F] text-white hover:bg-[#2A1F14] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Tags list */}
          <div className="space-y-1 max-h-[240px] overflow-y-auto">
            {localTags.map((tag, index) => (
              <div
                key={`${tag}-${index}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-2 group px-2 py-1.5 rounded-lg transition-colors cursor-grab active:cursor-grabbing ${dragOverIndex === index
                  ? "bg-[#F3EDE6] border-2 border-dashed border-[#C4956A]"
                  : "hover:bg-[#FAF7F3] border-2 border-transparent"
                  }`}
              >
                {/* Drag handle */}
                <GripVertical className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />

                {editingIndex === index ? (
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      autoFocus
                      className="flex-1 px-2 py-0.5 text-xs rounded border border-[#C4956A] bg-white focus:outline-none focus:ring-1 focus:ring-[#C4956A]/30"
                    />
                    <button
                      onClick={saveEdit}
                      className="w-6 h-6 rounded flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors flex-shrink-0"
                      title="אישור"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors flex-shrink-0"
                      title="ביטול"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : confirmDeleteIndex === index ? (
                  // ── Confirm delete inline ──
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="flex-1 text-xs text-red-600 font-medium">מחק את &quot;{tag}&quot;?</span>
                    <button
                      onClick={() => removeTag(index)}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors flex-shrink-0"
                    >
                      מחק
                    </button>
                    <button
                      onClick={() => setConfirmDeleteIndex(null)}
                      className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors flex-shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span
                      className={`flex-1 text-xs font-medium cursor-pointer ${tag === "VIP" ? "text-amber-700" : "text-[#8B7355]"
                        }`}
                      onClick={() => startEdit(index)}
                      title="לחץ לעריכה"
                    >
                      {tag}
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(index)}
                        className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-[#8B7355] hover:bg-[#F3EDE6] transition-colors"
                        title="ערוך"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteIndex(index)}
                        className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="מחק"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {localTags.length === 0 && (
            <div className="text-center py-3 text-xs text-petra-muted">
              אין תוויות. הוסף תווית חדשה למעלה.
            </div>
          )}

          {isSaving && (
            <div className="text-center pt-2 text-[10px] text-[#C4956A] font-medium">
              שומר...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
