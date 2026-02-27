"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import {
  Syringe,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageCircle,
  PawPrint,
  RefreshCw,
} from "lucide-react";
import { cn, toWhatsAppPhone } from "@/lib/utils";

interface VaccinationEntry {
  healthId: string;
  petId: string;
  petName: string;
  species: string;
  breed: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vaccineType: "rabies" | "dhpp";
  vaccineLabel: string;
  validUntil: string;
  daysUntil: number;
  isExpired: boolean;
}

const DAY_OPTIONS = [7, 14, 30, 60, 90];

function urgencyClass(entry: VaccinationEntry): string {
  if (entry.isExpired) return "border-red-200 bg-red-50";
  if (entry.daysUntil <= 7) return "border-orange-200 bg-orange-50";
  if (entry.daysUntil <= 30) return "border-amber-100 bg-amber-50";
  return "border-slate-100 bg-white";
}

function urgencyBadge(entry: VaccinationEntry) {
  if (entry.isExpired) {
    return (
      <span className="badge badge-danger">
        פג תוקף לפני {Math.abs(entry.daysUntil)} ימים
      </span>
    );
  }
  if (entry.daysUntil <= 7) {
    return (
      <span className="badge badge-danger">
        נפקע בעוד {entry.daysUntil} ימים
      </span>
    );
  }
  if (entry.daysUntil <= 30) {
    return (
      <span className="badge badge-warning">
        נפקע בעוד {entry.daysUntil} ימים
      </span>
    );
  }
  return (
    <span className="badge badge-neutral">
      נפקע בעוד {entry.daysUntil} ימים
    </span>
  );
}

export default function VaccinationsPage() {
  const [days, setDays] = useState(30);
  const [typeFilter, setTypeFilter] = useState<"all" | "rabies" | "dhpp">("all");

  const { data, isLoading, isError, refetch } = useQuery<{
    vaccinations: VaccinationEntry[];
    total: number;
  }>({
    queryKey: ["vaccinations", days],
    queryFn: () =>
      fetch(`/api/pets/vaccinations?days=${days}`).then((r) => r.json()),
  });

  const allVaccinations = data?.vaccinations ?? [];
  const vaccinations = typeFilter === "all"
    ? allVaccinations
    : allVaccinations.filter((v) => v.vaccineType === typeFilter);

  const expired = vaccinations.filter((v) => v.isExpired);
  const expiring = vaccinations.filter((v) => !v.isExpired);

  const buildWhatsApp = (phone: string, petName: string, vaccineLabel: string, expiry: string) => {
    const formatted = new Date(expiry).toLocaleDateString("he-IL");
    const msg = encodeURIComponent(
      `שלום! רצינו להזכיר לך שהחיסון (${vaccineLabel}) של ${petName} עומד לפוג בתאריך ${formatted}. כדאי לתאם עם הווטרינר לחידוש החיסון. – הצוות שלנו`
    );
    return `https://wa.me/${toWhatsAppPhone(phone)}?text=${msg}`;
  };

  const rabiesCount = allVaccinations.filter((v) => v.vaccineType === "rabies").length;
  const dhppCount = allVaccinations.filter((v) => v.vaccineType === "dhpp").length;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">תזכורות חיסונים</h1>
          <p className="text-sm text-petra-muted mt-1">
            חיות מחמד עם חיסון שפג תוקפו או שעומד לפוג
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-secondary gap-2 inline-flex items-center"
        >
          <RefreshCw className="w-4 h-4" />
          רענן
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-petra-text">הצג בתוך:</span>
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                days === d
                  ? "bg-brand-500 text-white border-brand-500"
                  : "bg-white text-petra-muted border-slate-200 hover:border-brand-300"
              )}
            >
              {d} ימים
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-petra-text">סוג חיסון:</span>
          {[
            { value: "all", label: "הכל" },
            { value: "rabies", label: `כלבת (${rabiesCount})` },
            { value: "dhpp", label: `DHPP (${dhppCount})` },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value as "all" | "rabies" | "dhpp")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                typeFilter === opt.value
                  ? "bg-brand-500 text-white border-brand-500"
                  : "bg-white text-petra-muted border-slate-200 hover:border-brand-300"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {data && (
          <span className="mr-auto text-sm text-petra-muted">
            {vaccinations.length} רשומות
          </span>
        )}
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="card p-10 text-center text-petra-muted text-sm">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin opacity-40" />
          טוען...
        </div>
      )}
      {isError && (
        <div className="card p-8 text-center text-red-500 text-sm">
          שגיאה בטעינת נתונים
        </div>
      )}

      {!isLoading && !isError && vaccinations.length === 0 && (
        <div className="card p-12 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400 opacity-60" />
          <p className="text-petra-muted text-sm">
            אין חיסונים שפגו תוקפם או שיפקעו בתוך {days} הימים הקרובים
          </p>
        </div>
      )}

      {/* Expired section */}
      {expired.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold text-red-600">
              חיסונים שפג תוקפם ({expired.length})
            </h2>
          </div>
          <div className="space-y-2">
            {expired.map((v) => (
              <VaccinationRow
                key={v.healthId}
                entry={v}
                waLink={buildWhatsApp(v.customerPhone, v.petName, v.vaccineLabel, v.validUntil)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Expiring soon section */}
      {expiring.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-amber-600">
              חיסונים שעומדים לפוג ({expiring.length})
            </h2>
          </div>
          <div className="space-y-2">
            {expiring.map((v) => (
              <VaccinationRow
                key={v.healthId}
                entry={v}
                waLink={buildWhatsApp(v.customerPhone, v.petName, v.vaccineLabel, v.validUntil)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function VaccinationRow({
  entry,
  waLink,
}: {
  entry: VaccinationEntry;
  waLink: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 rounded-xl border gap-4",
        urgencyClass(entry)
      )}
    >
      {/* Pet info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
          <PawPrint className="w-4 h-4 text-brand-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-petra-text">
            {entry.petName}
            {entry.breed && (
              <span className="text-petra-muted font-normal mr-1 text-xs">
                ({entry.breed})
              </span>
            )}
          </p>
          <Link
            href={`/customers/${entry.customerId}`}
            className="text-xs text-brand-600 hover:underline"
          >
            {entry.customerName}
          </Link>
        </div>
      </div>

      {/* Expiry info */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <p className="text-xs text-petra-muted flex items-center gap-1 justify-end">
            <Syringe className="w-3 h-3" />
            {entry.vaccineLabel}
          </p>
          <p className="text-xs font-medium text-petra-text">
            {new Date(entry.validUntil).toLocaleDateString("he-IL")}
          </p>
        </div>
        {urgencyBadge(entry)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200 text-xs font-medium"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          WhatsApp
        </a>
        <Link
          href={`/customers/${entry.customerId}`}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors border border-brand-200 text-xs font-medium"
        >
          פרופיל
        </Link>
      </div>
    </div>
  );
}
