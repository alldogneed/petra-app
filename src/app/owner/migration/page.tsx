"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload, Database, CheckCircle2, AlertTriangle, XCircle, Search, X, Check,
  Building2, Users, PawPrint, SkipForward, Play, RefreshCw, FileSpreadsheet, Download,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn, fetchJSON } from "@/lib/utils";
import { TIER_LABELS } from "@/lib/platform-labels";
import { PetraLoader } from "@/components/ui/PetraLoader";

interface Business {
  id: string;
  name: string;
  tier: string;
  status: string;
  email?: string | null;
}

interface ParseResult {
  batchId: string;
  businessName: string;
  stats: {
    totalCustomers: number;
    totalPets: number;
    skippedRows: number;
    inFileDuplicates: number;
    dbDuplicates: number;
    orphanPets: number;
  };
  topIssues: { row: number; type: string; code: string; message: string }[];
}

interface ExecuteResult {
  createdCustomers: number;
  mergedCustomers: number;
  createdPets: number;
}

const STEPS = ["business", "upload", "preview", "import"] as const;

const ISSUE_TYPES = ["customer", "pet"];

export default function MigrationPage() {
  const t = useTranslations("owner.ownerMigrationPage");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [businessSearch, setBusinessSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fileName, setFileName] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [executeResult, setExecuteResult] = useState<(ExecuteResult & { businessName: string }) | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(businessSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [businessSearch]);

  // Business list — server-side search (name / email / phone), capped at 100 by the API
  const { data: bizData, isLoading: bizLoading, isError: bizError } = useQuery({
    queryKey: ["owner", "migration", "businesses", debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams({ search: debouncedSearch });
      return fetchJSON<{ businesses: Business[] }>(`/api/admin/migration/businesses?${params}`);
    },
  });
  const businesses: Business[] = bizData?.businesses ?? [];

  const parseMutation = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error(t("errors.chooseFile"));
      if (!selectedBusiness) throw new Error(t("errors.chooseBusiness"));
      const formData = new FormData();
      formData.append("targetBusinessId", selectedBusiness.id);
      formData.append("file", file);
      return fetchJSON<ParseResult>("/api/admin/migration/parse", { method: "POST", body: formData });
    },
    onSuccess: (data) => {
      setParseResult(data);
      setExecuteResult(null);
    },
    onError: (err: Error) => toast.error(err.message || t("errors.parseFailed")),
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      if (!parseResult?.batchId) throw new Error(t("errors.noBatch"));
      return fetchJSON<ExecuteResult>("/api/admin/migration/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: parseResult.batchId }),
      });
    },
    onSuccess: (data) => {
      setExecuteResult({ ...data, businessName: parseResult?.businessName ?? selectedBusiness?.name ?? "" });
      setParseResult(null);
      setConfirmOpen(false);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      toast.success(t("toasts.importDone"));
      queryClient.invalidateQueries({ queryKey: ["owner"] });
    },
    onError: (err: Error) => {
      setConfirmOpen(false);
      toast.error(err.message || t("errors.importFailed"));
    },
  });

  function clearFileState() {
    setParseResult(null);
    setExecuteResult(null);
    parseMutation.reset();
    executeMutation.reset();
  }

  function reset() {
    clearFileState();
    setConfirmOpen(false);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function selectBusiness(b: Business) {
    if (selectedBusiness?.id !== b.id) clearFileState(); // a parsed batch belongs to one business
    setSelectedBusiness(b);
  }

  function onFileChosen() {
    setFileName(fileRef.current?.files?.[0]?.name ?? "");
    clearFileState();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!fileRef.current || !e.dataTransfer.files.length) return;
    fileRef.current.files = e.dataTransfer.files;
    onFileChosen();
  }

  const currentStep = executeResult ? 4 : confirmOpen || executeMutation.isPending ? 4 : parseResult ? 3 : selectedBusiness ? 2 : 1;
  const totalRows = parseResult ? parseResult.stats.totalCustomers + parseResult.stats.totalPets : 0;

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title">{t("header.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("header.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/admin/migration/template" download="petra-import-template.xlsx" className="btn-secondary">
            <Download className="w-4 h-4" />
            {t("header.downloadTemplate")}
          </a>
        </div>
      </div>

      {/* Steps */}
      <ol className="card p-3 mb-6 flex flex-wrap items-center gap-x-2 gap-y-2">
        {STEPS.map((stepId, i) => {
          const label = t(`steps.${stepId}`);
          const n = i + 1;
          const done = executeResult ? true : n < currentStep;
          const active = !executeResult && n === currentStep;
          return (
            <li key={stepId} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                  done ? "bg-emerald-100 text-emerald-700" : active ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500"
                )}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : n}
              </span>
              <span className={cn("text-sm", active ? "font-semibold text-slate-900" : done ? "text-slate-700" : "text-slate-500")}>
                {label}
              </span>
              {n < STEPS.length && <span className="w-4 sm:w-8 h-px bg-slate-200 mx-1" aria-hidden />}
            </li>
          );
        })}
      </ol>

      {/* Step 4 — result */}
      {executeResult && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">{t("result.title")}</h2>
              {executeResult.businessName && (
                <p className="text-sm text-slate-500">{t("result.businessLine", { name: executeResult.businessName })}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t("result.newCustomers"), value: executeResult.createdCustomers, icon: Users },
              { label: t("result.mergedCustomers"), value: executeResult.mergedCustomers, icon: Users },
              { label: t("result.petsAdded"), value: executeResult.createdPets, icon: PawPrint },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <Icon className="w-4 h-4 mx-auto mb-1 text-slate-500" />
                <div className="text-xl font-bold text-slate-900">{value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          <button onClick={reset} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> {t("result.importAnother")}
          </button>
        </div>
      )}

      {!executeResult && (
        <div className="space-y-4">
          {/* Step 1 — business */}
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">{t("business.title")}</h2>
            <div className="relative mb-2">
              <Search className="w-4 h-4 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={businessSearch}
                onChange={(e) => setBusinessSearch(e.target.value)}
                placeholder={t("business.searchPlaceholder")}
                aria-label={t("business.searchAria")}
                className="input w-full ps-9"
              />
            </div>

            {bizLoading ? (
              <PetraLoader />
            ) : bizError ? (
              <p className="text-sm text-red-600 py-4 text-center">{t("errors.loadBusinesses")}</p>
            ) : businesses.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">
                {debouncedSearch ? t("business.noMatch") : t("business.empty")}
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {businesses.map((b) => {
                  const selected = selectedBusiness?.id === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => selectBusiness(b)}
                      aria-pressed={selected}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-start transition-colors",
                        selected ? "bg-brand-50" : "hover:bg-slate-50"
                      )}
                    >
                      <Building2 className={cn("w-4 h-4 flex-shrink-0", selected ? "text-brand-600" : "text-slate-500")} />
                      <span className="flex-1 min-w-0 text-start">
                        <span className={cn("block text-sm truncate", selected ? "font-semibold text-slate-900" : "text-slate-700")}>
                          {b.name}
                        </span>
                        {b.email && <span className="block text-xs text-slate-500 truncate" dir="ltr">{b.email}</span>}
                      </span>
                      <span className="badge badge-neutral flex-shrink-0">{TIER_LABELS[b.tier] ?? b.tier}</span>
                      <CheckCircle2 className={cn("w-4 h-4 flex-shrink-0", selected ? "text-brand-600" : "invisible")} />
                    </button>
                  );
                })}
              </div>
            )}
            {businesses.length === 100 && (
              <p className="text-xs text-slate-500 mt-2">{t("business.capped")}</p>
            )}

            {selectedBusiness && (
              <div className="flex items-center gap-2 mt-3 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{t.rich("business.target", { name: selectedBusiness.name, b: (c) => <strong className="text-slate-900">{c}</strong> })}</span>
                <span className="badge badge-brand">{TIER_LABELS[selectedBusiness.tier] ?? selectedBusiness.tier}</span>
              </div>
            )}
          </section>

          {/* Step 2 — file */}
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">{t("file.title")}</h2>
            <label
              className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl cursor-pointer transition-colors border-2 border-dashed border-slate-200 bg-slate-50 hover:border-brand-300 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
            >
              <FileSpreadsheet className={cn("w-8 h-8", fileName ? "text-brand-600" : "text-slate-500")} />
              {fileName ? (
                <span className="text-sm font-medium text-slate-900 break-all" dir="ltr">{fileName}</span>
              ) : (
                <span className="text-sm text-slate-700">{t("file.dropHint")}</span>
              )}
              <span className="text-xs text-slate-500">
                {t("file.columns")}
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={onFileChosen}
              />
            </label>

            {parseMutation.isError && (
              <div className="mt-3 px-4 py-3 rounded-xl text-sm flex items-center gap-2 bg-red-50 text-red-700 border border-red-200">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                {(parseMutation.error as Error).message}
              </div>
            )}

            {!parseResult && (
              <button
                onClick={() => parseMutation.mutate()}
                disabled={parseMutation.isPending || !selectedBusiness || !fileName}
                className="btn-primary w-full justify-center mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                {parseMutation.isPending ? t("file.parsing") : t("file.parse")}
              </button>
            )}
          </section>

          {/* Step 3 — preview */}
          {parseResult && (
            <section className="card p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{t("preview.title")}</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {t("preview.notWritten", { name: parseResult.businessName })}
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: t("preview.customersToImport"), value: parseResult.stats.totalCustomers, icon: Users },
                  { label: t("preview.petsToImport"), value: parseResult.stats.totalPets, icon: PawPrint },
                  { label: t("preview.inFileDuplicates"), value: parseResult.stats.inFileDuplicates, icon: SkipForward },
                  { label: t("preview.alreadyExist"), value: parseResult.stats.dbDuplicates, icon: Database },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <Icon className="w-4 h-4 text-slate-500 mb-1" />
                    <div className="text-lg font-bold text-slate-900">{value}</div>
                    <div className="text-xs text-slate-500">{label}</div>
                  </div>
                ))}
              </div>

              {(parseResult.stats.skippedRows > 0 || parseResult.stats.orphanPets > 0) && (
                <p className="text-xs text-slate-500">
                  {t("preview.skippedRows", { count: parseResult.stats.skippedRows })}
                  {parseResult.stats.orphanPets > 0 && t("preview.orphanPets", { count: parseResult.stats.orphanPets })}
                </p>
              )}

              {parseResult.topIssues.length > 0 ? (
                <div className="rounded-xl border border-amber-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-amber-50 text-amber-800">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {t("preview.issuesTitle")}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="table-header-cell text-start">{t("preview.colRow")}</th>
                          <th className="table-header-cell text-start">{t("preview.colType")}</th>
                          <th className="table-header-cell text-start">{t("preview.colIssue")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseResult.topIssues.map((issue, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="table-cell whitespace-nowrap">{issue.row}</td>
                            <td className="table-cell whitespace-nowrap">{ISSUE_TYPES.includes(issue.type) ? t(`issueTypes.${issue.type}`) : t("issueTypes.other")}</td>
                            <td className="table-cell">{issue.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">{t("preview.noIssues")}</p>
              )}

              {executeMutation.isError && (
                <div className="px-4 py-3 rounded-xl text-sm flex items-center gap-2 bg-red-50 text-red-700 border border-red-200">
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                  {(executeMutation.error as Error).message}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={executeMutation.isPending || parseResult.stats.totalCustomers === 0}
                  className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4" />
                  {t("preview.execute", { count: parseResult.stats.totalCustomers })}
                </button>
                <button onClick={reset} className="btn-secondary">
                  <RefreshCw className="w-4 h-4" /> {t("preview.restart")}
                </button>
              </div>
              {parseResult.stats.totalCustomers === 0 && (
                <p className="text-xs text-slate-500">{t("preview.noNewCustomers")}</p>
              )}
            </section>
          )}
        </div>
      )}

      {/* Confirmation modal */}
      {confirmOpen && parseResult && (
        <div className="modal-overlay" onClick={() => !executeMutation.isPending && setConfirmOpen(false)}>
          <div className="modal-backdrop" />
          <div
            className="modal-content max-w-md p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="migration-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="migration-confirm-title" className="text-lg font-bold text-slate-900">{t("confirm.title")}</h2>
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={executeMutation.isPending}
                className="btn-ghost p-1 rounded-lg"
                aria-label={tc("actions.close")}
                title={tc("actions.close")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-700">
              {t.rich("confirm.body", {
                rows: totalRows,
                customers: parseResult.stats.totalCustomers,
                pets: parseResult.stats.totalPets,
                name: parseResult.businessName,
                b: (c) => <strong className="text-slate-900">{c}</strong>,
              })}
            </p>
            <div className="mt-3 px-3 py-2.5 rounded-xl text-sm flex items-start gap-2 bg-amber-50 text-amber-800 border border-amber-200">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{t("confirm.warning")}</span>
            </div>
            <div className="flex flex-wrap justify-end gap-2 mt-6">
              <button onClick={() => setConfirmOpen(false)} disabled={executeMutation.isPending} className="btn-secondary">
                {tc("actions.cancel")}
              </button>
              <button
                onClick={() => executeMutation.mutate()}
                disabled={executeMutation.isPending}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4" />
                {executeMutation.isPending ? t("confirm.importing") : t("confirm.submit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
