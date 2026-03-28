"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  PawPrint,
  Plus,
  X,
  CreditCard,
  GraduationCap,
  Pencil,
  MessageCircle,
  ExternalLink,
  Upload,
  FileText,
  Trash2,
  Download,
  Scissors,
  BookOpen,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FolderOpen,
  File,
  FileCheck,
  Image as ImageIcon,
  Heart,
  Pill,
  UtensilsCrossed,
  ShoppingCart,
  Link2,
  Send,
  CalendarClock,
  CheckCircle2,
  ListTodo,
  Loader2,
  MoreVertical,
  PenLine,
  Copy,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
const CreateOrderModal = dynamic(
  () => import("@/components/orders/CreateOrderModal").then((m) => ({ default: m.CreateOrderModal })),
  { ssr: false }
);
import { useAuth } from "@/providers/auth-provider";
import { usePlan } from "@/hooks/usePlan";
import { usePermissions } from "@/hooks/usePermissions";
import { triggerLimitModal } from "@/lib/limit-reached";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import {
  cn,
  formatDate,
  formatCurrency,
  getStatusColor,
  getStatusLabel,
  getTimelineIcon,
  toWhatsAppPhone,
  fetchJSON,
  copyToClipboard,
} from "@/lib/utils";
import { validateIsraeliPhone, validateEmail, sanitizeName, normalizeIsraeliPhone, validateName } from "@/lib/validation";

const DOG_BREEDS = [
  "גולדן רטריוור", "לברדור", "בורדר קולי", "ג'ק ראסל", "פודל", "צ'יוואווה",
  "ביגל", "בולדוג", "הסקי סיבירי", "בוקסר", "רוטוויילר", "גרמן שפרד",
  "מלמוט", "שנאוצר", "דלמציה", "דוברמן", "שיצו", "מלטזי",
  "יורקשייר טריאר", "פומרניאן", "קניש", "שפניאל", "ספינגר ספניאל",
  "קוקר ספניאל", "ויזסלה", "ויימרנר", "סמויד", "מלמוט אלסקי",
  "אמריקן בולי", "פיטבול", "אמריקן סטפורדשייר", "סטפורדשייר בול",
  "רידג'בק רודזיאני", "בסנג'י", "שרפיי", "אקיטה", "שיבה אינו",
  "צ'או צ'או", "ניופאונדלנד", "ברנר זנן הר", "גרייהאונד", "וויפט",
  "אפגן האונד", "סלוקי", "דוג דה בורדו", "מונגרל", "כלב כנעני", "מעורב",
  "פינשר", "דוברמן פינשר", "ארגנטינה דוגו", "קאנה קורסו", "ספינוני",
  "קאלי", "אוסטרלי שפרד", "קורגי", "פלוודה מוגת'", "שטלנד שפדוג'",
];

const CAT_BREEDS = [
  "פרסי", "מיין קון", "בריטי שורטהייר", "בנגלי", "סיאמי", "אביסיני",
  "בירמן", "ספינקס", "רגדול", "סקוטיש פולד", "נורבגי יערות",
  "מיקס", "ללא גזע ידוע",
];

function BreedCombobox({
  value,
  onChange,
  species,
}: {
  value: string;
  onChange: (v: string) => void;
  species: string;
}) {
  const [open, setOpen] = useState(false);
  const breeds = species === "dog" ? DOG_BREEDS : species === "cat" ? CAT_BREEDS : [];
  const filtered = breeds.filter((b) =>
    b.toLowerCase().includes(value.toLowerCase())
  );

  if (breeds.length === 0) {
    return (
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="הזן גזע"
      />
    );
  }

  return (
    <div className="relative">
      <input
        className="input"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="הזן או בחר גזע"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 right-0 left-0 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.slice(0, 12).map((breed) => (
            <button
              key={breed}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(breed); setOpen(false); }}
              className="w-full text-right px-3 py-2 text-sm hover:bg-brand-50 text-petra-text"
            >
              {breed}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const BEHAVIORAL_TAGS = [
  "ריאקטיבי",
  "תוקפן",
  "חרדת נטישה",
  "פחדן",
  "מאומץ",
  "ריאקטיבי בשרשרת",
  "שמירת משאבים",
  "ידידותי",
  "אנרגטי",
  "מאולף",
];

interface PetDoc {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

interface CustomerDoc {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  category: string;
  createdAt: string;
}

interface DogMedication {
  id: string;
  medName: string;
  dosage: string | null;
  frequency: string | null;
  times: string | null;
  instructions: string | null;
  startDate: string | null;
  endDate: string | null;
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
  tags: string;
  attachments: string;
  medicalNotes: string | null;
  foodNotes: string | null;
  foodBrand: string | null;
  foodGramsPerDay: number | null;
  foodFrequency: string | null;
  behaviorNotes: string | null;
  health: {
    neuteredSpayed: boolean | null;
    neuteredSpayedDate: string | null;
    allergies: string | null;
    medicalConditions: string | null;
    surgeriesHistory: string | null;
    activityLimitations: string | null;
    vetName: string | null;
    vetPhone: string | null;
    rabiesLastDate: string | null;
    rabiesValidUntil: string | null;
    dhppLastDate: string | null;
    dhppPuppy1Date: string | null;
    dhppPuppy2Date: string | null;
    dhppPuppy3Date: string | null;
    bordatellaDate: string | null;
    parkWormDate: string | null;
    dewormingLastDate: string | null;
    fleaTickType: string | null;
    fleaTickDate: string | null;
    fleaTickExpiryDate: string | null;
    originInfo: string | null;
    timeWithOwner: string | null;
  } | null;
  behavior: {
    dogAggression: boolean | null;
    humanAggression: boolean | null;
    leashReactivity: boolean | null;
    leashPulling: boolean | null;
    jumping: boolean | null;
    separationAnxiety: boolean | null;
    excessiveBarking: boolean | null;
    destruction: boolean | null;
    resourceGuarding: boolean | null;
    fears: boolean | null;
    badWithKids: boolean | null;
    houseSoiling: boolean | null;
    biteHistory: boolean | null;
    biteDetails: string | null;
    triggers: string | null;
    priorTraining: boolean | null;
    priorTrainingDetails: string | null;
    customIssues: string | null;
  } | null;
  medications: DogMedication[];
}

interface PaymentInfo {
  id: string;
  amount: number;
  method: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  appointment: { service: { name: string } } | null;
  boardingStay: { pet: { name: string }; room: { name: string } | null } | null;
}

interface TrainingGoal {
  id: string;
  title: string;
  status: string;
  progressPercent: number;
}

interface TrainingProgramInfo {
  id: string;
  dogId: string;
  name: string;
  programType: string;
  status: string;
  startDate: string | null;
  totalSessions: number | null;
  frequency: string | null;
  notes: string | null;
  dog: { name: string } | null;
  goals: TrainingGoal[];
  sessions: { id: string }[];
}

interface OrderLineInfo {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
}

interface OrderPaymentInfo {
  id: string;
  amount: number;
  status: string;
}

interface OrderInfo {
  id: string;
  orderType: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  taxTotal: number;
  total: number;
  notes: string | null;
  createdAt: string;
  lines: OrderLineInfo[];
  payments: OrderPaymentInfo[];
}

interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  idNumber: string | null;
  notes: string | null;
  tags: string;
  source: string | null;
  documents: string;
  createdAt: string;
  pets: Pet[];
  appointments: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    service: { name: string; color: string | null };
    pet: { name: string; species: string } | null;
  }[];
  payments: PaymentInfo[];
  orders: OrderInfo[];
  trainingPrograms: TrainingProgramInfo[];
  timelineEvents: {
    id: string;
    type: string;
    description: string;
    createdAt: string;
  }[];
}

function calcAge(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (totalMonths < 0) return null;
  if (totalMonths < 12) return `${totalMonths} חודשים`;
  const years = Math.floor(totalMonths / 12);
  return `${years} שנ׳`;
}

const MAX_UPLOAD_MB = 10;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Compress images client-side before upload (canvas → JPEG). PDFs/docs returned as-is. */
async function compressImage(file: File, maxPx = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  return new Promise((resolve) => {
    const img = document.createElement("img");
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      let { width, height } = img;
      if (width > maxPx) { height = Math.round((height * maxPx) / width); width = maxPx; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const out = new (File as any)([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg", lastModified: Date.now() }) as File;
        resolve(out.size < file.size ? out : file);
      }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(file); };
    img.src = blobUrl;
  });
}

// ─── Add Pet Modal ───────────────────────────────────────────────────────────

function AddPetModal({
  customerId,
  isOpen,
  onClose,
}: {
  customerId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [form, setForm] = useState({
    name: "",
    species: "dog",
    breed: "",
    gender: "",
    weight: "",
    birthDate: "",
    microchip: "",
    neuteredSpayed: false,
    behavioralTags: [] as string[],
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch(`/api/customers/${customerId}/pets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create pet");
      const pet = await res.json();

      if (profilePhoto) {
        setUploadStatus("מעלה תמונת פרופיל...");
        const fd = new FormData();
        fd.append("file", profilePhoto);
        fd.append("type", "profile_photo");
        fd.append("label", "תמונת פרופיל");
        const attachRes = await fetch(`/api/pets/${pet.id}/attachments`, { method: "POST", body: fd });
        if (!attachRes.ok) throw new Error("שגיאה בהעלאת תמונת פרופיל");
      }

      if (pendingFiles.length > 0) {
        setUploadStatus("מעלה מסמכים...");
        for (const file of pendingFiles) {
          const fd = new FormData();
          fd.append("file", file);
          const docRes = await fetch(`/api/pets/${pet.id}/documents`, {
            method: "POST",
            body: fd,
          });
          if (!docRes.ok) throw new Error("שגיאה בהעלאת מסמך");
        }
        setUploadStatus("");
      }

      return pet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      onClose();
      setForm({
        name: "",
        species: "dog",
        breed: "",
        gender: "",
        weight: "",
        birthDate: "",
        microchip: "",
        neuteredSpayed: false,
        behavioralTags: [],
      });
      setPendingFiles([]);
      if (profilePhotoPreview) URL.revokeObjectURL(profilePhotoPreview);
      setProfilePhoto(null);
      setProfilePhotoPreview(null);
    },
  });

  const toggleTag = (tag: string) => {
    setForm((f) => ({
      ...f,
      behavioralTags: f.behavioralTags.includes(tag)
        ? f.behavioralTags.filter((t) => t !== tag)
        : [...f.behavioralTags, tag],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">חיית מחמד חדשה</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">שם *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">סוג</label>
              <select
                className="input"
                value={form.species}
                onChange={(e) => setForm({ ...form, species: e.target.value })}
              >
                <option value="dog">כלב</option>
                <option value="cat">חתול</option>
                <option value="other">אחר</option>
              </select>
            </div>
            <div>
              <label className="label">גזע</label>
              <BreedCombobox
                value={form.breed}
                onChange={(v) => setForm({ ...form, breed: v })}
                species={form.species}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">מין</label>
              <select
                className="input"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="">—</option>
                <option value="male">זכר</option>
                <option value="female">נקבה</option>
              </select>
            </div>
            <div>
              <label className="label">משקל (ק״ג)</label>
              <input
                className="input"
                type="number"
                step="0.1"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תאריך לידה</label>
              <input
                className="input"
                type="date"
                value={form.birthDate}
                onChange={(e) =>
                  setForm({ ...form, birthDate: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">מיקרוצ׳יפ</label>
              <input
                className="input"
                value={form.microchip}
                onChange={(e) =>
                  setForm({ ...form, microchip: e.target.value })
                }
                placeholder="מספר שבב"
              />
            </div>
          </div>

          {/* Sterilized toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-amber-600" />
              <label className="text-sm font-medium text-petra-text">
                עיקור / סירוס
              </label>
            </div>
            <button
              type="button"
              dir="ltr"
              onClick={() =>
                setForm((f) => ({ ...f, neuteredSpayed: !f.neuteredSpayed }))
              }
              className={cn(
                "w-11 h-6 rounded-full transition-colors relative flex-shrink-0",
                form.neuteredSpayed ? "bg-brand-500" : "bg-slate-200"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all",
                  form.neuteredSpayed ? "left-5" : "left-0.5"
                )}
              />
            </button>
          </div>

          {/* Profile Photo */}
          <div>
            <label className="label">תמונת פרופיל</label>
            <input
              ref={profileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (profilePhotoPreview) URL.revokeObjectURL(profilePhotoPreview);
                  setProfilePhoto(file);
                  setProfilePhotoPreview(URL.createObjectURL(file));
                }
                e.target.value = "";
              }}
            />
            {profilePhotoPreview ? (
              <div className="relative w-20 h-20">
                <img
                  src={profilePhotoPreview}
                  className="w-20 h-20 rounded-xl object-cover border border-slate-200"
                  alt="פרופיל"
                />
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(profilePhotoPreview);
                    setProfilePhoto(null);
                    setProfilePhotoPreview(null);
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  onClick={() => profileInputRef.current?.click()}
                  className="absolute -bottom-1.5 -right-1.5 w-5 h-5 bg-brand-500 text-white rounded-full flex items-center justify-center hover:bg-brand-600"
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => profileInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 hover:border-brand-300 hover:bg-brand-50/30 transition-colors text-petra-muted"
              >
                <Upload className="w-5 h-5" />
                <span className="text-[10px]">תמונה</span>
              </button>
            )}
          </div>

          {/* Behavioral tags */}
          <div>
            <label className="label">פרופיל התנהגותי</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {BEHAVIORAL_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                    form.behavioralTags.includes(tag)
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-white text-petra-muted border-slate-200 hover:border-amber-300 hover:text-amber-700"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="label">מסמכים (רישיונות, חיסונים, תמונות)</label>
            <div
              className="border-2 border-dashed border-stone-200 rounded-xl p-4 text-center cursor-pointer hover:border-amber-300 hover:bg-amber-50/30 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-5 h-5 text-stone-400 mx-auto mb-1" />
              <p className="text-xs text-petra-muted">לחץ לבחירת קבצים</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                PDF, JPG, PNG — עד {MAX_UPLOAD_MB}MB לקובץ · תמונות מכווצות אוטומטית
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.heic"
              className="hidden"
              onChange={async (e) => {
                if (!e.target.files) return;
                const compressed = await Promise.all(Array.from(e.target.files).map((f) => compressImage(f)));
                setPendingFiles(compressed.filter((f) => f.size <= MAX_UPLOAD_BYTES));
              }}
            />
            {pendingFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {pendingFiles.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs text-petra-muted p-1.5 rounded-lg bg-amber-50"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <span className="truncate flex-1">{file.name}</span>
                    <span className="text-[10px] text-stone-400">
                      {formatFileSize(file.size)}
                    </span>
                    <button
                      onClick={() =>
                        setPendingFiles((f) => f.filter((_, j) => j !== i))
                      }
                      className="text-red-400 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.name || mutation.isPending}
            onClick={() => mutation.mutate(form)}
          >
            <Plus className="w-4 h-4" />
            {mutation.isPending
              ? uploadStatus || "שומר..."
              : "הוסף חיית מחמד"}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
        {mutation.isError && (
          <p className="text-xs text-red-500 mt-2 text-center">
            שגיאה בשמירה — נסה שוב
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Pet Documents Modal ─────────────────────────────────────────────────────

function PetDocumentsModal({
  petId,
  petName,
  isOpen,
  onClose,
}: {
  petId: string;
  petName: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: docs = [], isLoading } = useQuery<PetDoc[]>({
    queryKey: ["petDocs", petId],
    queryFn: () =>
      fetch(`/api/pets/${petId}/documents`).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch documents");
        return r.json();
      }),
    enabled: isOpen,
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) =>
      fetch(`/api/pets/${petId}/documents?docId=${docId}`, {
        method: "DELETE",
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה במחיקה"); return d; }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["petDocs", petId] }),
    onError: () => toast.error("שגיאה במחיקת מסמך"),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    setIsUploading(true);
    for (const rawFile of files) {
      const file = await compressImage(rawFile);
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`${file.name} גדול מדי (מקסימום ${MAX_UPLOAD_MB}MB)`);
        continue;
      }
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch(`/api/pets/${petId}/documents`, { method: "POST", body: fd });
      if (!uploadRes.ok) toast.error("שגיאה בהעלאת קובץ");
    }
    setIsUploading(false);
    queryClient.invalidateQueries({ queryKey: ["petDocs", petId] });
    e.target.value = "";
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">
            מסמכי {petName}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-6 text-petra-muted text-sm">
            טוען...
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-6 text-petra-muted text-sm">
            אין מסמכים עדיין
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/50 border border-amber-100"
              >
                <FileText className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-petra-text truncate">
                    {doc.name}
                  </p>
                  <p className="text-[10px] text-petra-muted">
                    {formatFileSize(doc.size)} ·{" "}
                    {new Date(doc.createdAt).toLocaleDateString("he-IL")}
                  </p>
                </div>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-amber-100 text-petra-muted"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => deleteMutation.mutate(doc.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className="border-2 border-dashed border-stone-200 rounded-xl p-4 text-center cursor-pointer hover:border-amber-300 hover:bg-amber-50/30 transition-all"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-5 h-5 text-stone-400 mx-auto mb-1" />
          <p className="text-xs text-petra-muted">
            {isUploading ? "מעלה..." : "הוסף מסמך"}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            PDF, JPG, PNG — עד {MAX_UPLOAD_MB}MB · תמונות מכווצות אוטומטית
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.heic"
          className="hidden"
          onChange={handleUpload}
        />
      </div>
    </div>
  );
}

// ─── Edit Customer Modal ─────────────────────────────────────────────────────

function WhatsAppComposeModal({
  customerId,
  customerName,
  customerPhone,
  onClose,
  onSent,
}: {
  customerId: string;
  customerName: string;
  customerPhone: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!message.trim()) return;
    if (!customerPhone) { setError("אין מספר טלפון ללקוח"); return; }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה בשליחה");
        setSending(false);
        return;
      }
      if (data.stub) {
        toast.success("ההודעה תועדה (WhatsApp לא מחובר — שליחה בפועל בהמתנה לאימות)");
      } else {
        toast.success("ההודעה נשלחה בהצלחה");
      }
      onSent();
    } catch {
      setError("שגיאה בשליחה");
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-petra-text">שליחת WhatsApp</h2>
              <p className="text-xs text-petra-muted">{customerName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">הודעה</label>
            <textarea
              className="input resize-none"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`שלום ${customerName}, ...`}
              maxLength={1500}
              dir="rtl"
              autoFocus
            />
            <p className="text-xs text-petra-muted mt-1 text-left">{message.length}/1500</p>
          </div>
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary">ביטול</button>
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className="btn-primary flex items-center gap-2"
            >
              <Send className="w-4 h-4" /> {sending ? "שולח..." : "שלח הודעה"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_CUSTOMER_TAGS = ["VIP", "קבוע", "מזדמן", "פוטנציאל", "לשעבר", "עסקי"];

const REFERRAL_SOURCES = [
  { value: "referral", label: "המלצה מלקוח" },
  { value: "google", label: "גוגל" },
  { value: "instagram", label: "אינסטגרם" },
  { value: "facebook", label: "פייסבוק" },
  { value: "tiktok", label: "טיקטוק" },
  { value: "signage", label: "שלט / מעבר ברחוב" },
  { value: "other", label: "אחר" },
];

function EditCustomerModal({
  customer,
  isOpen,
  onClose,
}: {
  customer: CustomerDetail;
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: businessSettings } = useQuery<{ customerTags?: string }>({
    queryKey: ["settings"],
    queryFn: () => fetchJSON<{ customerTags?: string }>("/api/settings"),
    staleTime: 60_000,
  });

  const presetTags = useMemo(() => {
    if (!businessSettings?.customerTags) return DEFAULT_CUSTOMER_TAGS;
    try {
      const parsed = JSON.parse(businessSettings.customerTags);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CUSTOMER_TAGS;
    } catch {
      return DEFAULT_CUSTOMER_TAGS;
    }
  }, [businessSettings?.customerTags]);

  const [form, setForm] = useState({
    name: customer.name,
    phone: customer.phone,
    email: customer.email || "",
    address: customer.address || "",
    idNumber: customer.idNumber || "",
    notes: customer.notes || "",
    source: customer.source || "",
    selectedTags: (() => {
      try {
        const parsed = JSON.parse(customer.tags);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })() as string[],
  });
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string; email?: string }>({});

  const toggleTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tag)
        ? prev.selectedTags.filter((t) => t !== tag)
        : [...prev.selectedTags, tag],
    }));
  };

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customer.id] });
      onClose();
    },
    onError: () => toast.error("שגיאה בעדכון הלקוח. נסה שוב."),
  });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">עריכת לקוח</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">שם *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">טלפון *</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label">אימייל</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">כתובת</label>
            <input
              className="input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div>
            <label className="label">תעודת זהות</label>
            <input
              className="input"
              placeholder="מספר ת.ז."
              value={form.idNumber}
              onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
            />
          </div>
          <div>
            <label className="label">תגיות לקוח</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {presetTags.map((tag: string) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${form.selectedTags.includes(tag)
                    ? tag === "VIP"
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-[#3D2E1F] text-white border-[#3D2E1F]"
                    : "bg-[#FAF7F3] text-[#8B7355] border-[#E8DFD5] hover:border-[#C4956A]"
                    }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">מקור הגעה</label>
            <select
              className="input"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            >
              <option value="">— לא ידוע —</option>
              {REFERRAL_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">הערות</label>
            <textarea
              className="input min-h-[80px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.name || !form.phone || mutation.isPending}
            onClick={() => {
              const errors: typeof fieldErrors = {};
              const nameErr = validateName(form.name);
              if (nameErr) errors.name = nameErr;
              const phoneErr = validateIsraeliPhone(form.phone);
              if (phoneErr) errors.phone = phoneErr;
              const emailErr = validateEmail(form.email);
              if (emailErr) errors.email = emailErr;
              setFieldErrors(errors);
              if (Object.keys(errors).length > 0) return;
              mutation.mutate({
                name: sanitizeName(form.name),
                phone: normalizeIsraeliPhone(form.phone),
                email: form.email || null,
                address: form.address || null,
                idNumber: form.idNumber || null,
                notes: form.notes || null,
                source: form.source || null,
                tags: JSON.stringify(form.selectedTags),
              });
            }}
          >
            {mutation.isPending ? "שומר..." : "שמור שינויים"}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
        {fieldErrors.name && <p className="text-xs text-red-500 mt-2">{fieldErrors.name}</p>}
        {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
        {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
      </div>
    </div>
  );
}

// ─── Edit Pet Modal ───────────────────────────────────────────────────────────

function EditPetModal({
  pet,
  customerId,
  onClose,
}: {
  pet: Pet;
  customerId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const existingTags: string[] = (() => { try { return JSON.parse(pet.tags || "[]"); } catch { return []; } })();
  const [form, setForm] = useState({
    name: pet.name,
    breed: pet.breed ?? "",
    gender: pet.gender ?? "",
    weight: pet.weight != null ? String(pet.weight) : "",
    birthDate: pet.birthDate ? pet.birthDate.split("T")[0] : "",
    microchip: pet.microchip ?? "",
    selectedTags: existingTags,
  });

  const toggleTag = (tag: string) =>
    setForm((f) => ({
      ...f,
      selectedTags: f.selectedTags.includes(tag)
        ? f.selectedTags.filter((t) => t !== tag)
        : [...f.selectedTags, tag],
    }));

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/pets/${pet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          breed: form.breed,
          gender: form.gender,
          weight: form.weight,
          birthDate: form.birthDate,
          microchip: form.microchip,
          tags: JSON.stringify(form.selectedTags),
        }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה בעדכון"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      onClose();
    },
    onError: () => toast.error("שגיאה בעדכון חיית המחמד. נסה שוב."),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">עריכת {pet.name}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">שם *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">גזע</label>
            <BreedCombobox
              value={form.breed}
              onChange={(v) => setForm({ ...form, breed: v })}
              species={pet.species}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">מין</label>
              <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">לא ידוע</option>
                <option value="male">זכר</option>
                <option value="female">נקבה</option>
              </select>
            </div>
            <div>
              <label className="label">משקל (ק״ג)</label>
              <input className="input" type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תאריך לידה</label>
              <input className="input" type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
            </div>
            <div>
              <label className="label">מיקרוצ׳יפ</label>
              <input className="input" value={form.microchip} onChange={(e) => setForm({ ...form, microchip: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">תגיות התנהגותיות</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {BEHAVIORAL_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                    form.selectedTags.includes(tag)
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-white text-stone-600 border-stone-200 hover:border-amber-300"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button className="btn-primary flex-1" disabled={!form.name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "שומר..." : "שמור שינויים"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Pet Note Modal ──────────────────────────────────────────────────────

function EditPetNoteModal({
  petId,
  field,
  label,
  value,
  customerId,
  onClose,
}: {
  petId: string;
  field: string;
  label: string;
  value: string;
  customerId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(value);

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/pets/${petId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: text || null }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה בעדכון"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      onClose();
    },
    onError: () => toast.error("שגיאה בשמירת ההערה. נסה שוב."),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-petra-text">{label}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <textarea
          className="input min-h-[120px] w-full"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          placeholder="הזן הערות..."
        />
        <div className="flex gap-3 mt-4">
          <button className="btn-primary flex-1" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "שומר..." : "שמור"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ─── Medication Modal ─────────────────────────────────────────────────────────

function MedicationModal({
  petId,
  petName,
  med,
  customerId,
  onClose,
}: {
  petId: string;
  petName: string;
  med: DogMedication | null;
  customerId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    medName: med?.medName ?? "",
    dosage: med?.dosage ?? "",
    frequency: med?.frequency ?? "",
    times: med?.times ?? "",
    instructions: med?.instructions ?? "",
    startDate: med?.startDate ? med.startDate.split("T")[0] : "",
    endDate: med?.endDate ? med.endDate.split("T")[0] : "",
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (med) {
        return fetch(`/api/pets/${petId}/medications/${med.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה בעדכון"); return d; });
      }
      return fetch(`/api/pets/${petId}/medications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה בהוספה"); return d; });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      onClose();
    },
    onError: () => toast.error("שגיאה בשמירת התרופה. נסה שוב."),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">
            {med ? "עריכת תרופה" : `הוספת תרופה — ${petName}`}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">שם תרופה *</label>
            <input
              className="input"
              value={form.medName}
              onChange={(e) => setForm({ ...form, medName: e.target.value })}
              placeholder="ריבוקסיב, אמוקסיצילין..."
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">מינון</label>
              <input
                className="input"
                value={form.dosage}
                onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                placeholder="25 מ״ג"
              />
            </div>
            <div>
              <label className="label">תדירות</label>
              <input
                className="input"
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                placeholder="פעם ביום"
              />
            </div>
          </div>
          <div>
            <label className="label">שעות מתן</label>
            <input
              className="input"
              value={form.times}
              onChange={(e) => setForm({ ...form, times: e.target.value })}
              placeholder="07:00, 19:00"
            />
          </div>
          <div>
            <label className="label">הוראות</label>
            <input
              className="input"
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder="עם אוכל, לא לחצות..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">תאריך התחלה</label>
              <input
                className="input"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">תאריך סיום</label>
              <input
                className="input"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={!form.medName.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "שומר..." : med ? "שמור שינויים" : "הוסף תרופה"}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Send Contract Section ────────────────────────────────────────────────────

interface ContractTemplate {
  id: string;
  name: string;
}

interface ContractReq {
  id: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
  openedAt: string | null;
  signedAt: string | null;
  signedFileUrl: string | null;
  signUrl: string | null;
  ipAddress: string | null;
  expiresAt: string;
  templateId: string;
  template: { name: string };
}

function getEffectiveStatus(req: ContractReq): "SIGNED" | "EXPIRED" | "VIEWED" | "PENDING" {
  if (req.status === "SIGNED") return "SIGNED";
  if (req.status === "EXPIRED" || new Date(req.expiresAt) < new Date()) return "EXPIRED";
  if (req.openedAt) return "VIEWED";
  return "PENDING";
}

function getDaysUntilExpiry(expiresAt: string): number {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function SendContractSection({ customerId, customerName, pets }: { customerId: string; customerName: string; pets: { id: string; name: string }[] }) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedPetId, setSelectedPetId] = useState("");
  const [deletingContract, setDeletingContract] = useState<ContractReq | null>(null);

  const { data: templates = [] } = useQuery<ContractTemplate[]>({
    queryKey: ["contract-templates"],
    queryFn: () => fetch("/api/contracts/templates").then((r) => r.json()),
  });

  const { data: requests = [] } = useQuery<ContractReq[]>({
    queryKey: ["contract-requests", customerId],
    queryFn: () => fetch(`/api/contracts/requests?customerId=${customerId}`).then((r) => r.json()),
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      fetch("/api/contracts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, templateId: selectedTemplateId, petId: selectedPetId || undefined }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-requests", customerId] });
      toast.success("החוזה נשלח לחתימה!");
      setShowModal(false);
      setSelectedTemplateId("");
    },
    onError: (e: Error) => toast.error(e.message || "שגיאה בשליחה"),
  });

  const deleteContractMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/contracts/requests/${id}`, { method: "DELETE" }).then(async (r) => {
        if (!r.ok) { const d = await r.json(); throw new Error(d.error || "שגיאה במחיקה"); }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-requests", customerId] });
      toast.success("החוזה נמחק");
      setDeletingContract(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/contracts/requests/${id}/resend`, { method: "POST" }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "שגיאה");
        return d;
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contract-requests", customerId] });
      toast.success(data.renewed ? "חוזה חדש נשלח!" : "תזכורת נשלחה!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusLabel: Record<string, string> = { PENDING: "ממתין", VIEWED: "נצפה", SIGNED: "נחתם", EXPIRED: "פג תוקף" };
  const statusColor: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-700",
    VIEWED: "bg-blue-100 text-blue-700",
    SIGNED: "bg-emerald-100 text-emerald-700",
    EXPIRED: "bg-slate-100 text-slate-500",
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
          <PenLine className="w-4 h-4 text-petra-muted" />
          חוזים ({requests.length})
        </h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl btn-ghost text-petra-muted"
          disabled={templates.length === 0}
          title={templates.length === 0 ? "הוסף תבניות חוזים בהגדרות → חוזים" : undefined}
        >
          <Send className="w-3.5 h-3.5" />
          שלח לחתימה
        </button>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-petra-muted text-center py-4">לא נשלחו חוזים</p>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => {
            const effective = getEffectiveStatus(req);
            const daysLeft = getDaysUntilExpiry(req.expiresAt);
            return (
            <div key={req.id} className="rounded-xl border border-slate-100 hover:border-slate-200 transition-colors overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <FileText className="w-4 h-4 text-petra-muted flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-petra-text">{req.template.name}</p>
                  <p className="text-xs text-petra-muted">
                    {new Date(req.createdAt).toLocaleDateString("he-IL")}
                  </p>
                </div>
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0", statusColor[effective] ?? "bg-slate-100 text-slate-500")}>
                  {statusLabel[effective] ?? effective}
                </span>
                {req.signUrl && (effective === "PENDING" || effective === "VIEWED") && (
                  <button
                    type="button"
                    className="text-xs text-petra-muted hover:text-petra-text px-2 py-0.5 rounded hover:bg-slate-100 transition-colors flex items-center gap-1 flex-shrink-0"
                    title={req.signUrl}
                    onClick={() => { copyToClipboard(req.signUrl!); toast.success("הקישור הועתק!"); }}
                  >
                    <Copy className="w-3 h-3" />
                    העתק קישור
                  </button>
                )}
                {(effective === "PENDING" || effective === "VIEWED") && (
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-800 px-2 py-0.5 rounded hover:bg-blue-50 transition-colors flex items-center gap-1 flex-shrink-0"
                    title="שלח תזכורת WhatsApp"
                    disabled={resendMutation.isPending}
                    onClick={() => resendMutation.mutate(req.id)}
                  >
                    <RefreshCw className={cn("w-3 h-3", resendMutation.isPending && "animate-spin")} />
                    תזכורת
                  </button>
                )}
                {effective === "EXPIRED" && (
                  <button
                    type="button"
                    className="text-xs text-amber-600 hover:text-amber-800 px-2 py-0.5 rounded hover:bg-amber-50 transition-colors flex items-center gap-1 flex-shrink-0"
                    title="שלח חוזה חדש"
                    disabled={resendMutation.isPending}
                    onClick={() => resendMutation.mutate(req.id)}
                  >
                    <RotateCcw className={cn("w-3 h-3", resendMutation.isPending && "animate-spin")} />
                    שלח מחדש
                  </button>
                )}
                {req.signedFileUrl && (
                  <a href={req.signedFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-500 hover:underline flex items-center gap-1 flex-shrink-0">
                    <Download className="w-3.5 h-3.5" />
                    הורד
                  </a>
                )}
                <button
                  onClick={() => setDeletingContract(req)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-petra-muted hover:text-red-600 transition-colors flex-shrink-0"
                  title="מחק חוזה"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Audit trail */}
              <div className="px-3 pb-3 space-y-0.5">
                {req.sentAt && (
                  <p className="text-xs text-petra-muted flex items-center gap-1.5">
                    <span>✉️</span> נשלח: {new Date(req.sentAt).toLocaleString("he-IL", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                  </p>
                )}
                {req.openedAt && (
                  <p className="text-xs text-petra-muted flex items-center gap-1.5">
                    <span>👁</span> נפתח: {new Date(req.openedAt).toLocaleString("he-IL", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                  </p>
                )}
                {req.signedAt && (
                  <p className="text-xs text-petra-muted flex items-center gap-1.5">
                    <span>✍️</span> נחתם: {new Date(req.signedAt).toLocaleString("he-IL", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                    {req.ipAddress && <span className="text-petra-muted/70">· IP: {req.ipAddress}</span>}
                  </p>
                )}
                {(effective === "PENDING" || effective === "VIEWED") && daysLeft > 0 && (
                  <p className={cn("text-xs flex items-center gap-1.5", daysLeft <= 3 ? "text-red-500" : "text-emerald-600")}>
                    <span>⏳</span> יפוג בעוד {daysLeft} ימים
                  </p>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setShowModal(false)} />
          <div className="modal-content max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-petra-text">שלח חוזה לחתימה</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">בחר תבנית חוזה</label>
                <select className="input w-full" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                  <option value="">בחר תבנית...</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              {pets.length > 0 && (
                <div>
                  <label className="label">שייך לכלב (אופציונלי)</label>
                  <select className="input w-full" value={selectedPetId} onChange={(e) => setSelectedPetId(e.target.value)}>
                    <option value="">ללא שיוך לכלב</option>
                    {pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <p className="text-xs text-petra-muted mt-1">פרטי הכלב (שם, גזע, שבב, מין, צבע) יוטבעו אוטומטית בחוזה</p>
                </div>
              )}
              <div className="text-sm text-petra-muted bg-slate-50 rounded-xl p-3">
                ישלח ל: <span className="font-medium text-petra-text">{customerName}</span> ב-WhatsApp
              </div>
              <div className="flex gap-3">
                <button
                  className="btn-primary flex-1"
                  disabled={!selectedTemplateId || sendMutation.isPending}
                  onClick={() => sendMutation.mutate()}
                >
                  {sendMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />שולח...</> : <><Send className="w-4 h-4" />שלח</>}
                </button>
                <button className="btn-secondary" onClick={() => setShowModal(false)}>ביטול</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        open={!!deletingContract}
        onClose={() => setDeletingContract(null)}
        onConfirm={() => deletingContract && deleteContractMutation.mutate(deletingContract.id)}
        title="מחיקת חוזה"
        confirmText={deletingContract?.template.name ?? ""}
        description="מחיקת החוזה תסיר אותו לצמיתות. פעולה זו אינה ניתנת לביטול."
        loading={deleteContractMutation.isPending}
      />
    </div>
  );
}

// ─── Customer Documents Section ──────────────────────────────────────────────

const DOC_CATEGORY_LABELS: Record<string, string> = {
  contract: "חוזה",
  invoice: "חשבונית",
  receipt: "קבלה",
  agreement: "הסכם",
  medical: "רפואי",
  insurance: "ביטוח",
  other: "אחר",
};

const DOC_CATEGORY_COLORS: Record<string, string> = {
  contract: "bg-blue-100 text-blue-700 border-blue-200",
  invoice: "bg-emerald-100 text-emerald-700 border-emerald-200",
  receipt: "bg-green-100 text-green-700 border-green-200",
  agreement: "bg-violet-100 text-violet-700 border-violet-200",
  medical: "bg-red-100 text-red-700 border-red-200",
  insurance: "bg-cyan-100 text-cyan-700 border-cyan-200",
  other: "bg-stone-100 text-stone-600 border-stone-200",
};

function getDocIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType === "application/pdf") return FileCheck;
  return File;
}

function CustomerDocumentsSection({
  customerId,
  documentsJson,
}: {
  customerId: string;
  documentsJson: string;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("other");
  const [uploadLabel, setUploadLabel] = useState("");
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [deletingDoc, setDeletingDoc] = useState<{ id: string; name: string } | null>(null);

  // Parse docs from customer data (initial), then use react-query for fresh data
  const { data: docs = [] } = useQuery<CustomerDoc[]>({
    queryKey: ["customerDocs", customerId],
    queryFn: () =>
      fetch(`/api/customers/${customerId}/documents`).then((r) => r.json()),
    initialData: () => {
      try {
        return JSON.parse(documentsJson || "[]");
      } catch {
        return [];
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) =>
      fetch(`/api/customers/${customerId}/documents?docId=${docId}`, {
        method: "DELETE",
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה במחיקה"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customerDocs", customerId] });
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
    },
  });

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    setIsUploading(true);
    for (const file of pendingFiles) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", uploadCategory);
      if (uploadLabel.trim()) fd.append("label", uploadLabel.trim());
      await fetch(`/api/customers/${customerId}/documents`, {
        method: "POST",
        body: fd,
      });
    }
    setIsUploading(false);
    setPendingFiles([]);
    setUploadLabel("");
    setUploadCategory("other");
    setShowUploadForm(false);
    queryClient.invalidateQueries({ queryKey: ["customerDocs", customerId] });
    queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
  };

  const filteredDocs = filterCategory
    ? docs.filter((d) => d.category === filterCategory)
    : docs;

  // Count per category
  const categoryCounts: Record<string, number> = {};
  docs.forEach((d) => {
    categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
  });
  const usedCategories = Object.keys(categoryCounts);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-petra-muted" />
          מסמכים ({docs.length})
        </h2>
        <button
          onClick={() => setShowUploadForm((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all",
            showUploadForm
              ? "bg-brand-500 text-white"
              : "btn-ghost text-petra-muted"
          )}
        >
          <Upload className="w-3.5 h-3.5" />
          העלאת מסמך
        </button>
      </div>

      {/* Upload form */}
      {showUploadForm && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50/60 border border-amber-100 space-y-3">
          {/* Category selector */}
          <div>
            <label className="text-xs font-medium text-stone-600 mb-1.5 block">
              סוג מסמך
            </label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(DOC_CATEGORY_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setUploadCategory(key)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                    uploadCategory === key
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-white text-petra-muted border-slate-200 hover:border-amber-300 hover:text-amber-700"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional label */}
          <div>
            <label className="text-xs font-medium text-stone-600 mb-1 block">
              שם מסמך (אופציונלי)
            </label>
            <input
              className="input text-sm"
              value={uploadLabel}
              onChange={(e) => setUploadLabel(e.target.value)}
              placeholder="לדוגמה: חוזה אילוף ינואר 2026"
            />
          </div>

          {/* File drop zone */}
          <div
            className="border-2 border-dashed border-stone-200 rounded-xl p-4 text-center cursor-pointer hover:border-amber-300 hover:bg-amber-50/30 transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-5 h-5 text-stone-400 mx-auto mb-1" />
            <p className="text-xs text-petra-muted">לחץ לבחירת קבצים</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              PDF, JPG, PNG, DOC, XLS — עד {MAX_UPLOAD_MB}MB לקובץ
            </p>
            <p className="text-[10px] text-emerald-600 mt-0.5">
              תמונות מכווצות אוטומטית לפני ההעלאה
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={async (e) => {
              if (!e.target.files) return;
              const compressed = await Promise.all(Array.from(e.target.files).map((f) => compressImage(f)));
              const valid = compressed.filter((f) => f.size <= MAX_UPLOAD_BYTES);
              const oversized = compressed.filter((f) => f.size > MAX_UPLOAD_BYTES);
              setPendingFiles((prev) => [...prev, ...valid]);
              if (oversized.length > 0) {
                alert(`${oversized.length} קובץ/ים חורגים מגודל מקסימלי של ${MAX_UPLOAD_MB}MB ולא נוספו.`);
              }
              e.target.value = "";
            }}
          />

          {/* Pending files list */}
          {pendingFiles.length > 0 && (
            <div className="space-y-1">
              {pendingFiles.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs text-petra-muted p-1.5 rounded-lg bg-white border border-stone-100"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span className="truncate flex-1">{file.name}</span>
                  <span className="text-[10px] text-stone-400">
                    {formatFileSize(file.size)}
                  </span>
                  <button
                    onClick={() =>
                      setPendingFiles((f) => f.filter((_, j) => j !== i))
                    }
                    className="text-red-400 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload actions */}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowUploadForm(false);
                setPendingFiles([]);
                setUploadLabel("");
                setUploadCategory("other");
              }}
              className="text-xs text-petra-muted hover:text-petra-text px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
            >
              ביטול
            </button>
            <button
              onClick={handleUpload}
              disabled={pendingFiles.length === 0 || isUploading}
              className="btn-primary text-xs py-1.5 px-4"
            >
              {isUploading
                ? "מעלה..."
                : `העלה ${pendingFiles.length > 0 ? `(${pendingFiles.length})` : ""}`}
            </button>
          </div>
        </div>
      )}

      {/* Category filter pills */}
      {usedCategories.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button
            onClick={() => setFilterCategory(null)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-medium transition-all border",
              !filterCategory
                ? "bg-stone-700 text-white border-stone-700"
                : "bg-white text-petra-muted border-slate-200 hover:border-stone-300"
            )}
          >
            הכל ({docs.length})
          </button>
          {usedCategories.map((cat) => (
            <button
              key={cat}
              onClick={() =>
                setFilterCategory(filterCategory === cat ? null : cat)
              }
              className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-medium transition-all border",
                filterCategory === cat
                  ? "bg-stone-700 text-white border-stone-700"
                  : "bg-white text-petra-muted border-slate-200 hover:border-stone-300"
              )}
            >
              {DOC_CATEGORY_LABELS[cat] || cat} ({categoryCounts[cat]})
            </button>
          ))}
        </div>
      )}

      {/* Documents list */}
      {docs.length === 0 ? (
        <div className="empty-state py-8">
          <FolderOpen className="empty-state-icon w-8 h-8" />
          <p className="text-sm text-petra-muted mt-2">אין מסמכים עדיין</p>
          <p className="text-xs text-slate-400 mt-1">
            חוזים, חשבוניות, קבלות ועוד
          </p>
          {!showUploadForm && (
            <button
              className="btn-primary mt-3 text-xs"
              onClick={() => setShowUploadForm(true)}
            >
              <Upload className="w-3.5 h-3.5" />
              העלה מסמך ראשון
            </button>
          )}
        </div>
      ) : filteredDocs.length === 0 ? (
        <p className="text-sm text-petra-muted py-4 text-center">
          אין מסמכים בקטגוריה זו
        </p>
      ) : (
        <div className="space-y-2">
          {filteredDocs.map((doc) => {
            const DocIcon = getDocIcon(doc.mimeType);
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <DocIcon className="w-4.5 h-4.5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-petra-text truncate">
                      {doc.name}
                    </p>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium border flex-shrink-0",
                        DOC_CATEGORY_COLORS[doc.category] ||
                          DOC_CATEGORY_COLORS.other
                      )}
                    >
                      {DOC_CATEGORY_LABELS[doc.category] || doc.category}
                    </span>
                  </div>
                  <p className="text-[10px] text-petra-muted mt-0.5">
                    {formatFileSize(doc.size)} ·{" "}
                    {new Date(doc.createdAt).toLocaleDateString("he-IL")}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-amber-100 text-petra-muted hover:text-amber-700 transition-colors"
                    title="הורד"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => setDeletingDoc({ id: doc.id, name: doc.name })}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-petra-muted hover:text-red-600 transition-colors"
                    title="מחק"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDeleteModal
        open={!!deletingDoc}
        onClose={() => setDeletingDoc(null)}
        onConfirm={() => {
          if (deletingDoc) {
            deleteMutation.mutate(deletingDoc.id, {
              onSuccess: () => setDeletingDoc(null),
            });
          }
        }}
        title="מחיקת מסמך"
        confirmText={deletingDoc?.name ?? ""}
        description="מחיקת המסמך תסיר אותו לצמיתות. פעולה זו אינה ניתנת לביטול."
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "מזומן",
  credit_card: "כרטיס אשראי",
  bank_transfer: "העברה בנקאית",
  bit: "ביט",
  check: "צ׳ק",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: "badge-success",
  pending: "badge-warning",
  overdue: "badge-danger",
  canceled: "badge-neutral",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "שולם",
  pending: "ממתין",
  overdue: "באיחור",
  canceled: "בוטל",
};

const BEHAVIOR_FLAG_LABELS: Record<string, { label: string; severity: "red" | "orange" | "green" }> = {
  dogAggression: { label: "תוקפנות כלבים", severity: "red" },
  humanAggression: { label: "תוקפנות אנשים", severity: "red" },
  biteHistory: { label: "היסטוריית נשיכה", severity: "red" },
  badWithKids: { label: "בעייתי עם ילדים", severity: "red" },
  leashReactivity: { label: "ריאקטיבי בשרשרת", severity: "orange" },
  leashPulling: { label: "משיכה בשרשרת", severity: "orange" },
  jumping: { label: "קפיצה", severity: "orange" },
  separationAnxiety: { label: "חרדת נטישה", severity: "orange" },
  excessiveBarking: { label: "נביחות מוגזמות", severity: "orange" },
  destruction: { label: "הרסנות", severity: "orange" },
  resourceGuarding: { label: "שמירת משאבים", severity: "orange" },
  houseSoiling: { label: "צרכים בבית", severity: "orange" },
  priorTraining: { label: "אילוף קודם", severity: "green" },
};

const SEVERITY_COLORS: Record<string, string> = {
  red: "bg-red-100 text-red-700 border-red-200",
  orange: "bg-amber-100 text-amber-700 border-amber-200",
  green: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const PROGRAM_TYPE_LABELS: Record<string, string> = {
  BASIC_OBEDIENCE: "משמעת בסיסית",
  REACTIVITY: "ריאקטיביות",
  PUPPY: "גור",
  BEHAVIOR: "התנהגות",
  ADVANCED: "מתקדם",
  CUSTOM: "מותאם אישית",
};

const PROGRAM_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "פעיל",
  PAUSED: "מושהה",
  COMPLETED: "הושלם",
  CANCELED: "בוטל",
};

const PROGRAM_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "badge-success",
  PAUSED: "badge-warning",
  COMPLETED: "badge-brand",
  CANCELED: "badge-neutral",
};

const ORDER_STATUS_INFO: Record<string, { label: string; color: string }> = {
  draft: { label: "טיוטה", color: "badge-neutral" },
  confirmed: { label: "מאושר", color: "badge-brand" },
  paid: { label: "שולם", color: "badge-success" },
  partially_paid: { label: "שולם חלקית", color: "badge-warning" },
  canceled: { label: "בוטל", color: "badge-danger" },
  refunded: { label: "זוכה", color: "badge-danger" },
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  sale: "מכירה",
  products: "מוצרים",
  appointment: "תור",
  boarding: "פנסיון",
  training: "אילוף",
  grooming: "טיפוח",
};

// ─── Quick Task Modal (linked to customer) ───────────────────────────────────

const TASK_CATEGORIES = [
  { id: "GENERAL", label: "כללי" },
  { id: "BOARDING", label: "פנסיון" },
  { id: "TRAINING", label: "אילוף" },
  { id: "LEADS", label: "לידים" },
  { id: "HEALTH", label: "בריאות" },
  { id: "MEDICATION", label: "תרופות" },
  { id: "FEEDING", label: "האכלה" },
];

const TASK_PRIORITIES = [
  { id: "LOW", label: "נמוכה" },
  { id: "MEDIUM", label: "בינונית" },
  { id: "HIGH", label: "גבוהה" },
  { id: "URGENT", label: "דחופה" },
];

function QuickTaskModal({
  customerId,
  customerName,
  onClose,
  onSuccess,
}: {
  customerId: string;
  customerName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    title: "",
    category: "GENERAL",
    priority: "MEDIUM",
    dueDate: today,
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetchJSON("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          category: data.category,
          priority: data.priority,
          dueDate: data.dueDate || undefined,
          relatedEntityType: "customer",
          relatedEntityId: customerId,
        }),
      }),
    onSuccess: () => {
      toast.success(`משימה נוצרה עבור ${customerName}`);
      onSuccess();
      onClose();
    },
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-petra-text">
            <span className="flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-brand-500" />
              משימה חדשה — {customerName}
            </span>
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">כותרת *</label>
            <input
              type="text"
              className="input w-full"
              placeholder="תאר את המשימה..."
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">קטגוריה</label>
              <select
                className="input w-full"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {TASK_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">עדיפות</label>
              <select
                className="input w-full"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">תאריך יעד</label>
            <input
              type="date"
              className="input w-full"
              value={form.dueDate}
              min={today}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              className="btn-primary flex-1"
              disabled={!form.title.trim() || mutation.isPending}
              onClick={() => mutation.mutate(form)}
            >
              {mutation.isPending ? "שומר..." : "צור משימה"}
            </button>
            <button className="btn-secondary" onClick={onClose}>ביטול</button>
          </div>
          {mutation.isError && (
            <p className="text-xs text-red-600 text-center">שגיאה ביצירת המשימה. נסה שוב.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── New Appointment Modal (from customer profile) ───────────────────────────

interface ServiceBasic {
  id: string;
  name: string;
  durationMinutes: number | null;
  category: string | null;
}

function NewAppointmentModal({
  customer,
  onClose,
  onSuccess,
}: {
  customer: CustomerDetail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    priceListItemId: "",
    petId: "",
    date: today,
    startTime: "09:00",
    endTime: "10:00",
    notes: "",
  });
  const [fieldError, setFieldError] = useState("");

  const { data: services = [] } = useQuery<ServiceBasic[]>({
    queryKey: ["price-list-items-all-active"],
    queryFn: () => fetch("/api/price-list-items").then((r) => r.json()),
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetchJSON("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          priceListItemId: data.priceListItemId,
          petId: data.petId || null,
          date: data.date + "T00:00:00",
          startTime: data.startTime,
          endTime: data.endTime,
          notes: data.notes || null,
        }),
      }),
    onSuccess: () => {
      toast.success(`תור נקבע עבור ${customer.name}`);
      onSuccess();
      onClose();
    },
    onError: (err: Error) => {
      if ((err as unknown as Record<string, unknown>).code === "LIMIT_REACHED") {
        triggerLimitModal(err.message);
      } else {
        toast.error("שגיאה בקביעת התור. נסה שוב.");
      }
    },
  });

  // Auto-update endTime when service changes
  const handleServiceChange = (priceListItemId: string) => {
    const svc = services.find((s) => s.id === priceListItemId);
    if (svc) {
      const [h, m] = form.startTime.split(":").map(Number);
      const endMinutes = h * 60 + m + (svc.durationMinutes ?? 60);
      const endH = Math.floor(endMinutes / 60) % 24;
      const endM = endMinutes % 60;
      const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
      setForm((f) => ({ ...f, priceListItemId, endTime }));
    } else {
      setForm((f) => ({ ...f, priceListItemId }));
    }
    setFieldError("");
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-petra-text">תור חדש — {customer.name}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">שירות *</label>
            <select
              className="input w-full"
              value={form.priceListItemId}
              onChange={(e) => handleServiceChange(e.target.value)}
            >
              <option value="">בחר שירות...</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {customer.pets.length > 0 && (
            <div>
              <label className="label">חיית מחמד</label>
              <select
                className="input w-full"
                value={form.petId}
                onChange={(e) => setForm((f) => ({ ...f, petId: e.target.value }))}
              >
                <option value="">ללא שיוך לחיה</option>
                {customer.pets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">תאריך *</label>
            <input
              type="date"
              className="input w-full"
              value={form.date}
              min={today}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">שעת התחלה *</label>
              <input
                type="time"
                className="input w-full"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">שעת סיום *</label>
              <input
                type="time"
                className="input w-full"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label">הערות</label>
            <textarea
              className="input w-full"
              rows={2}
              placeholder="הערות נוספות..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              className="btn-primary flex-1"
              disabled={!form.priceListItemId || !form.date || !form.startTime || !form.endTime || mutation.isPending}
              onClick={() => {
                if (!form.priceListItemId) { setFieldError("יש לבחור שירות"); return; }
                mutation.mutate(form);
              }}
            >
              {mutation.isPending ? "שומר..." : "קבע תור"}
            </button>
            <button className="btn-secondary" onClick={onClose}>ביטול</button>
          </div>
          {fieldError && <p className="text-xs text-red-600">{fieldError}</p>}
          {mutation.isError && (
            <p className="text-xs text-red-600 text-center">שגיאה ביצירת התור. נסה שוב.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Edit Feeding Modal ───────────────────────────────────────────────────────
const FOOD_FREQUENCIES = [
  "פעם ביום",
  "2 פעמים ביום",
  "3 פעמים ביום",
  "4 פעמים ביום",
  "לפי דרישה",
];

function EditFeedingModal({
  petId,
  petName,
  pet,
  customerId,
  onClose,
}: {
  petId: string;
  petName: string;
  pet: Pet;
  customerId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    foodBrand: pet.foodBrand ?? "",
    foodGramsPerDay: pet.foodGramsPerDay?.toString() ?? "",
    foodFrequency: pet.foodFrequency ?? "",
    foodNotes: pet.foodNotes ?? "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/pets/${petId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodBrand: form.foodBrand || null,
          foodGramsPerDay: form.foodGramsPerDay ? parseFloat(form.foodGramsPerDay) : null,
          foodFrequency: form.foodFrequency || null,
          foodNotes: form.foodNotes || null,
        }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      toast.success("פרטי האכלה עודכנו");
      onClose();
    },
    onError: () => toast.error("שגיאה בעדכון פרטי האכלה. נסה שוב."),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">האכלה — {petName}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">מותג / חברת אוכל</label>
            <input
              className="input"
              placeholder="לדוג׳ Royal Canin, Hill's, Acana..."
              value={form.foodBrand}
              onChange={(e) => setForm({ ...form, foodBrand: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">כמות יומית (גרם)</label>
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                placeholder="לדוג׳ 250"
                value={form.foodGramsPerDay}
                onChange={(e) => setForm({ ...form, foodGramsPerDay: e.target.value })}
              />
            </div>
            <div>
              <label className="label">תדירות האכלה</label>
              <select
                className="input"
                value={form.foodFrequency}
                onChange={(e) => setForm({ ...form, foodFrequency: e.target.value })}
              >
                <option value="">בחר...</option>
                {FOOD_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">הערות נוספות (אלרגיות לאוכל, העדפות...)</label>
            <textarea
              className="input min-h-[80px] resize-none"
              placeholder="לדוג׳ ללא גלוטן, מעדיף אוכל רטוב..."
              value={form.foodNotes}
              onChange={(e) => setForm({ ...form, foodNotes: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">ביטול</button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="btn-primary flex-1"
            >
              {mutation.isPending ? "שומר..." : "שמור"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Health Modal ────────────────────────────────────────────────────────

function EditHealthModal({
  petId,
  petName,
  health,
  customerId,
  onClose,
}: {
  petId: string;
  petName: string;
  health: Pet["health"];
  customerId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toDateInput = (v: string | null) => (v ? v.split("T")[0] : "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const h = health as any;
  const [form, setForm] = useState({
    rabiesLastDate: toDateInput(h?.rabiesLastDate ?? null),
    rabiesValidUntil: toDateInput(h?.rabiesValidUntil ?? null),
    dhppLastDate: toDateInput(h?.dhppLastDate ?? null),
    dhppPuppy1Date: toDateInput(h?.dhppPuppy1Date ?? null),
    dhppPuppy2Date: toDateInput(h?.dhppPuppy2Date ?? null),
    dhppPuppy3Date: toDateInput(h?.dhppPuppy3Date ?? null),
    bordatellaDate: toDateInput(h?.bordatellaDate ?? null),
    parkWormDate: toDateInput(h?.parkWormDate ?? null),
    dewormingLastDate: toDateInput(h?.dewormingLastDate ?? null),
    fleaTickType: h?.fleaTickType ?? "",
    fleaTickDate: toDateInput(h?.fleaTickDate ?? null),
    fleaTickExpiryDate: toDateInput(h?.fleaTickExpiryDate ?? null),
    allergies: h?.allergies ?? "",
    medicalConditions: h?.medicalConditions ?? "",
    surgeriesHistory: h?.surgeriesHistory ?? "",
    activityLimitations: h?.activityLimitations ?? "",
    vetName: h?.vetName ?? "",
    vetPhone: h?.vetPhone ?? "",
    neuteredSpayed: h?.neuteredSpayed ?? false,
    neuteredSpayedDate: toDateInput(h?.neuteredSpayedDate ?? null),
    originInfo: h?.originInfo ?? "",
    timeWithOwner: h?.timeWithOwner ?? "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/pets/${petId}/health`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה בעדכון"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      onClose();
    },
    onError: () => toast.error("שגיאה בעדכון מידע הבריאות. נסה שוב."),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">בריאות — {petName}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-5">
          {/* Vaccines */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide">חיסונים וטיפולים</p>

            {/* כלבת */}
            <div>
              <p className="text-xs font-medium text-petra-text mb-2">כלבת — אחת לשנה</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">תאריך חיסון</label>
                  <input className="input" type="date" value={form.rabiesLastDate} onChange={(e) => setForm({ ...form, rabiesLastDate: e.target.value })} />
                </div>
                <div>
                  <label className="label">תוקף עד</label>
                  <input className="input" type="date" value={form.rabiesValidUntil} onChange={(e) => setForm({ ...form, rabiesValidUntil: e.target.value })} />
                </div>
              </div>
            </div>

            {/* משושה גורים */}
            <div>
              <p className="text-xs font-medium text-petra-text mb-2">משושה גורים — 3 מנות, שבועיים בין כל מנה</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">מנה 1</label>
                  <input className="input" type="date" value={form.dhppPuppy1Date} onChange={(e) => setForm({ ...form, dhppPuppy1Date: e.target.value })} />
                </div>
                <div>
                  <label className="label">מנה 2</label>
                  <input className="input" type="date" value={form.dhppPuppy2Date} onChange={(e) => setForm({ ...form, dhppPuppy2Date: e.target.value })} />
                </div>
                <div>
                  <label className="label">מנה 3</label>
                  <input className="input" type="date" value={form.dhppPuppy3Date} onChange={(e) => setForm({ ...form, dhppPuppy3Date: e.target.value })} />
                </div>
              </div>
            </div>

            {/* משושה בוגר */}
            <div>
              <p className="text-xs font-medium text-petra-text mb-2">משושה בוגר (DHPP) — אחת לשנה</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">תאריך חיסון</label>
                  <input className="input" type="date" value={form.dhppLastDate} onChange={(e) => setForm({ ...form, dhppLastDate: e.target.value })} />
                </div>
              </div>
            </div>

            {/* תילוע */}
            <div>
              <p className="text-xs font-medium text-petra-text mb-2">תילוע — אחת לחצי שנה</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">תאריך תילוע</label>
                  <input className="input" type="date" value={form.dewormingLastDate} onChange={(e) => setForm({ ...form, dewormingLastDate: e.target.value })} />
                </div>
              </div>
            </div>

            {/* תולעת הפארק */}
            <div>
              <p className="text-xs font-medium text-petra-text mb-2">תולעת הפארק — כל 3 חודשים</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">תאריך טיפול</label>
                  <input className="input" type="date" value={form.parkWormDate} onChange={(e) => setForm({ ...form, parkWormDate: e.target.value })} />
                </div>
              </div>
            </div>

            {/* קרציות ופרעושים */}
            <div>
              <p className="text-xs font-medium text-petra-text mb-2">קרציות ופרעושים</p>
              <div className="space-y-2">
                <div>
                  <label className="label">סוג טיפול (שם מוצר)</label>
                  <input className="input" placeholder="Nexgard, Bravecto, Advocate..." value={form.fleaTickType} onChange={(e) => setForm({ ...form, fleaTickType: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">תאריך טיפול</label>
                    <input className="input" type="date" value={form.fleaTickDate} onChange={(e) => setForm({ ...form, fleaTickDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">תוקף עד</label>
                    <input className="input" type="date" value={form.fleaTickExpiryDate} onChange={(e) => setForm({ ...form, fleaTickExpiryDate: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            {/* שעלת מכלאות */}
            <div>
              <p className="text-xs font-medium text-petra-text mb-2">שעלת מכלאות — תיעוד קבלה</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">תאריך קבלה</label>
                  <input className="input" type="date" value={form.bordatellaDate} onChange={(e) => setForm({ ...form, bordatellaDate: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
          {/* Medical */}
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">מצב רפואי</p>
            <div className="space-y-3">
              <div>
                <label className="label">אלרגיות</label>
                <input className="input" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} placeholder="אלרגיה לעוף, דשא..." />
              </div>
              <div>
                <label className="label">מצבים רפואיים</label>
                <textarea className="input min-h-[60px]" value={form.medicalConditions} onChange={(e) => setForm({ ...form, medicalConditions: e.target.value })} />
              </div>
              <div>
                <label className="label">ניתוחים בעבר</label>
                <input className="input" value={form.surgeriesHistory} onChange={(e) => setForm({ ...form, surgeriesHistory: e.target.value })} />
              </div>
              <div>
                <label className="label">מגבלות פעילות</label>
                <input className="input" value={form.activityLimitations} onChange={(e) => setForm({ ...form, activityLimitations: e.target.value })} />
              </div>
            </div>
          </div>
          {/* Vet */}
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">וטרינר</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">שם וטרינר</label>
                <input className="input" value={form.vetName} onChange={(e) => setForm({ ...form, vetName: e.target.value })} />
              </div>
              <div>
                <label className="label">טלפון וטרינר</label>
                <input className="input" value={form.vetPhone} onChange={(e) => setForm({ ...form, vetPhone: e.target.value })} />
              </div>
            </div>
          </div>
          {/* General */}
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">כללי</p>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form.neuteredSpayed}
                  onChange={(e) => setForm({ ...form, neuteredSpayed: e.target.checked })}
                  className="w-4 h-4 accent-brand-500"
                />
                <span className="text-sm text-petra-text">מסורס / מעוקרת</span>
              </label>
              {form.neuteredSpayed && (
                <div>
                  <label className="label">תאריך סירוס / עיקור</label>
                  <input type="date" className="input" value={form.neuteredSpayedDate} onChange={(e) => setForm({ ...form, neuteredSpayedDate: e.target.value })} />
                </div>
              )}
              <div>
                <label className="label">מקור (מאיפה הגיע)</label>
                <input className="input" value={form.originInfo} onChange={(e) => setForm({ ...form, originInfo: e.target.value })} placeholder="מאמץ, מגדל, רחוב..." />
              </div>
              <div>
                <label className="label">זמן עם הבעלים</label>
                <input className="input" value={form.timeWithOwner} onChange={(e) => setForm({ ...form, timeWithOwner: e.target.value })} placeholder="3 שנים" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "שומר..." : "שמור שינויים"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Behavior Modal ──────────────────────────────────────────────────────

const BEHAVIOR_EDIT_FLAGS: { key: keyof NonNullable<Pet["behavior"]>; label: string }[] = [
  { key: "dogAggression", label: "תוקפנות כלפי כלבים" },
  { key: "humanAggression", label: "תוקפנות כלפי בני אדם" },
  { key: "leashReactivity", label: "ריאקטיביות בשרשרת" },
  { key: "leashPulling", label: "משיכה בשרשרת" },
  { key: "jumping", label: "קפיצה על אנשים" },
  { key: "separationAnxiety", label: "חרדת נטישה" },
  { key: "excessiveBarking", label: "נביחות מוגזמות" },
  { key: "destruction", label: "הרס" },
  { key: "resourceGuarding", label: "שמירת משאבים" },
  { key: "badWithKids", label: "לא מתאים לילדים" },
  { key: "houseSoiling", label: "כלוך בבית" },
  { key: "biteHistory", label: "היסטוריית נשיכה" },
  { key: "priorTraining", label: "עבר אילוף בעבר" },
];

function EditBehaviorModal({
  petId,
  petName,
  behavior,
  customerId,
  onClose,
}: {
  petId: string;
  petName: string;
  behavior: Pet["behavior"];
  customerId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [customInput, setCustomInput] = useState("");
  const [form, setForm] = useState({
    dogAggression: behavior?.dogAggression ?? false,
    humanAggression: behavior?.humanAggression ?? false,
    leashReactivity: behavior?.leashReactivity ?? false,
    leashPulling: behavior?.leashPulling ?? false,
    jumping: behavior?.jumping ?? false,
    separationAnxiety: behavior?.separationAnxiety ?? false,
    excessiveBarking: behavior?.excessiveBarking ?? false,
    destruction: behavior?.destruction ?? false,
    resourceGuarding: behavior?.resourceGuarding ?? false,
    badWithKids: behavior?.badWithKids ?? false,
    houseSoiling: behavior?.houseSoiling ?? false,
    biteHistory: behavior?.biteHistory ?? false,
    priorTraining: behavior?.priorTraining ?? false,
    biteDetails: behavior?.biteDetails ?? "",
    triggers: behavior?.triggers ?? "",
    priorTrainingDetails: behavior?.priorTrainingDetails ?? "",
    customIssues: (() => {
      try { return behavior?.customIssues ? JSON.parse(behavior.customIssues) : []; }
      catch { return []; }
    })() as string[],
  });

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/pets/${petId}/behavior`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה בעדכון"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      onClose();
    },
    onError: () => toast.error("שגיאה בעדכון מידע ההתנהגות. נסה שוב."),
  });

  const toggle = (key: string) =>
    setForm((f) => ({ ...f, [key]: !f[key as keyof typeof f] }));

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">התנהגות — {petName}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          {/* Behavior flags */}
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">דגלי התנהגות</p>
            <div className="grid grid-cols-2 gap-y-2 gap-x-3">
              {BEHAVIOR_EDIT_FLAGS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form[key as keyof typeof form]}
                    onChange={() => toggle(key)}
                    className="w-4 h-4 accent-brand-500"
                  />
                  <span className="text-xs text-petra-text">{label}</span>
                </label>
              ))}
            </div>
          </div>
          {/* Extra text fields */}
          <div className="space-y-3">
            {form.biteHistory && (
              <div>
                <label className="label">פרטי נשיכה</label>
                <textarea
                  className="input min-h-[60px]"
                  value={form.biteDetails}
                  onChange={(e) => setForm({ ...form, biteDetails: e.target.value })}
                />
              </div>
            )}
            <div>
              <label className="label">טריגרים</label>
              <input
                className="input"
                value={form.triggers}
                onChange={(e) => setForm({ ...form, triggers: e.target.value })}
                placeholder="קולות חזקים, כלבים אחרים..."
              />
            </div>
            {form.priorTraining && (
              <div>
                <label className="label">פרטי אילוף קודם</label>
                <input
                  className="input"
                  value={form.priorTrainingDetails}
                  onChange={(e) => setForm({ ...form, priorTrainingDetails: e.target.value })}
                />
              </div>
            )}
          </div>
          {/* Custom issues */}
          <div>
            <p className="text-xs font-semibold text-petra-muted uppercase tracking-wide mb-2">בעיות נוספות (ידני)</p>
            {form.customIssues.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.customIssues.map((issue, idx) => (
                  <span
                    key={idx}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200"
                  >
                    {issue}
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, customIssues: f.customIssues.filter((_, i) => i !== idx) }))}
                      className="hover:text-red-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                className="input flex-1"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="תאר בעיה התנהגותית..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const val = customInput.trim();
                    if (val && !form.customIssues.includes(val)) {
                      setForm((f) => ({ ...f, customIssues: [...f.customIssues, val] }));
                      setCustomInput("");
                    }
                  }
                }}
              />
              <button
                type="button"
                className="btn-secondary text-xs px-3"
                onClick={() => {
                  const val = customInput.trim();
                  if (val && !form.customIssues.includes(val)) {
                    setForm((f) => ({ ...f, customIssues: [...f.customIssues, val] }));
                    setCustomInput("");
                  }
                }}
              >
                הוסף
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            className="btn-primary flex-1"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "שומר..." : "שמור שינויים"}
          </button>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function CustomerPermGate({ children }: { children: React.ReactNode }) {
  const permsGate = usePermissions();
  if (!permsGate.canSeePii) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ArrowRight className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-lg font-semibold text-petra-text mb-2">אין הרשאה</h2>
        <p className="text-sm text-petra-muted">אין לך הרשאה לצפות בפרטי לקוחות. פנה למנהל העסק.</p>
      </div>
    );
  }
  return <>{children}</>;
}

export default function CustomerProfilePage() {
  const params = useParams();
  const customerId = params.id as string;
  const queryClient = useQueryClient();
  const router = useRouter();

  const [showPetModal, setShowPetModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedPetDocs, setSelectedPetDocs] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [logNote, setLogNote] = useState("");
  const [showLogNote, setShowLogNote] = useState(false);
  const [showAllAppointments, setShowAllAppointments] = useState(false);
  const [expandedPetId, setExpandedPetId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, Record<string, boolean>>>({});
  const toggleSection = (petId: string, section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [petId]: { ...prev[petId], [section]: !prev[petId]?.[section] },
    }));
  };
  const isSectionOpen = (petId: string, section: string) => !!expandedSections[petId]?.[section];
  const [showOrderModal, setShowOrderModal] = useState(false);
  const openOrderModal = () => {
    if (!customer?.pets || customer.pets.length === 0) {
      toast.error("חובה להוסיף חיית מחמד ללקוח לפני יצירת הזמנה", { description: "לחץ על 'הוסף חיית מחמד' בקטע חיות המחמד למטה" });
      return;
    }
    setShowOrderModal(true);
  };
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [showQuickTaskModal, setShowQuickTaskModal] = useState(false);
  const [intakeSending, setIntakeSending] = useState(false);
  const [medModal, setMedModal] = useState<{ petId: string; petName: string; med: DogMedication | null } | null>(null);
  const [deletingMed, setDeletingMed] = useState<{ id: string; petId: string } | null>(null);
  const [healthModal, setHealthModal] = useState<{ pet: Pet } | null>(null);
  const [behaviorModal, setBehaviorModal] = useState<{ pet: Pet } | null>(null);
  const [feedingModal, setFeedingModal] = useState<{ pet: Pet } | null>(null);
  const [noteModal, setNoteModal] = useState<{ petId: string; field: string; label: string; value: string } | null>(null);
  const [editPetModal, setEditPetModal] = useState<{ pet: Pet } | null>(null);
  const [deletingPetId, setDeletingPetId] = useState<string | null>(null);
  const [deletingPetOwner, setDeletingPetOwner] = useState<{ id: string; name: string } | null>(null);
  const [showWaCompose, setShowWaCompose] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const { user } = useAuth();
  const { isGroomer, can } = usePlan();
  const perms = usePermissions();
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);

  const { data: customer, isLoading, isError, error } = useQuery<CustomerDetail>({
    queryKey: ["customer", customerId],
    queryFn: () =>
      fetch(`/api/customers/${customerId}`).then(async (r) => {
        if (r.status === 404) throw new Error("CUSTOMER_NOT_FOUND");
        if (!r.ok) throw new Error("FETCH_ERROR");
        return r.json();
      }),
    refetchInterval: 60000,
    retry: (failureCount, err) => {
      if ((err as Error)?.message === "CUSTOMER_NOT_FOUND") return false;
      return failureCount < 2;
    },
  });

  const logMutation = useMutation({
    mutationFn: (note: string) =>
      fetch(`/api/customers/${customerId}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: note, type: "note" }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      setLogNote("");
      setShowLogNote(false);
    },
  });

  const deleteMedMutation = useMutation({
    mutationFn: ({ petId, id }: { petId: string; id: string }) =>
      fetch(`/api/pets/${petId}/medications/${id}`, { method: "DELETE" }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "שגיאה במחיקה"); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      setDeletingMed(null);
    },
  });

  const [completingAptId, setCompletingAptId] = useState<string | null>(null);
  const [remindingAptId, setRemindingAptId] = useState<string | null>(null);
  const remindAptMutation = useMutation({
    mutationFn: (aptId: string) =>
      fetch(`/api/appointments/${aptId}/remind`, { method: "POST" }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "שגיאה");
        return data;
      }),
    onSuccess: () => { setRemindingAptId(null); toast.success("תזכורת WhatsApp נשלחה"); },
    onError: (err: Error) => { setRemindingAptId(null); toast.error(err.message || "שגיאה בשליחת תזכורת"); },
  });
  const completeAptMutation = useMutation({
    mutationFn: (aptId: string) =>
      fetchJSON(`/api/appointments/${aptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      setCompletingAptId(null);
    },
    onError: () => setCompletingAptId(null),
  });

  const deletePetMutation = useMutation<Record<string, unknown>, Error, { petId: string; confirmAction?: string }>({
    mutationFn: ({ petId, confirmAction }) =>
      fetchJSON(`/api/pets/${petId}`, {
        method: "DELETE",
        ...(confirmAction ? { headers: { "x-confirm-action": confirmAction } } : {}),
      }) as Promise<Record<string, unknown>>,
    onSuccess: (data) => {
      if (data.pendingApproval) {
        toast.success("הבקשה נשלחה לאישור הבעלים");
        setDeletingPetId(null);
        setDeletingPetOwner(null);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      toast.success("חיית המחמד נמחקה");
      setDeletingPetId(null);
      setDeletingPetOwner(null);
    },
    onError: () => {
      toast.error("שגיאה במחיקת חיית המחמד");
      setDeletingPetId(null);
      setDeletingPetOwner(null);
    },
  });

  const deleteCustomerMutation = useMutation<Record<string, unknown>>({
    mutationFn: () =>
      fetchJSON(`/api/customers/${customerId}`, {
        method: "DELETE",
        headers: { "x-confirm-action": `DELETE_CUSTOMER_${customerId}` },
      }) as Promise<Record<string, unknown>>,
    onSuccess: (data) => {
      if (data?.pendingApproval) {
        toast.success("הבקשה נשלחה לאישור הבעלים");
        setShowConfirmDeleteModal(false);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      router.push("/customers");
    },
    onError: () => {
      setConfirmDelete(false);
      setShowConfirmDeleteModal(false);
    },
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-slate-100 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-64 bg-slate-100 rounded-2xl" />
          <div className="lg:col-span-2 h-64 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError || !customer) {
    const isNotFound = (error as Error)?.message === "CUSTOMER_NOT_FOUND" || (!isLoading && !customer);
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center" dir="rtl">
        <div className="text-6xl">{isNotFound ? "🔍" : "⚠️"}</div>
        <h2 className="text-xl font-bold text-petra-text">
          {isNotFound ? "לקוח לא נמצא" : "שגיאה בטעינת הדף"}
        </h2>
        <p className="text-sm text-petra-muted max-w-xs">
          {isNotFound
            ? "הלקוח שחיפשת לא קיים או שהקישור שגוי"
            : "משהו השתבש. אנא נסה לרענן את הדף."}
        </p>
        <Link href="/customers" className="btn-primary mt-2">
          חזרה לרשימת הלקוחות
        </Link>
      </div>
    );
  }

  const customerTags: string[] = (() => {
    try {
      return JSON.parse(customer.tags);
    } catch {
      return [];
    }
  })();

  const paidTotal = (customer.payments || [])
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);

  const pendingTotal = (customer.payments || [])
    .filter((p) => p.status === "pending" || p.status === "overdue")
    .reduce((s, p) => s + p.amount, 0);

  const activePrograms = (customer.trainingPrograms || []).filter(
    (p) => p.status === "ACTIVE"
  );

  const displayedAppointments = showAllAppointments
    ? customer.appointments
    : customer.appointments.slice(0, 6);

  return (
    <CustomerPermGate>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/customers"
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-100 text-petra-muted transition-colors flex-shrink-0"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-petra-text truncate">
              {customer.name}
            </h1>
            <p className="text-sm text-petra-muted">
              נוסף {formatDate(customer.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {/* Mobile quick-actions dropdown */}
          <div className="relative sm:hidden">
            <button
              onClick={() => setShowMobileActions(!showMobileActions)}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMobileActions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMobileActions(false)} />
                <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 z-50 py-1 animate-fade-in">
                  <button onClick={() => { openOrderModal(); setShowMobileActions(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-right">
                    <ShoppingCart className="w-4 h-4 text-slate-400" />הזמנה חדשה
                  </button>
                  <button onClick={() => { setShowNewAppointmentModal(true); setShowMobileActions(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-right">
                    <CalendarClock className="w-4 h-4 text-slate-400" />קבע תור
                  </button>
                  <button onClick={() => { setShowQuickTaskModal(true); setShowMobileActions(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-right">
                    <ListTodo className="w-4 h-4 text-slate-400" />משימה
                  </button>
                  <Link href={`/payment-request?customerId=${customer.id}&name=${encodeURIComponent(customer.name)}&phone=${encodeURIComponent(customer.phone)}`} onClick={() => setShowMobileActions(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                    <Send className="w-4 h-4 text-slate-400" />בקשת תשלום
                  </Link>
                  <button
                    disabled={intakeSending}
                    onClick={async () => {
                      setShowMobileActions(false);
                      setIntakeSending(true);
                      try {
                        const res = await fetch("/api/intake/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: customer.id }) });
                        const data = await res.json();
                        if (data.url && customer.phone) {
                          const msg = `שלום ${customer.name}! 📋\nאנא מלא טופס קבלה:\n${data.url}`;
                          window.open(`https://wa.me/${toWhatsAppPhone(customer.phone)}?text=${encodeURIComponent(msg)}`, "_blank");
                        }
                      } finally { setIntakeSending(false); }
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-right disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4 text-slate-400" />{intakeSending ? "שולח..." : "טופס קבלה"}
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setShowNewAppointmentModal(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            title="קבע תור ללקוח זה"
          >
            <CalendarClock className="w-4 h-4" />
            קבע תור
          </button>
          <button
            onClick={() => setShowQuickTaskModal(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            title="צור משימה עבור לקוח זה"
          >
            <ListTodo className="w-4 h-4" />
            משימה
          </button>
          <Link
            href={`/payment-request?customerId=${customer.id}&name=${encodeURIComponent(customer.name)}&phone=${encodeURIComponent(customer.phone)}`}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            title="שלח בקשת תשלום ללקוח זה"
          >
            <Send className="w-4 h-4" />
            בקשת תשלום
          </Link>
          <button
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
            title="שלח טופס קבלה בוואטסאפ"
            disabled={intakeSending}
            onClick={async () => {
              setIntakeSending(true);
              try {
                const res = await fetch("/api/intake/create", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ customerId: customer.id }),
                });
                const data = await res.json();
                if (data.url && customer.phone) {
                  const msg = `שלום ${customer.name}! 📋\nאנא מלא טופס קבלה עבור הכלב שלך:\n${data.url}\nהקישור בתוקף ל-7 ימים. תודה! 🐾`;
                  window.open(`https://wa.me/${toWhatsAppPhone(customer.phone)}?text=${encodeURIComponent(msg)}`, "_blank");
                }
              } finally {
                setIntakeSending(false);
              }
            }}
          >
            <FileText className="w-4 h-4" />
            {intakeSending ? "שולח..." : "טופס קבלה"}
          </button>
          {user?.businessSlug && customer.phone && (
            <a
              href={`https://wa.me/${toWhatsAppPhone(customer.phone)}?text=${encodeURIComponent(
                `שלום ${customer.name}! 📅\nקבע/י תור אונליין בקישור הבא:\n${window?.location?.origin || ""}/book/${user.businessSlug}\nנשמח לראותך! 🐾`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
              title="שלח קישור הזמנה בוואטסאפ"
            >
              <CalendarClock className="w-4 h-4" />
              קישור הזמנה
            </a>
          )}
          {/* Delete button — hidden for staff, "send for approval" for manager, confirm modal for owner */}
          {!perms.isStaff && !perms.isVolunteer && (
            <button
              onClick={() => {
                if (perms.isManager) {
                  // Manager: trigger direct delete which routes to pending approval
                  deleteCustomerMutation.mutate();
                } else {
                  // Owner: open typed confirmation modal
                  setShowConfirmDeleteModal(true);
                }
              }}
              disabled={deleteCustomerMutation.isPending}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors disabled:opacity-50"
              title={perms.isManager ? "שלח בקשת מחיקה לאישור" : "מחק לקוח"}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => openOrderModal()}
            className="hidden sm:flex btn-primary items-center gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            הזמנה חדשה
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column ── */}
        <div className="space-y-4">
          {/* Contact Card */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-petra-text">פרטי קשר</h2>
              <button
                onClick={() => setShowEditModal(true)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted transition-colors"
                title="ערוך לקוח"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-petra-muted flex-shrink-0" />
                <a href={`tel:${customer.phone}`} className="text-sm hover:underline">{customer.phone}</a>
                <div className="ms-auto flex items-center gap-1.5">
                  <button
                    onClick={() => setShowWaCompose(true)}
                    className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 transition-colors"
                    title="כתוב הודעת WhatsApp"
                  >
                    <Send className="w-3.5 h-3.5" />
                    שלח
                  </button>
                  <a
                    href={`https://wa.me/${toWhatsAppPhone(customer.phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 transition-colors"
                    title="פתח WhatsApp Web"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
              {customer.email && (
                <a
                  href={`https://mail.google.com/mail/?view=cm&to=${customer.email}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 group"
                >
                  <Mail className="w-4 h-4 text-petra-muted flex-shrink-0 group-hover:text-brand-600 transition-colors" />
                  <span className="text-sm break-all text-brand-600 group-hover:text-brand-700 group-hover:underline transition-colors">
                    {customer.email}
                  </span>
                </a>
              )}
              {/* Address — masked for staff */}
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-petra-muted flex-shrink-0" />
                {perms.canSeePii ? (
                  customer.address
                    ? <span className="text-sm">{customer.address}</span>
                    : <span className="text-sm text-slate-300">—</span>
                ) : (
                  <span className="text-sm text-slate-300 tracking-widest select-none" title="אין הרשאה לצפייה בכתובת">●●●●●</span>
                )}
              </div>
            </div>

            {customerTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                {customerTags.map((tag) => (
                  <span key={tag} className="badge-brand">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {customer.notes && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-sm text-petra-muted">{customer.notes}</p>
              </div>
            )}

            {/* Stats grid */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-xl bg-slate-50">
                <p className="text-lg font-bold text-petra-text">
                  {customer.appointments.length}
                </p>
                <p className="text-[10px] text-petra-muted">תורים</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-slate-50">
                <p className="text-lg font-bold text-petra-text">
                  {customer.pets.length}
                </p>
                <p className="text-[10px] text-petra-muted">חיות</p>
              </div>
              {perms.canSeeFinance && (
                <div className="text-center p-2 rounded-xl bg-slate-50">
                  <p
                    className={cn(
                      "text-base font-bold leading-tight",
                      pendingTotal > 0 ? "text-red-500" : "text-emerald-600"
                    )}
                  >
                    {pendingTotal > 0
                      ? `−${formatCurrency(pendingTotal)}`
                      : formatCurrency(paidTotal)}
                  </p>
                  <p className="text-[10px] text-petra-muted">
                    {pendingTotal > 0 ? "יתרה" : "שולם"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Package tracking */}
          {activePrograms.some((p) => (p.totalSessions ?? 0) > 0) && (
            <div className="card p-5">
              <h3 className="text-sm font-bold text-petra-text mb-3 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-amber-500" />
                מעקב חבילות
              </h3>
              <div className="space-y-4">
                {activePrograms.filter((p) => (p.totalSessions ?? 0) > 0).map((program) => {
                  const completed = program.sessions?.length ?? 0;
                  const total = program.totalSessions || 1;
                  const pct = Math.min(
                    100,
                    Math.round((completed / total) * 100)
                  );
                  return (
                    <div key={program.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-petra-text">
                          {program.dog?.name
                            ? `${program.dog.name} · `
                            : ""}
                          {PROGRAM_TYPE_LABELS[program.programType] ||
                            program.name}
                        </span>
                        <span className="text-[10px] text-petra-muted">
                          {completed}/{total} מפגשים
                        </span>
                      </div>
                      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background:
                              pct >= 100
                                ? "#10B981"
                                : pct >= 60
                                ? "#F97316"
                                : "#FBBF24",
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-petra-muted mt-0.5 text-right">
                        {pct}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pets */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-petra-text">
                חיות מחמד ({customer.pets.length})
              </h2>
              <button
                className="btn-ghost text-xs"
                onClick={() => setShowPetModal(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                הוסף
              </button>
            </div>

            {customer.pets.length === 0 ? (
              <div className="empty-state py-8">
                <PawPrint className="empty-state-icon w-8 h-8" />
                <p className="text-sm text-petra-muted mt-2">
                  אין חיות מחמד רשומות
                </p>
                <button
                  className="btn-primary mt-3 text-xs"
                  onClick={() => setShowPetModal(true)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  הוסף חיית מחמד
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {customer.pets.map((pet) => {
                  const petTags: string[] = (() => {
                    try {
                      return JSON.parse(pet.tags || "[]");
                    } catch {
                      return [];
                    }
                  })();
                  const age = calcAge(pet.birthDate);
                  const attachmentsList: { type: string; url: string }[] = (() => {
                    try { return JSON.parse(pet.attachments || "[]"); } catch { return []; }
                  })();
                  const profilePhotoUrl = attachmentsList.find((a) => a.type === "profile_photo")?.url ?? null;
                  const docCount = attachmentsList.length;
                  const hasWarning =
                    pet.behavior?.dogAggression ||
                    pet.behavior?.humanAggression ||
                    pet.behavior?.biteHistory;
                  const isExpanded = expandedPetId === pet.id;
                  const hasMeds = pet.medications && pet.medications.length > 0;
                  const hasFood = !!pet.foodNotes;

                  // Gather active behavior flags
                  const activeBehaviorFlags = pet.behavior
                    ? Object.entries(BEHAVIOR_FLAG_LABELS).filter(
                        ([key]) => pet.behavior?.[key as keyof typeof pet.behavior] === true
                      )
                    : [];

                  // Training programs for this pet
                  const petPrograms = (customer.trainingPrograms || []).filter(
                    (p) => p.dogId === pet.id
                  );

                  return (
                    <div
                      key={pet.id}
                      className={cn(
                        "group rounded-2xl bg-amber-50/50 border border-amber-100 p-4 space-y-3 transition-all",
                        isExpanded && "sm:col-span-2 border-amber-200 shadow-sm"
                      )}
                    >
                      {/* Clickable header area */}
                      <div
                        className="cursor-pointer"
                        onClick={() => setExpandedPetId(isExpanded ? null : pet.id)}
                      >
                        {/* Pet header */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {profilePhotoUrl ? (
                              <img src={profilePhotoUrl} className="w-full h-full object-cover" alt={pet.name} />
                            ) : (
                              <PawPrint className="w-5 h-5 text-amber-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-petra-text">
                                {pet.name}
                              </span>
                              {hasWarning && (
                                <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                              )}
                              {pet.health?.neuteredSpayed && (
                                <Scissors className="w-3 h-3 text-stone-400 flex-shrink-0" />
                              )}
                            </div>
                            <div className="text-xs text-petra-muted">
                              {pet.species === "dog"
                                ? "כלב"
                                : pet.species === "cat"
                                ? "חתול"
                                : pet.species}
                              {pet.breed ? ` · ${pet.breed}` : ""}
                              {pet.gender
                                ? ` · ${pet.gender === "male" ? "זכר" : "נקבה"}`
                                : ""}
                            </div>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-1">
                            <button
                              className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-amber-200 transition-all"
                              onClick={(e) => { e.stopPropagation(); setEditPetModal({ pet }); }}
                              title="ערוך"
                            >
                              <Pencil className="w-3 h-3 text-amber-700" />
                            </button>
                            {!perms.isStaff && !perms.isVolunteer && (
                              <button
                                className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (perms.isOwner) {
                                    setDeletingPetOwner({ id: pet.id, name: pet.name });
                                  } else {
                                    setDeletingPetId(pet.id);
                                  }
                                }}
                                title={perms.isOwner ? "מחק" : "שלח בקשת מחיקה לאישור"}
                              >
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </button>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-stone-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-stone-400" />
                            )}
                          </div>
                        </div>

                        {/* Quick info: age, weight, indicators */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-stone-500">
                          {age && <span>גיל: {age}</span>}
                          {pet.weight && <span>משקל: {pet.weight} ק״ג</span>}
                          {pet.microchip && (
                            <span className="text-stone-400">שבב: {pet.microchip}</span>
                          )}
                          {hasMeds && (
                            <span className="flex items-center gap-0.5 text-red-500">
                              <Pill className="w-3 h-3" />
                              {pet.medications.length} תרופות
                            </span>
                          )}
                          {hasFood && (
                            <span className="flex items-center gap-0.5 text-amber-600">
                              <UtensilsCrossed className="w-3 h-3" />
                              האכלה
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Behavioral tags */}
                      {petTags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {petTags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* ── Expanded details ── */}
                      {isExpanded && (
                        <div className="pt-3 border-t border-amber-200/50 space-y-4 animate-fade-in">
                          {/* Feeding info */}
                          <div>
                            <div
                              className="flex items-center justify-between mb-1.5 cursor-pointer select-none"
                              onClick={(e) => { e.stopPropagation(); toggleSection(pet.id, "feeding"); }}
                            >
                              <div className="flex items-center gap-1.5">
                                <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" />
                                <span className="text-xs font-bold text-petra-text">האכלה</span>
                                {isSectionOpen(pet.id, "feeding") ? <ChevronUp className="w-3 h-3 text-stone-400" /> : <ChevronDown className="w-3 h-3 text-stone-400" />}
                              </div>
                              <button
                                className="w-5 h-5 rounded flex items-center justify-center hover:bg-amber-100 transition-colors"
                                onClick={(e) => { e.stopPropagation(); setFeedingModal({ pet }); }}
                                title="ערוך האכלה"
                              >
                                <Pencil className="w-3 h-3 text-amber-600" />
                              </button>
                            </div>
                            {isSectionOpen(pet.id, "feeding") && ((pet.foodBrand || pet.foodGramsPerDay || pet.foodFrequency || pet.foodNotes) ? (
                              <div className="bg-white/60 rounded-lg p-2.5 space-y-1.5">
                                {pet.foodBrand && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">מותג: </span>
                                    <span className="text-stone-700 font-medium">{pet.foodBrand}</span>
                                  </div>
                                )}
                                <div className="flex gap-4 text-[11px]">
                                  {pet.foodGramsPerDay && (
                                    <div>
                                      <span className="text-stone-500">כמות: </span>
                                      <span className="text-stone-700 font-medium">{pet.foodGramsPerDay} גרם/יום</span>
                                    </div>
                                  )}
                                  {pet.foodFrequency && (
                                    <div>
                                      <span className="text-stone-500">תדירות: </span>
                                      <span className="text-stone-700">{pet.foodFrequency}</span>
                                    </div>
                                  )}
                                </div>
                                {pet.foodNotes && (
                                  <p className="text-[11px] text-stone-500 whitespace-pre-line">{pet.foodNotes}</p>
                                )}
                              </div>
                            ) : (
                              <button
                                className="w-full text-xs text-amber-400 hover:text-amber-600 py-1.5 border border-dashed border-amber-200 hover:border-amber-300 rounded-lg transition-colors"
                                onClick={(e) => { e.stopPropagation(); setFeedingModal({ pet }); }}
                              >
                                + הוסף פרטי האכלה
                              </button>
                            ))}
                          </div>

                          {/* Medications */}
                          <div>
                            <div
                              className="flex items-center justify-between mb-1.5 cursor-pointer select-none"
                              onClick={(e) => { e.stopPropagation(); toggleSection(pet.id, "medications"); }}
                            >
                              <div className="flex items-center gap-1.5">
                                <Pill className="w-3.5 h-3.5 text-red-500" />
                                <span className="text-xs font-bold text-petra-text">
                                  תרופות ({pet.medications.length})
                                </span>
                                {isSectionOpen(pet.id, "medications") ? <ChevronUp className="w-3 h-3 text-stone-400" /> : <ChevronDown className="w-3 h-3 text-stone-400" />}
                              </div>
                              <button
                                className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-100 transition-colors"
                                onClick={(e) => { e.stopPropagation(); setMedModal({ petId: pet.id, petName: pet.name, med: null }); }}
                                title="ערוך תרופות"
                              >
                                <Pencil className="w-3 h-3 text-red-500" />
                              </button>
                            </div>
                            {isSectionOpen(pet.id, "medications") && <div className="space-y-1.5">
                              {pet.medications.map((med) => (
                                <div key={med.id} className="bg-white/60 rounded-lg p-2.5 group">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-petra-text">
                                      {med.medName}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      {med.dosage && (
                                        <span className="text-[10px] text-stone-500 bg-red-50 px-1.5 py-0.5 rounded">
                                          {med.dosage}
                                        </span>
                                      )}
                                      <button
                                        className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center hover:bg-brand-50 transition-all"
                                        onClick={(e) => { e.stopPropagation(); setMedModal({ petId: pet.id, petName: pet.name, med }); }}
                                        title="ערוך"
                                      >
                                        <Pencil className="w-3 h-3 text-brand-500" />
                                      </button>
                                      <button
                                        className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center hover:bg-red-100 transition-all"
                                        onClick={(e) => { e.stopPropagation(); setDeletingMed({ id: med.id, petId: pet.id }); }}
                                        title="מחק"
                                      >
                                        <Trash2 className="w-3 h-3 text-red-500" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-stone-500 mt-1">
                                    {med.frequency && <span>תדירות: {med.frequency}</span>}
                                    {med.times && <span>שעות: {med.times}</span>}
                                    {med.instructions && (
                                      <span className="text-stone-400">{med.instructions}</span>
                                    )}
                                    {med.startDate && (
                                      <span>
                                        מ-{new Date(med.startDate).toLocaleDateString("he-IL")}
                                      </span>
                                    )}
                                    {med.endDate && (
                                      <span>
                                        עד {new Date(med.endDate).toLocaleDateString("he-IL")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {pet.medications.length > 0 ? (
                                <button
                                  className="w-full text-xs text-red-400 hover:text-red-600 py-1.5 border border-dashed border-red-200 hover:border-red-300 rounded-lg transition-colors"
                                  onClick={(e) => { e.stopPropagation(); setMedModal({ petId: pet.id, petName: pet.name, med: null }); }}
                                >
                                  + הוסף תרופה נוספת
                                </button>
                              ) : (
                                <button
                                  className="w-full text-xs text-red-400 hover:text-red-600 py-1.5 border border-dashed border-red-200 hover:border-red-300 rounded-lg transition-colors"
                                  onClick={(e) => { e.stopPropagation(); setMedModal({ petId: pet.id, petName: pet.name, med: null }); }}
                                >
                                  + הוסף תרופה ראשונה
                                </button>
                              )}
                            </div>}
                          </div>

                          {/* Health */}
                          <div>
                            <div
                              className="flex items-center justify-between mb-1.5 cursor-pointer select-none"
                              onClick={(e) => { e.stopPropagation(); toggleSection(pet.id, "health"); }}
                            >
                              <div className="flex items-center gap-1.5">
                                <Heart className="w-3.5 h-3.5 text-rose-500" />
                                <span className="text-xs font-bold text-petra-text">בריאות</span>
                                {isSectionOpen(pet.id, "health") ? <ChevronUp className="w-3 h-3 text-stone-400" /> : <ChevronDown className="w-3 h-3 text-stone-400" />}
                              </div>
                              <button
                                className="w-5 h-5 rounded flex items-center justify-center hover:bg-rose-100 transition-colors"
                                onClick={(e) => { e.stopPropagation(); setHealthModal({ pet }); }}
                                title="ערוך בריאות"
                              >
                                <Pencil className="w-3 h-3 text-rose-500" />
                              </button>
                            </div>
                            {isSectionOpen(pet.id, "health") && pet.health && (
                              <div className="bg-white/60 rounded-lg p-2.5 space-y-1.5">
                                {/* Vaccines */}
                                {(pet.health.rabiesLastDate || pet.health.rabiesValidUntil ||
                                  pet.health.dhppLastDate || pet.health.dhppPuppy1Date || pet.health.dhppPuppy2Date || pet.health.dhppPuppy3Date ||
                                  pet.health.bordatellaDate || pet.health.parkWormDate ||
                                  pet.health.dewormingLastDate || pet.health.fleaTickDate) && (
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                                    {pet.health.rabiesLastDate && (
                                      <div>
                                        <span className="text-stone-500">כלבת: </span>
                                        <span className="text-stone-700">
                                          {new Date(pet.health.rabiesLastDate).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                    {pet.health.rabiesValidUntil && (
                                      <div>
                                        <span className="text-stone-500">כלבת עד: </span>
                                        <span className="text-stone-700">
                                          {new Date(pet.health.rabiesValidUntil).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                    {pet.health.dhppPuppy1Date && (
                                      <div>
                                        <span className="text-stone-500">משושה גורים מ1: </span>
                                        <span className="text-stone-700">
                                          {new Date(pet.health.dhppPuppy1Date).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                    {pet.health.dhppPuppy2Date && (
                                      <div>
                                        <span className="text-stone-500">משושה גורים מ2: </span>
                                        <span className="text-stone-700">
                                          {new Date(pet.health.dhppPuppy2Date).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                    {pet.health.dhppPuppy3Date && (
                                      <div>
                                        <span className="text-stone-500">משושה גורים מ3: </span>
                                        <span className="text-stone-700">
                                          {new Date(pet.health.dhppPuppy3Date).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                    {pet.health.dhppLastDate && (
                                      <div>
                                        <span className="text-stone-500">משושה בוגר: </span>
                                        <span className="text-stone-700">
                                          {new Date(pet.health.dhppLastDate).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                    {pet.health.bordatellaDate && (
                                      <div>
                                        <span className="text-stone-500">שעלת מכלאות: </span>
                                        <span className="text-stone-700">
                                          {new Date(pet.health.bordatellaDate).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                    {pet.health.parkWormDate && (
                                      <div>
                                        <span className="text-stone-500">תולעת פארק: </span>
                                        <span className="text-stone-700">
                                          {new Date(pet.health.parkWormDate).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                    {pet.health.dewormingLastDate && (
                                      <div>
                                        <span className="text-stone-500">תילוע: </span>
                                        <span className="text-stone-700">
                                          {new Date(pet.health.dewormingLastDate).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                    {pet.health.fleaTickDate && (
                                      <div>
                                        <span className="text-stone-500">קרציות/פרעושים: </span>
                                        <span className="text-stone-700">
                                          {pet.health.fleaTickType ? `${pet.health.fleaTickType} · ` : ""}
                                          {new Date(pet.health.fleaTickDate).toLocaleDateString("he-IL")}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {pet.health.allergies && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">אלרגיות: </span>
                                    <span className="text-stone-700">{pet.health.allergies}</span>
                                  </div>
                                )}
                                {pet.health.medicalConditions && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">מצבים רפואיים: </span>
                                    <span className="text-stone-700">{pet.health.medicalConditions}</span>
                                  </div>
                                )}
                                {pet.health.surgeriesHistory && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">ניתוחים: </span>
                                    <span className="text-stone-700">{pet.health.surgeriesHistory}</span>
                                  </div>
                                )}
                                {pet.health.activityLimitations && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">מגבלות פעילות: </span>
                                    <span className="text-stone-700">{pet.health.activityLimitations}</span>
                                  </div>
                                )}
                                {(pet.health.vetName || pet.health.vetPhone) && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">וטרינר: </span>
                                    <span className="text-stone-700">
                                      {pet.health.vetName}
                                      {pet.health.vetPhone ? ` · ${pet.health.vetPhone}` : ""}
                                    </span>
                                  </div>
                                )}
                                {pet.health.originInfo && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">מקור: </span>
                                    <span className="text-stone-700">{pet.health.originInfo}</span>
                                  </div>
                                )}
                                {pet.health.timeWithOwner && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">זמן עם הבעלים: </span>
                                    <span className="text-stone-700">{pet.health.timeWithOwner}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Behavior details */}
                          <div>
                            <div
                              className="flex items-center justify-between mb-1.5 cursor-pointer select-none"
                              onClick={(e) => { e.stopPropagation(); toggleSection(pet.id, "behavior"); }}
                            >
                              <div className="flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                <span className="text-xs font-bold text-petra-text">התנהגות</span>
                                {isSectionOpen(pet.id, "behavior") ? <ChevronUp className="w-3 h-3 text-stone-400" /> : <ChevronDown className="w-3 h-3 text-stone-400" />}
                              </div>
                              <button
                                className="w-5 h-5 rounded flex items-center justify-center hover:bg-amber-100 transition-colors"
                                onClick={(e) => { e.stopPropagation(); setBehaviorModal({ pet }); }}
                                title="ערוך התנהגות"
                              >
                                <Pencil className="w-3 h-3 text-amber-600" />
                              </button>
                            </div>
                            {isSectionOpen(pet.id, "behavior") && (activeBehaviorFlags.length > 0 || (() => { try { return JSON.parse(pet.behavior?.customIssues || "[]"); } catch { return []; } })().length > 0 || pet.behavior?.triggers || pet.behavior?.biteDetails || pet.behavior?.priorTrainingDetails) && (
                              <div className="bg-white/60 rounded-lg p-2.5 space-y-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {activeBehaviorFlags.map(([key, info]) => (
                                    <span
                                      key={key}
                                      className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] font-medium border",
                                        SEVERITY_COLORS[info.severity]
                                      )}
                                    >
                                      {info.label}
                                    </span>
                                  ))}
                                  {(() => { try { return JSON.parse(pet.behavior?.customIssues || "[]") as string[]; } catch { return [] as string[]; } })().map((issue: string, idx: number) => (
                                    <span
                                      key={`custom-${idx}`}
                                      className="px-2 py-0.5 rounded-full text-[10px] font-medium border bg-purple-50 text-purple-700 border-purple-200"
                                    >
                                      {issue}
                                    </span>
                                  ))}
                                </div>
                                {pet.behavior?.triggers && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">טריגרים: </span>
                                    <span className="text-stone-700">{pet.behavior.triggers}</span>
                                  </div>
                                )}
                                {pet.behavior?.biteDetails && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">פרטי נשיכה: </span>
                                    <span className="text-stone-700">{pet.behavior.biteDetails}</span>
                                  </div>
                                )}
                                {pet.behavior?.priorTrainingDetails && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">אילוף קודם: </span>
                                    <span className="text-stone-700">{pet.behavior.priorTrainingDetails}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Training Programs — hidden for groomer tier */}
                          {!isGroomer && petPrograms.length > 0 && (
                            <div>
                              <div
                                className="flex items-center justify-between mb-1.5 cursor-pointer select-none"
                                onClick={(e) => { e.stopPropagation(); toggleSection(pet.id, "training"); }}
                              >
                                <div className="flex items-center gap-1.5">
                                  <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                                  <span className="text-xs font-bold text-petra-text">
                                    אילוף ({petPrograms.length})
                                  </span>
                                  {isSectionOpen(pet.id, "training") ? <ChevronUp className="w-3 h-3 text-stone-400" /> : <ChevronDown className="w-3 h-3 text-stone-400" />}
                                </div>
                                <a
                                  href={`/training?pet=${pet.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[10px] text-indigo-500 hover:underline"
                                >
                                  פתח אילוף ←
                                </a>
                              </div>
                              {isSectionOpen(pet.id, "training") && (
                                <div className="space-y-2">
                                  {petPrograms.map((prog) => {
                                    const completedSessions = prog.sessions.length;
                                    const totalSessions = prog.totalSessions;
                                    const statusColors: Record<string, string> = {
                                      ACTIVE: "bg-green-100 text-green-700 border-green-200",
                                      PAUSED: "bg-yellow-100 text-yellow-700 border-yellow-200",
                                      COMPLETED: "bg-blue-100 text-blue-700 border-blue-200",
                                      CANCELED: "bg-red-100 text-red-700 border-red-200",
                                    };
                                    const statusLabels: Record<string, string> = {
                                      ACTIVE: "פעיל", PAUSED: "מושהה",
                                      COMPLETED: "הושלם", CANCELED: "בוטל",
                                    };
                                    const achievedGoals = prog.goals.filter(g => g.status === "ACHIEVED").length;
                                    return (
                                      <div key={prog.id} className="bg-white/60 rounded-lg p-2.5 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-medium text-petra-text">{prog.name}</span>
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${statusColors[prog.status] ?? "bg-slate-100 text-slate-600"}`}>
                                            {statusLabels[prog.status] ?? prog.status}
                                          </span>
                                        </div>
                                        {/* Sessions progress */}
                                        {(totalSessions || completedSessions > 0) && (
                                          <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] text-stone-500">
                                              <span>מפגשים</span>
                                              <span>{completedSessions}{totalSessions ? `/${totalSessions}` : ""}</span>
                                            </div>
                                            {totalSessions && (
                                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                  className="h-full bg-indigo-400 rounded-full transition-all"
                                                  style={{ width: `${Math.min(100, (completedSessions / totalSessions) * 100)}%` }}
                                                />
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        {/* Goals */}
                                        {prog.goals.length > 0 && (
                                          <div className="space-y-1">
                                            <p className="text-[10px] text-stone-500 font-medium">
                                              יעדים: {achievedGoals}/{prog.goals.length} הושגו
                                            </p>
                                            {prog.goals.slice(0, 4).map(goal => (
                                              <div key={goal.id} className="flex items-center gap-1.5">
                                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                                  goal.status === "ACHIEVED" ? "bg-green-500" :
                                                  goal.status === "IN_PROGRESS" ? "bg-indigo-400" : "bg-slate-300"
                                                }`} />
                                                <span className={`text-[10px] flex-1 truncate ${goal.status === "ACHIEVED" ? "line-through text-stone-400" : "text-stone-600"}`}>
                                                  {goal.title}
                                                </span>
                                                {goal.progressPercent > 0 && goal.status !== "ACHIEVED" && (
                                                  <span className="text-[10px] text-indigo-500 font-medium">{goal.progressPercent}%</span>
                                                )}
                                              </div>
                                            ))}
                                            {prog.goals.length > 4 && (
                                              <p className="text-[10px] text-stone-400">+{prog.goals.length - 4} יעדים נוספים</p>
                                            )}
                                          </div>
                                        )}
                                        {prog.notes && (
                                          <p className="text-[10px] text-stone-500 leading-snug">{prog.notes}</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Notes */}
                          <div className="space-y-1.5">
                            <div className="group flex items-start gap-1.5 bg-white/60 rounded-lg p-2.5">
                              <div className="flex-1 text-[11px]">
                                <span className="text-stone-500 font-medium">הערות רפואיות: </span>
                                <span className="text-stone-700">{pet.medicalNotes || <span className="italic text-stone-400">לא הוזן</span>}</span>
                              </div>
                              <button
                                className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center hover:bg-brand-50 transition-all flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); setNoteModal({ petId: pet.id, field: "medicalNotes", label: "הערות רפואיות", value: pet.medicalNotes || "" }); }}
                              >
                                <Pencil className="w-3 h-3 text-brand-500" />
                              </button>
                            </div>
                            <div className="group flex items-start gap-1.5 bg-white/60 rounded-lg p-2.5">
                              <div className="flex-1 text-[11px]">
                                <span className="text-stone-500 font-medium">הערות התנהגות: </span>
                                <span className="text-stone-700">{pet.behaviorNotes || <span className="italic text-stone-400">לא הוזן</span>}</span>
                              </div>
                              <button
                                className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center hover:bg-brand-50 transition-all flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); setNoteModal({ petId: pet.id, field: "behaviorNotes", label: "הערות התנהגות", value: pet.behaviorNotes || "" }); }}
                              >
                                <Pencil className="w-3 h-3 text-brand-500" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Documents button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPetDocs({ id: pet.id, name: pet.name });
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium text-stone-500 hover:text-amber-700 hover:bg-amber-100 transition-colors border border-stone-200 hover:border-amber-200"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {docCount > 0
                          ? `${docCount} מסמכים`
                          : "מסמכים ותמונות"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Appointments */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-petra-text">
                תורים ({customer.appointments.length})
              </h2>
              <div className="flex items-center gap-2">
                <button
                  className="btn-primary text-xs py-1.5 px-3"
                  onClick={() => setShowNewAppointmentModal(true)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  קבע תור
                </button>
                <Link href="/calendar" className="btn-ghost text-xs">
                  <ExternalLink className="w-3.5 h-3.5" />
                  יומן
                </Link>
              </div>
            </div>
            {customer.appointments.length === 0 ? (
              <p className="text-sm text-petra-muted py-4 text-center">
                אין תורים
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {displayedAppointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      <div
                        className="w-1.5 h-8 rounded-full flex-shrink-0"
                        style={{ background: apt.service?.color || "#F97316" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-petra-text">
                          {apt.service?.name || "שירות"}
                        </div>
                        <div className="text-xs text-petra-muted">
                          {new Date(apt.date).toLocaleDateString("he-IL")} ·{" "}
                          {apt.startTime}
                          {apt.pet ? ` · ${apt.pet.name}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className={cn(
                            "badge text-[10px]",
                            getStatusColor(apt.status)
                          )}
                        >
                          {getStatusLabel(apt.status)}
                        </span>
                        {apt.status === "scheduled" && customer.phone && can("whatsapp_reminders") && (
                          <button
                            className="w-6 h-6 flex items-center justify-center rounded-full bg-green-50 hover:bg-green-100 text-green-600 transition-colors flex-shrink-0"
                            title="שלח תזכורת WhatsApp"
                            disabled={remindingAptId === apt.id}
                            onClick={() => {
                              setRemindingAptId(apt.id);
                              remindAptMutation.mutate(apt.id);
                            }}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {apt.status === "scheduled" && (
                          <button
                            className="w-6 h-6 flex items-center justify-center rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors flex-shrink-0"
                            title="סמן כהושלם"
                            disabled={completingAptId === apt.id}
                            onClick={() => {
                              setCompletingAptId(apt.id);
                              completeAptMutation.mutate(apt.id);
                            }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {customer.appointments.length > 6 && (
                  <button
                    onClick={() =>
                      setShowAllAppointments((v) => !v)
                    }
                    className="w-full mt-3 py-2 text-xs text-petra-muted hover:text-petra-text flex items-center justify-center gap-1 transition-colors"
                  >
                    {showAllAppointments ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        הצג פחות
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        הצג הכל ({customer.appointments.length})
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Payments — hidden for staff (user/volunteer) */}
          {perms.canSeeFinance && (customer.payments || []).length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-petra-muted" />
                  תשלומים ({customer.payments.length})
                </h2>
                <Link href="/payments" className="btn-ghost text-xs">
                  <ExternalLink className="w-3.5 h-3.5" />
                  הכל
                </Link>
              </div>
              <div className="space-y-2">
                {customer.payments.slice(0, 8).map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-petra-text">
                        {formatCurrency(payment.amount)}
                        <span className="text-xs text-petra-muted mr-1">
                          ·{" "}
                          {PAYMENT_METHOD_LABELS[payment.method] ||
                            payment.method}
                        </span>
                      </div>
                      <div className="text-xs text-petra-muted">
                        {payment.appointment?.service?.name ||
                          (payment.boardingStay
                            ? `פנסיון – ${payment.boardingStay.pet?.name}`
                            : "")}
                        {" · "}
                        {new Date(
                          payment.paidAt || payment.createdAt
                        ).toLocaleDateString("he-IL")}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "badge text-[10px]",
                        PAYMENT_STATUS_COLORS[payment.status] || "badge-neutral"
                      )}
                    >
                      {PAYMENT_STATUS_LABELS[payment.status] || payment.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orders */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-petra-muted" />
                הזמנות ({(customer.orders || []).length})
              </h2>
              <button
                onClick={() => openOrderModal()}
                className="btn-ghost text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                הזמנה חדשה
              </button>
            </div>

            {(customer.orders || []).length === 0 ? (
              <div className="empty-state py-6">
                <div className="empty-state-icon">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <p className="text-sm text-petra-muted mb-3">אין הזמנות עדיין</p>
                <button
                  onClick={() => openOrderModal()}
                  className="btn-primary text-sm"
                >
                  <ShoppingCart className="w-4 h-4" />
                  צור הזמנה ראשונה
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {(customer.orders || []).map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  const statusInfo = ORDER_STATUS_INFO[order.status] || { label: order.status, color: "badge-neutral" };
                  const showPayLink = order.status === "draft" || order.status === "confirmed";

                  return (
                    <div key={order.id} className="rounded-xl border border-slate-100 overflow-hidden">
                      {/* Order row */}
                      <button
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-right"
                      >
                        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                          <ShoppingCart className="w-4 h-4 text-brand-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-petra-text">
                            {formatCurrency(order.total)}
                            <span className="text-xs text-petra-muted mr-1">
                              · {order.lines.length} פריטים
                            </span>
                          </div>
                          <div className="text-xs text-petra-muted">
                            {ORDER_TYPE_LABELS[order.orderType] || order.orderType}
                            {" · "}
                            {new Date(order.createdAt).toLocaleDateString("he-IL")}
                          </div>
                        </div>
                        <span className={cn("badge text-[10px]", statusInfo.color)}>
                          {statusInfo.label}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-petra-muted flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-petra-muted flex-shrink-0" />
                        )}
                      </button>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-3">
                          {/* Line items */}
                          <div className="space-y-1.5">
                            {order.lines.map((line) => (
                              <div key={line.id} className="flex items-center justify-between text-sm">
                                <span className="text-petra-text">{line.name}</span>
                                <div className="flex items-center gap-3 text-petra-muted">
                                  <span className="text-xs">{line.quantity} × {formatCurrency(line.unitPrice)}</span>
                                  <span className="font-medium text-petra-text w-16 text-right">
                                    {formatCurrency(line.lineSubtotal)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Totals breakdown */}
                          <div className="border-t border-slate-200 pt-2 space-y-1">
                            {order.discountAmount > 0 && (
                              <div className="flex justify-between text-xs text-emerald-600">
                                <span>הנחה</span>
                                <span dir="ltr">−{formatCurrency(order.discountAmount)}</span>
                              </div>
                            )}
                            {order.taxTotal > 0 && (
                              <div className="flex justify-between text-xs text-petra-muted">
                                <span>מע&quot;מ</span>
                                <span dir="ltr">{formatCurrency(order.taxTotal)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm font-bold text-petra-text">
                              <span>סה&quot;כ</span>
                              <span dir="ltr">{formatCurrency(order.total)}</span>
                            </div>
                          </div>

                          {/* Payment request link */}
                          {showPayLink && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/payment-request?customerId=${customer.id}`);
                              }}
                              className="flex items-center gap-2 p-2.5 bg-brand-50 border border-brand-100 rounded-xl w-full text-start hover:bg-brand-100 transition-colors"
                            >
                              <Link2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                              <span className="text-xs text-brand-700 flex-1 font-medium">
                                שלח בקשת תשלום
                              </span>
                            </button>
                          )}

                          {/* Notes */}
                          {order.notes && (
                            <div className="text-xs text-petra-muted">
                              <span className="font-medium">הערות:</span> {order.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Training Programs — hidden for groomer tier */}
          {!isGroomer && (customer.trainingPrograms || []).length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-petra-muted" />
                  תוכניות אימון ({customer.trainingPrograms.length})
                </h2>
                <Link href="/training" className="btn-ghost text-xs">
                  <ExternalLink className="w-3.5 h-3.5" />
                  הכל
                </Link>
              </div>
              <div className="space-y-3">
                {customer.trainingPrograms.map((program) => (
                  <div
                    key={program.id}
                    className="p-3 rounded-xl bg-slate-50/80 border border-slate-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-medium text-petra-text">
                          {program.name}
                        </span>
                        {program.dog && (
                          <span className="text-xs text-petra-muted mr-1">
                            · {program.dog.name}
                          </span>
                        )}
                      </div>
                      <span
                        className={cn(
                          "badge text-[10px]",
                          PROGRAM_STATUS_COLORS[program.status] ||
                            "badge-neutral"
                        )}
                      >
                        {PROGRAM_STATUS_LABELS[program.status] ||
                          program.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-petra-muted mb-2">
                      <span>
                        {PROGRAM_TYPE_LABELS[program.programType] ||
                          program.programType}
                      </span>
                      <span>·</span>
                      <span>{program.totalSessions} מפגשים</span>
                    </div>
                    {program.goals.length > 0 && (
                      <div className="space-y-1.5">
                        {program.goals.slice(0, 3).map((goal) => (
                          <div key={goal.id} className="flex items-center gap-2">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs text-petra-text">
                                  {goal.title}
                                </span>
                                <span className="text-[10px] text-petra-muted">
                                  {goal.progressPercent}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${goal.progressPercent}%`,
                                    background:
                                      goal.progressPercent >= 100
                                        ? "#10B981"
                                        : "#F97316",
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contracts */}
          <SendContractSection customerId={customerId} customerName={customer.name} pets={customer.pets.map((p) => ({ id: p.id, name: p.name }))} />

          {/* Customer Documents */}
          <CustomerDocumentsSection
            customerId={customerId}
            documentsJson={customer.documents || "[]"}
          />

          {/* Timeline */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-petra-text">ציר זמן</h2>
              <button
                onClick={() => setShowLogNote((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all",
                  showLogNote
                    ? "bg-brand-500 text-white"
                    : "btn-ghost text-petra-muted"
                )}
              >
                <BookOpen className="w-3.5 h-3.5" />
                רשום הערה
              </button>
            </div>

            {/* Log progress inline */}
            {showLogNote && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-100">
                <textarea
                  className="w-full text-sm bg-transparent border-none outline-none resize-none placeholder:text-stone-400 text-petra-text min-h-[72px]"
                  placeholder="הוסף הערת התקדמות, תצפית, או פעילות..."
                  value={logNote}
                  onChange={(e) => setLogNote(e.target.value)}
                />
                <div className="flex gap-2 justify-end mt-2">
                  <button
                    onClick={() => {
                      setShowLogNote(false);
                      setLogNote("");
                    }}
                    className="text-xs text-petra-muted hover:text-petra-text px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    ביטול
                  </button>
                  <button
                    onClick={() => logMutation.mutate(logNote)}
                    disabled={!logNote.trim() || logMutation.isPending}
                    className="btn-primary text-xs py-1.5 px-4"
                  >
                    {logMutation.isPending ? "שומר..." : "שמור"}
                  </button>
                </div>
              </div>
            )}

            {customer.timelineEvents.length === 0 ? (
              <p className="text-sm text-petra-muted py-4 text-center">
                אין אירועים
              </p>
            ) : (
              <div className="space-y-3">
                {customer.timelineEvents.map((event) => {
                  const Icon = getTimelineIcon(event.type);
                  return (
                    <div key={event.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm text-petra-text">
                          {event.description}
                        </p>
                        <p className="text-xs text-petra-muted mt-0.5">
                          {new Date(event.createdAt).toLocaleDateString(
                            "he-IL"
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddPetModal
        customerId={customerId}
        isOpen={showPetModal}
        onClose={() => setShowPetModal(false)}
      />
      <EditCustomerModal
        customer={customer}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
      />
      {showWaCompose && (
        <WhatsAppComposeModal
          customerId={customer.id}
          customerName={customer.name}
          customerPhone={customer.phone}
          onClose={() => setShowWaCompose(false)}
          onSent={() => {
            setShowWaCompose(false);
            queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
          }}
        />
      )}
      {selectedPetDocs && (
        <PetDocumentsModal
          petId={selectedPetDocs.id}
          petName={selectedPetDocs.name}
          isOpen={!!selectedPetDocs}
          onClose={() => setSelectedPetDocs(null)}
        />
      )}
      <CreateOrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        prefillCustomerId={customerId}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
        }}
      />
      {showNewAppointmentModal && customer && (
        <NewAppointmentModal
          customer={customer}
          onClose={() => setShowNewAppointmentModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
          }}
        />
      )}
      {showQuickTaskModal && customer && (
        <QuickTaskModal
          customerId={customerId}
          customerName={customer.name}
          onClose={() => setShowQuickTaskModal(false)}
          onSuccess={() => {
            // tasks are on /tasks page, no need to refresh this page
          }}
        />
      )}
      {medModal && (
        <MedicationModal
          petId={medModal.petId}
          petName={medModal.petName}
          med={medModal.med}
          customerId={customerId}
          onClose={() => setMedModal(null)}
        />
      )}
      {healthModal && (
        <EditHealthModal
          petId={healthModal.pet.id}
          petName={healthModal.pet.name}
          health={healthModal.pet.health}
          customerId={customerId}
          onClose={() => setHealthModal(null)}
        />
      )}
      {behaviorModal && (
        <EditBehaviorModal
          petId={behaviorModal.pet.id}
          petName={behaviorModal.pet.name}
          behavior={behaviorModal.pet.behavior}
          customerId={customerId}
          onClose={() => setBehaviorModal(null)}
        />
      )}
      {noteModal && (
        <EditPetNoteModal
          petId={noteModal.petId}
          field={noteModal.field}
          label={noteModal.label}
          value={noteModal.value}
          customerId={customerId}
          onClose={() => setNoteModal(null)}
        />
      )}
      {editPetModal && (
        <EditPetModal
          pet={editPetModal.pet}
          customerId={customerId}
          onClose={() => setEditPetModal(null)}
        />
      )}
      {deletingPetId && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setDeletingPetId(null)} />
          <div className="modal-content max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-petra-text mb-2">בקשת מחיקת חיית מחמד</h3>
            <p className="text-sm text-petra-muted mb-5">
              הבקשה תישלח לאישור הבעלים לפני ביצוע המחיקה. האם להמשיך?
            </p>
            <div className="flex gap-3">
              <button
                className="btn-primary flex-1 !bg-red-600 hover:!bg-red-700"
                disabled={deletePetMutation.isPending}
                onClick={() => deletePetMutation.mutate({ petId: deletingPetId })}
              >
                {deletePetMutation.isPending ? "שולח..." : "שלח לאישור"}
              </button>
              <button className="btn-secondary flex-1" onClick={() => setDeletingPetId(null)}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
      {feedingModal && (
        <EditFeedingModal
          petId={feedingModal.pet.id}
          petName={feedingModal.pet.name}
          pet={feedingModal.pet}
          customerId={customerId}
          onClose={() => setFeedingModal(null)}
        />
      )}
      {deletingMed && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setDeletingMed(null)} />
          <div className="modal-content max-w-sm mx-4 p-6">
            <h2 className="text-base font-bold text-petra-text mb-2">מחיקת תרופה</h2>
            <p className="text-sm text-petra-muted mb-6">האם למחוק את התרופה? פעולה זו אינה הפיכה.</p>
            <div className="flex gap-3">
              <button
                className="btn-danger flex-1"
                disabled={deleteMedMutation.isPending}
                onClick={() => deleteMedMutation.mutate(deletingMed)}
              >
                {deleteMedMutation.isPending ? "מוחק..." : "מחק"}
              </button>
              <button className="btn-secondary" onClick={() => setDeletingMed(null)}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Owner double-confirm delete modal */}
      <ConfirmDeleteModal
        open={showConfirmDeleteModal}
        onClose={() => setShowConfirmDeleteModal(false)}
        onConfirm={() => deleteCustomerMutation.mutate()}
        title="מחיקת לקוח"
        confirmText={customer?.name ?? ""}
        description="מחיקת הלקוח תסיר את כל הפגישות, התשלומים ותוכניות האימון המשויכות. פעולה זו אינה ניתנת לביטול."
        loading={deleteCustomerMutation.isPending}
      />

      {/* Owner double-confirm pet delete modal */}
      {deletingPetOwner && (
        <ConfirmDeleteModal
          open
          onClose={() => setDeletingPetOwner(null)}
          onConfirm={() =>
            deletePetMutation.mutate({
              petId: deletingPetOwner.id,
              confirmAction: `DELETE_PET_${deletingPetOwner.id}`,
            })
          }
          title="מחיקת חיית מחמד"
          confirmText={deletingPetOwner.name}
          description={`מחיקת ${deletingPetOwner.name} תסיר את כל הנתונים הרפואיים, המשקל וההיסטוריה המשויכים. פעולה זו אינה ניתנת לביטול.`}
          loading={deletePetMutation.isPending}
        />
      )}
    </div>
    </CustomerPermGate>
  );
}
