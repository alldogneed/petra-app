"use client";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { CheckCircle2, ArrowLeft, MessageCircle, ClipboardList, Syringe } from "lucide-react";
import { fetchJSON, cn, toWhatsAppPhone } from "@/lib/utils";



// ─── Birthday Widget ──────────────────────────────────────────────────────────

export interface VaccinationItem {
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

export function VaccinationAlertWidget() {
  const queryClient = useQueryClient();
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [taskedIds, setTaskedIds] = useState<Set<string>>(new Set());
  const { data } = useQuery<{ vaccinations: VaccinationItem[]; total: number }>({
    queryKey: ["pet-vaccinations"],
    queryFn: () => fetchJSON("/api/pets/vaccinations?days=30"),
  });

  const createTaskMutation = useMutation({
    mutationFn: (payload: { title: string; category: string; priority: string; dueDate: string }) =>
      fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה ביצירת משימה"); return d; }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  if (!data || data.total === 0) return null;

  return (
    <div className="card overflow-hidden" style={{ borderTop: "3px solid #8B5CF6" }}>
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 bg-violet-50/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-100">
            <Syringe className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-petra-text">חיסוני כלבת — התראות</h2>
            <p className="text-[11px] text-petra-muted">
              <span className="text-violet-600 font-medium">{data.total} חיות מחמד</span>{" "}
              עם חיסון פג תוקף / עומד לפוג
            </p>
          </div>
        </div>
        <Link
          href="/vaccinations"
          className="text-xs font-medium text-brand-500 hover:text-brand-600 flex items-center gap-1"
        >
          לכל החיסונים
          <ArrowLeft className="w-3 h-3" />
        </Link>
      </div>

      <div className="divide-y divide-slate-50">
        {data.vaccinations.map((v) => {
          const expiry = v.validUntil ? new Date(v.validUntil) : null;
          const expiryStr = expiry && !isNaN(expiry.getTime()) ? expiry.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" }) : "";
          const waMsg = `שלום ${v.customerName}! 💉\nחיסון ${v.vaccineLabel} של ${v.petName} ${v.isExpired ? "פג תוקפו" : `עומד לפוג בתאריך ${expiryStr}`}.\nנא לדאוג לחידוש החיסון בהקדם. 🐾`;
          const waLink = `https://wa.me/${toWhatsAppPhone(v.customerPhone)}?text=${encodeURIComponent(waMsg)}`;
          const sent = sentIds.has(v.petId);

          return (
            <div
              key={v.petId}
              className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors"
            >
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold",
                v.isExpired
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
              )}>
                {v.isExpired ? "!" : v.daysUntil}
              </div>

              <div className="flex-1 min-w-0">
                <Link href={v.customerId ? `/customers/${v.customerId}` : "/customers"} className="text-sm font-medium text-petra-text hover:text-brand-600 truncate block">
                  {v.petName}{v.customerName && <span className="font-normal text-petra-muted"> ({v.customerName})</span>}
                </Link>
                <div className={cn(
                  "text-[11px] font-medium",
                  v.isExpired ? "text-red-600" : "text-amber-600"
                )}>
                  {v.isExpired ? `פג תוקף ${expiryStr}` : `פג תוקף עוד ${v.daysUntil} ימים · ${expiryStr}`}
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {taskedIds.has(v.petId) ? (
                  <span className="text-xs text-violet-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    משימה
                  </span>
                ) : (
                  <button
                    className="w-7 h-7 rounded-md bg-violet-50 text-violet-600 hover:bg-violet-100 flex items-center justify-center transition-colors"
                    title="צור משימת תזכורת"
                    onClick={() => {
                      const dueDate = new Date();
                      dueDate.setDate(dueDate.getDate() + 1);
                      createTaskMutation.mutate({
                        title: `חידוש חיסון כלבת — ${v.petName} (${v.customerName})`,
                        category: "HEALTH",
                        priority: v.isExpired ? "URGENT" : "HIGH",
                        dueDate: dueDate.toISOString().slice(0, 10),
                      });
                      setTaskedIds((prev) => new Set([...prev, v.petId]));
                    }}
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                  </button>
                )}
                {v.customerPhone && (
                  sent ? (
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      נשלח
                    </span>
                  ) : (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-7 h-7 rounded-md bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors"
                      title="שלח תזכורת חיסון בוואטסאפ"
                      onClick={() => setSentIds((prev) => new Set([...prev, v.petId]))}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
