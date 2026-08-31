"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, RotateCcw, PenLine, ChevronLeft, ChevronRight, User, Phone, MapPin, CreditCard, FileText, Download, Clock, Dog, PawPrint, Cpu, Calendar, Heart, Palette } from "lucide-react";

interface ContractField {
  id: string;
  type: "customer_name" | "id_number" | "address" | "phone" | "signature"
    | "pet_name" | "pet_breed" | "pet_microchip" | "pet_birthdate" | "pet_gender" | "pet_color";
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
  status: string;
  fields: ContractField[];
  customerData: Record<string, string>;
}

const FIELD_LABELS: Record<string, string> = {
  customer_name: "שם מלא",
  id_number: "תעודת זהות",
  address: "כתובת",
  phone: "טלפון",
  pet_name: "שם הכלב",
  pet_breed: "גזע",
  pet_microchip: "שבב",
  pet_birthdate: "תאריך לידה",
  pet_gender: "מין",
  pet_color: "צבע",
};

const FIELD_ICONS: Record<string, React.ReactNode> = {
  customer_name: <User className="w-3.5 h-3.5" />,
  id_number: <CreditCard className="w-3.5 h-3.5" />,
  address: <MapPin className="w-3.5 h-3.5" />,
  phone: <Phone className="w-3.5 h-3.5" />,
  pet_name: <Dog className="w-3.5 h-3.5" />,
  pet_breed: <PawPrint className="w-3.5 h-3.5" />,
  pet_microchip: <Cpu className="w-3.5 h-3.5" />,
  pet_birthdate: <Calendar className="w-3.5 h-3.5" />,
  pet_gender: <Heart className="w-3.5 h-3.5" />,
  pet_color: <Palette className="w-3.5 h-3.5" />,
};

/**
 * Crop the signature canvas export to the drawn ink bounding box (+ padding).
 * The server stretches the PNG into each field's w×h — cropping away the empty
 * canvas margins minimizes aspect-ratio distortion regardless of field shape.
 */
function exportSignaturePng(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Alpha channel > 0 = ink (canvas starts fully transparent)
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  // Empty canvas (shouldn't happen — submit is gated on hasSignature) — export as-is
  if (maxX < 0) return canvas.toDataURL("image/png");
  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const outCtx = out.getContext("2d");
  if (!outCtx) return canvas.toDataURL("image/png");
  outCtx.drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
  return out.toDataURL("image/png");
}

export default function SignContractPage() {
  const { token } = useParams<{ token: string }>();
  const [contract, setContract] = useState<ContractData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Distinct terminal states from the API: SIGNED (409) / EXPIRED (410)
  const [linkState, setLinkState] = useState<"SIGNED" | "EXPIRED" | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signedFileUrl, setSignedFileUrl] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [readConfirmed, setReadConfirmed] = useState(false);

  // PDF canvas state (single pdfjs code path — desktop + mobile)
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);
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
        const data = await r.json().catch(() => ({}));
        if (r.ok) {
          setContract(data);
        } else if (r.status === 409 || data.status === "SIGNED") {
          setLinkState("SIGNED");
        } else if (r.status === 410 || data.status === "EXPIRED") {
          setLinkState("EXPIRED");
        } else {
          setLoadError(data.error || "שגיאה בטעינת החוזה");
        }
      })
      .catch(() => setLoadError("שגיאת רשת"))
      .finally(() => setLoading(false));
  }, [token]);

  // ── PDF canvas renderer (shared desktop + mobile) ───────────────────────────
  const renderPdfPage = useCallback(async (doc: NonNullable<typeof pdfDocRef.current>, pageNum: number) => {
    if (!pdfCanvasRef.current) return;
    if (renderTaskRef.current) { renderTaskRef.current.cancel(); renderTaskRef.current = null; }
    const page = await doc.getPage(pageNum);
    const dpr = Math.max(2, window.devicePixelRatio || 2);
    const containerWidth = Math.max(300, pdfCanvasRef.current.parentElement?.clientWidth ?? 400);
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

  // Load PDF into the canvas renderer (all viewports)
  useEffect(() => {
    if (!contract || !token) return;
    setPdfLoading(true);
    setPdfError(false);
    let cancelled = false;
    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const resp = await fetch(`/api/sign/${token}/pdf`);
        if (!resp.ok) throw new Error(`PDF fetch failed: ${resp.status}`);
        const ab = await resp.arrayBuffer();
        const doc = await pdfjsLib.getDocument({
          data: new Uint8Array(ab),
          cMapUrl: "/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/standard_fonts/",
        }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        await renderPdfPage(doc, 1);
      } catch (e) {
        console.error("PDF load error", e);
        if (!cancelled) setPdfError(true);
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [contract, token, renderPdfPage]);

  // Re-render on page change
  useEffect(() => {
    if (!pdfDocRef.current) return;
    renderPdfPage(pdfDocRef.current, currentPage);
  }, [currentPage, renderPdfPage]);

  // ── Signature pad handlers ──────────────────────────────────────────────────
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
        body: JSON.stringify({ signatureBase64: exportSignaturePng(canvasRef.current) }),
      });
      if (r.ok) { const d = await r.json(); setSigned(true); setSignedFileUrl(d.signedFileUrl ?? null); }
      else if (r.status === 409) { setLinkState("SIGNED"); }
      else if (r.status === 410) { setLinkState("EXPIRED"); }
      else { const d = await r.json().catch(() => ({})); alert(d.error || "שגיאה. נסה שוב."); }
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

  // ── Already signed (409) ─────────────────────────────────────────────────────
  if (linkState === "SIGNED") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-sm border border-emerald-100">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">החוזה כבר נחתם ✅</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            החתימה כבר התקבלה ונשמרה בהצלחה.<br />
            אין צורך לחתום שוב.
          </p>
          <p className="text-xs text-slate-400">אפשר לסגור את העמוד</p>
        </div>
      </div>
    );
  }

  // ── Link expired (410) ───────────────────────────────────────────────────────
  if (linkState === "EXPIRED") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-sm border border-amber-100">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">תוקף הקישור פג ⏳</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            הקישור לחתימה כבר אינו בתוקף.<br />
            פנה לעסק ובקש שישלחו לך קישור חדש לחתימה.
          </p>
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-orange-50 via-white to-white p-6" dir="rtl">
        <div className="space-y-6 max-w-sm w-full">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <div className="space-y-2 text-right">
            <h2 className="text-2xl font-bold text-slate-800">החוזה נחתם בהצלחה!</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              תודה, {contract?.customerName}.<br />
              החתימה שלך התקבלה אצל <strong className="text-slate-700">{contract?.businessName}</strong>.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">{contract?.templateName}</span>
              <span className="text-xs text-slate-400">מסמך</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> נחתם
              </span>
              <span className="text-xs text-slate-400">סטטוס</span>
            </div>
          </div>
          {signedFileUrl && (
            <a
              href={signedFileUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-2xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              הורד עותק של החוזה החתום
            </a>
          )}
          <p className="text-xs text-slate-400 text-center">ניתן לסגור את הדף</p>
          <div className="pt-6 border-t border-slate-100 text-center">
            <div className="flex items-center justify-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Petra" className="w-7 h-7 rounded-lg" />
              <span className="text-sm font-bold text-slate-600">Petra</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">חתימה דיגיטלית מאובטחת</p>
          </div>
        </div>
      </div>
    );
  }

  if (!contract) return null;

  const dataFields = (contract.fields ?? []).filter(
    (f) => f.type !== "signature" && contract.customerData?.[f.type]
  );
  const summaryFields = Array.from(new Set(dataFields.map((f) => f.type))).map((type) => ({
    type,
    value: contract.customerData?.[type] ?? "",
  }));

  const pdfProxyUrl = `/api/sign/${token}/pdf`;
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
          <button
            type="button"
            onClick={() => signatureSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            <PenLine className="w-3.5 h-3.5" />
            חתום
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-0 sm:space-y-4 sm:px-4 sm:pt-4 pb-10">

        {/* ── Summary: customer details ──────────────────────────────────────── */}
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
          </div>
        )}

        {/* ── Step 1: Read the document ────────────────────────────────────── */}
        <div className="bg-white sm:rounded-2xl sm:border sm:border-slate-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[11px] font-bold flex items-center justify-center">1</span>
              <span className="text-sm font-semibold text-slate-700">קרא את החוזה</span>
            </div>
            {/* Page nav + open-in-new-window escape hatch */}
            <div className="flex items-center gap-2">
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button type="button" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 bg-white">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-medium text-slate-600 min-w-[44px] text-center" dir="ltr">{currentPage} / {totalPages}</span>
                  <button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 bg-white">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              )}
              <a
                href={pdfProxyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors ${totalPages > 1 ? "hidden sm:flex" : "flex"}`}
              >
                <Download className="w-3.5 h-3.5" />
                פתח PDF בחלון חדש
              </a>
            </div>
          </div>

          {/* ── pdfjs canvas viewer (single code path, all viewports) ───────── */}
          <div className="relative bg-white">
            {pdfLoading && (
              <div className="flex items-center justify-center bg-white" style={{ minHeight: 400 }}>
                <div className="text-center space-y-2">
                  <Loader2 className="w-7 h-7 animate-spin text-orange-400 mx-auto" />
                  <p className="text-xs text-slate-400">טוען מסמך...</p>
                </div>
              </div>
            )}
            {pdfError && !pdfLoading && (
              <div className="flex items-center justify-center bg-white" style={{ minHeight: 300 }}>
                <div className="text-center space-y-3 px-6">
                  <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-sm text-slate-500">לא ניתן להציג את המסמך כאן</p>
                  <a href={pdfProxyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700">
                    <Download className="w-4 h-4" />
                    פתח PDF בחלון חדש
                  </a>
                </div>
              </div>
            )}
            <canvas
              ref={pdfCanvasRef}
              className="block w-full"
              style={{ display: pdfLoading || pdfError ? "none" : "block" }}
            />
          </div>

          {/* Bottom bar: next page / confirm read */}
          {!pdfLoading && totalPages > 0 && !isLastPage ? (
            <button
              type="button"
              onClick={() => { setCurrentPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="w-full py-3.5 text-sm font-semibold border-t border-slate-100 flex items-center justify-center gap-2 transition-colors bg-slate-50 hover:bg-slate-100 text-slate-700"
            >
              עמוד הבא ({currentPage + 1} מתוך {totalPages})
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setReadConfirmed(true);
                signatureSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`w-full py-3.5 text-sm font-semibold border-t border-slate-100 flex items-center justify-center gap-2 transition-colors ${
                readConfirmed
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {readConfirmed ? "קראתי את החוזה ✓" : "קראתי את החוזה — המשך לחתימה"}
            </button>
          )}
        </div>

        {/* ── Step 2: Signature ────────────────────────────────────────────────── */}
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

        {/* Petra branding footer */}
        <div className="py-6 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Petra" className="w-6 h-6 rounded-lg" />
            <span className="text-sm font-bold text-slate-400">Petra</span>
          </div>
          <p className="text-[11px] text-slate-400">חתימה דיגיטלית מאובטחת</p>
        </div>
      </div>
    </div>
  );
}
