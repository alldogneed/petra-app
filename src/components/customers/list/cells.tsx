"use client";
/** Small presentational pieces of the customers list (badges, cells, row actions). */
import { Crown, Sparkles, Check, PawPrint, Clock, Calendar, Phone, Mail, Pencil } from "lucide-react";
import { toWhatsAppPhone } from "@/lib/utils";
import { isValidEmail } from "@/lib/validation";
import { formatShortDate, type AppointmentInfo, type EnhancedCustomer, type FinancialInfo, type PetInfo } from "./types";

// ─── Status Badge ───────────────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "vip":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Crown className="w-3 h-3" />
          VIP
        </span>
      );
    case "active":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          פעיל
        </span>
      );
    case "dormant":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          רדום
        </span>
      );
    default:
      return null;
  }
}

// ─── Financial Badge ────────────────────────────────────────────

export function FinancialBadge({ financial }: { financial: FinancialInfo }) {
  if (financial.totalPending > 0) {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-100">
          חוב
        </span>
        <span className="text-xs font-bold text-red-600 mr-1">
          ₪{financial.totalPending.toLocaleString()}
        </span>
      </div>
    );
  }
  if (financial.hasDeposits) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
        <Sparkles className="w-3 h-3" />
        קרדיט
      </span>
    );
  }
  if (financial.totalPaid > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">
        <Check className="w-3 h-3" />
        מאוזן
      </span>
    );
  }
  return <span className="text-xs text-slate-400">—</span>;
}

// ─── Pets Cell ──────────────────────────────────────────────────

export function PetsCell({ pets, count }: { pets: PetInfo[]; count: number }) {
  if (count === 0) {
    return <span className="text-xs text-slate-400">אין חיות</span>;
  }
  const primary = pets[0];
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full bg-[#FEF3E2] flex items-center justify-center flex-shrink-0">
        <PawPrint className="w-3.5 h-3.5 text-[#C4956A]" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-petra-text truncate max-w-[160px]">
          {primary.name}
          {primary.breed && (
            <span className="text-petra-muted font-normal text-xs">
              {" "}
              — {primary.breed}
            </span>
          )}
        </div>
        {count > 1 && (
          <span className="text-[10px] text-[#A0845C] font-medium">
            +{count - 1} נוספים
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Appointment Dates Cell ─────────────────────────────────────

export function AppointmentDates({
  last,
  next,
}: {
  last: AppointmentInfo | null;
  next: AppointmentInfo | null;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />
        <span className="text-[11px] text-petra-muted">
          {last ? <>אחרון: {formatShortDate(last.date)}</> : "אין היסטוריה"}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Calendar className="w-3 h-3 text-brand-500 flex-shrink-0" />
        <span
          className={`text-[11px] font-medium ${next ? "text-petra-text" : "text-slate-400"}`}
        >
          {next ? <>הבא: {formatShortDate(next.date)}</> : "לא נקבע"}
        </span>
      </div>
    </div>
  );
}

// ─── WhatsApp Icon (official logo SVG) ─────────────────────────

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

// ─── Quick Actions ──────────────────────────────────────────────

export function QuickActions({
  customer,
  onEdit,
}: {
  customer: EnhancedCustomer;
  onEdit: () => void;
}) {
  const waPhone = toWhatsAppPhone(customer.phone);
  const isValidPhone = customer.phone.replace(/\D/g, "").length >= 9;

  return (
    <div className="flex items-center gap-1 flex-nowrap">
      {/* WhatsApp — only for valid phone numbers */}
      {isValidPhone && (
        <a
          href={`https://wa.me/${waPhone}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#25D366] hover:bg-[#E8FEF0] transition-colors"
          title="שלח הודעת WhatsApp"
          aria-label={`שלח הודעת WhatsApp`}
          onClick={(e) => e.stopPropagation()}
        >
          <WhatsAppIcon className="w-4 h-4" />
        </a>
      )}

      {/* Phone call */}
      {isValidPhone && (
        <a
          href={`tel:${customer.phone}`}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors"
          title={`התקשר ל־${customer.phone}`}
          aria-label={`התקשר ל־${customer.phone}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Phone className="w-4 h-4" />
        </a>
      )}

      {/* Email — only when customer has a valid email address */}
      {customer.email && isValidEmail(customer.email) ? (
        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-500 hover:bg-blue-50 transition-colors"
          title={`שלח אימייל ל־${customer.email}`}
          onClick={(e) => {
            e.stopPropagation();
            window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(customer.email!)}`, "_blank");
          }}
        >
          <Mail className="w-4 h-4" />
        </button>
      ) : (
        <span className="w-8 h-8" />
      )}

      {/* Edit */}
      <button
        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
        title="עריכת לקוח"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
      >
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  );
}
// ─── Filter Pill Button ─────────────────────────────────────────

export function FilterPill({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex flex-shrink-0 whitespace-nowrap items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${active
        ? "bg-[#3D2E1F] text-white shadow-sm"
        : "bg-[#FAF7F3] text-[#8B7355] border border-[#E8DFD5] hover:bg-[#F3EDE6] hover:border-[#D4C5B2]"
        }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-white/20 text-white" : "bg-[#E8DFD5] text-[#8B7355]"
            }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
