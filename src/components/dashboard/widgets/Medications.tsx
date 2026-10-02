"use client";
import { useQuery } from "@tanstack/react-query";
import { DashCard, DashCardHeader, DashLink, DashRow } from "@/components/dashboard/dash-ui";

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
    <DashCard>
      <DashCardHeader
        title="תרופות – חיות בפנסיון"
        actions={<DashLink href="/medications">לוח מלא</DashLink>}
      />
      {pets.slice(0, 5).map((p) => (
        <DashRow key={p.petName + p.customerName} className="justify-between">
          <span className="text-sm font-medium text-slate-900 truncate min-w-0">
            {p.petName}
            {p.customerName && <span className="font-normal text-xs text-slate-500"> · {p.customerName}</span>}
          </span>
          <span
            className="text-xs text-slate-600 text-left truncate min-w-0 max-w-[50%]"
            title={p.medications.map((m) => m.medName).join(", ")}
          >
            {p.medications.map((m) => m.medName).join(", ")}
          </span>
        </DashRow>
      ))}
      {pets.length > 5 && (
        <p className="m-0 py-2.5 border-t border-slate-100 text-xs text-slate-500">
          ועוד {pets.length - 5} חיות נוספות
        </p>
      )}
    </DashCard>
  );
}
