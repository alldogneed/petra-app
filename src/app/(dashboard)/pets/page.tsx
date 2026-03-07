"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import {
  PawPrint,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Pill,
  Dog,
  Cat,
  HelpCircle,
  RefreshCw,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  gender: string | null;
  weight: number | null;
  birthDate: string | null;
  tags: string | null;
  createdAt: string;
  customer: { id: string; name: string; phone: string };
  health: {
    neuteredSpayed: boolean | null;
    rabiesValidUntil: string | null;
    rabiesUnknown: boolean | null;
    allergies: string | null;
    medicalConditions: string | null;
  } | null;
  medications: { id: string; medName: string; frequency: string | null; endDate: string | null }[];
  activeMedicationCount: number;
  vaccinationStatus: "ok" | "expiring" | "expired" | "unknown";
  _count: { appointments: number };
}

const SPECIES_OPTIONS = [
  { value: "", label: "כל הסוגים" },
  { value: "dog", label: "כלבים" },
  { value: "cat", label: "חתולים" },
  { value: "other", label: "אחר" },
];

const GENDER_LABELS: Record<string, string> = {
  male: "זכר",
  female: "נקבה",
};

const SPECIES_LABELS: Record<string, string> = {
  dog: "כלב",
  cat: "חתול",
  other: "אחר",
};

function SpeciesIcon({ species, className }: { species: string; className?: string }) {
  if (species === "dog") return <Dog className={cn("w-4 h-4", className)} />;
  if (species === "cat") return <Cat className={cn("w-4 h-4", className)} />;
  return <PawPrint className={cn("w-4 h-4", className)} />;
}

function VaccineBadge({ status }: { status: Pet["vaccinationStatus"] }) {
  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
        <AlertTriangle className="w-2.5 h-2.5" />
        חיסון פג
      </span>
    );
  }
  if (status === "expiring") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
        <Clock className="w-2.5 h-2.5" />
        חיסון פוקע
      </span>
    );
  }
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
        <CheckCircle2 className="w-2.5 h-2.5" />
        חיסון תקין
      </span>
    );
  }
  return null;
}

const GENDER_FILTER_OPTIONS = [
  { value: "", label: "כל המינים" },
  { value: "male", label: "זכרים" },
  { value: "female", label: "נקבות" },
];

const VACCINE_FILTER_OPTIONS = [
  { value: "", label: "כל החיסונים" },
  { value: "expired", label: "פג תוקף" },
  { value: "expiring", label: "עומד לפוג" },
  { value: "ok", label: "תקין" },
  { value: "unknown", label: "לא ידוע" },
];

export default function PetsPage() {
  const [search, setSearch] = useState("");
  const [species, setSpecies] = useState("");
  const [gender, setGender] = useState("");
  const [vaccineStatus, setVaccineStatus] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((window as any)._petSearchTimer);
    (window as any)._petSearchTimer = setTimeout(() => setDebouncedSearch(val), 300);
  };

  const params = new URLSearchParams();
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (species) params.set("species", species);

  const { data, isLoading, isError, refetch } = useQuery<{
    pets: Pet[];
    total: number;
  }>({
    queryKey: ["pets-all", debouncedSearch, species],
    queryFn: () => fetch(`/api/pets?${params.toString()}`).then((r) => r.json()),
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/pets/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pets-export.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("שגיאה בייצוא");
    } finally {
      setIsExporting(false);
    }
  };

  const pets = data?.pets ?? [];

  // Client-side filters (gender + vaccine status)
  const filteredPets = pets.filter((p) => {
    if (gender && p.gender !== gender) return false;
    if (vaccineStatus && p.vaccinationStatus !== vaccineStatus) return false;
    return true;
  });

  // Stats
  const vaccinationIssues = pets.filter(
    (p) => p.vaccinationStatus === "expired" || p.vaccinationStatus === "expiring"
  ).length;
  const withMeds = pets.filter((p) => p.activeMedicationCount > 0).length;
  const dogs = pets.filter((p) => p.species === "dog").length;
  const cats = pets.filter((p) => p.species === "cat").length;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">חיות מחמד</h1>
          <p className="text-sm text-petra-muted mt-1">
            כל החיות הרשומות בעסק
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="btn-secondary gap-2 inline-flex items-center"
          >
            <Download className="w-4 h-4" />
            {isExporting ? "מייצא..." : "ייצוא XLSX"}
          </button>
          <button onClick={() => refetch()} className="btn-secondary gap-2 inline-flex items-center">
            <RefreshCw className="w-4 h-4" />
            רענן
          </button>
        </div>
      </div>

      {/* Stats row */}
      {!isLoading && pets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
              <PawPrint className="w-4 h-4 text-brand-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-petra-text">{data?.total ?? 0}</p>
              <p className="text-xs text-petra-muted">חיות סה״כ</p>
            </div>
          </div>
          <div className="card p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Dog className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-petra-text">{dogs}</p>
              <p className="text-xs text-petra-muted">כלבים · {cats} חתולים</p>
            </div>
          </div>
          <div className="card p-3 flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", vaccinationIssues > 0 ? "bg-red-100" : "bg-emerald-100")}>
              <AlertTriangle className={cn("w-4 h-4", vaccinationIssues > 0 ? "text-red-500" : "text-emerald-500")} />
            </div>
            <div>
              <p className="text-xl font-bold text-petra-text">{vaccinationIssues}</p>
              <p className="text-xs text-petra-muted">בעיות חיסון</p>
            </div>
          </div>
          <div className="card p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Pill className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-petra-text">{withMeds}</p>
              <p className="text-xs text-petra-muted">עם תרופות פעילות</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted pointer-events-none" />
            <input
              className="input pr-9 w-full"
              placeholder="חפש לפי שם חיה, גזע, בעלים..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {SPECIES_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSpecies(opt.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                  species === opt.value
                    ? "bg-brand-500 text-white border-brand-500"
                    : "bg-white text-petra-muted border-slate-200 hover:border-brand-300"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2 flex-wrap">
            {GENDER_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGender(opt.value)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                  gender === opt.value
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white text-petra-muted border-slate-200 hover:border-blue-300"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {VACCINE_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setVaccineStatus(opt.value)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                  vaccineStatus === opt.value
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white text-petra-muted border-slate-200 hover:border-emerald-300"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {data && (
            <span className="text-sm text-petra-muted ms-auto">
              {filteredPets.length !== pets.length
                ? `${filteredPets.length} מתוך ${data.total}`
                : `${data.total}`}{" "}
              חיות
            </span>
          )}
        </div>
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="card p-10 text-center text-petra-muted text-sm">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin opacity-40" />
          טוען...
        </div>
      )}
      {isError && (
        <div className="card p-8 text-center text-red-500 text-sm">שגיאה בטעינת נתונים</div>
      )}
      {!isLoading && !isError && filteredPets.length === 0 && (
        <div className="card p-12 text-center">
          <PawPrint className="w-10 h-10 mx-auto mb-3 text-petra-muted opacity-30" />
          <p className="text-petra-muted text-sm">
            {debouncedSearch || species || gender || vaccineStatus ? "לא נמצאו חיות התואמות את הסינון" : "אין חיות רשומות עדיין"}
          </p>
        </div>
      )}

      {/* Pets table */}
      {!isLoading && filteredPets.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="table-header-cell">שם</th>
                  <th className="table-header-cell">גזע / סוג</th>
                  <th className="table-header-cell">בעלים</th>
                  <th className="table-header-cell">גיל / משקל</th>
                  <th className="table-header-cell">חיסון</th>
                  <th className="table-header-cell">תרופות</th>
                  <th className="table-header-cell">תורים</th>
                </tr>
              </thead>
              <tbody>
                {filteredPets.map((pet) => {
                  const ageStr = pet.birthDate
                    ? (() => {
                        const bd = new Date(pet.birthDate);
                        const now = new Date();
                        const months = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
                        if (months < 24) return `${months} חודשים`;
                        return `${Math.floor(months / 12)} שנים`;
                      })()
                    : null;

                  const parsedTags = pet.tags ? (() => { try { return JSON.parse(pet.tags!); } catch { return []; } })() : [];

                  return (
                    <tr key={pet.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                            <SpeciesIcon species={pet.species} className="text-brand-500" />
                          </div>
                          <div>
                            <Link
                              href={`/pets/${pet.id}`}
                              className="font-semibold text-petra-text hover:text-brand-600 transition-colors"
                            >
                              {pet.name}
                            </Link>
                            {pet.gender && (
                              <p className="text-[10px] text-petra-muted">
                                {GENDER_LABELS[pet.gender] ?? pet.gender}
                                {pet.health?.neuteredSpayed ? " · מסורס/עקור" : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="text-petra-text">{pet.breed || SPECIES_LABELS[pet.species] || pet.species}</span>
                        {pet.species && pet.breed && (
                          <span className="block text-[10px] text-petra-muted">{SPECIES_LABELS[pet.species] || pet.species}</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <Link
                          href={`/customers/${pet.customer.id}`}
                          className="text-brand-600 hover:underline font-medium"
                        >
                          {pet.customer.name}
                        </Link>
                        <p className="text-[10px] text-petra-muted mt-0.5">{pet.customer.phone}</p>
                      </td>
                      <td className="table-cell">
                        {ageStr && <span className="text-petra-text">{ageStr}</span>}
                        {pet.weight && (
                          <span className="block text-[10px] text-petra-muted">{pet.weight} ק״ג</span>
                        )}
                        {!ageStr && !pet.weight && <span className="text-petra-muted">—</span>}
                      </td>
                      <td className="table-cell">
                        <VaccineBadge status={pet.vaccinationStatus} />
                        {pet.vaccinationStatus === "unknown" && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-petra-muted">
                            <HelpCircle className="w-2.5 h-2.5" />
                            לא ידוע
                          </span>
                        )}
                      </td>
                      <td className="table-cell">
                        {pet.activeMedicationCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                            <Pill className="w-2.5 h-2.5" />
                            {pet.activeMedicationCount} תרופות
                          </span>
                        ) : (
                          <span className="text-petra-muted text-[10px]">—</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className="text-petra-text text-xs">{pet._count.appointments}</span>
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
