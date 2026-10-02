"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Save, Loader2, FileText, X, Pencil, Trash2, Plus, AlertTriangle } from "lucide-react";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { cn, fetchJSON } from "@/lib/utils";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { usePermissions } from "@/hooks/usePermissions";

// ─── Legacy export ────────────────────────────────────────────────────────────
// The settings tab used to be "תשלומים" (invoicing + contracts). Invoicing
// (Morning) is hidden while under construction, so the tab is just contracts.
// Kept under the old name because the settings shell imports `PaymentsTab`.

export function PaymentsTab() {
  return <ContractsTab />;
}


// ─── Contracts Tab ────────────────────────────────────────────────────────────

interface ContractTemplate {
  id: string;
  name: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  signaturePage: number;
  signatureX: number;
  signatureY: number;
  signatureWidth: number;
  signatureHeight: number;
  fields: string; // JSON
  createdAt: string;
}

export function ContractsTab() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContractTemplate | null>(null);
  // POST/PATCH/DELETE /api/contracts/templates → CONTRACTS_MANAGE (owner-grantable).
  // Deleting a template with signed contracts additionally needs CRITICAL_DELETE
  // (server answers 403 code SIGNED_CONTRACTS with a Hebrew message).
  const { canManageContracts: canEditTemplates } = usePermissions();

  const { data: templates = [], isLoading, isError } = useQuery<ContractTemplate[]>({
    queryKey: ["contract-templates"],
    queryFn: () => fetchJSON<ContractTemplate[]>("/api/contracts/templates"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/contracts/templates/${id}`, { method: "DELETE" }).then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((typeof d?.error === "string" && d.error) || "שגיאה במחיקת התבנית");
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-templates"] });
      setDeleteTarget(null);
      toast.success("תבנית נמחקה");
    },
    // Server's Hebrew message — incl. 403 SIGNED_CONTRACTS ("לתבנית יש N חוזים חתומים…").
    onError: (e: Error) => {
      setDeleteTarget(null);
      toast.error(e.message || "שגיאה במחיקת התבנית");
    },
  });

  if (isLoading) {
    return <PetraLoader />;
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-petra-text">חוזים</h2>
          <p className="text-sm text-petra-muted mt-0.5">תבניות PDF להחתמת לקוחות</p>
        </div>
        {canEditTemplates && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            תבנית חדשה
          </button>
        )}
      </div>

      {!canEditTemplates && (
        <p className="text-xs text-petra-muted">הוספה, עריכה ומחיקה של תבניות חוזים דורשות את ההרשאה &quot;לנהל תבניות חוזים&quot; — בקש מבעל העסק.</p>
      )}

      {isError ? (
        <div className="card p-4 text-sm text-red-600">שגיאה בטעינת תבניות החוזים</div>
      ) : templates.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm text-petra-muted">אין תבניות חוזים עדיין</p>
          {canEditTemplates && (
            <button onClick={() => setShowModal(true)} className="btn-primary text-sm inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              העלה תבנית ראשונה
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            let fieldCount = 0;
            try { fieldCount = JSON.parse(t.fields || "[]").length; } catch { fieldCount = 0; }
            return (
              <div key={t.id} className="card p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-petra-text text-sm truncate">{t.name}</p>
                  <p className="text-xs text-petra-muted mt-0.5 break-all">
                    {t.fileName} · {(t.fileSize / 1024).toFixed(0)} KB
                    {fieldCount > 0 ? ` · ${fieldCount} שדות` : " · ללא שדות"}
                  </p>
                  <p className="text-xs text-petra-muted">
                    נוצר: {new Date(t.createdAt).toLocaleDateString("he-IL")}
                  </p>
                </div>
                {canEditTemplates && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setEditingTemplate(t)}
                      className="btn-ghost text-xs py-1.5 px-3 inline-flex items-center gap-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      ערוך
                    </button>
                    <button
                      onClick={() => setDeleteTarget(t)}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                      disabled={deleteMutation.isPending}
                      aria-label={`מחק את ${t.name}`}
                      title="מחק תבנית"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="למחוק את תבנית החוזה?"
        description={deleteTarget ? <>התבנית &quot;{deleteTarget.name}&quot; תימחק לצמיתות — <strong>יחד עם כל בקשות ההחתמה שנשלחו ממנה, כולל חוזים חתומים וקבצי ה-PDF שלהם</strong>. לא ניתן לבטל פעולה זו. מחיקת תבנית שיש לה חוזים חתומים מותרת רק למי שמורשה למחוק לקוחות וכלבים.</> : undefined}
        confirmLabel="מחק"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
        onCancel={() => setDeleteTarget(null)}
      />

      {showModal && <AddContractTemplateModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); queryClient.invalidateQueries({ queryKey: ["contract-templates"] }); }} />}
      {editingTemplate && <EditContractTemplateModal template={editingTemplate} onClose={() => setEditingTemplate(null)} onSaved={() => { setEditingTemplate(null); queryClient.invalidateQueries({ queryKey: ["contract-templates"] }); }} />}
    </div>
  );
}

// ─── Contract field types ────────────────────────────────────────────────────

type ContractFieldType =
  | "customer_name" | "id_number" | "address" | "phone" | "signature"
  | "pet_name" | "pet_breed" | "pet_microchip" | "pet_birthdate" | "pet_gender" | "pet_color";

interface ContractField {
  id: string;
  type: ContractFieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const FIELD_TYPES: { type: ContractFieldType; label: string; color: string; bgColor: string }[] = [
  { type: "customer_name",  label: "👤 שם לקוח",  color: "#2563eb", bgColor: "rgba(37,99,235,0.12)" },
  { type: "id_number",      label: "🆔 ת.ז.",      color: "#7c3aed", bgColor: "rgba(124,58,237,0.12)" },
  { type: "address",        label: "🏠 כתובת",     color: "#16a34a", bgColor: "rgba(22,163,74,0.12)" },
  { type: "phone",          label: "📞 טלפון",     color: "#0891b2", bgColor: "rgba(8,145,178,0.12)" },
  { type: "pet_name",       label: "🐕 שם הכלב",   color: "#b45309", bgColor: "rgba(180,83,9,0.12)" },
  { type: "pet_breed",      label: "🐾 גזע",       color: "#a16207", bgColor: "rgba(161,98,7,0.12)" },
  { type: "pet_microchip",  label: "📟 מס׳ שבב",   color: "#dc2626", bgColor: "rgba(220,38,38,0.12)" },
  { type: "pet_birthdate",  label: "📅 תאריך לידה", color: "#9333ea", bgColor: "rgba(147,51,234,0.12)" },
  { type: "pet_gender",     label: "⚥ מין הכלב",    color: "#0d9488", bgColor: "rgba(13,148,136,0.12)" },
  { type: "pet_color",      label: "🎨 צבע/סימנים", color: "#c026d3", bgColor: "rgba(192,38,211,0.12)" },
  { type: "signature",      label: "✍️ חתימה",     color: "#ea580c", bgColor: "rgba(234,88,12,0.12)" },
];

const FIELD_DEFAULTS: Record<ContractFieldType, { width: number; height: number }> = {
  customer_name:  { width: 0.3,  height: 0.04 },
  id_number:      { width: 0.2,  height: 0.04 },
  address:        { width: 0.4,  height: 0.04 },
  phone:          { width: 0.2,  height: 0.04 },
  pet_name:       { width: 0.25, height: 0.04 },
  pet_breed:      { width: 0.25, height: 0.04 },
  pet_microchip:  { width: 0.25, height: 0.04 },
  pet_birthdate:  { width: 0.2,  height: 0.04 },
  pet_gender:     { width: 0.15, height: 0.04 },
  pet_color:      { width: 0.25, height: 0.04 },
  signature:      { width: 0.35, height: 0.07 },
};

const FIELD_SHORT_LABELS: Record<ContractFieldType, string> = {
  customer_name: "שם לקוח",
  id_number: "ת.ז.",
  address: "כתובת",
  phone: "טלפון",
  pet_name: "שם הכלב",
  pet_breed: "גזע",
  pet_microchip: "מס׳ שבב",
  pet_birthdate: "תאריך לידה",
  pet_gender: "מין",
  pet_color: "צבע/סימנים",
  signature: "חתימה",
};

function ContractFieldOverlay({
  field,
  overlayRef,
  onUpdate,
  onRemove,
}: {
  field: ContractField;
  overlayRef: React.RefObject<HTMLDivElement | null>;
  onUpdate: (id: string, updates: Partial<ContractField>) => void;
  onRemove: (id: string) => void;
}) {
  const ft = FIELD_TYPES.find((t) => t.type === field.type)!;

  const startInteraction = (e: React.PointerEvent, mode: "drag" | "resize") => {
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const rect = overlayRef.current!.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const { x, y, width, height } = field;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      if (mode === "drag") {
        onUpdate(field.id, {
          x: Math.max(0, Math.min(1 - width, x + dx)),
          y: Math.max(0, Math.min(1 - height, y + dy)),
        });
      } else {
        onUpdate(field.id, {
          width: Math.max(0.05, Math.min(1 - x, width + dx)),
          height: Math.max(0.02, Math.min(1 - y, height + dy)),
        });
      }
    };
    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  };

  return (
    <div
      style={{
        position: "absolute",
        left: `${field.x * 100}%`,
        top: `${field.y * 100}%`,
        width: `${field.width * 100}%`,
        height: `${field.height * 100}%`,
        border: `2px dashed ${ft.color}`,
        background: ft.bgColor,
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 4px",
        cursor: "move",
        touchAction: "none",
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).dataset.resize) return;
        startInteraction(e, "drag");
      }}
    >
      <span style={{ fontSize: 10, color: ft.color, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", pointerEvents: "none" }}>
        {ft.label}
      </span>
      <button
        type="button"
        style={{ color: ft.color, lineHeight: 1, flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}
        onClick={(e) => { e.stopPropagation(); onRemove(field.id); }}
      >
        ×
      </button>
      {/* Resize handle — bottom-right */}
      <div
        data-resize="true"
        style={{
          position: "absolute",
          bottom: -4,
          right: -4,
          width: 8,
          height: 8,
          background: ft.color,
          borderRadius: 2,
          cursor: "nwse-resize",
          touchAction: "none",
        }}
        onPointerDown={(e) => startInteraction(e, "resize")}
      />
    </div>
  );
}

function FieldsSummary({ fields, onClear }: { fields: ContractField[]; onClear: () => void }) {
  if (fields.length === 0) return null;
  const hasSignature = fields.some((f) => f.type === "signature");
  const byPage = fields.reduce<Record<number, ContractField[]>>((acc, f) => {
    (acc[f.page] ||= []).push(f);
    return acc;
  }, {});
  const pages = Object.keys(byPage).map(Number).sort((a, b) => a - b);

  return (
    <div className="mt-1.5 space-y-1">
      <div className="text-xs text-petra-muted space-y-0.5">
        {pages.map((p) => {
          const labels = byPage[p].map((f) => FIELD_SHORT_LABELS[f.type]);
          return (
            <p key={p}>עמוד {p}: <span className="font-medium text-petra-text">{labels.join(", ")}</span></p>
          );
        })}
      </div>
      <p className="text-xs text-petra-muted">
        {fields.length} שד{fields.length === 1 ? "ה" : "ות"} בסך הכל ·{" "}
        <button type="button" className="underline" onClick={onClear}>נקה הכל</button>
      </p>
      {!hasSignature && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="text-xs">לא הוצב שדה חתימה – הלקוח לא יוכל לחתום על המסמך</p>
        </div>
      )}
    </div>
  );
}

function AddContractTemplateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [signaturePage, setSignaturePage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [fields, setFields] = useState<ContractField[]>([]);
  const [selectedType, setSelectedType] = useState<ContractField["type"]>("signature");
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pageBlobUrl, setPageBlobUrl] = useState<string | null>(null);
  const [pageDims, setPageDims] = useState({ width: 595, height: 842 }); // A4 default
  const [pdfReady, setPdfReady] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfBytesRef = useRef<Uint8Array | null>(null);

  // Extract a single page as a blob URL using pdf-lib
  const extractPageBlob = useCallback(async (bytes: Uint8Array, pageNum: number) => {
    const { PDFDocument } = await import("pdf-lib");
    const src = await PDFDocument.load(bytes.slice(), { ignoreEncryption: true });
    const dest = await PDFDocument.create();
    const [page] = await dest.copyPages(src, [Math.min(pageNum - 1, src.getPageCount() - 1)]);
    dest.addPage(page);
    const singleBytes = await dest.save();
    return new Blob([new Uint8Array(singleBytes) as BlobPart], { type: "application/pdf" });
  }, []);

  // Load PDF metadata + first page
  useEffect(() => {
    if (!file) return;
    setPdfLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const ab = await file.arrayBuffer();
        if (cancelled) return;
        // Store immutable copy as Uint8Array
        const bytes = new Uint8Array(ab);
        pdfBytesRef.current = bytes;

        // Use pdfjs just for metadata (page count + dimensions)
        const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
        GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await getDocument({ data: bytes.slice() }).promise;
        if (cancelled) { doc.destroy(); return; }
        setTotalPages(doc.numPages);
        setSignaturePage(1);
        const page = await doc.getPage(1);
        const vp = page.getViewport({ scale: 1 });
        setPageDims({ width: vp.width, height: vp.height });
        doc.destroy();

        // Extract first page for native rendering
        const blob = await extractPageBlob(bytes, 1);
        if (cancelled) return;
        setPageBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
        setPdfReady(true);
      } catch (e) {
        console.error("PDF load error", e);
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [file, extractPageBlob]);

  // Extract page on navigation
  useEffect(() => {
    const bytes = pdfBytesRef.current;
    if (!bytes || !pdfReady || signaturePage < 1) return;
    // Clear immediately to show loading spinner
    setPageBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    let cancelled = false;
    (async () => {
      try {
        const blob = await extractPageBlob(bytes, signaturePage);
        if (cancelled) return;
        setPageBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
      } catch (e) {
        console.error("Page extraction error", e);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signaturePage]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => { setPageBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; }); };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFields([]);
    pdfBytesRef.current = null;
    setPdfReady(false);
    setTotalPages(0);
    setPageBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const def = FIELD_DEFAULTS[selectedType];
    const newField: ContractField = {
      id: crypto.randomUUID(),
      type: selectedType,
      page: signaturePage,
      x: Math.max(0, Math.min(x - def.width / 2, 1 - def.width)),
      y: Math.max(0, Math.min(y - def.height / 2, 1 - def.height)),
      width: def.width,
      height: def.height,
    };
    setFields((prev) => [...prev, newField]);
  };

  const removeField = (id: string) => setFields((prev) => prev.filter((f) => f.id !== id));
  const updateField = (id: string, updates: Partial<ContractField>) =>
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));

  const [sigWarningShown, setSigWarningShown] = useState(false);

  const handleSave = async () => {
    if (!file || !name.trim()) return;
    if (!fields.some((f) => f.type === "signature") && !sigWarningShown) {
      setSigWarningShown(true);
      toast.error("לא הוצב שדה חתימה – הלקוח לא יוכל לחתום. לחץ שוב לשמור בכל זאת.");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name.trim());
      fd.append("signaturePage", String(signaturePage));
      fd.append("fields", JSON.stringify(fields));
      const r = await fetch("/api/contracts/templates", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || "שגיאה בשמירה"); return; }
      toast.success("תבנית נשמרה!");
      onSaved();
    } catch {
      toast.error("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  };

  const currentPageFields = fields.filter((f) => f.page === signaturePage);

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">תבנית חוזה חדשה</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">שם התבנית *</label>
            <input className="input" placeholder="לדוג׳: חוזה פנסיון, הסכם אילוף..." value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="label">קובץ PDF *</label>
            <input type="file" accept="application/pdf" onChange={handleFileChange} className="input" />
          </div>

          {file && (
            <div className="space-y-3">
              {/* Page navigation */}
              {totalPages > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-petra-muted">עמוד:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-petra-muted hover:bg-slate-100 disabled:opacity-40"
                      disabled={signaturePage <= 1}
                      onClick={() => setSignaturePage((p) => Math.max(1, p - 1))}
                    >‹</button>
                    <span className="text-sm font-medium text-petra-text min-w-[60px] text-center">
                      {signaturePage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-petra-muted hover:bg-slate-100 disabled:opacity-40"
                      disabled={signaturePage >= totalPages}
                      onClick={() => setSignaturePage((p) => Math.min(totalPages, p + 1))}
                    >›</button>
                  </div>
                </div>
              )}

              {/* Field type toolbar */}
              <div>
                <p className="text-xs text-petra-muted mb-2">בחר סוג שדה ולחץ על המסמך למיקומו:</p>
                <div className="flex flex-wrap gap-2">
                  {FIELD_TYPES.map((ft) => (
                    <button
                      key={ft.type}
                      type="button"
                      onClick={() => setSelectedType(ft.type)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                        selectedType === ft.type
                          ? "ring-2 ring-orange-500 border-transparent"
                          : "border-slate-200 hover:border-slate-300"
                      )}
                      style={selectedType === ft.type ? { background: ft.bgColor, color: ft.color } : {}}
                    >
                      {ft.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* PDF viewer (native browser rendering) with field overlays */}
              <div>
                <div
                  ref={containerRef}
                  className="relative border border-slate-200 rounded-xl overflow-hidden bg-white"
                  style={{ aspectRatio: `${pageDims.width} / ${pageDims.height}`, minHeight: 300 }}
                >
                  {(pdfLoading || !pageBlobUrl) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                      <PetraLoader variant="inline" />
                    </div>
                  )}
                  {pageBlobUrl && !pdfLoading && (
                    <object
                      key={pageBlobUrl}
                      data={`${pageBlobUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                      type="application/pdf"
                      className="absolute inset-0 w-full h-full"
                    >
                      <p className="text-center text-sm text-petra-muted p-4">לא ניתן להציג את המסמך</p>
                    </object>
                  )}
                  {pageBlobUrl && !pdfLoading && (
                  <div
                    ref={overlayRef}
                    className="absolute inset-0 cursor-crosshair"
                    style={{ zIndex: 10 }}
                    onClick={handleOverlayClick}
                  >
                    {currentPageFields.map((f) => (
                      <ContractFieldOverlay
                        key={f.id}
                        field={f}
                        overlayRef={overlayRef}
                        onUpdate={updateField}
                        onRemove={removeField}
                      />
                    ))}
                  </div>
                  )}
                </div>
                <FieldsSummary fields={fields} onClear={() => setFields([])} />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-5 mt-2 border-t border-slate-100">
          <button
            className="btn-primary flex-1"
            disabled={!file || !name.trim() || saving}
            onClick={handleSave}
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />שומר...</> : <><Save className="w-4 h-4" />שמור תבנית</>}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Contract Template Modal ────────────────────────────────────────────

function EditContractTemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: ContractTemplate;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [signaturePage, setSignaturePage] = useState(template.signaturePage);
  const [totalPages, setTotalPages] = useState(0);
  const [fields, setFields] = useState<ContractField[]>(() => {
    try { return JSON.parse(template.fields || "[]"); } catch { return []; }
  });
  const [selectedType, setSelectedType] = useState<ContractField["type"]>("signature");
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState(false);
  const [pageBlobUrl, setPageBlobUrl] = useState<string | null>(null);
  const [pageDims, setPageDims] = useState({ width: 595, height: 842 });
  const [pdfReady, setPdfReady] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfBytesRef = useRef<Uint8Array | null>(null);

  // Extract a single page as a blob URL using pdf-lib
  const extractPageBlob = useCallback(async (bytes: Uint8Array, pageNum: number) => {
    const { PDFDocument } = await import("pdf-lib");
    const src = await PDFDocument.load(bytes.slice(), { ignoreEncryption: true });
    const dest = await PDFDocument.create();
    const [page] = await dest.copyPages(src, [Math.min(pageNum - 1, src.getPageCount() - 1)]);
    dest.addPage(page);
    const singleBytes = await dest.save();
    return new Blob([new Uint8Array(singleBytes) as BlobPart], { type: "application/pdf" });
  }, []);

  // Load PDF from existing URL
  useEffect(() => {
    setPdfLoading(true);
    setPdfError(false);
    setPdfReady(false);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        // Proxy through our API to avoid CORS issues with Vercel Blob
        const resp = await fetch(`/api/contracts/templates/${template.id}/pdf`);
        if (!resp.ok) throw new Error(`PDF fetch failed: ${resp.status}`);
        const ab = await resp.arrayBuffer();
        if (cancelled) return;
        const bytes = new Uint8Array(ab);
        pdfBytesRef.current = bytes;

        // Use pdfjs just for metadata
        const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
        GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await getDocument({ data: bytes.slice() }).promise;
        if (cancelled) { doc.destroy(); return; }
        setTotalPages(doc.numPages);
        const page = await doc.getPage(1);
        const vp = page.getViewport({ scale: 1 });
        setPageDims({ width: vp.width, height: vp.height });
        doc.destroy();

        // Extract current page for native rendering
        const blob = await extractPageBlob(bytes, signaturePage);
        if (cancelled) return;
        setPageBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
        setPdfReady(true);
      } catch (e) {
        console.error("PDF load error", e);
        if (!cancelled) setPdfError(true);
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    }, 100);
    return () => { cancelled = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.fileUrl]);

  // Extract page on navigation
  useEffect(() => {
    const bytes = pdfBytesRef.current;
    if (!bytes || !pdfReady || signaturePage < 1) return;
    setPageBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    let cancelled = false;
    (async () => {
      try {
        const blob = await extractPageBlob(bytes, signaturePage);
        if (cancelled) return;
        setPageBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
      } catch (e) {
        console.error("Page extraction error", e);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signaturePage]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => { setPageBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; }); };
  }, []);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const def = FIELD_DEFAULTS[selectedType];
    const newField: ContractField = {
      id: crypto.randomUUID(),
      type: selectedType,
      page: signaturePage,
      x: Math.max(0, Math.min(x - def.width / 2, 1 - def.width)),
      y: Math.max(0, Math.min(y - def.height / 2, 1 - def.height)),
      width: def.width,
      height: def.height,
    };
    setFields((prev) => [...prev, newField]);
  };

  const removeField = (id: string) => setFields((prev) => prev.filter((f) => f.id !== id));
  const updateField = (id: string, updates: Partial<ContractField>) =>
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));

  const [sigWarningShown, setSigWarningShown] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    if (!fields.some((f) => f.type === "signature") && !sigWarningShown) {
      setSigWarningShown(true);
      toast.error("לא הוצב שדה חתימה – הלקוח לא יוכל לחתום. לחץ שוב לשמור בכל זאת.");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`/api/contracts/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), fields: JSON.stringify(fields) }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error || "שגיאה בשמירה"); return; }
      toast.success("תבנית עודכנה!");
      onSaved();
    } catch {
      toast.error("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  };

  const currentPageFields = fields.filter((f) => f.page === signaturePage);

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">עריכת תבנית: {template.name}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">שם התבנית</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-3">
            {/* Page navigation */}
            {totalPages > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-petra-muted">עמוד:</span>
                <div className="flex items-center gap-2">
                  <button type="button" className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-petra-muted hover:bg-slate-100 disabled:opacity-40" disabled={signaturePage <= 1} onClick={() => setSignaturePage((p) => Math.max(1, p - 1))}>‹</button>
                  <span className="text-sm font-medium text-petra-text min-w-[60px] text-center">{signaturePage} / {totalPages}</span>
                  <button type="button" className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-petra-muted hover:bg-slate-100 disabled:opacity-40" disabled={signaturePage >= totalPages} onClick={() => setSignaturePage((p) => Math.min(totalPages, p + 1))}>›</button>
                </div>
              </div>
            )}

            {/* Field type toolbar */}
            <div>
              <p className="text-xs text-petra-muted mb-2">בחר סוג שדה ולחץ על המסמך למיקומו:</p>
              <div className="flex flex-wrap gap-2">
                {FIELD_TYPES.map((ft) => (
                  <button key={ft.type} type="button" onClick={() => setSelectedType(ft.type)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all", selectedType === ft.type ? "ring-2 ring-orange-500 border-transparent" : "border-slate-200 hover:border-slate-300")}
                    style={selectedType === ft.type ? { background: ft.bgColor, color: ft.color } : {}}>
                    {ft.label}
                  </button>
                ))}
              </div>
            </div>

            {/* PDF viewer (native browser rendering) + overlays */}
            <div>
              <div ref={containerRef} className="relative border border-slate-200 rounded-xl overflow-hidden bg-white" style={{ aspectRatio: `${pageDims.width} / ${pageDims.height}`, minHeight: 300 }}>
                {(pdfLoading || (!pageBlobUrl && !pdfError)) && <div className="absolute inset-0 flex items-center justify-center bg-slate-50"><PetraLoader variant="inline" /></div>}
                {pdfError && !pdfLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-red-500">
                    <FileText className="w-8 h-8" />
                    <p className="text-sm">שגיאה בטעינת המסמך</p>
                    <button type="button" className="text-xs underline" onClick={() => { setPdfLoading(true); setPdfError(false); setTimeout(async () => { try { const resp = await fetch(`/api/contracts/templates/${template.id}/pdf`); if (!resp.ok) throw new Error("fetch failed"); const ab = await resp.arrayBuffer(); const bytes = new Uint8Array(ab); pdfBytesRef.current = bytes; const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist"); GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"; const doc = await getDocument({ data: bytes.slice() }).promise; setTotalPages(doc.numPages); const pg = await doc.getPage(1); const vp = pg.getViewport({ scale: 1 }); setPageDims({ width: vp.width, height: vp.height }); doc.destroy(); const blob = await extractPageBlob(bytes, signaturePage); setPageBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); }); setPdfReady(true); setPdfError(false); } catch { setPdfError(true); } finally { setPdfLoading(false); } }, 100); }}>נסה שוב</button>
                  </div>
                )}
                {pageBlobUrl && !pdfLoading && !pdfError && (
                  <object
                    key={pageBlobUrl}
                    data={`${pageBlobUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    type="application/pdf"
                    className="absolute inset-0 w-full h-full"
                  >
                    <p className="text-center text-sm text-petra-muted p-4">לא ניתן להציג את המסמך</p>
                  </object>
                )}
                {pageBlobUrl && !pdfLoading && !pdfError && (
                  <div ref={overlayRef} className="absolute inset-0 cursor-crosshair" style={{ zIndex: 10 }} onClick={handleOverlayClick}>
                    {currentPageFields.map((f) => (
                      <ContractFieldOverlay
                        key={f.id}
                        field={f}
                        overlayRef={overlayRef}
                        onUpdate={updateField}
                        onRemove={removeField}
                      />
                    ))}
                  </div>
                )}
              </div>
              <FieldsSummary fields={fields} onClear={() => setFields([])} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-5 mt-2 border-t border-slate-100">
          <button className="btn-primary flex-1" disabled={!name.trim() || saving} onClick={handleSave}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />שומר...</> : <><Save className="w-4 h-4" />שמור שינויים</>}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}
