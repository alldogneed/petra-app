"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed,
  Pill,
  Footprints,
  StickyNote,
  Check,
  X,
  PawPrint,
  ClipboardCheck,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BoardingTabs } from "@/components/boarding/BoardingTabs";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CareLog {
  id: string;
  type: string;
  title: string;
  notes: string | null;
  doneAt: string;
  doneByUserId: string | null;
}

interface Medication {
  id: string;
  medName: string;
  dosage: string | null;
  frequency: string | null;
  times: string | null;
  instructions: string | null;
}

interface Pet {
  id: string;
  name: string;
  breed: string | null;
  species: string;
  foodNotes: string | null;
  foodBrand: string | null;
  foodGramsPerDay: number | null;
  foodFrequency: string | null;
  medicalNotes: string | null;
  medications: Medication[];
}

interface Stay {
  id: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
  notes: string | null;
  feedingPlan: string | null;
  room: { id: string; name: string; pricePerNight: number | null } | null;
  pet: Pet;
  customer: { id: string; name: string; phone: string };
  careLogs: CareLog[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FREQ_TIMES: Record<string, string[]> = {
  once:  ["08:00"],
  twice: ["08:00", "18:00"],
  three: ["08:00", "13:00", "18:00"],
  four:  ["08:00", "11:00", "15:00", "18:00"],
};

const HE_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: React.FC<{ className?: string; style?: React.CSSProperties }> }> = {
  FEEDING:    { label: "האכלה",  color: "#F97316", bg: "#FFF7ED", Icon: UtensilsCrossed },
  MEDICATION: { label: "תרופה",  color: "#8B5CF6", bg: "#F5F3FF", Icon: Pill            },
  WALK:       { label: "טיול",   color: "#10B981", bg: "#ECFDF5", Icon: Footprints      },
  NOTE:       { label: "הערה",   color: "#64748B", bg: "#F8FAFC", Icon: StickyNote      },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateHe(dateStr: string) {
  const d = new Date(dateStr);
  const day = HE_DAYS[d.getDay()];
  return `${day}, ${d.toLocaleDateString("he-IL", { day: "numeric", month: "long" })}`;
}

function addDays(dateStr: string, delta: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function parseFeedingTimes(feedingPlan: string | null, foodFrequency: string | null): string[] {
  // If there's a structured feedingPlan JSON, try to extract frequency
  if (feedingPlan) {
    try {
      const parsed = JSON.parse(feedingPlan);
      if (parsed.frequency && FREQ_TIMES[parsed.frequency]) return FREQ_TIMES[parsed.frequency];
    } catch { /* ignore */ }
  }
  // Fall back to pet's foodFrequency field
  if (foodFrequency && FREQ_TIMES[foodFrequency]) return FREQ_TIMES[foodFrequency];
  return FREQ_TIMES["twice"]; // default
}

// ─── NoteModal ────────────────────────────────────────────────────────────────

function NoteModal({
  stayId,
  petId,
  onClose,
  onSave,
}: {
  stayId: string;
  petId: string;
  onClose: () => void;
  onSave: (type: string, title: string, notes: string) => void;
}) {
  const [type, setType] = useState<"WALK" | "NOTE">("NOTE");
  const [notes, setNotes] = useState("");

  const typeLabels: Array<{ value: "WALK" | "NOTE"; label: string }> = [
    { value: "NOTE", label: "הערה" },
    { value: "WALK", label: "טיול" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-petra-text">הוסף רשומה</h3>
          <button onClick={onClose} className="text-petra-muted hover:text-petra-text">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-2 mb-3">
          {typeLabels.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                type === t.value ? "bg-brand-500 text-white" : "bg-slate-100 text-petra-muted"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <textarea
          className="input h-24 resize-none"
          placeholder={type === "WALK" ? "פרטי הטיול (אורך, התנהגות...)" : "הערה לצוות..."}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="btn-ghost flex-1">ביטול</button>
          <button
            className="btn-primary flex-1"
            disabled={!notes.trim()}
            onClick={() => {
              const title = type === "WALK" ? "טיול" : "הערה";
              onSave(type, title, notes);
              onClose();
            }}
          >
            שמור
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PetCareCard ──────────────────────────────────────────────────────────────

function PetCareCard({ stay, date, onLog, onDelete }: {
  stay: Stay;
  date: string;
  onLog: (boardingStayId: string, petId: string, type: string, title: string, notes?: string) => void;
  onDelete: (logId: string) => void;
}) {
  const [showNoteModal, setShowNoteModal] = useState(false);

  const feedingTimes = parseFeedingTimes(stay.feedingPlan, stay.pet.foodFrequency);
  const medications = stay.pet.medications;
  const logs = stay.careLogs;

  const isLoggedForKey = (key: string) =>
    logs.some((l) => l.title === key || l.type + ":" + l.title === key);

  // Check if feeding slot is logged
  const isFeedingLogged = (time: string) =>
    logs.some((l) => l.type === "FEEDING" && l.title === `האכלה ${time}`);

  // Check if medication slot is logged
  const isMedLogged = (medId: string, time?: string) =>
    logs.some((l) => l.type === "MEDICATION" && l.title.includes(medId + (time ? `@${time}` : "")));

  const logFeeding = (time: string) => {
    const title = `האכלה ${time}`;
    const existingLog = logs.find((l) => l.type === "FEEDING" && l.title === title);
    if (existingLog) {
      onDelete(existingLog.id);
    } else {
      const foodDesc = [
        stay.pet.foodBrand,
        stay.pet.foodGramsPerDay ? `${stay.pet.foodGramsPerDay}ג׳` : null,
        stay.pet.foodNotes,
      ].filter(Boolean).join(" • ");
      onLog(stay.id, stay.pet.id, "FEEDING", title, foodDesc || undefined);
    }
  };

  const logMedication = (med: Medication, time?: string) => {
    const titleKey = med.id + (time ? `@${time}` : "");
    const title = `${med.medName}${time ? ` ${time}` : ""}`;
    const existingLog = logs.find((l) => l.type === "MEDICATION" && l.title.includes(titleKey));
    if (existingLog) {
      onDelete(existingLog.id);
    } else {
      const desc = [med.dosage, med.instructions].filter(Boolean).join(" • ");
      onLog(stay.id, stay.pet.id, "MEDICATION", title, desc || undefined);
    }
  };

  const medTimes = (med: Medication): string[] => {
    if (!med.times) return [""];
    try {
      const parsed = JSON.parse(med.times);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* ignore */ }
    return [""];
  };

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <PawPrint className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-petra-text text-lg">{stay.pet.name}</span>
              {stay.pet.breed && <span className="text-xs text-petra-muted">{stay.pet.breed}</span>}
            </div>
            <div className="text-sm text-petra-muted">{stay.customer.name}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {stay.room && (
                <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {stay.room.name}
                </span>
              )}
              <span className={cn(
                "text-[11px] px-2 py-0.5 rounded-full font-medium",
                stay.status === "checked_in" ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"
              )}>
                {stay.status === "checked_in" ? "נמצא" : "הזמנה"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Feeding section */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-3">
          <UtensilsCrossed className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-petra-text">האכלות</span>
          {stay.pet.foodBrand && (
            <span className="text-xs text-petra-muted">• {stay.pet.foodBrand}</span>
          )}
          {stay.pet.foodGramsPerDay && (
            <span className="text-xs text-petra-muted">• {stay.pet.foodGramsPerDay}ג׳</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {feedingTimes.map((time) => {
            const done = isFeedingLogged(time);
            return (
              <button
                key={time}
                onClick={() => logFeeding(time)}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-xl border transition-all text-sm",
                  done
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-slate-50 border-slate-200 text-petra-text hover:bg-orange-50 hover:border-orange-200"
                )}
              >
                <span className="font-medium">{time}</span>
                {done ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                )}
              </button>
            );
          })}
        </div>
        {stay.pet.foodNotes && (
          <p className="text-xs text-petra-muted mt-2 bg-orange-50 px-2 py-1.5 rounded-lg">{stay.pet.foodNotes}</p>
        )}
      </div>

      {/* Medications section */}
      {medications.length > 0 && (
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <Pill className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-semibold text-petra-text">תרופות</span>
          </div>
          <div className="space-y-2">
            {medications.map((med) => {
              const times = medTimes(med);
              return (
                <div key={med.id} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-petra-text">{med.medName}</span>
                      {med.dosage && <span className="text-xs text-petra-muted">{med.dosage}</span>}
                    </div>
                    {med.instructions && <p className="text-xs text-petra-muted mt-0.5">{med.instructions}</p>}
                  </div>
                  <div className="p-2 grid grid-cols-2 gap-1.5">
                    {times.map((time, idx) => {
                      const done = isMedLogged(med.id, time || undefined);
                      return (
                        <button
                          key={idx}
                          onClick={() => logMedication(med, time || undefined)}
                          className={cn(
                            "flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-all text-sm",
                            done
                              ? "bg-purple-50 border-purple-200 text-purple-700"
                              : "bg-white border-slate-200 text-petra-text hover:bg-purple-50 hover:border-purple-200"
                          )}
                        >
                          <span className="font-medium">{time || "נתן"}</span>
                          {done ? (
                            <Check className="w-4 h-4 text-purple-600" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Walks & Notes button */}
      <div className="p-4 border-b border-slate-100">
        <button
          onClick={() => setShowNoteModal(true)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-slate-300 text-sm text-petra-muted hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50/30 transition-all"
        >
          <Footprints className="w-4 h-4" />
          הוסף טיול / הערה
        </button>
      </div>

      {/* Today's log timeline */}
      {logs.length > 0 && (
        <div className="p-4">
          <p className="text-xs font-semibold text-petra-muted mb-3">לוג היום</p>
          <div className="space-y-2">
            {logs.map((log) => {
              const cfg = TYPE_CONFIG[log.type] || TYPE_CONFIG.NOTE;
              const Icon = cfg.Icon;
              return (
                <div key={log.id} className="flex items-start gap-2.5 group">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: cfg.bg }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: cfg.color } as React.CSSProperties} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-petra-text">{log.title}</span>
                      <span className="text-[10px] text-petra-muted">{formatTime(log.doneAt)}</span>
                    </div>
                    {log.notes && <p className="text-xs text-petra-muted truncate">{log.notes}</p>}
                  </div>
                  <button
                    onClick={() => onDelete(log.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
                    title="בטל"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showNoteModal && (
        <NoteModal
          stayId={stay.id}
          petId={stay.pet.id}
          onClose={() => setShowNoteModal(false)}
          onSave={(type, title, notes) => onLog(stay.id, stay.pet.id, type, title, notes)}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DailyCarePage() {
  const [date, setDate] = useState(todayStr());
  const queryClient = useQueryClient();

  const { data: stays = [], isLoading, isFetching } = useQuery<Stay[]>({
    queryKey: ["care-log", date],
    queryFn: async () => {
      const r = await fetch(`/api/boarding/care-log?date=${date}`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const logMutation = useMutation({
    mutationFn: async (payload: {
      boardingStayId: string;
      petId: string;
      type: string;
      title: string;
      notes?: string;
    }) => {
      const r = await fetch("/api/boarding/care-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["care-log", date] });
    },
    onError: () => toast.error("שגיאה בשמירה. נסה שוב."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (logId: string) => {
      const r = await fetch(`/api/boarding/care-log/${logId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["care-log", date] });
    },
    onError: () => toast.error("שגיאה בביטול. נסה שוב."),
  });

  // Summary stats
  const summary = useMemo(() => {
    let feedingsDone = 0;
    let medicationsDone = 0;
    let walksDone = 0;
    for (const stay of stays) {
      for (const log of stay.careLogs) {
        if (log.type === "FEEDING") feedingsDone++;
        else if (log.type === "MEDICATION") medicationsDone++;
        else if (log.type === "WALK") walksDone++;
      }
    }
    return { total: stays.length, feedingsDone, medicationsDone, walksDone };
  }, [stays]);

  const isToday = date === todayStr();

  return (
    <div className="space-y-4">
      <BoardingTabs />

      {/* Date navigator */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setDate((d) => addDays(d, 1))}
          className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-petra-muted hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 text-center">
          <div className="font-bold text-petra-text">{formatDateHe(date)}</div>
          {isToday && <div className="text-xs text-brand-600 font-medium">היום</div>}
        </div>
        <button
          onClick={() => setDate((d) => addDays(d, -1))}
          className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-petra-muted hover:bg-slate-100 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        {!isToday && (
          <button
            onClick={() => setDate(todayStr())}
            className="text-xs px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
          >
            היום
          </button>
        )}
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["care-log", date] })}
          className={cn("w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-petra-muted hover:bg-slate-100 transition-colors", isFetching && "animate-spin")}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Summary strip */}
      {summary.total > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "כלבים", value: summary.total, color: "bg-slate-50 text-slate-600" },
            { label: "האכלות", value: summary.feedingsDone, color: "bg-orange-50 text-orange-600" },
            { label: "תרופות", value: summary.medicationsDone, color: "bg-purple-50 text-purple-600" },
            { label: "טיולים", value: summary.walksDone, color: "bg-green-50 text-green-600" },
          ].map((item) => (
            <div key={item.label} className={cn("rounded-xl p-3 text-center", item.color)}>
              <div className="text-2xl font-bold">{item.value}</div>
              <div className="text-xs font-medium">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 text-petra-muted">
          <RefreshCw className="w-5 h-5 animate-spin me-2" />
          טוען...
        </div>
      )}

      {/* Empty state */}
      {!isLoading && stays.length === 0 && (
        <div className="text-center py-16 text-petra-muted">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 mx-auto mb-4 flex items-center justify-center">
            <ClipboardCheck className="w-8 h-8 text-slate-400" />
          </div>
          <p className="font-semibold text-petra-text mb-1">אין כלבים בפנסיון</p>
          <p className="text-sm">לא נמצאו שהיות פעילות לתאריך זה</p>
        </div>
      )}

      {/* Pet cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {stays.map((stay) => (
          <PetCareCard
            key={stay.id}
            stay={stay}
            date={date}
            onLog={(boardingStayId, petId, type, title, notes) =>
              logMutation.mutate({ boardingStayId, petId, type, title, notes })
            }
            onDelete={(logId) => deleteMutation.mutate(logId)}
          />
        ))}
      </div>
    </div>
  );
}
