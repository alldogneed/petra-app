"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  PawPrint,
  User,
  Phone,
  Calendar,
  Weight,
  Pill,
  Hotel,
  GraduationCap,
  ArrowRight,
  Syringe,
  Heart,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
} from "lucide-react";
import { cn, formatDate, formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DogHealth {
  rabiesLastDate: string | null;
  rabiesValidUntil: string | null;
  dhppLastDate: string | null;
  dewormingLastDate: string | null;
  neuteredSpayed: boolean;
  medicalConditions: string | null;
  allergies: string | null;
  vetName: string | null;
  vetPhone: string | null;
}

interface DogBehavior {
  isAggressive: boolean;
  isFearful: boolean;
  isHyperactive: boolean;
  isGoodWithDogs: boolean | null;
  isGoodWithCats: boolean | null;
  isGoodWithKids: boolean | null;
  pullsOnLeash: boolean;
  biteHistory: boolean;
  notes: string | null;
  behavioralTags: string | null;
}

interface Medication {
  id: string;
  medName: string;
  dosage: string | null;
  frequency: string | null;
  times: string | null;
  instructions: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  service: { name: string };
}

interface BoardingStay {
  id: string;
  checkIn: string;
  checkOut: string | null;
  status: string;
  room: { name: string } | null;
}

interface TrainingProgram {
  id: string;
  title: string;
  status: string;
  startDate: string | null;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  birthDate: string | null;
  weight: number | null;
  gender: string | null;
  microchip: string | null;
  medicalNotes: string | null;
  foodNotes: string | null;
  behaviorNotes: string | null;
  tags: string;
  customer: { id: string; name: string; phone: string; email: string | null };
  health: DogHealth | null;
  behavior: DogBehavior | null;
  medications: Medication[];
  appointments: Appointment[];
  boardingStays: BoardingStay[];
  trainingPrograms: TrainingProgram[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  scheduled: { label: "מתוכנן", className: "badge-brand" },
  completed: { label: "הושלם", className: "badge-success" },
  canceled:  { label: "בוטל",  className: "badge-danger" },
  checked_in:  { label: "נמצא", className: "badge-success" },
  checked_out: { label: "יצא",  className: "badge-neutral" },
  reserved:    { label: "שמור", className: "badge-brand" },
  active:   { label: "פעיל",   className: "badge-success" },
  completed_prog: { label: "הושלם", className: "badge-neutral" },
  paused:   { label: "מושהה", className: "badge-warning" },
};

function isVaccineExpiringSoon(date: string | null): boolean {
  if (!date) return false;
  const diff = (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 30;
}

function isVaccineExpired(date: string | null): boolean {
  if (!date) return false;
  return new Date(date).getTime() < Date.now();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PetProfilePage() {
  const params = useParams<{ id: string }>();

  const { data: pet, isLoading, isError, refetch } = useQuery<Pet>({
    queryKey: ["pet", params.id],
    queryFn: () => fetch(`/api/pets/${params.id}`).then((r) => r.json()),
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-petra-muted" />
      </div>
    );
  }

  if (isError || !pet) {
    return (
      <div className="p-6">
        <div className="card p-10 text-center text-red-500">שגיאה בטעינת פרטי החיה</div>
      </div>
    );
  }

  const tags: string[] = (() => {
    try { return JSON.parse(pet.tags) as string[]; } catch { return []; }
  })();

  const activeMeds = pet.medications.filter(
    (m) => !m.endDate || new Date(m.endDate) >= new Date()
  );

  const rabiesExpiringSoon = isVaccineExpiringSoon(pet.health?.rabiesValidUntil ?? null);
  const rabiesExpired = isVaccineExpired(pet.health?.rabiesValidUntil ?? null);

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/pets" className="text-petra-muted hover:text-petra-text transition-colors">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center flex-shrink-0">
          <PawPrint className="w-7 h-7 text-brand-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-petra-text">{pet.name}</h1>
            {pet.breed && <span className="text-petra-muted text-sm">({pet.breed})</span>}
            {activeMeds.length > 0 && (
              <span className="badge badge-warning gap-1 flex items-center text-xs">
                <Pill className="w-3 h-3" /> {activeMeds.length} תרופות
              </span>
            )}
            {(rabiesExpired || rabiesExpiringSoon) && (
              <span className={cn("badge text-xs flex items-center gap-1", rabiesExpired ? "badge-danger" : "badge-warning")}>
                <Syringe className="w-3 h-3" />
                {rabiesExpired ? "חיסון פג תוקף" : "חיסון עומד לפוג"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <Link
              href={`/customers/${pet.customer.id}`}
              className="flex items-center gap-1 text-sm text-brand-600 hover:underline"
            >
              <User className="w-3.5 h-3.5" />
              {pet.customer.name}
            </Link>
            {pet.customer.phone && (
              <a
                href={`tel:${pet.customer.phone}`}
                className="flex items-center gap-1 text-sm text-petra-muted hover:text-petra-text"
              >
                <Phone className="w-3.5 h-3.5" />
                {pet.customer.phone}
              </a>
            )}
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-secondary flex items-center gap-1.5 text-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          רענן
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: info */}
        <div className="space-y-5 lg:col-span-1">
          {/* Basic info card */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-bold text-petra-text flex items-center gap-2">
              <PawPrint className="w-4 h-4 text-brand-500" />
              פרטי חיה
            </h2>
            <dl className="space-y-2.5 text-sm">
              {[
                { label: "מין", value: pet.gender === "male" ? "זכר" : pet.gender === "female" ? "נקבה" : null },
                { label: "תאריך לידה", value: pet.birthDate ? formatDate(new Date(pet.birthDate)) : null },
                { label: "משקל", value: pet.weight ? `${pet.weight} ק"ג` : null },
                { label: "מיקרוצ'יפ", value: pet.microchip },
                { label: "מסורס/עקור", value: pet.health?.neuteredSpayed ? "כן" : null },
              ]
                .filter((r) => r.value)
                .map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-2">
                    <dt className="text-petra-muted">{label}</dt>
                    <dd className="font-medium text-petra-text">{value}</dd>
                  </div>
                ))}
            </dl>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1 border-t">
                {tags.map((t) => (
                  <span key={t} className="badge badge-neutral text-xs">{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* Health card */}
          {pet.health && (
            <div className="card p-5 space-y-3">
              <h2 className="text-sm font-bold text-petra-text flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500" />
                בריאות
              </h2>
              <dl className="space-y-2 text-sm">
                {[
                  { label: "כלבת – תוקף", value: pet.health.rabiesValidUntil ? formatDate(new Date(pet.health.rabiesValidUntil)) : null, warn: rabiesExpired || rabiesExpiringSoon },
                  { label: "חיסון מחלות", value: pet.health.dhppLastDate ? formatDate(new Date(pet.health.dhppLastDate)) : null },
                  { label: "תילוע", value: pet.health.dewormingLastDate ? formatDate(new Date(pet.health.dewormingLastDate)) : null },
                  { label: "רופא וטרינר", value: pet.health.vetName },
                  { label: "טלפון וטרינר", value: pet.health.vetPhone },
                ]
                  .filter((r) => r.value)
                  .map(({ label, value, warn }) => (
                    <div key={label} className="flex justify-between gap-2">
                      <dt className="text-petra-muted">{label}</dt>
                      <dd className={cn("font-medium", warn ? "text-amber-600" : "text-petra-text")}>{value}</dd>
                    </div>
                  ))}
              </dl>
              {pet.health.medicalConditions && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-petra-muted mb-1">מצבים רפואיים</p>
                  <p className="text-sm text-petra-text">{pet.health.medicalConditions}</p>
                </div>
              )}
              {pet.health.allergies && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-petra-muted mb-1">אלרגיות</p>
                  <p className="text-sm text-petra-text text-amber-600">{pet.health.allergies}</p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {(pet.medicalNotes || pet.foodNotes || pet.behaviorNotes) && (
            <div className="card p-5 space-y-3">
              <h2 className="text-sm font-bold text-petra-text flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                הערות
              </h2>
              {pet.medicalNotes && (
                <div>
                  <p className="text-xs text-petra-muted mb-1">רפואי</p>
                  <p className="text-sm text-petra-text">{pet.medicalNotes}</p>
                </div>
              )}
              {pet.foodNotes && (
                <div>
                  <p className="text-xs text-petra-muted mb-1">אוכל</p>
                  <p className="text-sm text-petra-text">{pet.foodNotes}</p>
                </div>
              )}
              {pet.behaviorNotes && (
                <div>
                  <p className="text-xs text-petra-muted mb-1">התנהגות</p>
                  <p className="text-sm text-petra-text">{pet.behaviorNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Behavior */}
          {pet.behavior && (() => {
            const alerts = [
              pet.behavior.isAggressive && "אגרסיבי",
              pet.behavior.isFearful && "פחדן",
              pet.behavior.biteHistory && "היסטוריית נשיכה",
              pet.behavior.pullsOnLeash && "מושך רצועה",
            ].filter(Boolean) as string[];
            const positives = [
              pet.behavior.isGoodWithDogs === true && "מסתדר עם כלבים",
              pet.behavior.isGoodWithCats === true && "מסתדר עם חתולים",
              pet.behavior.isGoodWithKids === true && "מסתדר עם ילדים",
            ].filter(Boolean) as string[];
            if (alerts.length === 0 && positives.length === 0) return null;
            return (
              <div className="card p-5 space-y-3">
                <h2 className="text-sm font-bold text-petra-text flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-violet-500" />
                  התנהגות
                </h2>
                {alerts.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {alerts.map((a) => (
                      <span key={a} className="badge badge-danger text-xs">{a}</span>
                    ))}
                  </div>
                )}
                {positives.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {positives.map((a) => (
                      <span key={a} className="badge badge-success text-xs">{a}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Right column: history */}
        <div className="lg:col-span-2 space-y-5">
          {/* Medications */}
          {pet.medications.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-petra-text flex items-center gap-2">
                  <Pill className="w-4 h-4 text-violet-500" />
                  תרופות
                </h2>
                <Link
                  href="/medications"
                  className="text-xs text-brand-500 hover:text-brand-600"
                >
                  לוח תרופות
                </Link>
              </div>
              <div className="divide-y">
                {pet.medications.map((m) => {
                  const active = !m.endDate || new Date(m.endDate) >= new Date();
                  return (
                    <div key={m.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-petra-text">{m.medName}</span>
                          {m.dosage && <span className="text-xs text-petra-muted">{m.dosage}</span>}
                          {m.frequency && <span className="badge badge-neutral text-[10px]">{m.frequency}</span>}
                          <span className={cn("badge text-[10px]", active ? "badge-success" : "badge-neutral")}>
                            {active ? "פעיל" : "הסתיים"}
                          </span>
                        </div>
                        {m.instructions && (
                          <p className="text-xs text-petra-muted mt-0.5">{m.instructions}</p>
                        )}
                        {(m.startDate || m.endDate) && (
                          <p className="text-xs text-petra-muted mt-0.5">
                            {m.startDate && `מ-${formatDate(new Date(m.startDate))}`}
                            {m.startDate && m.endDate && " עד "}
                            {m.endDate && formatDate(new Date(m.endDate))}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Appointments */}
          {pet.appointments.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-bold text-petra-text flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-brand-500" />
                היסטוריית תורים ({pet.appointments.length})
              </h2>
              <div className="divide-y">
                {pet.appointments.map((a) => {
                  const cfg = STATUS_CONFIG[a.status] ?? { label: a.status, className: "badge-neutral" };
                  return (
                    <div key={a.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-petra-text truncate">{a.service.name}</p>
                          <p className="text-xs text-petra-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(new Date(a.date))} · {a.startTime}–{a.endTime}
                          </p>
                        </div>
                      </div>
                      <span className={cn("badge text-xs", cfg.className)}>{cfg.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Boarding stays */}
          {pet.boardingStays.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-bold text-petra-text flex items-center gap-2 mb-4">
                <Hotel className="w-4 h-4 text-brand-500" />
                היסטוריית פנסיון ({pet.boardingStays.length})
              </h2>
              <div className="divide-y">
                {pet.boardingStays.map((s) => {
                  const cfg = STATUS_CONFIG[s.status] ?? { label: s.status, className: "badge-neutral" };
                  return (
                    <div key={s.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-petra-text">
                          {formatDate(new Date(s.checkIn))}
                          {s.checkOut && ` → ${formatDate(new Date(s.checkOut))}`}
                        </p>
                        {s.room && (
                          <p className="text-xs text-petra-muted">{s.room.name}</p>
                        )}
                      </div>
                      <span className={cn("badge text-xs", cfg.className)}>{cfg.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Training programs */}
          {pet.trainingPrograms.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-bold text-petra-text flex items-center gap-2 mb-4">
                <GraduationCap className="w-4 h-4 text-brand-500" />
                תוכניות אימון ({pet.trainingPrograms.length})
              </h2>
              <div className="divide-y">
                {pet.trainingPrograms.map((p) => {
                  const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG[p.status + "_prog"] ?? { label: p.status, className: "badge-neutral" };
                  return (
                    <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-petra-text">{p.title}</p>
                        {p.startDate && (
                          <p className="text-xs text-petra-muted">התחיל: {formatDate(new Date(p.startDate))}</p>
                        )}
                      </div>
                      <span className={cn("badge text-xs", cfg.className)}>{cfg.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {pet.appointments.length === 0 && pet.boardingStays.length === 0 && pet.medications.length === 0 && (
            <div className="card p-10 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-petra-muted text-sm">אין היסטוריה עדיין לחיה זו</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
