"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { X, Upload, FileText, Trash2, Download, FolderOpen, File, FileCheck, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { cn } from "@/lib/utils";
import { DOC_CATEGORY_COLORS, DOC_CATEGORY_LABELS } from "./SendContractSection";
import { CustomerDoc, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, compressImage, formatFileSize } from "./types";

export function getDocIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType === "application/pdf") return FileCheck;
  return File;
}

export function CustomerDocumentsSection({
  customerId,
  documentsJson,
}: {
  customerId: string;
  documentsJson: string;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("other");
  const [uploadLabel, setUploadLabel] = useState("");
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [deletingDoc, setDeletingDoc] = useState<{ id: string; name: string } | null>(null);

  // Parse docs from customer data (initial), then use react-query for fresh data
  const { data: docs = [] } = useQuery<CustomerDoc[]>({
    queryKey: ["customerDocs", customerId],
    queryFn: () =>
      fetch(`/api/customers/${customerId}/documents`).then((r) => r.json()),
    initialData: () => {
      try {
        return JSON.parse(documentsJson || "[]");
      } catch {
        return [];
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) =>
      fetch(`/api/customers/${customerId}/documents?docId=${docId}`, {
        method: "DELETE",
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה במחיקה"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customerDocs", customerId] });
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
    },
  });

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    setIsUploading(true);
    let anyFailed = false;
    for (const file of pendingFiles) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", uploadCategory);
      if (uploadLabel.trim()) fd.append("label", uploadLabel.trim());
      const res = await fetch(`/api/customers/${customerId}/documents`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "שגיאה בהעלאת קובץ" }));
        toast.error(err.error || "שגיאה בהעלאת קובץ");
        anyFailed = true;
      }
    }
    setIsUploading(false);
    if (!anyFailed) {
      setPendingFiles([]);
      setUploadLabel("");
      setUploadCategory("other");
      setShowUploadForm(false);
    }
    queryClient.invalidateQueries({ queryKey: ["customerDocs", customerId] });
    queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
  };

  const filteredDocs = filterCategory
    ? docs.filter((d) => d.category === filterCategory)
    : docs;

  // Count per category
  const categoryCounts: Record<string, number> = {};
  docs.forEach((d) => {
    categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
  });
  const usedCategories = Object.keys(categoryCounts);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-petra-muted" />
          מסמכים ({docs.length})
        </h2>
        <button
          onClick={() => setShowUploadForm((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all",
            showUploadForm
              ? "bg-brand-500 text-white"
              : "btn-ghost text-petra-muted"
          )}
        >
          <Upload className="w-3.5 h-3.5" />
          העלאת מסמך
        </button>
      </div>

      {/* Upload form */}
      {showUploadForm && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50/60 border border-amber-100 space-y-3">
          {/* Category selector */}
          <div>
            <label className="text-xs font-medium text-stone-600 mb-1.5 block">
              סוג מסמך
            </label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(DOC_CATEGORY_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setUploadCategory(key)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                    uploadCategory === key
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-white text-petra-muted border-slate-200 hover:border-amber-300 hover:text-amber-700"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional label */}
          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">
              שם מסמך (אופציונלי)
            </label>
            <input
              className="input text-sm"
              value={uploadLabel}
              onChange={(e) => setUploadLabel(e.target.value)}
              placeholder="לדוגמה: חוזה אילוף ינואר 2026"
            />
          </div>

          {/* File drop zone */}
          <div
            className="border-2 border-dashed border-stone-200 rounded-xl p-4 text-center cursor-pointer hover:border-amber-300 hover:bg-amber-50/30 transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-5 h-5 text-stone-400 mx-auto mb-1" />
            <p className="text-xs text-petra-muted">לחץ לבחירת קבצים</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              PDF, JPG, PNG, DOC, XLS — עד {MAX_UPLOAD_MB}MB לקובץ
            </p>
            <p className="text-[10px] text-emerald-600 mt-0.5">
              תמונות מכווצות אוטומטית לפני ההעלאה
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={async (e) => {
              if (!e.target.files) return;
              const compressed = await Promise.all(Array.from(e.target.files).map((f) => compressImage(f)));
              const valid = compressed.filter((f) => f.size <= MAX_UPLOAD_BYTES);
              const oversized = compressed.filter((f) => f.size > MAX_UPLOAD_BYTES);
              setPendingFiles((prev) => [...prev, ...valid]);
              if (oversized.length > 0) {
                alert(`${oversized.length} קובץ/ים חורגים מגודל מקסימלי של ${MAX_UPLOAD_MB}MB ולא נוספו.`);
              }
              e.target.value = "";
            }}
          />

          {/* Pending files list */}
          {pendingFiles.length > 0 && (
            <div className="space-y-1">
              {pendingFiles.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs text-petra-muted p-1.5 rounded-lg bg-white border border-stone-100"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span className="truncate flex-1">{file.name}</span>
                  <span className="text-[10px] text-stone-400">
                    {formatFileSize(file.size)}
                  </span>
                  <button
                    onClick={() =>
                      setPendingFiles((f) => f.filter((_, j) => j !== i))
                    }
                    className="text-red-400 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload actions */}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowUploadForm(false);
                setPendingFiles([]);
                setUploadLabel("");
                setUploadCategory("other");
              }}
              className="text-xs text-petra-muted hover:text-petra-text px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
            >
              ביטול
            </button>
            <button
              onClick={handleUpload}
              disabled={pendingFiles.length === 0 || isUploading}
              className="btn-primary text-xs py-1.5 px-4"
            >
              {isUploading
                ? "מעלה..."
                : `העלה ${pendingFiles.length > 0 ? `(${pendingFiles.length})` : ""}`}
            </button>
          </div>
        </div>
      )}

      {/* Category filter pills */}
      {usedCategories.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button
            onClick={() => setFilterCategory(null)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-medium transition-all border",
              !filterCategory
                ? "bg-stone-700 text-white border-stone-700"
                : "bg-white text-petra-muted border-slate-200 hover:border-stone-300"
            )}
          >
            הכל ({docs.length})
          </button>
          {usedCategories.map((cat) => (
            <button
              key={cat}
              onClick={() =>
                setFilterCategory(filterCategory === cat ? null : cat)
              }
              className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-medium transition-all border",
                filterCategory === cat
                  ? "bg-stone-700 text-white border-stone-700"
                  : "bg-white text-petra-muted border-slate-200 hover:border-stone-300"
              )}
            >
              {DOC_CATEGORY_LABELS[cat] || cat} ({categoryCounts[cat]})
            </button>
          ))}
        </div>
      )}

      {/* Documents list */}
      {docs.length === 0 ? (
        <div className="empty-state py-8">
          <FolderOpen className="empty-state-icon w-8 h-8" />
          <p className="text-sm text-petra-muted mt-2">אין מסמכים עדיין</p>
          <p className="text-xs text-slate-400 mt-1">
            חוזים, חשבוניות, קבלות ועוד
          </p>
          {!showUploadForm && (
            <button
              className="btn-primary mt-3 text-xs"
              onClick={() => setShowUploadForm(true)}
            >
              <Upload className="w-3.5 h-3.5" />
              העלה מסמך ראשון
            </button>
          )}
        </div>
      ) : filteredDocs.length === 0 ? (
        <p className="text-sm text-petra-muted py-4 text-center">
          אין מסמכים בקטגוריה זו
        </p>
      ) : (
        <div className="space-y-2">
          {filteredDocs.map((doc) => {
            const DocIcon = getDocIcon(doc.mimeType);
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <DocIcon className="w-4.5 h-4.5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-petra-text truncate">
                      {doc.name}
                    </p>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium border flex-shrink-0",
                        DOC_CATEGORY_COLORS[doc.category] ||
                          DOC_CATEGORY_COLORS.other
                      )}
                    >
                      {DOC_CATEGORY_LABELS[doc.category] || doc.category}
                    </span>
                  </div>
                  <p className="text-[10px] text-petra-muted mt-0.5">
                    {formatFileSize(doc.size)} ·{" "}
                    {new Date(doc.createdAt).toLocaleDateString("he-IL")}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-amber-100 text-petra-muted hover:text-amber-700 transition-colors"
                    title="הורד"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => setDeletingDoc({ id: doc.id, name: doc.name })}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-petra-muted hover:text-red-600 transition-colors"
                    title="מחק"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDeleteModal
        open={!!deletingDoc}
        onClose={() => setDeletingDoc(null)}
        onConfirm={() => {
          if (deletingDoc) {
            deleteMutation.mutate(deletingDoc.id, {
              onSuccess: () => setDeletingDoc(null),
            });
          }
        }}
        title="מחיקת מסמך"
        confirmText={deletingDoc?.name ?? ""}
        description="מחיקת המסמך תסיר אותו לצמיתות. פעולה זו אינה ניתנת לביטול."
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
