"use client";
import { PageTitle } from "@/components/ui/PageTitle";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  PawPrint,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Pill,
  Dog,
  Cat,
  HelpCircle,
  RefreshCw,
  Download,
  Plus,
  Trash2,
  Phone,
  X,
} from "lucide-react";
import { cn, fetchJSON, toWhatsAppPhone } from "@/lib/utils";
import { toast } from "sonner";
import { TierGate } from "@/components/paywall/TierGate";
import { usePermissions } from "@/hooks/usePermissions";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { useTranslations } from "next-intl";

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  gender: string | null;
  weight: number | null;
  birthDate: string | null;
  tags: string | null;
  createdAt: string;
  customer: { id: string; name: string; phone: string | null } | null;
  health: {
    neuteredSpayed: boolean | null;
    rabiesValidUntil: string | null;
    rabiesUnknown: boolean | null;
    allergies: string | null;
    medicalConditions: string | null;
  } | null;
  medications: { id: string; medName: string; frequency: string | null; endDate: string | null }[];
  activeMedicationCount: number;
  vaccinationStatus: "ok" | "expiring" | "expired" | "unknown";
  _count: { appointments: number };
}

const SPECIES_OPTIONS = [
  { value: "", key: "all" },
  { value: "dog", key: "dog" },
  { value: "cat", key: "cat" },
  { value: "other", key: "other" },
];

const GENDER_KEYS = ["male", "female"];

const SPECIES_KEYS = ["dog", "cat", "other"];

function SpeciesIcon({ species, className }: { species: string; className?: string }) {
  if (species === "dog") return <Dog className={cn("w-4 h-4", className)} />;
  if (species === "cat") return <Cat className={cn("w-4 h-4", className)} />;
  return <PawPrint className={cn("w-4 h-4", className)} />;
}

function VaccineBadge({ status }: { status: Pet["vaccinationStatus"] }) {
  const t = useTranslations("pets.petsPage");
  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
        <AlertTriangle className="w-2.5 h-2.5" />
        {t("vaccineBadge.expired")}
      </span>
    );
  }
  if (status === "expiring") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
        <Clock className="w-2.5 h-2.5" />
        {t("vaccineBadge.expiring")}
      </span>
    );
  }
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
        <CheckCircle2 className="w-2.5 h-2.5" />
        {t("vaccineBadge.ok")}
      </span>
    );
  }
  return null;
}

const GENDER_FILTER_OPTIONS = [
  { value: "", key: "all" },
  { value: "male", key: "male" },
  { value: "female", key: "female" },
];

const VACCINE_FILTER_OPTIONS = [
  { value: "", key: "all" },
  { value: "expired", key: "expired" },
  { value: "expiring", key: "expiring" },
  { value: "ok", key: "ok" },
  { value: "unknown", key: "unknown" },
];

// ─── WhatsApp Icon (official logo SVG — mirrors customers page QuickActions) ──

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

// ─── Add Pet Modal (customer picker + basic pet fields) ──────────────────────

interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
}

function AddPetModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("pets.petsPage");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const [customerSearch, setCustomerSearch] = useState("");
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [form, setForm] = useState({
    name: "",
    species: "dog",
    breed: "",
    gender: "",
    birthDate: "",
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCustomerSearch(customerSearch), 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  const { data: customerResults = [], isFetching: searchingCustomers } = useQuery<CustomerOption[]>({
    queryKey: ["pets-customer-search", debouncedCustomerSearch],
    queryFn: () =>
      fetch(`/api/customers?search=${encodeURIComponent(debouncedCustomerSearch)}&take=20`).then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      }),
    enabled: !selectedCustomer,
  });

  // Same endpoint + payload shape as the customer-card add-pet flow
  // (customers/[id]/page.tsx AddPetModal → POST /api/customers/:id/pets)
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/customers/${selectedCustomer!.id}/pets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          species: form.species,
          breed: form.breed,
          gender: form.gender,
          weight: "",
          birthDate: form.birthDate,
          microchip: "",
          neuteredSpayed: false,
          behavioralTags: [],
        }),
      });
      if (!res.ok) throw new Error("Failed to create pet");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pets-all"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (selectedCustomer) {
        queryClient.invalidateQueries({ queryKey: ["customer", selectedCustomer.id] });
      }
      toast.success(t("addModal.toastSuccess"));
      onClose();
    },
    onError: () => toast.error(t("addModal.toastError")),
  });

  const canSubmit = !!selectedCustomer && !!form.name.trim() && !mutation.isPending;

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-petra-text">{t("addModal.title")}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-petra-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Customer picker */}
          <div>
            <label className="label">{t("addModal.customerLabel")}</label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between gap-2 border border-brand-200 bg-brand-50 rounded-lg px-3 py-2">
                <span className="text-sm font-medium text-petra-text truncate">
                  {selectedCustomer.name}
                  {selectedCustomer.phone && (
                    <span className="text-xs text-petra-muted ms-2" dir="ltr">{selectedCustomer.phone}</span>
                  )}
                </span>
                <button
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-brand-100 text-petra-muted shrink-0"
                  onClick={() => setSelectedCustomer(null)}
                  title={t("addModal.changeCustomer")}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted pointer-events-none" />
                  <input
                    className="input ps-9 w-full"
                    placeholder={t("addModal.customerSearchPlaceholder")}
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="mt-2 max-h-44 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-50">
                  {searchingCustomers ? (
                    <p className="text-xs text-petra-muted p-3 text-center">{t("addModal.searching")}</p>
                  ) : customerResults.length === 0 ? (
                    <p className="text-xs text-petra-muted p-3 text-center">{t("addModal.noCustomers")}</p>
                  ) : (
                    customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-start px-3 py-2 hover:bg-brand-50 transition-colors flex items-center justify-between gap-2"
                        onClick={() => setSelectedCustomer(c)}
                      >
                        <span className="text-sm text-petra-text truncate">{c.name}</span>
                        {c.phone && (
                          <span className="text-xs text-petra-muted shrink-0" dir="ltr">{c.phone}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div>
            <label className="label">{t("addModal.nameLabel")}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("addModal.speciesLabel")}</label>
              <select
                className="input"
                value={form.species}
                onChange={(e) => setForm({ ...form, species: e.target.value })}
              >
                <option value="dog">{t("speciesLabel.dog")}</option>
                <option value="cat">{t("speciesLabel.cat")}</option>
                <option value="other">{t("speciesLabel.other")}</option>
              </select>
            </div>
            <div>
              <label className="label">{t("addModal.breedLabel")}</label>
              <input
                className="input"
                value={form.breed}
                onChange={(e) => setForm({ ...form, breed: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("addModal.genderLabel")}</label>
              <select
                className="input"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="">{t("addModal.genderUnspecified")}</option>
                <option value="male">{t("genderLabel.male")}</option>
                <option value="female">{t("genderLabel.female")}</option>
              </select>
            </div>
            <div>
              <label className="label">{t("addModal.birthDateLabel")}</label>
              <input
                type="date"
                className="input"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              className="btn-primary flex-1"
              disabled={!canSubmit}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? tc("progress.saving") : t("addModal.submit")}
            </button>
            <button className="btn-secondary flex-1" onClick={onClose}>
              {tc("actions.cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PetsPage() {
  const t = useTranslations("pets.petsPage");
  return (
    <TierGate
      feature="pets_advanced"
      title={t("tierGate.title")}
      description={t("tierGate.description")}
    >
      <PetsPageContent />
    </TierGate>
  );
}

function PetsPageContent() {
  const t = useTranslations("pets.petsPage");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const [species, setSpecies] = useState("");
  const [gender, setGender] = useState("");
  const [vaccineStatus, setVaccineStatus] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  // Mirrors the customer-card pet-delete flow (customers/[id]/page.tsx):
  // owner → typed-confirm modal + x-confirm-action header; manager → approval request
  const [deletingPetId, setDeletingPetId] = useState<{ id: string; customerId: string | null } | null>(null);
  const [deletingPetOwner, setDeletingPetOwner] = useState<{ id: string; name: string; customerId: string | null } | null>(null);
  const perms = usePermissions();
  const queryClient = useQueryClient();

  const deletePetMutation = useMutation<Record<string, unknown>, Error, { petId: string; customerId?: string | null; confirmAction?: string }>({
    mutationFn: ({ petId, confirmAction }) =>
      fetchJSON(`/api/pets/${petId}`, {
        method: "DELETE",
        ...(confirmAction ? { headers: { "x-confirm-action": confirmAction } } : {}),
      }) as Promise<Record<string, unknown>>,
    onSuccess: (data, { customerId }) => {
      if (data.pendingApproval) {
        toast.success(t("toasts.pendingApproval"));
        setDeletingPetId(null);
        setDeletingPetOwner(null);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["pets-all"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (customerId) queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      toast.success(t("toasts.deleted"));
      setDeletingPetId(null);
      setDeletingPetOwner(null);
    },
    onError: (err) => {
      toast.error(err?.message || t("toasts.deleteError"));
      setDeletingPetId(null);
      setDeletingPetOwner(null);
    },
  });

  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((window as any)._petSearchTimer);
    (window as any)._petSearchTimer = setTimeout(() => setDebouncedSearch(val), 300);
  };

  const params = new URLSearchParams();
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (species) params.set("species", species);

  const { data, isLoading, isError, refetch } = useQuery<{
    pets: Pet[];
    total: number;
  }>({
    queryKey: ["pets-all", debouncedSearch, species],
    queryFn: () => fetch(`/api/pets?${params.toString()}`).then((r) => r.json()),
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/pets/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pets-export.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert(t("toasts.exportError"));
    } finally {
      setIsExporting(false);
    }
  };

  const pets = data?.pets ?? [];

  // Client-side filters (gender + vaccine status)
  const filteredPets = pets.filter((p) => {
    if (gender && p.gender !== gender) return false;
    if (vaccineStatus && p.vaccinationStatus !== vaccineStatus) return false;
    return true;
  });

  // Stats
  const vaccinationIssues = pets.filter(
    (p) => p.vaccinationStatus === "expired" || p.vaccinationStatus === "expiring"
  ).length;
  const withMeds = pets.filter((p) => p.activeMedicationCount > 0).length;
  const dogs = pets.filter((p) => p.species === "dog").length;
  const cats = pets.filter((p) => p.species === "cat").length;

  return (
    <div className="p-0 sm:p-6 space-y-6 animate-fade-in">
      <PageTitle title={t("header.title")} />
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("header.title")}</h1>
          <p className="text-sm text-petra-muted mt-1">
            {t("header.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary gap-2 inline-flex items-center"
          >
            <Plus className="w-4 h-4" />
            {t("header.addPet")}
          </button>
          {perms.canExportData && (
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="btn-secondary gap-2 inline-flex items-center"
          >
            <Download className="w-4 h-4" />
            {isExporting ? tc("progress.exporting") : t("header.exportXlsx")}
          </button>
          )}
          <button onClick={() => refetch()} className="btn-secondary gap-2 inline-flex items-center">
            <RefreshCw className="w-4 h-4" />
            {t("header.refresh")}
          </button>
        </div>
      </div>

      {/* Stats row */}
      {!isLoading && pets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
              <PawPrint className="w-4 h-4 text-brand-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-petra-text">{data?.total ?? 0}</p>
              <p className="text-xs text-petra-muted">{t("stats.total")}</p>
            </div>
          </div>
          <div className="card p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Dog className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-petra-text">{dogs}</p>
              <p className="text-xs text-petra-muted">{t("stats.dogsCats", { cats: String(cats) })}</p>
            </div>
          </div>
          <div className="card p-3 flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", vaccinationIssues > 0 ? "bg-red-100" : "bg-emerald-100")}>
              <AlertTriangle className={cn("w-4 h-4", vaccinationIssues > 0 ? "text-red-500" : "text-emerald-500")} />
            </div>
            <div>
              <p className="text-xl font-bold text-petra-text">{vaccinationIssues}</p>
              <p className="text-xs text-petra-muted">{t("stats.vaccinationIssues")}</p>
            </div>
          </div>
          <div className="card p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Pill className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-petra-text">{withMeds}</p>
              <p className="text-xs text-petra-muted">{t("stats.withMeds")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted pointer-events-none" />
            <input
              className="input ps-9 w-full"
              placeholder={t("filters.searchPlaceholder")}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {SPECIES_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSpecies(opt.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                  species === opt.value
                    ? "bg-brand-500 text-white border-brand-500"
                    : "bg-white text-petra-muted border-slate-200 hover:border-brand-300"
                )}
              >
                {t(`speciesFilter.${opt.key}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2 flex-wrap">
            {GENDER_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGender(opt.value)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                  gender === opt.value
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white text-petra-muted border-slate-200 hover:border-blue-300"
                )}
              >
                {t(`genderFilter.${opt.key}`)}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {VACCINE_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setVaccineStatus(opt.value)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                  vaccineStatus === opt.value
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white text-petra-muted border-slate-200 hover:border-emerald-300"
                )}
              >
                {t(`vaccineFilter.${opt.key}`)}
              </button>
            ))}
          </div>
          {data && (
            <span className="text-sm text-petra-muted ms-auto">
              {filteredPets.length !== pets.length
                ? t("filters.countFiltered", { filtered: String(filteredPets.length), total: String(data.total) })
                : t("filters.countAll", { total: String(data.total) })}
            </span>
          )}
        </div>
      </div>

      {/* Loading / Error */}
      {isLoading && <PetraLoader />}
      {isError && (
        <div className="card p-8 text-center text-red-500 text-sm">{t("states.loadError")}</div>
      )}
      {!isLoading && !isError && filteredPets.length === 0 && (
        <div className="card p-12 text-center">
          <PawPrint className="w-10 h-10 mx-auto mb-3 text-petra-muted opacity-30" />
          <p className="text-petra-muted text-sm">
            {debouncedSearch || species || gender || vaccineStatus ? t("states.emptyFiltered") : t("states.empty")}
          </p>
          {!debouncedSearch && !species && !gender && !vaccineStatus && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary mt-4 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t("header.addPet")}
            </button>
          )}
        </div>
      )}

      {/* Pets table */}
      {!isLoading && filteredPets.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t("table.caption")}</caption>
              <thead>
                <tr className="border-b border-slate-100">
                  <th scope="col" className="table-header-cell">{t("table.name")}</th>
                  <th scope="col" className="table-header-cell">{t("table.breedSpecies")}</th>
                  <th scope="col" className="table-header-cell">{t("table.owner")}</th>
                  <th scope="col" className="table-header-cell">{t("table.ageWeight")}</th>
                  <th scope="col" className="table-header-cell">{t("table.vaccine")}</th>
                  <th scope="col" className="table-header-cell">{t("table.meds")}</th>
                  <th scope="col" className="table-header-cell">{t("table.appointments")}</th>
                  {!perms.isStaff && !perms.isVolunteer && (
                    <th scope="col" className="table-header-cell">
                      <span className="sr-only">{t("table.actions")}</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredPets.map((pet) => {
                  const ageStr = pet.birthDate
                    ? (() => {
                        const bd = new Date(pet.birthDate);
                        const now = new Date();
                        const months = (now.getFullYear() - bd.getFullYear()) * 12 + (now.getMonth() - bd.getMonth());
                        if (months < 24) return t("table.ageMonths", { count: months });
                        return t("table.ageYears", { count: Math.floor(months / 12) });
                      })()
                    : null;

                  const parsedTags = pet.tags ? (() => { try { return JSON.parse(pet.tags!); } catch { return []; } })() : [];

                  return (
                    <tr key={pet.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                            <SpeciesIcon species={pet.species} className="text-brand-500" />
                          </div>
                          <div>
                            <Link
                              href={`/pets/${pet.id}`}
                              className="font-semibold text-petra-text hover:text-brand-600 transition-colors"
                            >
                              {pet.name}
                            </Link>
                            {pet.gender && (
                              <p className="text-[10px] text-petra-muted">
                                {GENDER_KEYS.includes(pet.gender) ? t(`genderLabel.${pet.gender}`) : pet.gender}
                                {pet.health?.neuteredSpayed ? t("table.neutered") : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="text-petra-text">{pet.breed || (SPECIES_KEYS.includes(pet.species) ? t(`speciesLabel.${pet.species}`) : "") || pet.species}</span>
                        {pet.species && pet.breed && (
                          <span className="block text-[10px] text-petra-muted">{(SPECIES_KEYS.includes(pet.species) ? t(`speciesLabel.${pet.species}`) : "") || pet.species}</span>
                        )}
                      </td>
                      <td className="table-cell">
                        {pet.customer ? (
                          <>
                            <Link
                              href={`/customers/${pet.customer.id}`}
                              className="text-brand-600 hover:underline font-medium"
                            >
                              {pet.customer.name}
                            </Link>
                            {pet.customer.phone && (
                              <div className="flex items-center gap-1 mt-0.5">
                                {pet.customer.phone.replace(/\D/g, "").length >= 9 && (
                                  <>
                                    <a
                                      href={`https://wa.me/${toWhatsAppPhone(pet.customer.phone)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="w-6 h-6 rounded-lg flex items-center justify-center text-[#25D366] hover:bg-[#E8FEF0] transition-colors"
                                      title={t("table.sendWhatsApp")}
                                      aria-label={t("table.sendWhatsApp")}
                                    >
                                      <WhatsAppIcon className="w-3.5 h-3.5" />
                                    </a>
                                    <a
                                      href={`tel:${pet.customer.phone}`}
                                      className="w-6 h-6 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors"
                                      title={t("table.call", { phone: pet.customer.phone })}
                                      aria-label={t("table.call", { phone: pet.customer.phone })}
                                    >
                                      <Phone className="w-3.5 h-3.5" />
                                    </a>
                                  </>
                                )}
                                <span className="text-[10px] text-petra-muted" dir="ltr">{pet.customer.phone}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-petra-muted text-sm">{t("table.serviceDog")}</span>
                        )}
                      </td>
                      <td className="table-cell">
                        {ageStr && <span className="text-petra-text">{ageStr}</span>}
                        {pet.weight && (
                          <span className="block text-[10px] text-petra-muted">{t("table.weight", { weight: String(pet.weight) })}</span>
                        )}
                        {!ageStr && !pet.weight && <span className="text-petra-muted">—</span>}
                      </td>
                      <td className="table-cell">
                        <VaccineBadge status={pet.vaccinationStatus} />
                        {pet.vaccinationStatus === "unknown" && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-petra-muted">
                            <HelpCircle className="w-2.5 h-2.5" />
                            {t("table.vaccineUnknown")}
                          </span>
                        )}
                      </td>
                      <td className="table-cell">
                        {pet.activeMedicationCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                            <Pill className="w-2.5 h-2.5" />
                            {t("table.medsCount", { count: pet.activeMedicationCount })}
                          </span>
                        ) : (
                          <span className="text-petra-muted text-[10px]">—</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className="text-petra-text text-xs">{pet._count.appointments}</span>
                      </td>
                      {!perms.isStaff && !perms.isVolunteer && (
                        <td className="table-cell">
                          <button
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                            onClick={() => {
                              if (perms.isOwner) {
                                setDeletingPetOwner({ id: pet.id, name: pet.name, customerId: pet.customer?.id ?? null });
                              } else {
                                setDeletingPetId({ id: pet.id, customerId: pet.customer?.id ?? null });
                              }
                            }}
                            title={perms.isOwner ? tc("actions.delete") : t("table.sendDeleteRequest")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add pet modal */}
      {showAddModal && <AddPetModal onClose={() => setShowAddModal(false)} />}

      {/* Manager delete → approval-request modal (mirrors customers/[id]) */}
      {deletingPetId && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setDeletingPetId(null)} />
          <div className="modal-content max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-petra-text mb-2">{t("managerDelete.title")}</h3>
            <p className="text-sm text-petra-muted mb-5">
              {t("managerDelete.body")}
            </p>
            <div className="flex gap-3">
              <button
                className="btn-primary flex-1 !bg-red-600 hover:!bg-red-700"
                disabled={deletePetMutation.isPending}
                onClick={() => deletePetMutation.mutate({ petId: deletingPetId.id, customerId: deletingPetId.customerId })}
              >
                {deletePetMutation.isPending ? t("managerDelete.sending") : t("managerDelete.submit")}
              </button>
              <button className="btn-secondary flex-1" onClick={() => setDeletingPetId(null)}>
                {tc("actions.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Owner typed-confirm pet delete modal (mirrors customers/[id]) */}
      {deletingPetOwner && (
        <ConfirmDeleteModal
          open
          onClose={() => setDeletingPetOwner(null)}
          onConfirm={() =>
            deletePetMutation.mutate({
              petId: deletingPetOwner.id,
              customerId: deletingPetOwner.customerId,
              confirmAction: `DELETE_PET_${deletingPetOwner.id}`,
            })
          }
          title={t("ownerDelete.title")}
          confirmText={deletingPetOwner.name}
          description={t("ownerDelete.description", { name: deletingPetOwner.name })}
          loading={deletePetMutation.isPending}
        />
      )}
    </div>
  );
}
