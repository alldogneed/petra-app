"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Plus, X, Pencil, Upload, FileText, Trash2, Download, Scissors } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { DogMedication, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, Pet, PetDoc, compressImage, formatFileSize } from "./types";

export const DOG_BREEDS = [
  "גולדן רטריוור", "לברדור", "בורדר קולי", "ג'ק ראסל", "פודל", "צ'יוואווה", // i18n-ok — stored value (pet.breed / pet.tags)
  "ביגל", "בולדוג", "הסקי סיבירי", "בוקסר", "רוטוויילר", "גרמן שפרד", // i18n-ok — stored value (pet.breed / pet.tags)
  "מלמוט", "שנאוצר", "דלמציה", "דוברמן", "שיצו", "מלטזי", // i18n-ok — stored value (pet.breed / pet.tags)
  "יורקשייר טריאר", "פומרניאן", "קניש", "שפניאל", "ספינגר ספניאל", // i18n-ok — stored value (pet.breed / pet.tags)
  "קוקר ספניאל", "ויזסלה", "ויימרנר", "סמויד", "מלמוט אלסקי", // i18n-ok — stored value (pet.breed / pet.tags)
  "אמריקן בולי", "פיטבול", "אמריקן סטפורדשייר", "סטפורדשייר בול", // i18n-ok — stored value (pet.breed / pet.tags)
  "רידג'בק רודזיאני", "בסנג'י", "שרפיי", "אקיטה", "שיבה אינו", // i18n-ok — stored value (pet.breed / pet.tags)
  "צ'או צ'או", "ניופאונדלנד", "ברנר זנן הר", "גרייהאונד", "וויפט", // i18n-ok — stored value (pet.breed / pet.tags)
  "אפגן האונד", "סלוקי", "דוג דה בורדו", "מונגרל", "כלב כנעני", "מעורב", // i18n-ok — stored value (pet.breed / pet.tags)
  "פינשר", "דוברמן פינשר", "ארגנטינה דוגו", "קאנה קורסו", "ספינוני", // i18n-ok — stored value (pet.breed / pet.tags)
  "קאלי", "אוסטרלי שפרד", "קורגי", "פלוודה מוגת'", "שטלנד שפדוג'", // i18n-ok — stored value (pet.breed / pet.tags)
];

export const CAT_BREEDS = [
  "פרסי", "מיין קון", "בריטי שורטהייר", "בנגלי", "סיאמי", "אביסיני", // i18n-ok — stored value (pet.breed / pet.tags)
  "בירמן", "ספינקס", "רגדול", "סקוטיש פולד", "נורבגי יערות", // i18n-ok — stored value (pet.breed / pet.tags)
  "מיקס", "ללא גזע ידוע", // i18n-ok — stored value (pet.breed / pet.tags)
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
  const t = useTranslations("customers.petModals");
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
        placeholder={t("breed.placeholder")}
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
        placeholder={t("breed.placeholderPick")}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 start-0 end-0 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.slice(0, 12).map((breed) => (
            <button
              key={breed}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(breed); setOpen(false); }}
              className="w-full text-start px-3 py-2 text-sm hover:bg-brand-50 text-petra-text"
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
  "ריאקטיבי", // i18n-ok — stored value (pet.breed / pet.tags)
  "תוקפן", // i18n-ok — stored value (pet.breed / pet.tags)
  "חרדת נטישה", // i18n-ok — stored value (pet.breed / pet.tags)
  "פחדן", // i18n-ok — stored value (pet.breed / pet.tags)
  "מאומץ", // i18n-ok — stored value (pet.breed / pet.tags)
  "ריאקטיבי בשרשרת", // i18n-ok — stored value (pet.breed / pet.tags)
  "שמירת משאבים", // i18n-ok — stored value (pet.breed / pet.tags)
  "ידידותי", // i18n-ok — stored value (pet.breed / pet.tags)
  "אנרגטי", // i18n-ok — stored value (pet.breed / pet.tags)
  "מאולף", // i18n-ok — stored value (pet.breed / pet.tags)
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
  const t = useTranslations("customers.petModals");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
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
        setUploadStatus(t("add.uploadingProfile"));
        const fd = new FormData();
        fd.append("file", profilePhoto);
        fd.append("type", "profile_photo");
        fd.append("label", t("fields.profilePhoto"));
        const attachRes = await fetch(`/api/pets/${pet.id}/attachments`, { method: "POST", body: fd });
        if (!attachRes.ok) throw new Error(t("add.profileUploadError"));
      }

      if (pendingFiles.length > 0) {
        setUploadStatus(t("add.uploadingDocs"));
        for (const file of pendingFiles) {
          const fd = new FormData();
          fd.append("file", file);
          const docRes = await fetch(`/api/pets/${pet.id}/documents`, {
            method: "POST",
            body: fd,
          });
          if (!docRes.ok) throw new Error(t("add.docUploadError"));
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
        ? f.behavioralTags.filter((x) => x !== tag)
        : [...f.behavioralTags, tag],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">{t("add.title")}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">{t("fields.name")}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("fields.species")}</label>
              <select
                className="input"
                value={form.species}
                onChange={(e) => setForm({ ...form, species: e.target.value })}
              >
                <option value="dog">{t("species.dog")}</option>
                <option value="cat">{t("species.cat")}</option>
                <option value="other">{t("species.other")}</option>
              </select>
            </div>
            <div>
              <label className="label">{t("fields.breed")}</label>
              <BreedCombobox
                value={form.breed}
                onChange={(v) => setForm({ ...form, breed: v })}
                species={form.species}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("fields.gender")}</label>
              <select
                className="input"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="">—</option>
                <option value="male">{t("gender.male")}</option>
                <option value="female">{t("gender.female")}</option>
              </select>
            </div>
            <div>
              <label className="label">{t("fields.weight")}</label>
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
              <label className="label">{t("fields.birthDate")}</label>
              <input
                className="input"
                type="date" lang={cfg.lang}
                value={form.birthDate}
                onChange={(e) =>
                  setForm({ ...form, birthDate: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">{t("fields.microchip")}</label>
              <input
                className="input"
                value={form.microchip}
                onChange={(e) =>
                  setForm({ ...form, microchip: e.target.value })
                }
                placeholder={t("fields.microchipPlaceholder")}
              />
            </div>
          </div>

          {/* Sterilized toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-amber-600" />
              <label className="text-sm font-medium text-petra-text">
                {t("fields.neutered")}
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
                  form.neuteredSpayed ? "left-5" : "left-0.5" // rtl-ok — knob of a dir="ltr" switch
                )}
              />
            </button>
          </div>

          {/* Profile Photo */}
          <div>
            <label className="label">{t("fields.profilePhoto")}</label>
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
                  alt={t("add.profileAlt")}
                />
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(profilePhotoPreview);
                    setProfilePhoto(null);
                    setProfilePhotoPreview(null);
                  }}
                  className="absolute -top-1.5 -start-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  onClick={() => profileInputRef.current?.click()}
                  className="absolute -bottom-1.5 -start-1.5 w-5 h-5 bg-brand-500 text-white rounded-full flex items-center justify-center hover:bg-brand-600"
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
                <span className="text-[10px]">{t("add.photo")}</span>
              </button>
            )}
          </div>

          {/* Behavioral tags */}
          <div>
            <label className="label">{t("add.behavior")}</label>
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
            <label className="label">{t("add.documents")}</label>
            <div
              className="border-2 border-dashed border-stone-200 rounded-xl p-4 text-center cursor-pointer hover:border-amber-300 hover:bg-amber-50/30 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-5 h-5 text-stone-400 mx-auto mb-1" />
              <p className="text-xs text-petra-muted">{t("add.clickToChoose")}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {t("add.fileHint", { max: MAX_UPLOAD_MB })}
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
              ? uploadStatus || tc("progress.saving")
              : t("add.submit")}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            {tc("actions.cancel")}
          </button>
        </div>
        {mutation.isError && (
          <p className="text-xs text-red-500 mt-2 text-center">
            {t("add.saveError")}
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
  const t = useTranslations("customers.petModals");
  const tc = useTranslations("common");
  const { locale } = useBusinessLocale();
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
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("docs.deleteError")); return d; }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["petDocs", petId] }),
    onError: () => toast.error(t("docs.deleteDocError")),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    setIsUploading(true);
    for (const rawFile of files) {
      const file = await compressImage(rawFile);
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(t("docs.tooLarge", { fileName: file.name, max: MAX_UPLOAD_MB }));
        continue;
      }
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch(`/api/pets/${petId}/documents`, { method: "POST", body: fd });
      if (!uploadRes.ok) toast.error(t("docs.uploadError"));
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
            {t("docs.title", { petName })}
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
            {t("docs.empty")}
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
                    {new Date(doc.createdAt).toLocaleDateString(locale)}
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
                  onClick={() => setConfirmDeleteId(doc.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600"
                  title={t("docs.deleteDoc")}
                  aria-label={t("docs.deleteDoc")}
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
            {isUploading ? t("docs.uploading") : t("docs.addDoc")}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {t("docs.fileHint", { max: MAX_UPLOAD_MB })}
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
      <ConfirmDialog
        open={!!confirmDeleteId}
        title={t("docs.confirmTitle")}
        description={t("docs.confirmDescription")}
        confirmLabel={tc("actions.delete")}
        danger
        loading={deleteMutation.isPending}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (!confirmDeleteId) return;
          deleteMutation.mutate(confirmDeleteId, { onSettled: () => setConfirmDeleteId(null) });
        }}
      />
    </div>
  );
}

// ─── Edit Pet Modal ──────────────────────────────────────────────────────────

/** The fields the edit form needs — the pet profile page passes its own (richer) pet shape. */
type EditablePet = Pick<Pet, "id" | "name" | "species" | "breed" | "gender" | "weight" | "birthDate" | "microchip" | "tags">;

export function EditPetModal({
  pet,
  customerId,
  onClose,
}: {
  pet: EditablePet;
  /** Owner's customer id — refreshes the customer card. Null for a pet without an owner. */
  customerId: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("customers.petModals");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
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
        ? f.selectedTags.filter((x) => x !== tag)
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
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("errors.update")); return d; }),
    onSuccess: () => {
      if (customerId) queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      queryClient.invalidateQueries({ queryKey: ["pet", pet.id] });
      queryClient.invalidateQueries({ queryKey: ["pets"] });
      toast.success(t("edit.saved"));
      onClose();
    },
    onError: () => toast.error(t("edit.saveError")),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text">{t("edit.title", { name: pet.name })}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">{t("fields.name")}</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">{t("fields.breed")}</label>
            <BreedCombobox
              value={form.breed}
              onChange={(v) => setForm({ ...form, breed: v })}
              species={pet.species}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("fields.gender")}</label>
              <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">{t("gender.unknown")}</option>
                <option value="male">{t("gender.male")}</option>
                <option value="female">{t("gender.female")}</option>
              </select>
            </div>
            <div>
              <label className="label">{t("fields.weight")}</label>
              <input className="input" type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("fields.birthDate")}</label>
              <input className="input" type="date" lang={cfg.lang} value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
            </div>
            <div>
              <label className="label">{t("fields.microchip")}</label>
              <input className="input" value={form.microchip} onChange={(e) => setForm({ ...form, microchip: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">{t("edit.tags")}</label>
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
            {mutation.isPending ? tc("progress.saving") : t("edit.saveChanges")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
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
  const t = useTranslations("customers.petModals");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const [text, setText] = useState(value);

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/pets/${petId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: text || null }),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("errors.update")); return d; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      onClose();
    },
    onError: () => toast.error(t("note.saveError")),
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
          placeholder={t("note.placeholder")}
        />
        <div className="flex gap-3 mt-4">
          <button className="btn-primary flex-1" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? tc("progress.saving") : tc("actions.save")}
          </button>
          <button className="btn-secondary" onClick={onClose}>{tc("actions.cancel")}</button>
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
  const t = useTranslations("customers.petModals");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
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
        }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("errors.update")); return d; });
      }
      return fetch(`/api/pets/${petId}/medications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || t("med.addError")); return d; });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      onClose();
    },
    onError: () => toast.error(t("med.saveError")),
  });

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">
            {med ? t("med.editTitle") : t("med.addTitle", { petName })}
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
            <label className="label">{t("med.name")}</label>
            <input
              className="input"
              value={form.medName}
              onChange={(e) => setForm({ ...form, medName: e.target.value })}
              placeholder={t("med.namePlaceholder")}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("med.dosage")}</label>
              <input
                className="input"
                value={form.dosage}
                onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                placeholder={t("med.dosagePlaceholder")}
              />
            </div>
            <div>
              <label className="label">{t("med.frequency")}</label>
              <input
                className="input"
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                placeholder={t("med.frequencyPlaceholder")}
              />
            </div>
          </div>
          <div>
            <label className="label">{t("med.times")}</label>
            <input
              className="input"
              value={form.times}
              onChange={(e) => setForm({ ...form, times: e.target.value })}
              placeholder="07:00, 19:00"
            />
          </div>
          <div>
            <label className="label">{t("med.instructions")}</label>
            <input
              className="input"
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder={t("med.instructionsPlaceholder")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("med.startDate")}</label>
              <input
                className="input"
                type="date" lang={cfg.lang}
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t("med.endDate")}</label>
              <input
                className="input"
                type="date" lang={cfg.lang}
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
            {mutation.isPending ? tc("progress.saving") : med ? t("edit.saveChanges") : t("med.add")}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            {tc("actions.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
