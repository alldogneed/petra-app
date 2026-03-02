"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import {
  Syringe,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PawPrint,
  RefreshCw,
  MessageCircle,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Search,
} from "lucide-react";
import { cn, toWhatsAppPhone } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VaccinationEntry {
  healthId: string;
  petId: string;
  petName: string;
  species: string;
  breed: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vaccineType: "rabies" | "dhpp" | "deworming";
  vaccineLabel: string;
  lastDate: string | null;
  validUntil: string | null;
  daysUntil: number;
  isExpired: boolean;
  isUnknown: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeStatus(
  entry: VaccinationEntry
): "valid" | "expiring_soon" | "expired" | "unknown" {
  if (entry.isUnknown || entry.validUntil === null) return "unknown";
  if (entry.isExpired) return "expired";
  if (entry.daysUntil <= 30) return "expiring_soon";
  return "valid";
}

function StatusBadge({
  status,
  daysUntil,
}: {
  status: string;
  daysUntil: number;
}) {
  if (status === "valid") {
    return (
      <span className="flex items-center gap-1 text-emerald-700 font-medium text-xs">
        <ShieldCheck className="w-3.5 h-3.5" />
        תקף
        <span className="text-emerald-500">({daysUntil} ימים)</span>
      </span>
    );
  }
  if (status === "expiring_soon") {
    return (
      <span className="badge badge-warning flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {daysUntil === 0
          ? "פוקע היום"
          : daysUntil === 1
          ? "פוקע מחר"
          : `פוקע בעוד ${daysUntil} ימים`}
      </span>
    );
  }
  if (status === "expired") {
    return (
      <span className="badge badge-danger flex items-center gap-1">
        <ShieldX className="w-3 h-3" />
        פג תוקף
        <span>(לפני {Math.abs(daysUntil)} ימים)</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-slate-400 text-xs">
      <ShieldAlert className="w-3.5 h-3.5" />
      לא ידוע
    </span>
  );
}

function rowBorderClass(status: string) {
  if (status === "expired") return "border-r-4 border-r-red-400";
  if (status === "expiring_soon") return "border-r-4 border-r-amber-400";
  return "";
}

function buildWhatsApp(
  phone: string,
  petName: string,
  vaccineLabel: string,
  validUntil: string | null,
  isExpired: boolean
): string {
  let msg: string;
  if (isExpired) {
    msg = `שלום! רצינו להודיע לך שה${vaccineLabel} של הכלב ${petName} פג תוקפו. אנא פנה לווטרינר בהקדם. – הצוות שלנו`;
  } else {
    const dateStr = validUntil
      ? new Date(validUntil).toLocaleDateString("he-IL")
      : "בקרוב";
    msg = `שלום! רצינו להזכיר לך שה${vaccineLabel} של הכלב ${petName} עומד לפוג בתאריך ${dateStr}. כדאי לתאם חידוש. – הצוות שלנו`;
  }
  return `https://web.whatsapp.com/send?phone=${toWhatsAppPhone(phone)}&text=${encodeURIComponent(msg)}`;
}

type StatusFilter = "all" | "expired" | "expiring_soon" | "valid" | "unknown";
type TypeFilter = "all" | "rabies" | "dhpp" | "deworming";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VaccinationsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    vaccinations: VaccinationEntry[];
    total: number;
  }>({
    queryKey: ["vaccinations-full"],
    queryFn: () =>
      fetch("/api/pets/vaccinations?all=true").then((r) => r.json()),
    staleTime: 60000,
  });

  // Compute status for each entry
  const enriched = (data?.vaccinations ?? []).map((v) => ({
    ...v,
    status: computeStatus(v),
  }));

  // Apply filters
  const filtered = enriched.filter((v) => {
    if (typeFilter !== "all" && v.vaccineType !== typeFilter) return false;
    if (statusFilter !== "all" && v.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !v.petName.toLowerCase().includes(q) &&
        !v.customerName.toLowerCase().includes(q) &&
        !v.vaccineLabel.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  // Sort: expired → unknown → expiring_soon → valid
  const STATUS_ORDER: Record<string, number> = {
    expired: 0,
    unknown: 1,
    expiring_soon: 2,
    valid: 3,
  };
  const sorted = [...filtered].sort(
    (a, b) =>
      (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4) ||
      a.daysUntil - b.daysUntil
  );

  const expiredCount = enriched.filter((v) => v.status === "expired").length;
  const expiringSoonCount = enriched.filter(
    (v) => v.status === "expiring_soon"
  ).length;
  const unknownCount = enriched.filter((v) => v.status === "unknown").length;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">ניהול חיסונים</h1>
          <p className="text-sm text-petra-muted mt-1">
            מעקב חיסונים לכלבי העסק – כלבת, DHPP וטיפול נגד תולעים
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-secondary gap-2 inline-flex items-center"
        >
          <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          רענן
        </button>
      </div>

      {/* Stat cards */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() =>
              setStatusFilter(statusFilter === "expired" ? "all" : "expired")
            }
            className={cn(
              "stat-card text-right transition-all cursor-pointer",
              statusFilter === "expired" && "ring-2 ring-red-400"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldX className="w-4 h-4 text-red-500" />
              <span className="text-sm text-petra-muted">פג תוקף</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{expiredCount}</p>
          </button>

          <button
            onClick={() =>
              setStatusFilter(
                statusFilter === "expiring_soon" ? "all" : "expiring_soon"
              )
            }
            className={cn(
              "stat-card text-right transition-all cursor-pointer",
              statusFilter === "expiring_soon" && "ring-2 ring-amber-400"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-petra-muted">פוקע בקרוב</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {expiringSoonCount}
            </p>
          </button>

          <button
            onClick={() =>
              setStatusFilter(statusFilter === "unknown" ? "all" : "unknown")
            }
            className={cn(
              "stat-card text-right transition-all cursor-pointer",
              statusFilter === "unknown" && "ring-2 ring-slate-400"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-petra-muted">לא ידוע</span>
            </div>
            <p className="text-2xl font-bold text-slate-500">{unknownCount}</p>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <input
            type="text"
            placeholder="חיפוש לפי כלב, לקוח..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full pr-9"
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted pointer-events-none" />
        </div>

        {/* Vaccine type */}
        <div className="flex items-center gap-1 flex-wrap">
          {(
            [
              { value: "all", label: "הכל" },
              { value: "rabies", label: "כלבת" },
              { value: "dhpp", label: "DHPP" },
              { value: "deworming", label: "תולעים" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                typeFilter === opt.value
                  ? "bg-slate-700 text-white border-slate-700"
                  : "bg-white text-petra-muted border-slate-200 hover:border-slate-400"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 flex-wrap">
          {(
            [
              { value: "all", label: "הכל" },
              { value: "expired", label: "פג תוקף" },
              { value: "expiring_soon", label: "פוקע בקרוב" },
              { value: "valid", label: "תקף" },
              { value: "unknown", label: "לא ידוע" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                statusFilter === opt.value
                  ? "bg-brand-500 text-white border-brand-500"
                  : "bg-white text-petra-muted border-slate-200 hover:border-brand-300"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {data && (
          <span className="ms-auto text-sm text-petra-muted">
            {sorted.length} רשומות
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="card p-10 text-center text-petra-muted text-sm">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin opacity-40" />
          טוען...
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="card p-8 text-center text-red-500 text-sm">
          שגיאה בטעינת נתונים
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && sorted.length === 0 && (
        <div className="card p-12 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 opacity-60" />
          <p className="text-petra-muted text-sm">
            {statusFilter !== "all" || typeFilter !== "all" || search
              ? "לא נמצאו חיסונים מתאימים לפילטר הנבחר"
              : "לא נמצאו רשומות חיסון. הוסף תאריכי חיסון בפרופיל החיות."}
          </p>
        </div>
      )}

      {/* Alert banner */}
      {!isLoading && !isError && (expiredCount > 0 || expiringSoonCount > 0) && (
        <div className="card p-4 bg-amber-50 border-amber-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            {expiredCount > 0 && (
              <span className="font-semibold text-red-700">
                {expiredCount} חיסונים פגי תוקף
              </span>
            )}
            {expiredCount > 0 && expiringSoonCount > 0 && " · "}
            {expiringSoonCount > 0 && (
              <span className="font-semibold text-amber-700">
                {expiringSoonCount} חיסונים עומדים לפוג
              </span>
            )}
            {" – מומלץ לשלוח תזכורת לבעלי הכלבים"}
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && sorted.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="table-header-cell">שם הכלב</th>
                  <th className="table-header-cell">בעל הכלב</th>
                  <th className="table-header-cell">סוג חיסון</th>
                  <th className="table-header-cell">תאריך אחרון</th>
                  <th className="table-header-cell">תוקף עד</th>
                  <th className="table-header-cell">סטטוס</th>
                  <th className="table-header-cell">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sorted.map((v) => (
                  <tr
                    key={`${v.healthId}-${v.vaccineType}`}
                    className={cn(
                      "hover:bg-slate-50 transition-colors",
                      rowBorderClass(v.status)
                    )}
                  >
                    {/* Pet */}
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
                          <PawPrint className="w-3.5 h-3.5 text-brand-500" />
                        </div>
                        <div>
                          <p className="font-medium text-petra-text">
                            {v.petName}
                          </p>
                          {v.breed && (
                            <p className="text-xs text-petra-muted">{v.breed}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="table-cell">
                      <Link
                        href={`/customers/${v.customerId}`}
                        className="text-brand-600 hover:underline"
                      >
                        {v.customerName}
                      </Link>
                    </td>

                    {/* Vaccine type */}
                    <td className="table-cell">
                      <span className="flex items-center gap-1.5 font-medium text-petra-text">
                        <Syringe className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                        {v.vaccineLabel}
                      </span>
                    </td>

                    {/* Last date */}
                    <td className="table-cell text-petra-muted">
                      {v.lastDate
                        ? new Date(v.lastDate).toLocaleDateString("he-IL")
                        : "—"}
                    </td>

                    {/* Valid until */}
                    <td className="table-cell">
                      {v.validUntil ? (
                        <span
                          className={cn(
                            "font-medium",
                            v.status === "expired"
                              ? "text-red-600"
                              : v.status === "expiring_soon"
                              ? "text-amber-700"
                              : "text-petra-text"
                          )}
                        >
                          {new Date(v.validUntil).toLocaleDateString("he-IL")}
                        </span>
                      ) : (
                        <span className="text-petra-muted">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="table-cell">
                      <StatusBadge
                        status={v.status}
                        daysUntil={v.daysUntil}
                      />
                    </td>

                    {/* Actions */}
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        {(v.status === "expired" ||
                          v.status === "expiring_soon") && (
                          <a
                            href={buildWhatsApp(
                              v.customerPhone,
                              v.petName,
                              v.vaccineLabel,
                              v.validUntil,
                              v.isExpired
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200 text-xs font-medium"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            תזכורת
                          </a>
                        )}
                        <Link
                          href={`/customers/${v.customerId}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors border border-brand-200 text-xs font-medium"
                        >
                          פרופיל
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
