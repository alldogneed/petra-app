"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
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
} from "lucide-react";
import { CreateOrderModal } from "@/components/orders/CreateOrderModal";
import {
  cn,
  formatDate,
  formatCurrency,
  getStatusColor,
  getStatusLabel,
  getTimelineIcon,
  toWhatsAppPhone,
  fetchJSON,
} from "@/lib/utils";

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
  behaviorNotes: string | null;
  health: {
    neuteredSpayed: boolean | null;
    allergies: string | null;
    medicalConditions: string | null;
    surgeriesHistory: string | null;
    activityLimitations: string | null;
    vetName: string | null;
    vetPhone: string | null;
    rabiesLastDate: string | null;
    rabiesValidUntil: string | null;
    dhppLastDate: string | null;
    dewormingLastDate: string | null;
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
    fears: string | null;
    badWithKids: boolean | null;
    houseSoiling: boolean | null;
    biteHistory: boolean | null;
    biteDetails: string | null;
    triggers: string | null;
    priorTraining: boolean | null;
    priorTrainingDetails: string | null;
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
  name: string;
  programType: string;
  status: string;
  totalSessions: number;
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
  notes: string | null;
  tags: string;
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
        await fetch(`/api/pets/${pet.id}/attachments`, { method: "POST", body: fd });
      }

      if (pendingFiles.length > 0) {
        setUploadStatus("מעלה מסמכים...");
        for (const file of pendingFiles) {
          const fd = new FormData();
          fd.append("file", file);
          await fetch(`/api/pets/${pet.id}/documents`, {
            method: "POST",
            body: fd,
          });
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
              <input
                className="input"
                value={form.breed}
                onChange={(e) => setForm({ ...form, breed: e.target.value })}
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
                PDF, JPG, PNG — עד 10MB לקובץ
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.heic"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) setPendingFiles(Array.from(e.target.files));
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
      fetch(`/api/pets/${petId}/documents`).then((r) => r.json()),
    enabled: isOpen,
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) =>
      fetch(`/api/pets/${petId}/documents?docId=${docId}`, {
        method: "DELETE",
      }).then((r) => r.json()),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["petDocs", petId] }),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setIsUploading(true);
    for (const file of Array.from(e.target.files)) {
      const fd = new FormData();
      fd.append("file", file);
      await fetch(`/api/pets/${petId}/documents`, { method: "POST", body: fd });
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
  const [form, setForm] = useState({
    name: customer.name,
    phone: customer.phone,
    email: customer.email || "",
    address: customer.address || "",
    notes: customer.notes || "",
    tags: (() => {
      try {
        return JSON.parse(customer.tags).join(", ");
      } catch {
        return "";
      }
    })(),
  });

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
            <label className="label">תגיות (מופרדות בפסיקים)</label>
            <input
              className="input"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="VIP, בוקר, כלב גדול"
            />
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
            onClick={() =>
              mutation.mutate({
                name: form.name,
                phone: form.phone,
                email: form.email || null,
                address: form.address || null,
                notes: form.notes || null,
                tags: JSON.stringify(
                  form.tags
                    .split(",")
                    .map((t: string) => t.trim())
                    .filter(Boolean)
                ),
              })
            }
          >
            {mutation.isPending ? "שומר..." : "שמור שינויים"}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
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
      }).then((r) => r.json()),
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
              PDF, JPG, PNG — עד 10MB לקובץ
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                setPendingFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
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
                    onClick={() => deleteMutation.mutate(doc.id)}
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
  BASIC_OBEDIENCE: "ציות בסיסי",
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
  appointment: "תור",
  boarding: "פנסיון",
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
    dueDate: "",
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
  duration: number;
  color: string | null;
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
    serviceId: "",
    petId: "",
    date: today,
    startTime: "09:00",
    endTime: "10:00",
    notes: "",
  });

  const { data: services = [] } = useQuery<ServiceBasic[]>({
    queryKey: ["services"],
    queryFn: () => fetchJSON<ServiceBasic[]>("/api/services"),
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetchJSON("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          serviceId: data.serviceId,
          petId: data.petId || null,
          date: data.date + "T00:00:00",
          startTime: data.startTime,
          endTime: data.endTime,
          notes: data.notes || null,
        }),
      }),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  // Auto-update endTime when service changes
  const handleServiceChange = (serviceId: string) => {
    const svc = services.find((s) => s.id === serviceId);
    if (svc) {
      const [h, m] = form.startTime.split(":").map(Number);
      const endMinutes = h * 60 + m + svc.duration;
      const endH = Math.floor(endMinutes / 60) % 24;
      const endM = endMinutes % 60;
      const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
      setForm((f) => ({ ...f, serviceId, endTime }));
    } else {
      setForm((f) => ({ ...f, serviceId }));
    }
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
              value={form.serviceId}
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
              disabled={!form.serviceId || !form.date || !form.startTime || !form.endTime || mutation.isPending}
              onClick={() => mutation.mutate(form)}
            >
              {mutation.isPending ? "שומר..." : "קבע תור"}
            </button>
            <button className="btn-secondary" onClick={onClose}>ביטול</button>
          </div>
          {mutation.isError && (
            <p className="text-xs text-red-600 text-center">שגיאה ביצירת התור. נסה שוב.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

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
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [showQuickTaskModal, setShowQuickTaskModal] = useState(false);

  const { data: customer, isLoading } = useQuery<CustomerDetail>({
    queryKey: ["customer", customerId],
    queryFn: () =>
      fetch(`/api/customers/${customerId}`).then((r) => r.json()),
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

  const [completingAptId, setCompletingAptId] = useState<string | null>(null);
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

  const deleteCustomerMutation = useMutation({
    mutationFn: () =>
      fetchJSON(`/api/customers/${customerId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      router.push("/customers");
    },
    onError: () => setConfirmDelete(false),
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

  if (!customer)
    return (
      <div className="text-center py-12 text-petra-muted">לקוח לא נמצא</div>
    );

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/customers"
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-slate-100 text-petra-muted transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-petra-text">
              {customer.name}
            </h1>
            <p className="text-sm text-petra-muted">
              נוסף {formatDate(customer.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/scheduler?customerId=${customer.id}`}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            title="קבע תור ללקוח זה"
          >
            <CalendarClock className="w-4 h-4" />
            קבע תור
          </Link>
          <button
            onClick={() => setShowQuickTaskModal(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            title="צור משימה עבור לקוח זה"
          >
            <ListTodo className="w-4 h-4" />
            משימה
          </button>
          <Link
            href={`/payment-request?customerId=${customer.id}`}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            title="שלח בקשת תשלום ללקוח זה"
          >
            <Send className="w-4 h-4" />
            בקשת תשלום
          </Link>
          {confirmDelete ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-red-600 font-medium">מחק לקוח?</span>
              <button
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                onClick={() => deleteCustomerMutation.mutate()}
                disabled={deleteCustomerMutation.isPending}
              >
                {deleteCustomerMutation.isPending ? "מוחק..." : "כן, מחק"}
              </button>
              <button
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                onClick={() => setConfirmDelete(false)}
              >
                ביטול
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
              title="מחק לקוח"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setShowOrderModal(true)}
            className="btn-primary flex items-center gap-2"
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
                <span className="text-sm">{customer.phone}</span>
                <a
                  href={`https://wa.me/${toWhatsAppPhone(customer.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mr-auto flex items-center gap-1 text-xs text-green-600 hover:text-green-700 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
              </div>
              {customer.email && (
                <button
                  onClick={() => { window.location.href = `mailto:${customer.email}`; }}
                  className="flex items-center gap-2.5 group cursor-pointer"
                >
                  <Mail className="w-4 h-4 text-petra-muted flex-shrink-0 group-hover:text-brand-600 transition-colors" />
                  <span className="text-sm break-all text-brand-600 group-hover:text-brand-700 group-hover:underline transition-colors">
                    {customer.email}
                  </span>
                </button>
              )}
              {customer.address && (
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-petra-muted flex-shrink-0" />
                  <span className="text-sm">{customer.address}</span>
                </div>
              )}
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
            </div>
          </div>

          {/* Package tracking */}
          {activePrograms.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-bold text-petra-text mb-3 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-amber-500" />
                מעקב חבילות
              </h3>
              <div className="space-y-4">
                {activePrograms.map((program) => {
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
                      <p className="text-[10px] text-petra-muted mt-0.5 text-left">
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

                  return (
                    <div
                      key={pet.id}
                      className={cn(
                        "rounded-2xl bg-amber-50/50 border border-amber-100 p-4 space-y-3 transition-all",
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
                          <div className="flex-shrink-0">
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
                          {pet.foodNotes && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" />
                                <span className="text-xs font-bold text-petra-text">האכלה</span>
                              </div>
                              <p className="text-xs text-stone-600 bg-white/60 rounded-lg p-2.5 whitespace-pre-line">
                                {pet.foodNotes}
                              </p>
                            </div>
                          )}

                          {/* Medications */}
                          {hasMeds && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Pill className="w-3.5 h-3.5 text-red-500" />
                                <span className="text-xs font-bold text-petra-text">
                                  תרופות ({pet.medications.length})
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {pet.medications.map((med) => (
                                  <div key={med.id} className="bg-white/60 rounded-lg p-2.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-medium text-petra-text">
                                        {med.medName}
                                      </span>
                                      {med.dosage && (
                                        <span className="text-[10px] text-stone-500 bg-red-50 px-1.5 py-0.5 rounded">
                                          {med.dosage}
                                        </span>
                                      )}
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
                              </div>
                            </div>
                          )}

                          {/* Health */}
                          {pet.health && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Heart className="w-3.5 h-3.5 text-rose-500" />
                                <span className="text-xs font-bold text-petra-text">בריאות</span>
                              </div>
                              <div className="bg-white/60 rounded-lg p-2.5 space-y-1.5">
                                {/* Vaccines */}
                                {(pet.health.rabiesLastDate || pet.health.dhppLastDate || pet.health.dewormingLastDate) && (
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
                                    {pet.health.dhppLastDate && (
                                      <div>
                                        <span className="text-stone-500">משושה: </span>
                                        <span className="text-stone-700">
                                          {new Date(pet.health.dhppLastDate).toLocaleDateString("he-IL")}
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
                            </div>
                          )}

                          {/* Behavior details */}
                          {activeBehaviorFlags.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                <span className="text-xs font-bold text-petra-text">התנהגות</span>
                              </div>
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
                                </div>
                                {pet.behavior?.fears && (
                                  <div className="text-[11px]">
                                    <span className="text-stone-500">פחדים: </span>
                                    <span className="text-stone-700">{pet.behavior.fears}</span>
                                  </div>
                                )}
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
                            </div>
                          )}

                          {/* Notes */}
                          {pet.medicalNotes && (
                            <div className="text-[11px] bg-white/60 rounded-lg p-2.5">
                              <span className="text-stone-500 font-medium">הערות רפואיות: </span>
                              <span className="text-stone-700">{pet.medicalNotes}</span>
                            </div>
                          )}
                          {pet.behaviorNotes && (
                            <div className="text-[11px] bg-white/60 rounded-lg p-2.5">
                              <span className="text-stone-500 font-medium">הערות התנהגות: </span>
                              <span className="text-stone-700">{pet.behaviorNotes}</span>
                            </div>
                          )}
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
                        style={{ background: apt.service.color || "#F97316" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-petra-text">
                          {apt.service.name}
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

          {/* Payments */}
          {(customer.payments || []).length > 0 && (
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
                onClick={() => setShowOrderModal(true)}
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
                  onClick={() => setShowOrderModal(true)}
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
                                  <span className="font-medium text-petra-text w-16 text-left">
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

                          {/* Mock payment link */}
                          {showPayLink && (
                            <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                              <Link2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                              <span className="text-xs text-blue-700 truncate flex-1 font-mono" dir="ltr">
                                {typeof window !== "undefined" ? window.location.origin : ""}/pay/{order.id}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const url = `${window.location.origin}/pay/${order.id}`;
                                  navigator.clipboard.writeText(url);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex-shrink-0 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                              >
                                העתק
                              </button>
                            </div>
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

          {/* Training Programs */}
          {(customer.trainingPrograms || []).length > 0 && (
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
    </div>
  );
}
