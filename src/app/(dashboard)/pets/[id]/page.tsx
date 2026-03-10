"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState, useRef } from "react";
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
  Plus,
  Trash2,
  TrendingUp,
  X,
  ImageIcon,
  Upload,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

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
  dogAggression: boolean;
  humanAggression: boolean;
  leashReactivity: boolean;
  leashPulling: boolean;
  jumping: boolean;
  separationAnxiety: boolean;
  excessiveBarking: boolean;
  destruction: boolean;
  resourceGuarding: boolean;
  fears: boolean;
  badWithKids: boolean;
  houseSoiling: boolean;
  biteHistory: boolean;
  biteDetails: string | null;
  triggers: string | null;
  priorTraining: boolean;
  priorTrainingDetails: string | null;
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
  name: string;
  status: string;
  startDate: string | null;
}

interface WeightEntry {
  id: string;
  weight: number;
  recordedAt: string;
  notes: string | null;
}

interface PetAttachment {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  type: string;
  createdAt: string;
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
  attachments: string;
  customer: { id: string; name: string; phone: string; email: string | null } | null;
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

// ─── Weight Chart (inline SVG) ────────────────────────────────────────────────

function WeightChart({ entries }: { entries: WeightEntry[] }) {
  if (entries.length < 2) return null;

  const sorted = [...entries].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  ).slice(-12);

  const weights = sorted.map((e) => e.weight);
  const minW = Math.min(...weights) * 0.95;
  const maxW = Math.max(...weights) * 1.05;
  const range = maxW - minW || 1;

  const W = 280;
  const H = 80;
  const PAD = 10;

  const points = sorted.map((e, i) => {
    const x = PAD + (i / (sorted.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((e.weight - minW) / range) * (H - PAD * 2);
    return `${x},${y}`;
  });

  const polyline = points.join(" ");
  const lastPoint = points[points.length - 1].split(",");

  return (
    <div className="mt-3 bg-slate-50 rounded-xl p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16">
        <polyline
          points={polyline}
          fill="none"
          stroke="#6366f1"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {sorted.map((_, i) => {
          const [x, y] = points[i].split(",");
          return (
            <circle
              key={i}
              cx={parseFloat(x)}
              cy={parseFloat(y)}
              r="3"
              fill="#6366f1"
            />
          );
        })}
        <circle
          cx={parseFloat(lastPoint[0])}
          cy={parseFloat(lastPoint[1])}
          r="4"
          fill="#6366f1"
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-petra-muted mt-1">
        <span>{formatDate(new Date(sorted[0].recordedAt))}</span>
        <span className="font-medium text-brand-600">
          {sorted[sorted.length - 1].weight} ק"ג
        </span>
        <span>{formatDate(new Date(sorted[sorted.length - 1].recordedAt))}</span>
      </div>
    </div>
  );
}

// ─── Weight History Section ───────────────────────────────────────────────────

function WeightSection({ petId }: { petId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    weight: "",
    recordedAt: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const { data } = useQuery<{ entries: WeightEntry[] }>({
    queryKey: ["weight", petId],
    queryFn: () => fetch(`/api/pets/${petId}/weight`).then((r) => r.json()),
  });

  const entries = data?.entries ?? [];

  const addMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/pets/${petId}/weight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then(async (r) => {
        if (!r.ok) throw new Error("שגיאה");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weight", petId] });
      setShowForm(false);
      setForm({ weight: "", recordedAt: new Date().toISOString().split("T")[0], notes: "" });
      toast.success("מדידה נוספה");
    },
    onError: () => toast.error("שגיאה בהוספת מדידה"),
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) =>
      fetch(`/api/pets/${petId}/weight?entryId=${entryId}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weight", petId] });
      toast.success("מדידה נמחקה");
    },
  });

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-petra-text flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-500" />
          מעקב משקל
          {entries.length > 0 && (
            <span className="text-xs font-normal text-petra-muted">
              ({entries.length} מדידות)
            </span>
          )}
        </h2>
        <button
          onClick={() => setShowForm((p) => !p)}
          className="btn-secondary text-xs flex items-center gap-1 py-1 px-2"
        >
          <Plus className="w-3 h-3" />
          הוסף מדידה
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-3 bg-slate-50 rounded-xl space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">משקל (ק"ג) *</label>
              <input
                className="input text-sm"
                type="number"
                step="0.1"
                min="0.1"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                placeholder="0.0"
              />
            </div>
            <div>
              <label className="label text-xs">תאריך</label>
              <input
                className="input text-sm"
                type="date"
                value={form.recordedAt}
                onChange={(e) => setForm({ ...form, recordedAt: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label text-xs">הערות (אופציונלי)</label>
            <input
              className="input text-sm"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="הערות על המשקל..."
            />
          </div>
          <div className="flex gap-2">
            <button
              className="btn-primary text-xs py-1.5 flex-1"
              disabled={!form.weight || addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              {addMutation.isPending ? "שומר..." : "הוסף"}
            </button>
            <button className="btn-secondary text-xs py-1.5" onClick={() => setShowForm(false)}>
              ביטול
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 && !showForm ? (
        <p className="text-xs text-petra-muted text-center py-4">אין מדידות משקל עדיין</p>
      ) : (
        <>
          <WeightChart entries={entries} />
          {entries.length > 0 && (
            <div className="mt-3 divide-y divide-slate-50">
              {entries.slice(0, 8).map((entry) => (
                <div key={entry.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm text-petra-text">{entry.weight} ק"ג</span>
                    <span className="text-xs text-petra-muted mr-2">
                      {formatDate(new Date(entry.recordedAt))}
                    </span>
                    {entry.notes && (
                      <p className="text-xs text-petra-muted truncate">{entry.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(entry.id)}
                    className="text-petra-muted hover:text-red-500 transition-colors p-1"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Photo Gallery Section ─────────────────────────────────────────────────────

function PhotoGallery({ petId, attachmentsJson }: { petId: string; attachmentsJson: string }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const allAttachments: PetAttachment[] = (() => {
    try { return JSON.parse(attachmentsJson || "[]"); } catch { return []; }
  })();

  const photos = allAttachments.filter((a) =>
    a.mimeType?.startsWith("image/") || a.type === "profile_photo"
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    try {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} גדול מ-5MB`);
          continue;
        }
        const fd = new FormData();
        fd.append("file", file);
        fd.append("type", "photo");
        const res = await fetch(`/api/pets/${petId}/attachments`, { method: "POST", body: fd });
        if (!res.ok) throw new Error("שגיאה בהעלאה");
      }
      queryClient.invalidateQueries({ queryKey: ["pet", petId] });
      toast.success("תמונות הועלו בהצלחה");
    } catch {
      toast.error("שגיאה בהעלאת תמונות");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (photoId: string) => {
    const updated = allAttachments.filter((a) => a.id !== photoId);
    try {
      await fetch(`/api/pets/${petId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachments: JSON.stringify(updated) }),
      });
      queryClient.invalidateQueries({ queryKey: ["pet", petId] });
      toast.success("תמונה נמחקה");
    } catch {
      toast.error("שגיאה במחיקת תמונה");
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-petra-text flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-sky-500" />
          גלריית תמונות
          {photos.length > 0 && (
            <span className="text-xs font-normal text-petra-muted">({photos.length})</span>
          )}
        </h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="btn-secondary text-xs flex items-center gap-1 py-1 px-2"
        >
          <Upload className="w-3 h-3" />
          {uploading ? "מעלה..." : "הוסף תמונה"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {photos.length === 0 ? (
        <div
          className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-brand-300 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="text-xs text-petra-muted">לחץ להעלאת תמונות</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, idx) => (
            <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.name}
                className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                onClick={() => setLightboxIdx(idx)}
              />
              <button
                onClick={() => handleDelete(photo.id)}
                className="absolute top-1 left-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && photos[lightboxIdx] && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
          <button
            className="absolute top-4 right-4 text-white hover:text-slate-300"
            onClick={() => setLightboxIdx(null)}
          >
            <X className="w-6 h-6" />
          </button>
          {lightboxIdx > 0 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-slate-300"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i! - 1 + photos.length) % photos.length); }}
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}
          {lightboxIdx < photos.length - 1 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-slate-300"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i! + 1) % photos.length); }}
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[lightboxIdx].url}
            alt={photos[lightboxIdx].name}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-4 text-white text-sm opacity-70">
            {lightboxIdx + 1} / {photos.length}
          </p>
        </div>
      )}
    </div>
  );
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

  const allAttachments: PetAttachment[] = (() => {
    try { return JSON.parse(pet.attachments || "[]"); } catch { return []; }
  })();
  const hasPhotos = allAttachments.some((a) => a.mimeType?.startsWith("image/") || a.type === "profile_photo");
  const profilePhoto = allAttachments.find((a) => a.type === "profile_photo" || a.mimeType?.startsWith("image/"));

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/pets" className="text-petra-muted hover:text-petra-text transition-colors">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {profilePhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profilePhoto.url} alt={pet.name} className="w-full h-full object-cover" />
          ) : (
            <PawPrint className="w-7 h-7 text-brand-500" />
          )}
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
            {pet.customer ? (
              <>
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
              </>
            ) : (
              <span className="text-sm text-petra-muted">ללא לקוח משויך</span>
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
              pet.behavior.dogAggression && "אגרסיבי כלפי כלבים",
              pet.behavior.humanAggression && "אגרסיבי כלפי בני אדם",
              pet.behavior.biteHistory && "היסטוריית נשיכה",
              pet.behavior.leashPulling && "מושך רצועה",
              pet.behavior.leashReactivity && "ריאקטיבי ברצועה",
              pet.behavior.separationAnxiety && "חרדת נטישה",
              pet.behavior.excessiveBarking && "נביחות מוגזמות",
              pet.behavior.resourceGuarding && "שמירת משאבים",
              pet.behavior.fears && "פחדים",
              pet.behavior.badWithKids && "לא מתאים לילדים",
              pet.behavior.destruction && "הרסני",
              pet.behavior.houseSoiling && "מתלכלך בבית",
            ].filter(Boolean) as string[];
            const positives = [
              pet.behavior.priorTraining && "אילוף קודם",
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

        {/* Right column: history + new sections */}
        <div className="lg:col-span-2 space-y-5">
          {/* Weight History */}
          <WeightSection petId={pet.id} />

          {/* Photo Gallery */}
          <PhotoGallery petId={pet.id} attachmentsJson={pet.attachments} />

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
                        <p className="text-sm font-medium text-petra-text">{p.name}</p>
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
