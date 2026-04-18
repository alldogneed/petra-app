"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { XCircle, MessageCircle } from "lucide-react";

const WHATSAPP_SUPPORT = "972542560964";

export default function PaymentErrorPage() {
  const router = useRouter();

  useEffect(() => {
    // Break out of Cardcom iframe if we're embedded
    if (typeof window !== "undefined" && window !== window.top) {
      window.top!.location.href = window.location.href;
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-red-50 to-white p-8 text-center" dir="rtl">
      <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-6">
        <XCircle className="w-10 h-10 text-red-400" />
      </div>
      <h1 className="text-3xl font-bold text-slate-900 mb-3">התשלום נכשל</h1>
      <p className="text-slate-500 max-w-sm mb-8">
        לא הצלחנו לעבד את התשלום. אפשר לנסות שוב או לפנות לתמיכה.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => router.replace("/upgrade")}
          className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-colors"
        >
          נסה שוב
        </button>
        <button
          onClick={() => window.open(`https://wa.me/${WHATSAPP_SUPPORT}?text=${encodeURIComponent("שלום, נכשל לי תשלום ב-Petra. אשמח לעזרה.")}`, "_blank")}
          className="px-6 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-5 h-5" />
          פנה לתמיכה
        </button>
      </div>
    </div>
  );
}
