"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Check,
  X,
} from "lucide-react";
import { cn, toWhatsAppPhone } from "@/lib/utils";
import { BoardingTabs } from "@/components/boarding/BoardingTabs";
import { toast } from "sonner";

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
  serviceDogId: string | null;
  vaccineType: string;
  vaccineLabel: string;
  lastDate: string | null;
  validUntil: string | null;
  daysUntil: number;
  isExpired: boolean;
  isUnknown: boolean;
  extra?: string;
}

interface PetGroup {
  petId: string;
  petName: string;
  breed: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceDogId: string | null;
  vaccines: Map<string, VaccinationEntry & { status: VaccineStatus }>;
}

type VaccineStatus = "valid" | "expiring_soon" | "expired" | "unknown";
type StatusFilter = "all" | "expired" | "expiring_soon" | "valid" | "unknown";
type TypeFilter = "all" | string;

// ─── Constants ────────────────────────────────────────────────────────────────

// Main vaccines shown as columns in the grouped table
const COLUMN_VACCINES = [
  { type: "rabies",    label: "כלבת" },
  { type: "dhpp",      label: "משושה" },
  { type: "deworming", label: "תילוע" },
  { type: "fleaTick",  label: "קרציות" },
] as const;

const TYPE_FILTER_OPTIONS = [
  { value: "all",        label: "הכל" },
  { value: "rabies",     label: "כלבת" },
  { value: "dhpp",       label: "משושה בוגר" },
  { value: "dhppPuppy1", label: "גורים מנה 1" },
  { value: "dhppPuppy2", label: "גורים מנה 2" },
  { value: "dhppPuppy3", label: "גורים מנה 3" },
  { value: "bordetella", label: "שעלת מכלאות" },
  { value: "parkWorm",   label: "תולעת הפארק" },
  { value: "deworming",  label: "תילוע" },
  { value: "fleaTick",   label: "קרציות/פרעושים" },
];

const STATUS_ORDER: Record<string, number> = {
  expired: 0, unknown: 1, expiring_soon: 2, valid: 3,
};

// Map vaccine type → PATCH body fields (today's date + computed expiry)
function getMarkDoneFields(vaccineType: string, today: Date): Record<string, unknown> {
  const iso = today.toISOString();
  const addDays = (n: number) => new Date(today.getTime() + n * 86400000).toISOString();
  switch (vaccineType) {
    case "rabies":     return { rabiesLastDate: iso, rabiesValidUntil: addDays(334), rabiesUnknown: false }; // 11 months
    case "dhpp":       return { dhppLastDate: iso };
    case "dhppPuppy1": return { dhppPuppy1Date: iso };
    case "dhppPuppy2": return { dhppPuppy2Date: iso };
    case "dhppPuppy3": return { dhppPuppy3Date: iso };
    case "bordetella": return { bordatellaDate: iso };
    case "parkWorm":   return { parkWormDate: iso };
    case "deworming":  return { dewormingLastDate: iso };
    case "fleaTick":   return { fleaTickDate: iso };
    default: return {};
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeStatus(entry: VaccinationEntry): VaccineStatus {
  if (entry.isUnknown || entry.validUntil === null) return "unknown";
  if (entry.isExpired) return "expired";
  if (entry.daysUntil <= 30) return "expiring_soon";
  return "valid";
}

function worstStatus(group: PetGroup): VaccineStatus {
  const statuses = Array.from(group.vaccines.values()).map((v) => v.status);
  return (statuses.sort((a, b) => (STATUS_ORDER[a] ?? 4) - (STATUS_ORDER[b] ?? 4))[0] ?? "unknown") as VaccineStatus;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" });
}

function buildWhatsApp(phone: string, petName: string, vaccineLabel: string, validUntil: string | null, isExpired: boolean): string {
  let msg: string;
  if (isExpired) {
    msg = `שלום! רצינו להודיע לך שה${vaccineLabel} של הכלב ${petName} פג תוקפו. אנא פנה לווטרינר בהקדם. – הצוות שלנו`;
  } else {
    const dateStr = validUntil ? new Date(validUntil).toLocaleDateString("he-IL") : "בקרוב";
    msg = `שלום! רצינו להזכיר לך שה${vaccineLabel} של הכלב ${petName} עומד לפוג בתאריך ${dateStr}. כדאי לתאם חידוש. – הצוות שלנו`;
  }
  return `https://wa.me/${toWhatsAppPhone(phone)}?text=${encodeURIComponent(msg)}`;
}

// ─── VaccineCell ─────────────────────────────────────────────────────────────

function VaccineCell({
  entry,
  petId,
  onMarkDone,
}: {
  entry: (VaccinationEntry & { status: VaccineStatus }) | undefined;
  petId: string;
  onMarkDone: (petId: string, vaccineType: string, date: string) => void;
}) {
  const [confirmDate, setConfirmDate] = useState<string | null>(null);

  if (!entry) {
    return <td className="table-cell text-center"><span className="text-petra-muted text-xs">—</span></td>;
  }

  const { status, validUntil, daysUntil, vaccineType } = entry;

  const statusColors = {
    expired:      "text-red-600 bg-red-50",
    expiring_soon:"text-amber-700 bg-amber-50",
    valid:        "text-emerald-700 bg-emerald-50",
    unknown:      "text-slate-400 bg-slate-50",
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <td className="table-cell">
      <div className="flex flex-col gap-1 min-w-[100px]">
        {/* Expiry */}
        <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", statusColors[status])}>
          {status === "unknown" ? "לא ידוע" :
           status === "expired" ? `פג (${Math.abs(daysUntil)}י׳)` :
           status === "expiring_soon" ? `פוקע בעוד ${daysUntil}י׳` :
           validUntil ? `עד ${formatDate(validUntil)}` : "—"}
        </span>

        {/* Mark done button / confirm */}
        {confirmDate === null ? (
          <button
            onClick={() => setConfirmDate(today)}
            className="text-[10px] font-medium text-brand-600 hover:text-brand-700 hover:underline text-right"
          >
            ✓ בוצע
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={confirmDate}
              onChange={(e) => setConfirmDate(e.target.value)}
              className="text-[10px] border border-slate-300 rounded px-1 py-0.5 w-[90px] focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
            <button
              onClick={() => { onMarkDone(petId, vaccineType, confirmDate); setConfirmDate(null); }}
              className="p-0.5 rounded bg-emerald-500 text-white hover:bg-emerald-600"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={() => setConfirmDate(null)}
              className="p-0.5 rounded bg-slate-200 text-slate-500 hover:bg-slate-300"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </td>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VaccinationsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    vaccinations: VaccinationEntry[];
    total: number;
  }>({
    queryKey: ["vaccinations-full"],
    queryFn: () =>
      fetch("/api/pets/vaccinations?all=true").then((r) => {
        if (!r.ok) throw new Error("Failed to fetch vaccinations");
        return r.json();
      }),
    staleTime: 60000,
  });

  const markDoneMutation = useMutation({
    mutationFn: async ({ petId, vaccineType, date }: { petId: string; vaccineType: string; date: string }) => {
      const fields = getMarkDoneFields(vaccineType, new Date(date));
      const r = await fetch(`/api/pets/${petId}/health`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!r.ok) throw new Error("שגיאה");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vaccinations-full"] });
      toast.success("החיסון עודכן בהצלחה");
    },
    onError: () => toast.error("שגיאה בעדכון החיסון"),
  });

  // Group by pet
  const petGroups = useMemo<PetGroup[]>(() => {
    const map = new Map<string, PetGroup>();
    for (const v of data?.vaccinations ?? []) {
      if (!map.has(v.petId)) {
        map.set(v.petId, {
          petId: v.petId,
          petName: v.petName,
          breed: v.breed,
          customerId: v.customerId,
          customerName: v.customerName,
          customerPhone: v.customerPhone,
          serviceDogId: v.serviceDogId ?? null,
          vaccines: new Map(),
        });
      }
      map.get(v.petId)!.vaccines.set(v.vaccineType, { ...v, status: computeStatus(v) });
    }
    return Array.from(map.values());
  }, [data]);

  // Stats (from individual entries)
  const allEntries = useMemo(() =>
    (data?.vaccinations ?? []).map((v) => ({ ...v, status: computeStatus(v) })),
    [data]
  );
  const expiredCount = allEntries.filter((v) => v.status === "expired").length;
  const expiringSoonCount = allEntries.filter((v) => v.status === "expiring_soon").length;
  const unknownCount = allEntries.filter((v) => v.status === "unknown").length;

  // Filter groups
  const filteredGroups = useMemo(() => {
    return petGroups
      .filter((group) => {
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!group.petName.toLowerCase().includes(q) && !group.customerName.toLowerCase().includes(q)) return false;
        }
        if (typeFilter !== "all") {
          const v = group.vaccines.get(typeFilter);
          if (!v) return false;
          if (statusFilter !== "all" && v.status !== statusFilter) return false;
          return true;
        }
        if (statusFilter !== "all") {
          return worstStatus(group) === statusFilter;
        }
        return true;
      })
      .sort((a, b) => {
        // When "פוקע בקרוב" filter is active: sort by rabies expiry date ascending
        if (statusFilter === "expiring_soon" && typeFilter === "all") {
          const ra = a.vaccines.get("rabies");
          const rb = b.vaccines.get("rabies");
          const daysA = ra?.daysUntil ?? Infinity;
          const daysB = rb?.daysUntil ?? Infinity;
          if (daysA !== daysB) return daysA - daysB;
          return a.petName.localeCompare(b.petName, "he");
        }
        const orderA = STATUS_ORDER[worstStatus(a)] ?? 4;
        const orderB = STATUS_ORDER[worstStatus(b)] ?? 4;
        return orderA - orderB || a.petName.localeCompare(b.petName, "he");
      });
  }, [petGroups, search, typeFilter, statusFilter]);

  // Determine which vaccine columns to show
  // If type filter active and not one of the 4 main columns, add it temporarily
  const vaccineColumns = useMemo(() => {
    if (typeFilter !== "all" && !COLUMN_VACCINES.find((c) => c.type === typeFilter)) {
      const opt = TYPE_FILTER_OPTIONS.find((o) => o.value === typeFilter);
      return [...COLUMN_VACCINES, { type: typeFilter, label: opt?.label ?? typeFilter }];
    }
    return COLUMN_VACCINES;
  }, [typeFilter]);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <BoardingTabs />

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">ניהול חיסונים</h1>
          <p className="text-sm text-petra-muted mt-1">מעקב חיסונים וטיפולים לכלבי העסק</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} className="btn-secondary gap-2 inline-flex items-center">
          <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          רענן
        </button>
      </div>

      {/* Stat cards */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => setStatusFilter(statusFilter === "expired" ? "all" : "expired")}
            className={cn("stat-card text-right transition-all cursor-pointer", statusFilter === "expired" && "ring-2 ring-red-400")}
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldX className="w-4 h-4 text-red-500" />
              <span className="text-sm text-petra-muted">פג תוקף</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{expiredCount}</p>
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === "expiring_soon" ? "all" : "expiring_soon")}
            className={cn("stat-card text-right transition-all cursor-pointer", statusFilter === "expiring_soon" && "ring-2 ring-amber-400")}
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-petra-muted">פוקע בקרוב</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{expiringSoonCount}</p>
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === "unknown" ? "all" : "unknown")}
            className={cn("stat-card text-right transition-all cursor-pointer", statusFilter === "unknown" && "ring-2 ring-slate-400")}
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

        {/* Vaccine type filter */}
        <div className="flex items-center gap-1 flex-wrap">
          {TYPE_FILTER_OPTIONS.map((opt) => (
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
          <span className="ms-auto text-sm text-petra-muted">{filteredGroups.length} כלבים</span>
        )}
      </div>

      {/* Loading / Error / Empty */}
      {isLoading && (
        <div className="card p-10 text-center text-petra-muted text-sm">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin opacity-40" />טוען...
        </div>
      )}
      {isError && (
        <div className="card p-8 text-center text-red-500 text-sm">שגיאה בטעינת נתונים</div>
      )}
      {!isLoading && !isError && filteredGroups.length === 0 && (
        <div className="card p-12 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 opacity-60" />
          <p className="text-petra-muted text-sm">
            {statusFilter !== "all" || typeFilter !== "all" || search
              ? "לא נמצאו כלבים מתאימים לפילטר הנבחר"
              : "לא נמצאו רשומות חיסון. הוסף תאריכי חיסון בפרופיל החיות."}
          </p>
        </div>
      )}

      {/* Alert banner */}
      {!isLoading && !isError && (expiredCount > 0 || expiringSoonCount > 0) && (
        <div className="card p-4 bg-amber-50 border-amber-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            {expiredCount > 0 && <span className="font-semibold text-red-700">{expiredCount} חיסונים פגי תוקף</span>}
            {expiredCount > 0 && expiringSoonCount > 0 && " · "}
            {expiringSoonCount > 0 && <span className="font-semibold text-amber-700">{expiringSoonCount} חיסונים עומדים לפוג</span>}
            {" – מומלץ לשלוח תזכורת לבעלי הכלבים"}
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && filteredGroups.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="table-header-cell">שם הכלב</th>
                  <th className="table-header-cell">בעל הכלב</th>
                  {vaccineColumns.map((col) => (
                    <th key={col.type} className="table-header-cell text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Syringe className="w-3.5 h-3.5 text-violet-400" />
                        {col.label}
                      </div>
                    </th>
                  ))}
                  <th className="table-header-cell">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredGroups.map((group) => {
                  const worst = worstStatus(group);
                  const borderClass =
                    worst === "expired" ? "border-r-4 border-r-red-400" :
                    worst === "expiring_soon" ? "border-r-4 border-r-amber-400" : "";

                  // Find a problematic vaccine to suggest for WhatsApp
                  const alertVaccine = Array.from(group.vaccines.values()).find(
                    (v) => v.status === "expired" || v.status === "expiring_soon"
                  );

                  return (
                    <tr key={group.petId} className={cn("hover:bg-slate-50 transition-colors", borderClass)}>
                      {/* Dog */}
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
                            <PawPrint className="w-3.5 h-3.5 text-brand-500" />
                          </div>
                          <div>
                            <p className="font-medium text-petra-text">{group.petName}</p>
                            {group.breed && <p className="text-xs text-petra-muted">{group.breed}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="table-cell">
                        {group.customerId ? (
                          <Link href={`/customers/${group.customerId}`} className="text-brand-600 hover:underline">
                            {group.customerName}
                          </Link>
                        ) : (
                          <span className="text-xs text-petra-muted">כלב שירות</span>
                        )}
                      </td>

                      {/* Vaccine columns */}
                      {vaccineColumns.map((col) => (
                        <VaccineCell
                          key={col.type}
                          entry={group.vaccines.get(col.type)}
                          petId={group.petId}
                          onMarkDone={(petId, vaccineType, date) =>
                            markDoneMutation.mutate({ petId, vaccineType, date })
                          }
                        />
                      ))}

                      {/* Actions */}
                      <td className="table-cell">
                        <div className="flex items-center gap-2 flex-wrap">
                          {alertVaccine && group.customerPhone && (
                            <a
                              href={buildWhatsApp(
                                group.customerPhone,
                                group.petName,
                                alertVaccine.vaccineLabel,
                                alertVaccine.validUntil,
                                alertVaccine.isExpired
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200 text-xs font-medium"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              תזכורת
                            </a>
                          )}
                          {group.customerId ? (
                            <button
                              onClick={() => router.push(`/customers/${group.customerId}`)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors border border-brand-200 text-xs font-medium"
                            >
                              פרופיל
                            </button>
                          ) : null}
                          {group.serviceDogId ? (
                            <button
                              onClick={() => router.push(`/service-dogs/${group.serviceDogId}`)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors border border-violet-200 text-xs font-medium"
                            >
                              תיק כלב
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
