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
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate as formatDateL } from "@/lib/format";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { toast } from "sonner";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { EditPetModal } from "@/components/customers/detail/pet-modals";

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
  service: { name: string } | null;
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

// Labels: pets.petsDetailPage.status.<key>
const STATUS_CONFIG: Record<string, { className: string }> = {
  scheduled: { className: "badge-brand" },
  completed: { className: "badge-success" },
  canceled:  { className: "badge-danger" },
  checked_in:  { className: "badge-success" },
  checked_out: { className: "badge-neutral" },
  reserved:    { className: "badge-brand" },
  active:   { className: "badge-success" },
  completed_prog: { className: "badge-neutral" },
  paused:   { className: "badge-warning" },
};

type PetT = ReturnType<typeof useTranslations<"pets">>;

/** Badge for a status; unknown statuses show the raw value (as before). */
function statusBadge(t: PetT, ...keys: string[]): { label: string; className: string } | null {
  for (const key of keys) {
    const cfg = STATUS_CONFIG[key];
    if (cfg) return { label: t(`petsDetailPage.status.${key}`), className: cfg.className };
  }
  return null;
}

/** Same output as the old utils.formatDate for a he-IL business. */
function useFormatDay() {
  const { locale } = useBusinessLocale();
  return (d: Date | string) => formatDateL(d, { locale, style: "long" });
}

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
  const t = useTranslations("pets");
  const formatDate = useFormatDay();
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
          {t("petsDetailPage.weight.kg", { weight: sorted[sorted.length - 1].weight })}
        </span>
        <span>{formatDate(new Date(sorted[sorted.length - 1].recordedAt))}</span>
      </div>
    </div>
  );
}

// ─── Weight History Section ───────────────────────────────────────────────────

function WeightSection({ petId }: { petId: string }) {
  const t = useTranslations("pets");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const formatDate = useFormatDay();
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
        if (!r.ok) throw new Error(t("petsDetailPage.weight.error"));
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weight", petId] });
      setShowForm(false);
      setForm({ weight: "", recordedAt: new Date().toISOString().split("T")[0], notes: "" });
      toast.success(t("petsDetailPage.weight.added"));
    },
    onError: () => toast.error(t("petsDetailPage.weight.addError")),
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) =>
      fetch(`/api/pets/${petId}/weight?entryId=${entryId}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weight", petId] });
      toast.success(t("petsDetailPage.weight.deleted"));
    },
  });

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-petra-text flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-500" />
          {t("petsDetailPage.weight.title")}
          {entries.length > 0 && (
            <span className="text-xs font-normal text-petra-muted">
              {t("petsDetailPage.weight.count", { count: entries.length })}
            </span>
          )}
        </h2>
        <button
          onClick={() => setShowForm((p) => !p)}
          className="btn-secondary text-xs flex items-center gap-1 py-1 px-2"
        >
          <Plus className="w-3 h-3" />
          {t("petsDetailPage.weight.addEntry")}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-3 bg-slate-50 rounded-xl space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">{t("petsDetailPage.weight.weightLabel")}</label>
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
              <label className="label text-xs">{t("petsDetailPage.weight.dateLabel")}</label>
              <input
                className="input text-sm"
                type="date" lang={cfg.lang}
                value={form.recordedAt}
                onChange={(e) => setForm({ ...form, recordedAt: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label text-xs">{t("petsDetailPage.weight.notesLabel")}</label>
            <input
              className="input text-sm"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={t("petsDetailPage.weight.notesPlaceholder")}
            />
          </div>
          <div className="flex gap-2">
            <button
              className="btn-primary text-xs py-1.5 flex-1"
              disabled={!form.weight || addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              {addMutation.isPending ? tc("progress.saving") : tc("actions.add")}
            </button>
            <button className="btn-secondary text-xs py-1.5" onClick={() => setShowForm(false)}>
              {tc("actions.cancel")}
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 && !showForm ? (
        <p className="text-xs text-petra-muted text-center py-4">{t("petsDetailPage.weight.empty")}</p>
      ) : (
        <>
          <WeightChart entries={entries} />
          {entries.length > 0 && (
            <div className="mt-3 divide-y divide-slate-50">
              {entries.slice(0, 8).map((entry) => (
                <div key={entry.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm text-petra-text">{t("petsDetailPage.weight.kg", { weight: entry.weight })}</span>
                    <span className="text-xs text-petra-muted ms-2">
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
  const t = useTranslations("pets");
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
          toast.error(t("petsDetailPage.photos.tooLarge", { name: file.name }));
          continue;
        }
        const fd = new FormData();
        fd.append("file", file);
        fd.append("type", "photo");
        const res = await fetch(`/api/pets/${petId}/attachments`, { method: "POST", body: fd });
        if (!res.ok) throw new Error(t("petsDetailPage.photos.uploadError"));
      }
      queryClient.invalidateQueries({ queryKey: ["pet", petId] });
      toast.success(t("petsDetailPage.photos.uploaded"));
    } catch {
      toast.error(t("petsDetailPage.photos.uploadFailed"));
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
      toast.success(t("petsDetailPage.photos.deleted"));
    } catch {
      toast.error(t("petsDetailPage.photos.deleteError"));
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-petra-text flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-sky-500" />
          {t("petsDetailPage.photos.title")}
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
          {uploading ? t("petsDetailPage.photos.uploading") : t("petsDetailPage.photos.add")}
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
          <p className="text-xs text-petra-muted">{t("petsDetailPage.photos.clickToUpload")}</p>
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
                className="absolute top-1 end-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
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
            className="absolute top-4 start-4 text-white hover:text-slate-300"
            onClick={() => setLightboxIdx(null)}
          >
            <X className="w-6 h-6" />
          </button>
          {lightboxIdx > 0 && (
            <button
              className="absolute start-4 top-1/2 -translate-y-1/2 text-white hover:text-slate-300"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i! - 1 + photos.length) % photos.length); }}
            >
              <ChevronRight className="w-8 h-8 ltr:-scale-x-100" />
            </button>
          )}
          {lightboxIdx < photos.length - 1 && (
            <button
              className="absolute end-4 top-1/2 -translate-y-1/2 text-white hover:text-slate-300"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i! + 1) % photos.length); }}
            >
              <ChevronLeft className="w-8 h-8 ltr:-scale-x-100" />
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
  const t = useTranslations("pets");
  const formatDate = useFormatDay();

  const { data: pet, isLoading, isError, refetch } = useQuery<Pet>({
    queryKey: ["pet", params.id],
    queryFn: () => fetch(`/api/pets/${params.id}`).then((r) => r.json()),
    staleTime: 60000,
  });
  const [showEdit, setShowEdit] = useState(false);

  if (isLoading) {
    return <PetraLoader />;
  }

  if (isError || !pet) {
    return (
      <div className="p-6">
        <div className="card p-10 text-center text-red-500">{t("petsDetailPage.loadError")}</div>
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
          <ArrowRight className="w-5 h-5 ltr:-scale-x-100" />
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
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
            >
              <Pencil className="w-3.5 h-3.5" />
              {t("petsDetailPage.header.editDetails")}
            </button>
            {pet.breed && <span className="text-petra-muted text-sm">({pet.breed})</span>}
            {activeMeds.length > 0 && (
              <span className="badge badge-warning gap-1 flex items-center text-xs">
                <Pill className="w-3 h-3" /> {t("petsDetailPage.header.medsCount", { count: activeMeds.length })}
              </span>
            )}
            {(rabiesExpired || rabiesExpiringSoon) && (
              <span className={cn("badge text-xs flex items-center gap-1", rabiesExpired ? "badge-danger" : "badge-warning")}>
                <Syringe className="w-3 h-3" />
                {rabiesExpired ? t("petsDetailPage.header.vaccineExpired") : t("petsDetailPage.header.vaccineExpiring")}
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
                    <span dir="ltr" className="whitespace-nowrap">{pet.customer.phone}</span>
                  </a>
                )}
              </>
            ) : (
              <span className="text-sm text-petra-muted">{t("petsDetailPage.header.noCustomer")}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-secondary flex items-center gap-1.5 text-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t("petsDetailPage.header.refresh")}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: info */}
        <div className="space-y-5 lg:col-span-1">
          {/* Basic info card */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-bold text-petra-text flex items-center gap-2">
              <PawPrint className="w-4 h-4 text-brand-500" />
              {t("petsDetailPage.info.title")}
            </h2>
            <dl className="space-y-2.5 text-sm">
              {[
                { label: t("petsDetailPage.info.gender"), value: pet.gender === "male" ? t("petsDetailPage.info.male") : pet.gender === "female" ? t("petsDetailPage.info.female") : null },
                { label: t("petsDetailPage.info.birthDate"), value: pet.birthDate ? formatDate(new Date(pet.birthDate)) : null },
                { label: t("petsDetailPage.info.weight"), value: pet.weight ? t("petsDetailPage.weight.kg", { weight: pet.weight }) : null },
                { label: t("petsDetailPage.info.microchip"), value: pet.microchip },
                { label: t("petsDetailPage.info.neutered"), value: pet.health?.neuteredSpayed ? t("petsDetailPage.info.yes") : null },
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
                {tags.map((tag) => (
                  <span key={tag} className="badge badge-neutral text-xs">{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Health card */}
          {pet.health && (
            <div className="card p-5 space-y-3">
              <h2 className="text-sm font-bold text-petra-text flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500" />
                {t("petsDetailPage.health.title")}
              </h2>
              <dl className="space-y-2 text-sm">
                {[
                  { label: t("petsDetailPage.health.rabiesValid"), value: pet.health.rabiesValidUntil ? formatDate(new Date(pet.health.rabiesValidUntil)) : null, warn: rabiesExpired || rabiesExpiringSoon },
                  { label: t("petsDetailPage.health.dhpp"), value: pet.health.dhppLastDate ? formatDate(new Date(pet.health.dhppLastDate)) : null },
                  { label: t("petsDetailPage.health.deworming"), value: pet.health.dewormingLastDate ? formatDate(new Date(pet.health.dewormingLastDate)) : null },
                  { label: t("petsDetailPage.health.vetName"), value: pet.health.vetName },
                  { label: t("petsDetailPage.health.vetPhone"), value: pet.health.vetPhone },
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
                  <p className="text-xs text-petra-muted mb-1">{t("petsDetailPage.health.medicalConditions")}</p>
                  <p className="text-sm text-petra-text">{pet.health.medicalConditions}</p>
                </div>
              )}
              {pet.health.allergies && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-petra-muted mb-1">{t("petsDetailPage.health.allergies")}</p>
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
                {t("petsDetailPage.notes.title")}
              </h2>
              {pet.medicalNotes && (
                <div>
                  <p className="text-xs text-petra-muted mb-1">{t("petsDetailPage.notes.medical")}</p>
                  <p className="text-sm text-petra-text">{pet.medicalNotes}</p>
                </div>
              )}
              {pet.foodNotes && (
                <div>
                  <p className="text-xs text-petra-muted mb-1">{t("petsDetailPage.notes.food")}</p>
                  <p className="text-sm text-petra-text">{pet.foodNotes}</p>
                </div>
              )}
              {pet.behaviorNotes && (
                <div>
                  <p className="text-xs text-petra-muted mb-1">{t("petsDetailPage.notes.behavior")}</p>
                  <p className="text-sm text-petra-text">{pet.behaviorNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Behavior */}
          {pet.behavior && (() => {
            const alerts = [
              pet.behavior.dogAggression && t("petsDetailPage.behavior.dogAggression"),
              pet.behavior.humanAggression && t("petsDetailPage.behavior.humanAggression"),
              pet.behavior.biteHistory && t("petsDetailPage.behavior.biteHistory"),
              pet.behavior.leashPulling && t("petsDetailPage.behavior.leashPulling"),
              pet.behavior.leashReactivity && t("petsDetailPage.behavior.leashReactivity"),
              pet.behavior.separationAnxiety && t("petsDetailPage.behavior.separationAnxiety"),
              pet.behavior.excessiveBarking && t("petsDetailPage.behavior.excessiveBarking"),
              pet.behavior.resourceGuarding && t("petsDetailPage.behavior.resourceGuarding"),
              pet.behavior.fears && t("petsDetailPage.behavior.fears"),
              pet.behavior.badWithKids && t("petsDetailPage.behavior.badWithKids"),
              pet.behavior.destruction && t("petsDetailPage.behavior.destruction"),
              pet.behavior.houseSoiling && t("petsDetailPage.behavior.houseSoiling"),
            ].filter(Boolean) as string[];
            const positives = [
              pet.behavior.priorTraining && t("petsDetailPage.behavior.priorTraining"),
            ].filter(Boolean) as string[];
            if (alerts.length === 0 && positives.length === 0) return null;
            return (
              <div className="card p-5 space-y-3">
                <h2 className="text-sm font-bold text-petra-text flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-violet-500" />
                  {t("petsDetailPage.behavior.title")}
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
                  {t("petsDetailPage.meds.title")}
                </h2>
                <Link
                  href="/medications"
                  className="text-xs text-brand-500 hover:text-brand-600"
                >
                  {t("petsDetailPage.meds.board")}
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
                            {active ? t("petsDetailPage.meds.active") : t("petsDetailPage.meds.ended")}
                          </span>
                        </div>
                        {m.instructions && (
                          <p className="text-xs text-petra-muted mt-0.5">{m.instructions}</p>
                        )}
                        {(m.startDate || m.endDate) && (
                          <p className="text-xs text-petra-muted mt-0.5">
                            {m.startDate && t("petsDetailPage.meds.from", { date: formatDate(new Date(m.startDate)) })}
                            {m.startDate && m.endDate && t("petsDetailPage.meds.until")}
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-petra-text flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-brand-500" />
                  {t("petsDetailPage.appointments.title", { count: pet.appointments.length })}
                </h2>
                <Link href="/calendar" className="text-xs text-brand-500 hover:text-brand-600 hover:underline">
                  {t("petsDetailPage.appointments.calendarLink")}
                </Link>
              </div>
              <div className="divide-y">
                {pet.appointments.map((a) => {
                  const cfg = statusBadge(t, a.status) ?? { label: a.status, className: "badge-neutral" };
                  return (
                    <div key={a.id} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-petra-text truncate">{a.service?.name ?? t("petsDetailPage.appointments.unknownService")}</p>
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-petra-text flex items-center gap-2">
                  <Hotel className="w-4 h-4 text-brand-500" />
                  {t("petsDetailPage.boarding.title", { count: pet.boardingStays.length })}
                </h2>
                <Link href="/boarding" className="text-xs text-brand-500 hover:text-brand-600 hover:underline">
                  {t("petsDetailPage.boarding.link")}
                </Link>
              </div>
              <div className="divide-y">
                {pet.boardingStays.map((s) => {
                  const cfg = statusBadge(t, s.status) ?? { label: s.status, className: "badge-neutral" };
                  return (
                    <div key={s.id} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors">
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-petra-text flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-brand-500" />
                  {t("petsDetailPage.training.title", { count: pet.trainingPrograms.length })}
                </h2>
                <Link href="/training" className="text-xs text-brand-500 hover:text-brand-600 hover:underline">
                  {t("petsDetailPage.training.link")}
                </Link>
              </div>
              <div className="divide-y">
                {pet.trainingPrograms.map((p) => {
                  const cfg = statusBadge(t, p.status, p.status + "_prog") ?? { label: p.status, className: "badge-neutral" };
                  return (
                    <Link
                      key={p.id}
                      href={`/training?program=${p.id}`}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors cursor-pointer block"
                    >
                      <div>
                        <p className="text-sm font-medium text-petra-text">{p.name}</p>
                        {p.startDate && (
                          <p className="text-xs text-petra-muted">{t("petsDetailPage.training.started", { date: formatDate(new Date(p.startDate)) })}</p>
                        )}
                      </div>
                      <span className={cn("badge text-xs", cfg.className)}>{cfg.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {pet.appointments.length === 0 && pet.boardingStays.length === 0 && pet.medications.length === 0 && (
            <div className="card p-10 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-petra-muted text-sm">{t("petsDetailPage.emptyHistory")}</p>
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <EditPetModal pet={pet} customerId={pet.customer?.id ?? null} onClose={() => setShowEdit(false)} />
      )}
    </div>
  );
}
