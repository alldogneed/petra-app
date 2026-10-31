"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Pill,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  RefreshCw,
  Search,
  PawPrint,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { BoardingTabs } from "@/components/boarding/BoardingTabs";
import { PetraLoader } from "@/components/ui/PetraLoader";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MedicationItem {
  id: string;
  medName: string;
  dosage: string | null;
  frequency: string | null;
  times: string | null;
  instructions: string | null;
  startDate: string | null;
  endDate: string | null;
  petId: string;
  pet: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
    customer: {
      id: string;
      name: string;
      phone: string;
    };
  };
}

interface PetOption {
  id: string;
  name: string;
  customer?: { name: string };
}

interface AddMedForm {
  petId: string;
  medName: string;
  dosage: string;
  frequency: string;
  times: string;
  instructions: string;
  startDate: string;
  endDate: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isActive(med: MedicationItem): boolean {
  if (!med.endDate) return true;
  return new Date(med.endDate) >= new Date();
}

function formatDate(d: string | null, locale: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(locale);
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({
  med,
  onClose,
}: {
  med: MedicationItem;
  onClose: () => void;
}) {
  const t = useTranslations("boarding.medicationsPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    medName: med.medName,
    dosage: med.dosage ?? "",
    frequency: med.frequency ?? "",
    times: med.times ?? "",
    instructions: med.instructions ?? "",
    startDate: med.startDate ? med.startDate.slice(0, 10) : "",
    endDate: med.endDate ? med.endDate.slice(0, 10) : "",
  });

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch(`/api/medications/${med.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error(t("errors.update"));
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medications"] });
      onClose();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      medName: form.medName,
      dosage: form.dosage || null,
      frequency: form.frequency || null,
      times: form.times || null,
      instructions: form.instructions || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <Pencil className="w-5 h-5 text-brand-500" />
            {t("editModal.title")}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t("form.medName")}</label>
            <input
              className="input w-full"
              required
              value={form.medName}
              onChange={(e) => setForm((f) => ({ ...f, medName: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("form.dosage")}</label>
              <input
                className="input w-full"
                placeholder={t("form.dosagePlaceholder")}
                value={form.dosage}
                onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">{t("form.frequency")}</label>
              <input
                className="input w-full"
                placeholder={t("editModal.frequencyPlaceholder")}
                value={form.frequency}
                onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label">{t("form.times")}</label>
            <input
              className="input w-full"
              placeholder={t("form.timesPlaceholder")}
              value={form.times}
              onChange={(e) => setForm((f) => ({ ...f, times: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">{t("form.instructions")}</label>
            <textarea
              className="input w-full min-h-[60px]"
              value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("form.startDate")}</label>
              <input
                type="date" lang={cfg.lang}
                className="input w-full"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">{t("form.endDate")}</label>
              <input
                type="date" lang={cfg.lang}
                className="input w-full"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>

          {mutation.error && (
            <p className="text-sm text-red-500">{String(mutation.error)}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary flex-1"
            >
              {mutation.isPending ? tc("progress.saving") : t("editModal.submit")}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              {tc("actions.cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Medication Modal ─────────────────────────────────────────────────────

function AddModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("boarding.medicationsPage");
  const tc = useTranslations("common");
  const { cfg } = useBusinessLocale();
  const queryClient = useQueryClient();

  const { data: petsData } = useQuery<PetOption[]>({
    queryKey: ["pets-list-for-modal"],
    queryFn: () =>
      fetch("/api/customers?full=1")
        .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
        .then(
          (customers: Array<{ id: string; name: string; pets: PetOption[] }>) =>
            customers.flatMap((c) =>
              (c.pets ?? []).map((p) => ({
                ...p,
                customer: { name: c.name },
              }))
            )
        ),
    staleTime: 60000,
  });

  const [form, setForm] = useState<AddMedForm>({
    petId: "",
    medName: "",
    dosage: "",
    frequency: "",
    times: "",
    instructions: "",
    startDate: "",
    endDate: "",
  });

  const mutation = useMutation({
    mutationFn: (data: AddMedForm) =>
      fetch(`/api/pets/${data.petId}/medications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medName: data.medName,
          dosage: data.dosage || null,
          frequency: data.frequency || null,
          times: data.times || null,
          instructions: data.instructions || null,
          startDate: data.startDate || null,
          endDate: data.endDate || null,
        }),
      }).then((r) => {
        if (!r.ok) throw new Error(t("errors.add"));
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medications"] });
      onClose();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.petId) return;
    mutation.mutate(form);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-petra-text flex items-center gap-2">
            <Plus className="w-5 h-5 text-brand-500" />
            {t("addModal.title")}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t("addModal.pickDog")}</label>
            <div className="relative">
              <select
                required
                className="input w-full appearance-none"
                value={form.petId}
                onChange={(e) => setForm((f) => ({ ...f, petId: e.target.value }))}
              >
                <option value="">{t("addModal.pickDogOption")}</option>
                {(petsData ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.customer ? ` (${p.customer.name})` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="label">{t("form.medName")}</label>
            <input
              className="input w-full"
              required
              placeholder={t("addModal.medNamePlaceholder")}
              value={form.medName}
              onChange={(e) => setForm((f) => ({ ...f, medName: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("form.dosage")}</label>
              <input
                className="input w-full"
                placeholder={t("form.dosagePlaceholder")}
                value={form.dosage}
                onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">{t("form.frequency")}</label>
              <input
                className="input w-full"
                placeholder={t("addModal.frequencyPlaceholder")}
                value={form.frequency}
                onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label">{t("form.times")}</label>
            <input
              className="input w-full"
              placeholder={t("form.timesPlaceholder")}
              value={form.times}
              onChange={(e) => setForm((f) => ({ ...f, times: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">{t("form.instructions")}</label>
            <textarea
              className="input w-full min-h-[60px]"
              placeholder={t("addModal.instructionsPlaceholder")}
              value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t("form.startDate")}</label>
              <input
                type="date" lang={cfg.lang}
                className="input w-full"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">{t("form.endDate")}</label>
              <input
                type="date" lang={cfg.lang}
                className="input w-full"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>

          {mutation.error && (
            <p className="text-sm text-red-500">{String(mutation.error)}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={mutation.isPending || !form.petId}
              className="btn-primary flex-1"
            >
              {mutation.isPending ? t("addModal.adding") : t("addMed")}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              {tc("actions.cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MedicationsPage() {
  const t = useTranslations("boarding.medicationsPage");
  const tc = useTranslations("common");
  const { locale } = useBusinessLocale();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">("all");
  const [search, setSearch] = useState("");
  const [editMed, setEditMed] = useState<MedicationItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    medications: MedicationItem[];
    total: number;
  }>({
    queryKey: ["medications", activeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeFilter !== "all") params.set("active", activeFilter);
      return fetch(`/api/medications?${params}`).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch medications");
        return r.json();
      });
    },
    staleTime: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/medications/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error(t("errors.delete"));
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medications"] });
      toast.success(t("toasts.deleted"));
    },
    onError: () => toast.error(t("toasts.deleteError")),
  });

  const allMeds = data?.medications ?? [];

  const meds = allMeds.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.pet?.name?.toLowerCase().includes(q) ||
      m.medName.toLowerCase().includes(q) ||
      m.pet?.customer?.name?.toLowerCase().includes(q)
    );
  });

  function handleDelete(id: string, medName: string) {
    if (window.confirm(t("confirmDelete", { medName }))) {
      deleteMutation.mutate(id);
    }
  }

  return (
    <div className="p-0 sm:p-6 space-y-6 animate-fade-in">
      <BoardingTabs />
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="text-sm text-petra-muted mt-1">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary gap-2 inline-flex items-center"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
            {t("refresh")}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="btn-primary gap-2 inline-flex items-center"
          >
            <Plus className="w-4 h-4" />
            {t("addMed")}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full ps-9"
          />
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted pointer-events-none" />
        </div>

        {/* Active filter */}
        <div className="flex items-center gap-2">
          {(
            [
              { value: "all", labelKey: "filters.all" },
              { value: "true", labelKey: "filters.active" },
              { value: "false", labelKey: "filters.inactive" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setActiveFilter(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                activeFilter === opt.value
                  ? "bg-brand-500 text-white border-brand-500"
                  : "bg-white text-petra-muted border-slate-200 hover:border-brand-300"
              )}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>

        {data && (
          <span className="ms-auto text-sm text-petra-muted">
            {t("count", { count: meds.length })}
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading && <PetraLoader />}

      {/* Error */}
      {isError && (
        <div className="card p-8 text-center text-red-500 text-sm">
          {t("loadError")}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && meds.length === 0 && (
        <div className="card p-12 text-center space-y-3">
          <Pill className="w-10 h-10 mx-auto text-slate-300" />
          <p className="text-petra-muted text-sm">{t("empty")}</p>
          <button
            onClick={() => setShowAdd(true)}
            className="text-sm text-brand-500 hover:underline"
          >
            {t("addFirst")}
          </button>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && meds.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="table-header-cell">{t("table.dogName")}</th>
                  <th className="table-header-cell">{t("table.owner")}</th>
                  <th className="table-header-cell">{t("table.medication")}</th>
                  <th className="table-header-cell">{t("table.dosage")}</th>
                  <th className="table-header-cell">{t("table.frequency")}</th>
                  <th className="table-header-cell">{t("table.start")}</th>
                  <th className="table-header-cell">{t("table.end")}</th>
                  <th className="table-header-cell">{t("table.status")}</th>
                  <th className="table-header-cell">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {meds.map((med) => {
                  const active = isActive(med);
                  return (
                    <tr key={med.id} className="hover:bg-slate-50 transition-colors">
                      {/* Pet */}
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
                            <PawPrint className="w-3.5 h-3.5 text-brand-500" />
                          </div>
                          <div>
                            <p className="font-medium text-petra-text">
                              {med.pet?.name ?? "—"}
                            </p>
                            {med.pet?.breed && (
                              <p className="text-xs text-petra-muted">
                                {med.pet.breed}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="table-cell">
                        {med.pet?.customer ? (
                          <Link
                            href={`/customers/${med.pet.customer.id}`}
                            className="text-brand-600 hover:underline"
                          >
                            {med.pet.customer.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Med name */}
                      <td className="table-cell">
                        <span className="flex items-center gap-1.5 font-medium text-petra-text">
                          <Pill className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                          {med.medName}
                        </span>
                        {med.instructions && (
                          <p className="text-xs text-petra-muted mt-0.5 max-w-[200px] truncate">
                            {med.instructions}
                          </p>
                        )}
                      </td>

                      {/* Dosage */}
                      <td className="table-cell text-petra-muted">
                        {med.dosage ?? "—"}
                      </td>

                      {/* Frequency */}
                      <td className="table-cell">
                        {med.frequency ? (
                          <span className="badge badge-neutral">{med.frequency}</span>
                        ) : (
                          <span className="text-petra-muted">—</span>
                        )}
                      </td>

                      {/* Start date */}
                      <td className="table-cell text-petra-muted">
                        {formatDate(med.startDate, locale)}
                      </td>

                      {/* End date */}
                      <td className="table-cell text-petra-muted">
                        {formatDate(med.endDate, locale)}
                      </td>

                      {/* Status */}
                      <td className="table-cell">
                        {active ? (
                          <span className="flex items-center gap-1 text-emerald-700 font-medium text-xs">
                            <Check className="w-3.5 h-3.5" />
                            {t("status.active")}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-400 text-xs">
                            <X className="w-3.5 h-3.5" />
                            {t("status.inactive")}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditMed(med)}
                            className="p-1.5 rounded-lg text-petra-muted hover:text-brand-600 hover:bg-brand-50 transition-colors"
                            title={t("edit")}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(med.id, med.medName)}
                            disabled={deleteMutation.isPending}
                            className="p-1.5 rounded-lg text-petra-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                            title={tc("actions.delete")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAdd && <AddModal onClose={() => setShowAdd(false)} />}
      {editMed && (
        <EditModal med={editMed} onClose={() => setEditMed(null)} />
      )}
    </div>
  );
}
