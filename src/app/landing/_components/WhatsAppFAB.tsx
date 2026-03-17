"use client";

import { MessageCircle } from "lucide-react";

const WHATSAPP_DEMO =
  "https://wa.me/972515311435?text=%D7%94%D7%99%D7%99%2C%20%D7%90%D7%A9%D7%9E%D7%97%20%D7%9C%D7%A7%D7%91%D7%95%D7%A2%20%D7%93%D7%9E%D7%95%20%D7%9C%D7%A4%D7%98%D7%A8%D7%94";

export function WhatsAppFAB() {
  return (
    <a
      href={WHATSAPP_DEMO}
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
