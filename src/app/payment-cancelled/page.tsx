"use client";

import { XCircle, ArrowRight, RefreshCw } from "lucide-react";

export default function PaymentCancelledPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center p-6" dir="rtl">
      <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">התשלום בוטל</h1>
        <p className="text-slate-500 mb-8">
          לא בוצע חיוב. ניתן לנסות שוב בכל עת.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => window.history.back()}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            נסה שוב
          </button>
          <a
            href="/"
            className="w-full py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            חזרה לאתר
          </a>
        </div>
      </div>
    </div>
  );
}
