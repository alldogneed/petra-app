"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, RotateCcw, PenLine, ChevronDown, User, Phone, MapPin, CreditCard, FileText } from "lucide-react";

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

const FIELD_LABELS: Record<string, string> = {
  customer_name: "שם מלא",
  id_number: "תעודת זהות",
  address: "כתובת",
  phone: "טלפון",
};

const FIELD_ICONS: Record<string, React.ReactNode> = {
  customer_name: <User className="w-3.5 h-3.5" />,
  id_number: <CreditCard className="w-3.5 h-3.5" />,
  address: <MapPin className="w-3.5 h-3.5" />,
  phone: <Phone className="w-3.5 h-3.5" />,
};

export default function SignContractPage() {
  const { token } = useParams<{ token: string }>();
  const [contract, setContract] = useState<ContractData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [readConfirmed, setReadConfirmed] = useState(false);

  // PDF viewer state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
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
        if (!r.ok) setLoadError(data.error || "שגיאה בטעינת החוזה");
        else setContract(data);
      })
      .catch(() => setLoadError("שגיאת רשת"))
      .finally(() => setLoading(false));
  }, [token]);

  const renderPdfPage = useCallback(async (doc: NonNullable<typeof pdfDocRef.current>, pageNum: number) => {
    if (!pdfCanvasRef.current) return;
    if (renderTaskRef.current) { renderTaskRef.current.cancel(); renderTaskRef.current = null; }
    const page = await doc.getPage(pageNum);
    const dpr = window.devicePixelRatio || 1;
    const containerWidth = Math.max(300, pdfCanvasRef.current.parentElement?.clientWidth ?? 600);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = (containerWidth / unscaled.width) * dpr;
    const viewport = page.getViewport({ scale });
    pdfCanvasRef.current.width = viewport.width;
    pdfCanvasRef.current.height = viewport.height;
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
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        // Fetch PDF through our own API proxy to avoid CSP/CORS issues
        const resp = await fetch(`/api/sign/${token}/pdf`);
        if (!resp.ok) throw new Error(`PDF fetch failed: ${resp.status}`);
        const ab = await resp.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        await renderPdfPage(doc, 1);
      } catch (e) {
        console.error("PDF load error", e);
        if (!cancelled) setPdfError(e instanceof Error ? e.message : "שגיאה בטעינת המסמך");
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

  // Signature pad
  const getPos = (canvas: HTMLCanvasElement, e: MouseEvent | Touch) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (("clientX" in e ? e.clientX : (e as Touch).clientX) - rect.left) * (canvas.width / rect.width),
      y: (("clientY" in e ? e.clientY : (e as Touch).clientY) - rect.top) * (canvas.height / rect.height),
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

  const stopDraw = useCallback(() => { isDrawing.current = false; lastPos.current = null; }, []);

  const clearCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasSignature(false);
  }, []);

  const handleSubmit = async () => {
    if (!canvasRef.current || !hasSignature) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureBase64: canvasRef.current.toDataURL("image/png") }),
      });
      if (r.ok) setSigned(true);
      else { const d = await r.json(); alert(d.error || "שגיאה. נסה שוב."); }
    } catch { alert("שגיאת רשת. נסה שוב."); }
    finally { setSubmitting(false); }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-sm">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">לא ניתן לטעון את החוזה</h2>
          <p className="text-sm text-slate-500">{loadError}</p>
        </div>
      </div>
    );
  }

  // ── Signed ───────────────────────────────────────────────────────────────────
  if (signed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-6" dir="rtl">
        <div className="text-center space-y-4 max-w-sm w-full">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">החוזה נחתם!</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            תודה, {contract?.customerName}.<br />
            החתימה שלך התקבלה אצל {contract?.businessName}.
          </p>
          <p className="text-xs text-slate-400">ניתן לסגור את הדף</p>
        </div>
      </div>
    );
  }

  if (!contract) return null;

  // Derive data fields (non-signature) that have values
  const dataFields = (contract.fields ?? []).filter(
    (f) => f.type !== "signature" && contract.customerData?.[f.type]
  );
  // Unique field types shown in summary
  const summaryFields = Array.from(new Set(dataFields.map((f) => f.type))).map((type) => ({
    type,
    value: contract.customerData?.[type] ?? "",
  }));
  const hasSignatureField = (contract.fields ?? []).some((f) => f.type === "signature");
  const currentPageFields = (contract.fields ?? []).filter((f) => f.page === currentPage);
  const isLastPage = currentPage >= totalPages;

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">

      {/* ── Sticky top bar ───────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2.5">
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-orange-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate leading-tight">{contract.templateName}</p>
              <p className="text-xs text-slate-500">{contract.businessName}</p>
            </div>
          </div>
          {!pdfLoading && totalPages > 0 && (
            <button
              type="button"
              onClick={() => signatureSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              <PenLine className="w-3.5 h-3.5" />
              חתום
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-0 sm:space-y-4 sm:px-4 sm:pt-4 pb-10">

        {/* ── Step 1: Who you are / what details go into the contract ─────────── */}
        {summaryFields.length > 0 && (
          <div className="bg-white sm:rounded-2xl sm:border sm:border-slate-200 px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">הפרטים שיופיעו בחוזה</p>
            <div className="grid grid-cols-2 gap-2">
              {summaryFields.map(({ type, value }) => (
                <div key={type} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                  <span className="text-slate-400">{FIELD_ICONS[type]}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 leading-none mb-0.5">{FIELD_LABELS[type]}</p>
                    <p className="text-sm font-medium text-slate-700 truncate">{value}</p>
                  </div>
                </div>
              ))}
            </div>
            {summaryFields.some((f) => !f.value) && (
              <p className="text-xs text-amber-600 mt-2">⚠️ חלק מהפרטים חסרים — בקש מהעסק לעדכן</p>
            )}
          </div>
        )}

        {/* ── Step 2: Read the document ────────────────────────────────────────── */}
        <div className="bg-white sm:rounded-2xl sm:border sm:border-slate-200 overflow-hidden shadow-sm">
          {/* Section header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[11px] font-bold flex items-center justify-center">1</span>
              <span className="text-sm font-semibold text-slate-700">קרא את החוזה</span>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button type="button" className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-40 text-sm bg-white" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>‹</button>
                <span className="text-xs font-medium text-slate-600 min-w-[50px] text-center">{currentPage} / {totalPages}</span>
                <button type="button" className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-40 text-sm bg-white" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>›</button>
              </div>
            )}
          </div>

          {/* PDF canvas */}
          <div className="relative bg-white" style={{ minHeight: 300 }}>
            {pdfLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white" style={{ minHeight: 300 }}>
                <div className="text-center space-y-2">
                  <Loader2 className="w-7 h-7 animate-spin text-orange-400 mx-auto" />
                  <p className="text-xs text-slate-400">טוען מסמך...</p>
                </div>
              </div>
            )}
            {pdfError && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-50" style={{ minHeight: 300 }}>
                <div className="text-center space-y-2 px-6">
                  <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
                  <p className="text-sm text-red-600">שגיאה בטעינת המסמך</p>
                  <p className="text-xs text-red-400 break-all" dir="ltr">{pdfError}</p>
                  <button onClick={() => { setPdfError(null); setPdfLoading(true); }} className="text-xs text-orange-600 underline mt-2">נסה שוב</button>
                </div>
              </div>
            )}
            <canvas ref={pdfCanvasRef} className="block" style={{ display: (pdfLoading || pdfError) ? "none" : "block", maxWidth: "100%" }} />

            {/* Field overlays */}
            {!pdfLoading && currentPageFields.map((f) => {
              const isSignature = f.type === "signature";
              return (
                <div key={f.id} style={{
                  position: "absolute",
                  left: `${f.x * 100}%`, top: `${f.y * 100}%`,
                  width: `${f.width * 100}%`, height: `${f.height * 100}%`,
                  background: isSignature ? "rgba(234,88,12,0.06)" : (FIELD_BG[f.type] ?? "rgba(0,0,0,0.05)"),
                  border: `${isSignature ? "2px" : "1px"} dashed ${FIELD_COLORS[f.type] ?? "#94a3b8"}`,
                  borderRadius: 4,
                  display: "flex", alignItems: "center",
                  justifyContent: isSignature ? "center" : "flex-start",
                  overflow: "hidden", pointerEvents: "none",
                }}>
                  {isSignature ? (
                    <span style={{ fontSize: 11, color: "#ea580c", fontWeight: 600, direction: "rtl" }}>✍️ כאן תופיע חתימתך</span>
                  ) : (
                    <span style={{ fontSize: 11, direction: "rtl", padding: "0 4px", color: FIELD_COLORS[f.type] ?? "#334155", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 500 }}>
                      {contract.customerData?.[f.type] ?? ""}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Next page / confirm read */}
          {!pdfLoading && totalPages > 0 && (
            isLastPage ? (
              <button
                type="button"
                onClick={() => {
                  setReadConfirmed(true);
                  signatureSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="w-full py-3.5 text-sm font-semibold border-t border-slate-100 flex items-center justify-center gap-2 transition-colors bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
              >
                <CheckCircle2 className="w-4 h-4" />
                קראתי את החוזה — המשך לחתימה
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="w-full py-3 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-t border-slate-100 transition-colors flex items-center justify-center gap-2"
              >
                עמוד הבא <ChevronDown className="w-4 h-4" />
              </button>
            )
          )}
        </div>

        {/* ── Step 3: Signature ────────────────────────────────────────────────── */}
        <div ref={signatureSectionRef} className="bg-white sm:rounded-2xl sm:border sm:border-slate-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[11px] font-bold flex items-center justify-center">2</span>
            <span className="text-sm font-semibold text-slate-700">חתום כאן</span>
            {hasSignature && <span className="mr-auto text-xs text-emerald-600 font-medium">✓ חתימה נרשמה</span>}
          </div>

          <div className="px-4 py-4 space-y-3">
            <div className="relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden touch-none">
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
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1">
                  <PenLine className="w-6 h-6 text-slate-300" />
                  <p className="text-slate-300 text-sm">חתום בתיבה זו</p>
                </div>
              )}
            </div>

            {hasSignature && (
              <button
                onClick={clearCanvas}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                נקה וחתום שוב
              </button>
            )}
          </div>

          {/* Confirmation checkbox */}
          <div className="px-4 pb-4">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={readConfirmed}
                onChange={(e) => setReadConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-orange-500 accent-orange-500"
              />
              <span className="text-xs text-slate-500 leading-relaxed group-hover:text-slate-700 transition-colors">
                קראתי את <strong className="text-slate-700">{contract.templateName}</strong> של {contract.businessName}, הבנתי את תנאיו ואני מסכים לחתום עליו.
              </span>
            </label>
          </div>

          <div className="px-4 pb-5">
            <button
              onClick={handleSubmit}
              disabled={!hasSignature || !readConfirmed || submitting}
              className="w-full py-4 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-base rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> שולח...</>
              ) : !readConfirmed ? (
                "אשר קריאת החוזה כדי לחתום"
              ) : !hasSignature ? (
                "חתום בתיבה למעלה כדי להמשיך"
              ) : (
                <><CheckCircle2 className="w-5 h-5" /> שלח חתימה ואשר</>
              )}
            </button>

            {hasSignature && readConfirmed && (
              <p className="text-[11px] text-slate-400 text-center mt-2.5 leading-relaxed">
                לחיצה תשלח את חתימתך. החוזה החתום יישמר ויישלח ל{contract.businessName}.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
