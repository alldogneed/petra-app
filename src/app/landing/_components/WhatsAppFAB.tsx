"use client";

import { MessageCircle } from "lucide-react";

const WHATSAPP_SUPPORT = "https://wa.me/972515311435";

export function WhatsAppFAB() {
  return (
    <a
      href={WHATSAPP_SUPPORT}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="פתיחת שיחה ב-WhatsApp לתמיכה — נפתח בחלון חדש"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-[#25D366] text-white px-3 py-2.5 sm:px-4 sm:py-3 rounded-full shadow-lg hover:bg-[#1ebe5d] hover:shadow-xl transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2"
    >
      <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 fill-white stroke-none" aria-hidden="true" />
      <span className="text-sm font-semibold overflow-hidden max-w-0 group-hover:max-w-xs transition-all duration-300 whitespace-nowrap">
        דברו איתנו
      </span>
    </a>
  );
}
