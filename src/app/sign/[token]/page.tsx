"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, RotateCcw, PenLine } from "lucide-react";

interface ContractField {
  id: string;
  type: "customer_name" | "id_number" | "address" | "phone" | "signature";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ContractData {
  customerName: string;
  businessName: string;
  templateName: string;
  pdfUrl: string;
  signaturePage: number;
  signatureX: number;
  signatureY: number;
  signatureWidth: number;
  signatureHeight: number;
  status: string;
  fields: ContractField[];
  customerData: Record<string, string>;
}

const FIELD_COLORS: Record<string, string> = {
  customer_name: "#2563eb",
  id_number: "#7c3aed",
  address: "#16a34a",
  phone: "#0891b2",
  signature: "#ea580c",
};
const FIELD_BG: Record<string, string> = {
  customer_name: "rgba(37,99,235,0.08)",
  id_number: "rgba(124,58,237,0.08)",
  address: "rgba(22,163,74,0.08)",
  phone: "rgba(8,145,178,0.08)",
  signature: "rgba(234,88,12,0.08)",
};

export default function SignContractPage() {
  const { token } = useParams<{ token: string }>();
  const [contract, setContract] = useState<ContractData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // PDF viewer state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  // Signature pad
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signatureSectionRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/sign/${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setLoadError(data.error || "שגיאה בטעינת החוזה");
        } else {
          setContract(data);
        }
      })
      .catch(() => setLoadError("שגיאת רשת"))
      .finally(() => setLoading(false));
  }, [token]);

  // Load PDF with PDF.js once we have the URL
  const renderPdfPage = useCallback(async (doc: NonNullable<typeof pdfDocRef.current>, pageNum: number) => {
    if (!pdfCanvasRef.current) return;
    if (renderTaskRef.current) { renderTaskRef.current.cancel(); renderTaskRef.current = null; }
    const page = await doc.getPage(pageNum);
    const dpr = window.devicePixelRatio || 1;
    const containerWidth = Math.max(300, pdfCanvasRef.current.parentElement?.clientWidth ?? 600);
    const unscaled = page.getViewport({ scale: 1 });
    // Render at higher resolution for crisp text on retina/mobile screens
    const scale = (containerWidth / unscaled.width) * dpr;
    const viewport = page.getViewport({ scale });
    pdfCanvasRef.current.width = viewport.width;
    pdfCanvasRef.current.height = viewport.height;
    // CSS keeps it at the container width
    pdfCanvasRef.current.style.width = `${containerWidth}px`;
    pdfCanvasRef.current.style.height = `${Math.round(viewport.height / dpr)}px`;
    const ctx = pdfCanvasRef.current.getContext("2d");
    if (!ctx) return;
    const task = page.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    try { await task.promise; } catch { /* cancelled */ }
  }, []);

  useEffect(() => {
    if (!contract?.pdfUrl) return;
    setPdfLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
        GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const resp = await fetch(contract.pdfUrl);
        const ab = await resp.arrayBuffer();
        const doc = await getDocument({ data: ab }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        await renderPdfPage(doc, 1);
      } catch (e) {
        console.error("PDF load error", e);
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [contract?.pdfUrl, renderPdfPage]);

  useEffect(() => {
    if (!pdfDocRef.current) return;
    renderPdfPage(pdfDocRef.current, currentPage);
  }, [currentPage, renderPdfPage]);

  // Signature pad drawing
  const getPos = (canvas: HTMLCanvasElement, e: MouseEvent | Touch) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = "clientX" in e ? e.clientX : (e as Touch).clientX;
    const clientY = "clientY" in e ? e.clientY : (e as Touch).clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return;
    e.preventDefault();
    isDrawing.current = true;
    const touch = "touches" in e ? e.touches[0] : (e as React.MouseEvent).nativeEvent;
    lastPos.current = getPos(canvasRef.current, touch as MouseEvent | Touch);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !canvasRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const touch = "touches" in e ? e.touches[0] : (e as React.MouseEvent).nativeEvent;
    const pos = getPos(canvas, touch as MouseEvent | Touch);
    if (lastPos.current) {
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      setHasSignature(true);
    }
    lastPos.current = pos;
  }, []);

  const stopDraw = useCallback(() => {
    isDrawing.current = false;
    lastPos.current = null;
  }, []);

  const clearCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasSignature(false);
  }, []);

  const handleSubmit = async () => {
    if (!canvasRef.current || !hasSignature) return;
    const signatureBase64 = canvasRef.current.toDataURL("image/png");
    setSubmitting(true);
    try {
      const r = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureBase64 }),
      });
      if (r.ok) {
        setSigned(true);
      } else {
        const d = await r.json();
        alert(d.error || "שגיאה בשליחת החתימה. נסה שוב.");
      }
    } catch {
      alert("שגיאת רשת. נסה שוב.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" />
          <p className="text-slate-600 text-sm">טוען חוזה...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="card p-8 max-w-sm w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-petra-text">לא ניתן לטעון את החוזה</h2>
          <p className="text-sm text-petra-muted">{loadError}</p>
        </div>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-6" dir="rtl">
        <div className="text-center space-y-4 max-w-sm w-full">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-petra-text">החוזה נחתם!</h2>
          <p className="text-sm text-petra-muted leading-relaxed">
            תודה, {contract?.customerName}. החתימה שלך התקבלה אצל {contract?.businessName}.
          </p>
          <p className="text-xs text-petra-muted/70">ניתן לסגור את הדף</p>
        </div>
      </div>
    );
  }

  if (!contract) return null;

  const currentPageFields = (contract.fields ?? []).filter((f) => f.page === currentPage);
  const hasFields = contract.fields && contract.fields.length > 0;

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-petra-text leading-tight truncate">{contract.templateName}</h1>
            <p className="text-xs text-petra-muted mt-0.5">{contract.businessName} · {contract.customerName}</p>
          </div>
          {!pdfLoading && totalPages > 0 && (
            <button
              type="button"
              onClick={() => signatureSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              <PenLine className="w-3.5 h-3.5" />
              חתום ↓
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-0 sm:px-4 pb-8 space-y-0 sm:space-y-4 sm:pt-4">
        {/* PDF viewer — no horizontal padding on mobile (full width) */}
        <div className="bg-white sm:rounded-2xl sm:border sm:border-slate-200 overflow-hidden shadow-sm">
          {/* Page navigation bar */}
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs text-petra-muted">
              {pdfLoading ? "טוען מסמך..." : totalPages > 0 ? `קרא את המסמך לפני החתימה` : ""}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-petra-muted hover:bg-slate-100 disabled:opacity-40"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >‹</button>
                <span className="text-xs font-medium text-petra-text min-w-[50px] text-center">{currentPage} / {totalPages}</span>
                <button
                  type="button"
                  className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-petra-muted hover:bg-slate-100 disabled:opacity-40"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >›</button>
              </div>
            )}
          </div>

          {/* Canvas + field overlays */}
          <div className="relative bg-white" style={{ minHeight: 300 }}>
            {pdfLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-white" style={{ minHeight: 300 }}>
                <div className="text-center space-y-2">
                  <Loader2 className="w-7 h-7 animate-spin text-orange-400 mx-auto" />
                  <p className="text-xs text-petra-muted">טוען מסמך...</p>
                </div>
              </div>
            )}
            <canvas
              ref={pdfCanvasRef}
              className="block"
              style={{ display: pdfLoading ? "none" : "block", maxWidth: "100%" }}
            />
            {/* Field overlays */}
            {!pdfLoading && currentPageFields.map((f) => {
              const isSignature = f.type === "signature";
              return (
                <div
                  key={f.id}
                  style={{
                    position: "absolute",
                    left: `${f.x * 100}%`,
                    top: `${f.y * 100}%`,
                    width: `${f.width * 100}%`,
                    height: `${f.height * 100}%`,
                    background: isSignature ? "rgba(234,88,12,0.06)" : (FIELD_BG[f.type] ?? "rgba(0,0,0,0.05)"),
                    border: `${isSignature ? "2px" : "1px"} dashed ${FIELD_COLORS[f.type] ?? "#94a3b8"}`,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: isSignature ? "center" : "flex-start",
                    overflow: "hidden",
                    pointerEvents: "none",
                  }}
                >
                  {isSignature ? (
                    <span style={{ fontSize: 12, color: "#ea580c", fontWeight: 600, direction: "rtl" }}>
                      ✍️ כאן תופיע חתימתך
                    </span>
                  ) : (
                    <span style={{
                      fontSize: 11,
                      direction: "rtl",
                      padding: "0 4px",
                      color: FIELD_COLORS[f.type] ?? "#334155",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontWeight: 500,
                    }}>
                      {contract.customerData?.[f.type] ?? ""}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Next page hint if there are more pages */}
          {totalPages > 1 && currentPage < totalPages && (
            <button
              type="button"
              className="w-full py-3 text-sm text-petra-muted hover:text-petra-text hover:bg-slate-50 border-t border-slate-100 transition-colors flex items-center justify-center gap-2"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              עמוד הבא ›
            </button>
          )}

          {hasFields && (
            <div className="px-4 py-2.5 bg-blue-50 border-t border-blue-100 text-xs text-blue-600 text-center">
              הנתונים שלך ימולאו אוטומטית בחוזה הסופי
            </div>
          )}
        </div>

        {/* Signature pad */}
        <div ref={signatureSectionRef} className="bg-white sm:rounded-2xl sm:border sm:border-slate-200 px-4 pt-5 pb-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-petra-text flex items-center gap-2">
              <PenLine className="w-4 h-4 text-orange-500" />
              חתום כאן
            </h2>
            <button
              onClick={clearCanvas}
              className="flex items-center gap-1.5 text-xs text-petra-muted hover:text-petra-text px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              נקה
            </button>
          </div>

          <div className="relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden touch-none" style={{ minHeight: 160 }}>
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className="w-full cursor-crosshair block"
              style={{ touchAction: "none" }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            {!hasSignature && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-slate-300 text-base">חתום כאן...</p>
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!hasSignature || submitting}
            className="w-full py-4 px-6 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-base rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> שולח...</>
            ) : (
              <><CheckCircle2 className="w-5 h-5" /> חתום ואשר</>
            )}
          </button>

          <p className="text-[11px] text-petra-muted text-center leading-relaxed">
            בלחיצה על &quot;חתום ואשר&quot; אתה מאשר את קריאת המסמך ומסכים לתנאיו.
            החתימה תישמר כראיה משפטית.
          </p>
        </div>
      </div>
    </div>
  );
}
