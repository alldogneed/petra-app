"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageTitle } from "@/components/ui/PageTitle";
import Link from "next/link";
import {
  Syringe, AlertTriangle, Check, X, Search, Printer, ChevronRight
} from "lucide-react";
import {
  ADULT_TREATMENTS, PUPPY_TREATMENTS, getCellStatus, formatPlannedDisplay,
  type VaccinePlan, type VaccinePlanEntry,
} from "@/lib/vaccine-plan";

const LOCATION_LABELS: Record<string, string> = {
  TRAINER: "מאלף",
  FOSTER: "משפחת אומנה",
  BOARDING: "פנסיון",
  FIELD: "שטח",
};

type DogTab = "adults" | "puppies";
type StatusFilter = "all" | "soon" | "overdue" | "unknown";

interface DogRow {
  id: string;
  petId: string;
  petName: string;
  petBreed: string | null;
  phase: string;
  currentLocation: string;
  vaccinePlan: VaccinePlan;
}

export default function VaccinationsPage() {
  const queryClient = useQueryClient();
  const [dogTab, setDogTab] = useState<DogTab>("adults");
  const [treatmentFilter, setTreatmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [markingOpen, setMarkingOpen] = useState<string | null>(null); // "dogId-key-idx"
  const [markDate, setMarkDate] = useState("");

  const treatments = dogTab === "adults" ? ADULT_TREATMENTS : PUPPY_TREATMENTS;

  const { data: dogs = [], isLoading } = useQuery<DogRow[]>({
    queryKey: ["service-dogs-vaccinations", dogTab],
    queryFn: () => fetch(`/api/service-dogs/vaccinations?dogType=${dogTab}`).then(r => r.json()),
  });

  const markDoneMutation = useMutation({
    mutationFn: async ({ dogId, treatmentKey, index, doneDate }: { dogId: string; treatmentKey: string; index: number; doneDate: string | null }) => {
      const r = await fetch(`/api/service-dogs/${dogId}/vaccine-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType: dogTab, treatmentKey, index, doneDate }),
      });
      if (!r.ok) throw new Error("שגיאה");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-dogs-vaccinations"] });
      setMarkingOpen(null);
      setMarkDate("");
      toast.success("הטיפול עודכן");
    },
    onError: () => toast.error("שגיאה בעדכון"),
  });

  // Build column definitions based on treatmentFilter
  const columns = useMemo(() => {
    if (treatmentFilter === "all") {
      return treatments.map(t => ({ key: t.key, label: t.label, index: null as number | null }));
    }
    const t = treatments.find(t => t.key === treatmentFilter);
    if (!t) return [];
    return Array.from({ length: t.doses }, (_, i) => ({
      key: t.key,
      label: t.doses === 1 ? t.label : `${t.label} ${i + 1}`,
      index: i as number | null,
    }));
  }, [treatmentFilter, treatments]);

  const getEntry = (dog: DogRow, key: string, idx: number | null): VaccinePlanEntry | null => {
    const section = dogTab === "adults" ? dog.vaccinePlan.adults : dog.vaccinePlan.puppies;
    if (!section) return null;
    const entries = (section as Record<string, VaccinePlanEntry[]>)[key];
    if (!entries) return null;
    if (idx === null) {
      // "all" view: if any entries are done → show the most recently completed dose
      // otherwise show the most urgent pending/overdue entry
      const doneDoses = entries.filter(e => e.done);
      if (doneDoses.length > 0) {
        return doneDoses.sort((a, b) =>
          new Date(b.done!).getTime() - new Date(a.done!).getTime()
        )[0];
      }
      const sorted = [...entries].sort((a, b) => {
        const sa = getCellStatus(a), sb = getCellStatus(b);
        const order: Record<string, number> = { overdue: 0, soon: 1, upcoming: 2, unknown: 4 };
        return (order[sa] ?? 5) - (order[sb] ?? 5);
      });
      return sorted[0] ?? null;
    }
    return entries[idx] ?? null;
  };

  // Compute warning counts
  const { overdueCount, soonCount } = useMemo(() => {
    let oc = 0, sc = 0;
    dogs.forEach(dog => {
      treatments.forEach(t => {
        const section = dogTab === "adults" ? dog.vaccinePlan.adults : dog.vaccinePlan.puppies;
        const entries = section ? (section as Record<string, VaccinePlanEntry[]>)[t.key] : null;
        entries?.forEach(e => {
          const s = getCellStatus(e);
          if (s === "overdue") oc++;
          if (s === "soon") sc++;
        });
      });
    });
    return { overdueCount: oc, soonCount: sc };
  }, [dogs, treatments, dogTab]);

  // Filter dogs
  const filteredDogs = useMemo(() => {
    let result = dogs;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(d => d.petName.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      result = result.filter(dog => {
        const section = dogTab === "adults" ? dog.vaccinePlan.adults : dog.vaccinePlan.puppies;
        if (!section) return statusFilter === "unknown";
        const keys = treatmentFilter === "all" ? treatments.map(t => t.key) : [treatmentFilter];
        return keys.some(key => {
          const entries = (section as Record<string, VaccinePlanEntry[]>)[key];
          return entries?.some(e => getCellStatus(e) === statusFilter);
        });
      });
    }
    // Always sort by rabies status priority: overdue → soon → upcoming → done → unknown
    const rabiesKey = dogTab === "adults" ? "RABIES_BOOSTER" : "RABIES_PRIMARY";
    const STATUS_PRIORITY: Record<string, number> = { overdue: 0, soon: 1, upcoming: 2, done: 3, unknown: 4 };
    result = [...result].sort((a, b) => {
      const getRabiesStatus = (dog: DogRow): string => {
        const sec = dogTab === "adults" ? dog.vaccinePlan.adults : dog.vaccinePlan.puppies;
        const entries = sec ? (sec as Record<string, VaccinePlanEntry[]>)[rabiesKey] : null;
        if (!entries?.[0]) return "unknown";
        return getCellStatus(entries[0]);
      };
      const pa = STATUS_PRIORITY[getRabiesStatus(a)] ?? 4;
      const pb = STATUS_PRIORITY[getRabiesStatus(b)] ?? 4;
      return pa - pb;
    });
    return result;
  }, [dogs, search, statusFilter, treatmentFilter, dogTab, treatments]);

  const cellBg: Record<string, string> = {
    done: "bg-green-50 text-green-700 border-green-200",
    overdue: "bg-red-50 text-red-600 border-red-200",
    soon: "bg-amber-50 text-amber-700 border-amber-200",
    upcoming: "bg-sky-50 text-sky-700 border-sky-100",
    unknown: "bg-slate-50 text-slate-400 border-slate-200",
  };

  return (
    <>
      <style>{`@media print { aside,nav,header,[data-topbar],[data-sidebar],.no-print{display:none!important} body{font-size:11px} }`}</style>
      <PageTitle title="ניהול חיסונים" />

      {/* Tab header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-0 border border-slate-200 rounded-xl overflow-hidden">
          {(["adults", "puppies"] as DogTab[]).map(tab => (
            <button key={tab} onClick={() => { setDogTab(tab); setTreatmentFilter("all"); }}
              className={cn("px-5 py-2.5 text-sm font-semibold transition-colors",
                dogTab === tab ? "bg-brand-600 text-white" : "bg-white text-petra-muted hover:bg-slate-50"
              )}>
              {tab === "adults" ? "חיסונים וטיפולים בוגרים" : "חיסונים וטיפולים צעירים"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 no-print">
          <div className="relative">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-petra-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="input pr-8 py-1.5 text-sm w-44 h-8"
              placeholder="חיפוש לפי שם כלב..." />
          </div>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 text-petra-muted hover:bg-slate-50">
            <Printer className="w-4 h-4" />הדפס דוח
          </button>
        </div>
      </div>

      {/* Treatment filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-3 no-print">
        {[{ key: "all", label: "כלל" }, ...treatments.map(t => ({ key: t.key, label: t.label }))].map(t => (
          <button key={t.key} onClick={() => setTreatmentFilter(t.key)}
            className={cn("px-3 py-1 rounded-full text-xs font-semibold border transition-all",
              treatmentFilter === t.key
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white text-petra-muted border-slate-200 hover:border-brand-300"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Status filter + dog count */}
      <div className="flex items-center gap-2 mb-3 flex-wrap no-print">
        <span className="text-sm text-petra-muted">{filteredDogs.length} כלבים</span>
        <div className="flex gap-1 ms-auto">
          {(["all", "soon", "overdue", "unknown"] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("px-3 py-1 rounded-lg text-xs font-medium transition-all",
                statusFilter === s ? "bg-brand-600 text-white" : "bg-slate-100 text-petra-muted hover:bg-slate-200"
              )}>
              {{ all: "הכל", soon: "פוקע בקרוב", overdue: "פג תוקף", unknown: "לא יודע" }[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Warning banner */}
      {(overdueCount > 0 || soonCount > 0) && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 mb-4 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span className="text-amber-800 font-medium">
            {overdueCount > 0 && `${overdueCount} חיסונים פגי תוקף`}
            {overdueCount > 0 && soonCount > 0 && " · "}
            {soonCount > 0 && `${soonCount} חיסונים עומדים לפוג`}
            {" – מומלץ לשלוח תזכורות לבעלי הכלבים"}
          </span>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="card p-8 text-center text-petra-muted text-sm">טוען...</div>
      ) : filteredDogs.length === 0 ? (
        <div className="card p-8 text-center text-petra-muted text-sm">
          <Syringe className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p>לא נמצאו כלבים</p>
        </div>
      ) : (
        <div className="card overflow-auto">
          <table className="w-full text-sm" dir="rtl">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-right p-3 font-semibold text-petra-text w-32">שם הכלב</th>
                <th className="text-right p-3 font-semibold text-petra-text w-24">מיקום הכלב</th>
                {columns.map((col, ci) => (
                  <th key={ci} className="text-center p-3 font-semibold text-petra-text min-w-[110px]">
                    {col.label}
                  </th>
                ))}
                <th className="text-center p-3 font-semibold text-petra-text w-28 no-print">עריכה</th>
              </tr>
            </thead>
            <tbody>
              {filteredDogs.map(dog => (
                <tr key={dog.id} className="border-b border-slate-100 hover:bg-slate-50/30 transition-colors">
                  <td className="p-3">
                    <div className="font-semibold text-petra-text">{dog.petName}</div>
                    {dog.petBreed && <div className="text-[11px] text-petra-muted">{dog.petBreed}</div>}
                  </td>
                  <td className="p-3 text-xs text-petra-muted">
                    {LOCATION_LABELS[dog.currentLocation] ?? dog.currentLocation}
                  </td>
                  {columns.map((col, ci) => {
                    const entry = getEntry(dog, col.key, col.index);
                    const status = getCellStatus(entry);
                    const markKey = `${dog.id}-${col.key}-${ci}`;
                    const isMarking = markingOpen === markKey;

                    return (
                      <td key={ci} className="p-2 text-center">
                        {isMarking ? (
                          <div className="flex items-center gap-1 justify-center no-print">
                            <input type="date" lang="he" value={markDate} onChange={e => setMarkDate(e.target.value)}
                              className="input text-xs py-0.5 w-32 h-7" />
                            <button onClick={() => {
                              if (!markDate) return;
                              markDoneMutation.mutate({ dogId: dog.id, treatmentKey: col.key, index: col.index ?? ci, doneDate: markDate });
                            }} className="p-1 rounded bg-green-500 text-white hover:bg-green-600">
                              <Check className="w-3 h-3" />
                            </button>
                            <button onClick={() => { setMarkingOpen(null); setMarkDate(""); }}
                              className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className={cn(
                              "rounded-lg px-2 py-1 text-xs font-medium border inline-block min-w-[90px] mb-1",
                              cellBg[status]
                            )}>
                              {status === "done" && entry?.done
                                ? `✓ ${new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", year: "numeric" }).format(new Date(entry.done))}`
                                : status === "overdue" ? "פג תוקף"
                                : status === "soon" && entry?.planned ? formatPlannedDisplay(entry.planned)
                                : status === "upcoming" && entry?.planned ? formatPlannedDisplay(entry.planned)
                                : "לא יודע"
                              }
                            </div>
                            {status !== "done" && (
                              <div className="no-print">
                                <button onClick={() => { setMarkingOpen(markKey); setMarkDate(""); }}
                                  className="text-[11px] text-orange-500 hover:text-orange-600 font-medium">
                                  ✓ בוצע
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-2 text-center no-print">
                    <div className="flex flex-col gap-1 items-center">
                      <Link href={`/service-dogs/${dog.id}?tab=vaccinations`}
                        className="text-xs px-2 py-1 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 hover:bg-brand-100 inline-flex items-center gap-1 font-medium">
                        ערוך תוכנית
                      </Link>
                      <Link href={`/service-dogs/${dog.id}`}
                        className="text-xs text-petra-muted hover:text-petra-text inline-flex items-center gap-0.5">
                        תיק כלב <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
