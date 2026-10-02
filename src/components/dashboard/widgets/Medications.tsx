"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PawPrint, ArrowLeft, Pill } from "lucide-react";



// ─── Medications Widget ───────────────────────────────────────────────────────

export function MedicationsWidget() {
  const { data } = useQuery<{ pets: { petName: string; customerName: string; medications: { medName: string }[] }[]; total: number }>({
    queryKey: ["dashboard-medications"],
    queryFn: () => fetch("/api/pets/medications?boarded=true").then((r) => {
      if (!r.ok) throw new Error("Failed");
      return r.json();
    }),
    staleTime: 120000,
  });

  const pets = data?.pets ?? [];
  if (pets.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
          <Pill className="w-4 h-4 text-violet-500" />
          תרופות – חיות בפנסיון
        </h2>
        <Link
          href="/medications"
          className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1"
        >
          לוח מלא
          <ArrowLeft className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-2">
        {pets.slice(0, 5).map((p) => (
          <div key={p.petName + p.customerName} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              <PawPrint className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
              <span className="text-sm font-medium text-petra-text truncate">{p.petName}</span>
              <span className="text-xs text-petra-muted truncate">({p.customerName})</span>
            </div>
            <div className="flex gap-1 flex-wrap justify-end">
              {p.medications.slice(0, 2).map((m) => (
                <span key={m.medName} className="badge badge-neutral text-[10px] truncate max-w-[100px]">{m.medName}</span>
              ))}
              {p.medications.length > 2 && (
                <span className="badge badge-neutral text-[10px]">+{p.medications.length - 2}</span>
              )}
            </div>
          </div>
        ))}
        {pets.length > 5 && (
          <p className="text-xs text-petra-muted text-center pt-1">
            ועוד {pets.length - 5} חיות נוספות
          </p>
        )}
      </div>
    </div>
  );
}
