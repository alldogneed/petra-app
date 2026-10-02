"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Plus, X, Pencil, Upload, FileText, Trash2, Download, Scissors, File } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { DogMedication, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, Pet, PetDoc, compressImage, formatFileSize } from "./types";

export const DOG_BREEDS = [
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

export const CAT_BREEDS = [
  "פרסי", "מיין קון", "בריטי שורטהייר", "בנגלי", "סיאמי", "אביסיני",
  "בירמן", "ספינקס", "רגדול", "סקוטיש פולד", "נורבגי יערות",
  "מיקס", "ללא גזע ידוע",
];

export function BreedCombobox({
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

export const BEHAVIORAL_TAGS = [
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


export function AddPetModal({
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
                type="date" lang="he"
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

export function PetDocumentsModal({
  petId,
  petName,
  customerId,
  isOpen,
  onClose,
}: {
  petId: string;
  petName: string;
  customerId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
    queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
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
          <PetraLoader variant="inline" />
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
                {confirmDeleteId === doc.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { deleteMutation.mutate(doc.id); setConfirmDeleteId(null); }}
                      className="px-2 py-1 text-[10px] font-medium bg-red-500 text-white rounded-md hover:bg-red-600"
                    >
                      מחק
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 text-[10px] font-medium bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200"
                    >
                      ביטול
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(doc.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
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


export function EditPetModal({
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
              <input className="input" type="date" lang="he" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
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

export function EditPetNoteModal({
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

export function MedicationModal({
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
                type="date" lang="he"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">תאריך סיום</label>
              <input
                className="input"
                type="date" lang="he"
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
