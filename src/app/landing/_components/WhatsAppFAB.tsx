"use client";

import { MessageCircle } from "lucide-react";

const WHATSAPP_SUPPORT = "https://wa.me/972542560964";

export function WhatsAppFAB() {
  return (
    <a
      href={WHATSAPP_SUPPORT}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="פתיחת שיחה ב-WhatsApp לתמיכה — נפתח בחלון חדש"
      className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 flex items-center gap-2 bg-[#25D366] text-white p-3 sm:px-4 sm:py-3 rounded-full shadow-lg hover:bg-[#1ebe5d] hover:shadow-xl transition-[transform,background-color,box-shadow] duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97] group focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2"
    >
      <MessageCircle className="w-5 h-5 fill-white stroke-none" aria-hidden="true" />
      <span className="text-sm font-semibold overflow-hidden max-w-0 group-hover:max-w-[7rem] transition-[max-width] duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] whitespace-nowrap hidden sm:inline">
        דברו איתנו
      </span>
    </a>
  );
}
