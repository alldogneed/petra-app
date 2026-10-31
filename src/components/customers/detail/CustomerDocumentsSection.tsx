"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { X, Upload, FileText, Trash2, Download, FolderOpen, File, FileCheck, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { cn } from "@/lib/utils";
import { DOC_CATEGORY_COLORS, DOC_CATEGORY_IDS } from "./SendContractSection";
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
  const t = useTranslations("customers.customerDocumentsSection");
  const tc = useTranslations("common");
  const tDoc = useTranslations("customers.sendContractSection.docCategories");
  const docCategoryLabel = (id: string) => (id && tDoc.has(id) ? tDoc(id) : id);
  const { locale } = useBusinessLocale();
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
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("errorDelete")); return d; }),
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
        const err = await res.json().catch(() => ({ error: t("errorUpload") }));
        toast.error(err.error || t("errorUpload"));
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
          {t("title", { count: docs.length })}
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
          {t("uploadDocument")}
        </button>
      </div>

      {/* Upload form */}
      {showUploadForm && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50/60 border border-amber-100 space-y-3">
          {/* Category selector */}
          <div>
            <label className="text-xs font-medium text-stone-600 mb-1.5 block">
              {t("docType")}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DOC_CATEGORY_IDS.map((key) => (
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
                  {docCategoryLabel(key)}
                </button>
              ))}
            </div>
          </div>

          {/* Optional label */}
          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">
              {t("docName")}
            </label>
            <input
              className="input text-sm"
              value={uploadLabel}
              onChange={(e) => setUploadLabel(e.target.value)}
              placeholder={t("docNamePlaceholder")}
            />
          </div>

          {/* File drop zone */}
          <div
            className="border-2 border-dashed border-stone-200 rounded-xl p-4 text-center cursor-pointer hover:border-amber-300 hover:bg-amber-50/30 transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-5 h-5 text-stone-400 mx-auto mb-1" />
            <p className="text-xs text-petra-muted">{t("clickToPick")}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {t("allowedTypes", { mb: MAX_UPLOAD_MB })}
            </p>
            <p className="text-[10px] text-emerald-600 mt-0.5">
              {t("imagesCompressed")}
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
                alert(t("oversized", { count: oversized.length, mb: MAX_UPLOAD_MB }));
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
              {tc("actions.cancel")}
            </button>
            <button
              onClick={handleUpload}
              disabled={pendingFiles.length === 0 || isUploading}
              className="btn-primary text-xs py-1.5 px-4"
            >
              {isUploading
                ? t("uploading")
                : pendingFiles.length > 0
                  ? t("uploadWithCount", { count: pendingFiles.length })
                  : t("upload")}
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
            {t("filterAll", { count: docs.length })}
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
              {docCategoryLabel(cat)} ({categoryCounts[cat]})
            </button>
          ))}
        </div>
      )}

      {/* Documents list */}
      {docs.length === 0 ? (
        <div className="empty-state py-8">
          <FolderOpen className="empty-state-icon w-8 h-8" />
          <p className="text-sm text-petra-muted mt-2">{t("emptyTitle")}</p>
          <p className="text-xs text-slate-400 mt-1">
            {t("emptyHint")}
          </p>
          {!showUploadForm && (
            <button
              className="btn-primary mt-3 text-xs"
              onClick={() => setShowUploadForm(true)}
            >
              <Upload className="w-3.5 h-3.5" />
              {t("uploadFirst")}
            </button>
          )}
        </div>
      ) : filteredDocs.length === 0 ? (
        <p className="text-sm text-petra-muted py-4 text-center">
          {t("emptyCategory")}
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
                      {docCategoryLabel(doc.category)}
                    </span>
                  </div>
                  <p className="text-[10px] text-petra-muted mt-0.5">
                    {formatFileSize(doc.size)} ·{" "}
                    {new Date(doc.createdAt).toLocaleDateString(locale)}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-amber-100 text-petra-muted hover:text-amber-700 transition-colors"
                    title={t("download")}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => setDeletingDoc({ id: doc.id, name: doc.name })}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-petra-muted hover:text-red-600 transition-colors"
                    title={tc("actions.delete")}
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
        title={t("deleteTitle")}
        confirmText={deletingDoc?.name ?? ""}
        description={t("deleteDescription")}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
