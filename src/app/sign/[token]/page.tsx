"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, RotateCcw, PenLine } from "lucide-react";

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
}

export default function SignContractPage() {
  const { token } = useParams<{ token: string }>();
  const [contract, setContract] = useState<ContractData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="card p-8 max-w-sm w-full text-center space-y-4">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
          <h2 className="text-xl font-bold text-petra-text">החוזה נחתם בהצלחה!</h2>
          <p className="text-sm text-petra-muted">
            {contract?.businessName} קיבלו את חתימתך. החוזה החתום נשמר בתיקייה שלך.
          </p>
        </div>
      </div>
    );
  }

  if (!contract) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-petra-text">{contract.templateName}</h1>
          <p className="text-sm text-petra-muted">
            {contract.businessName} מבקשים את חתימתך, {contract.customerName}
          </p>
        </div>

        {/* PDF viewer */}
        <div className="card overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex items-center gap-2">
            <span className="text-xs font-medium text-petra-muted">תצוגת מסמך</span>
            <span className="text-xs text-petra-muted">· עמוד {contract.signaturePage}</span>
          </div>
          <iframe
            src={`${contract.pdfUrl}#page=${contract.signaturePage}`}
            className="w-full"
            style={{ height: "500px", border: "none" }}
            title="חוזה לחתימה"
          />
        </div>

        {/* Signature pad */}
        <div className="card p-5 space-y-4">
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

          <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-white overflow-hidden touch-none">
            <canvas
              ref={canvasRef}
              width={600}
              height={180}
              className="w-full cursor-crosshair"
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
                <p className="text-slate-300 text-sm">חתום בתיבה זו...</p>
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!hasSignature || submitting}
            className="w-full py-3 px-6 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> שולח...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> חתום ואשר</>
            )}
          </button>

          <p className="text-[11px] text-petra-muted text-center">
            בלחיצה על &quot;חתום ואשר&quot; אתה מאשר את קריאת המסמך ומסכים לתנאיו.
            החתימה תישמר כראיה משפטית.
          </p>
        </div>
      </div>
    </div>
  );
}
