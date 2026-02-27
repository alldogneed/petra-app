"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import {
  Pill,
  Clock,
  PawPrint,
  RefreshCw,
  MessageCircle,
  CheckCircle2,
  Hotel,
  Filter,
} from "lucide-react";
import { cn, toWhatsAppPhone } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Medication {
  id: string;
  medName: string;
  dosage: string | null;
  frequency: string | null;
  times: string | null; // JSON array e.g. ["08:00","20:00"]
  instructions: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface PetMedications {
  petId: string;
  petName: string;
  species: string;
  breed: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  medications: Medication[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseTimes(timesJson: string | null): string[] {
  if (!timesJson) return [];
  try {
    const parsed = JSON.parse(timesJson);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // Might be a plain comma-separated string
    return timesJson.split(",").map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

function isEndingSoon(endDate: string | null): boolean {
  if (!endDate) return false;
  const daysLeft = Math.round(
    (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  return daysLeft >= 0 && daysLeft <= 3;
}

function buildWhatsApp(phone: string, petName: string, medName: string) {
  const msg = encodeURIComponent(
    `שלום! רצינו להזכיר לך שהכלב שלך ${petName} אמור לקבל את התרופה ${medName} כיום. 🐾`
  );
  return `https://wa.me/${toWhatsAppPhone(phone)}?text=${msg}`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MedicationsPage() {
  const [boardedOnly, setBoardedOnly] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery<{
    pets: PetMedications[];
    total: number;
  }>({
    queryKey: ["pet-medications", boardedOnly],
    queryFn: () =>
      fetch(`/api/pets/medications${boardedOnly ? "?boarded=true" : ""}`).then((r) =>
        r.json()
      ),
    staleTime: 60000,
  });

  const pets = (data?.pets ?? []).filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.petName.toLowerCase().includes(q) ||
      p.customerName.toLowerCase().includes(q) ||
      p.medications.some((m) => m.medName.toLowerCase().includes(q))
    );
  });

  // Group medications by time-of-day
  const allTimes = Array.from(
    new Set(
      pets.flatMap((p) =>
        p.medications.flatMap((m) => parseTimes(m.times))
      )
    )
  ).sort();

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">לוח תרופות</h1>
          <p className="text-sm text-petra-muted mt-1">
            חיות עם תרופות פעילות – לפי לוח זמנים יומי
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
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="חפש חיה, לקוח או תרופה..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full pr-9"
          />
          <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted pointer-events-none" />
        </div>
        <button
          onClick={() => setBoardedOnly((v) => !v)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all",
            boardedOnly
              ? "bg-brand-500 text-white border-brand-500"
              : "bg-white text-petra-muted border-slate-200 hover:border-brand-300"
          )}
        >
          <Hotel className="w-4 h-4" />
          רק חיות בפנסיון
        </button>
        {data && (
          <span className="ms-auto text-sm text-petra-muted">
            {pets.length} חיות,{" "}
            {pets.reduce((sum, p) => sum + p.medications.length, 0)} תרופות
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

      {!isLoading && !isError && pets.length === 0 && (
        <div className="card p-12 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400 opacity-60" />
          <p className="text-petra-muted text-sm">
            {boardedOnly
              ? "אין חיות בפנסיון עם תרופות פעילות"
              : "אין חיות עם תרופות פעילות"}
          </p>
        </div>
      )}

      {/* Time-based schedule (if times exist) */}
      {!isLoading && !isError && allTimes.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-petra-text flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-500" />
            לפי שעות מתן
          </h2>
          {allTimes.map((time) => {
            const entries = pets.flatMap((p) =>
              p.medications
                .filter((m) => parseTimes(m.times).includes(time))
                .map((m) => ({ pet: p, med: m }))
            );
            if (entries.length === 0) return null;
            return (
              <div key={time} className="card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-500" />
                  <span className="font-semibold text-brand-700 text-sm">{time}</span>
                  <span className="badge badge-brand mr-1">{entries.length}</span>
                </div>
                <div className="divide-y">
                  {entries.map(({ pet, med }) => (
                    <MedRow key={`${pet.petId}-${med.id}`} pet={pet} med={med} />
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* All medications without specific times */}
      {!isLoading && !isError && (() => {
        const noTimePets = pets.filter((p) =>
          p.medications.some((m) => parseTimes(m.times).length === 0)
        );
        if (noTimePets.length === 0) return null;
        return (
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-petra-text flex items-center gap-2">
              <Pill className="w-4 h-4 text-slate-500" />
              ללא שעה קבועה
            </h2>
            <div className="card divide-y">
              {noTimePets.flatMap((p) =>
                p.medications
                  .filter((m) => parseTimes(m.times).length === 0)
                  .map((m) => (
                    <MedRow key={`${p.petId}-${m.id}`} pet={p} med={m} />
                  ))
              )}
            </div>
          </section>
        );
      })()}
    </div>
  );
}

// ─── Med Row Component ────────────────────────────────────────────────────────

function MedRow({ pet, med }: { pet: PetMedications; med: Medication }) {
  const endingSoon = isEndingSoon(med.endDate);

  return (
    <div className="flex items-center justify-between py-3 px-1 gap-4 group">
      {/* Pet info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
          <PawPrint className="w-4 h-4 text-brand-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-petra-text">
            {pet.petName}
            {pet.breed && (
              <span className="text-petra-muted font-normal mr-1 text-xs">
                ({pet.breed})
              </span>
            )}
          </p>
          <Link
            href={`/customers/${pet.customerId}`}
            className="text-xs text-brand-600 hover:underline"
          >
            {pet.customerName}
          </Link>
        </div>
      </div>

      {/* Medication info */}
      <div className="flex-1 min-w-0 px-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-sm font-medium text-petra-text">
            <Pill className="w-3.5 h-3.5 text-violet-500" />
            {med.medName}
          </span>
          {med.dosage && (
            <span className="text-xs text-petra-muted">{med.dosage}</span>
          )}
          {med.frequency && (
            <span className="badge badge-neutral text-[10px]">{med.frequency}</span>
          )}
          {endingSoon && med.endDate && (
            <span className="badge badge-warning text-[10px]">
              נגמר ב-{new Date(med.endDate).toLocaleDateString("he-IL")}
            </span>
          )}
        </div>
        {med.instructions && (
          <p className="text-xs text-petra-muted mt-0.5 truncate">{med.instructions}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={buildWhatsApp(pet.customerPhone, pet.petName, med.medName)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200 text-xs font-medium"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          תזכורת
        </a>
        <Link
          href={`/customers/${pet.customerId}`}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors border border-brand-200 text-xs font-medium"
        >
          פרופיל
        </Link>
      </div>
    </div>
  );
}
