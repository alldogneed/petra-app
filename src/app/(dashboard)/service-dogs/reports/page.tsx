"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  BarChart2,
  Dog,
  Shield,
  GraduationCap,
  Heart,
  Printer,
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  UserCheck,
  Calendar,
  RefreshCw,
  Download,
  MapPin,
  Plus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn, escapeHtml } from "@/lib/utils";
import { formatDate as formatDateL } from "@/lib/format";
import { useBusinessLocale } from "@/hooks/useBusinessLocale";
import { ServiceDogsTabs } from "@/components/service-dogs/ServiceDogsTabs";
import {
  SERVICE_DOG_PHASE_MAP, SERVICE_DOG_PHASE_COLORS,
  RECIPIENT_STATUSES, FUNDING_SOURCE_MAP,
  LOCATION_OPTIONS, LOCATION_MAP,
} from "@/lib/service-dogs";
import { TierGate } from "@/components/paywall/TierGate";
import { PetraLoader } from "@/components/ui/PetraLoader";
import { usePermissions } from "@/hooks/usePermissions";

interface ServiceDogSummary {
  id: string;
  phase: string;
  trainingStatus: string;
  certificationDate: string | null;
  certificationExpiry: string | null;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  serviceType: string | null;
  isGovReportPending: boolean;
  currentLocation: string;
  medicalCompliance: { status: string; completedCount: number; totalProtocols: number; overdueCount: number; compliancePercent: number };
  pet: { name: string; breed: string | null };
  activePlacement: { recipientName: string; status: string } | null;
}

interface TrainingProgram {
  id: string;
  name: string;
  status: string;
  totalSessions: number | null;
  dog: { id: string; name: string } | null;
  sessions: { id: string; sessionDate: string; status: string }[];
}

function ServiceDogsReportsPageContent() {
  const { canExportData } = usePermissions();
  const t = useTranslations("serviceDogs.serviceDogsReportsPage");
  const { locale, cfg } = useBusinessLocale();
  const formatDate = (d: Date | string) => formatDateL(d, { locale, style: "long" });
  const { data: dogs = [], isLoading: dogsLoading } = useQuery<ServiceDogSummary[]>({
    queryKey: ["service-dogs"],
    queryFn: () => fetch("/api/service-dogs").then((r) => r.ok ? r.json() : []),
    staleTime: 60_000,
  });

  const { data: programs = [], isLoading: programsLoading } = useQuery<TrainingProgram[]>({
    queryKey: ["training-programs-sd"],
    queryFn: () => fetch("/api/training-programs?trainingType=SERVICE_DOG").then((r) => r.ok ? r.json().then((d: unknown) => Array.isArray(d) ? d : (d as { programs?: TrainingProgram[] }).programs ?? []) : []),
    staleTime: 60_000,
  });

  const { data: recipients = [] } = useQuery<{ id: string; name: string; status: string; fundingSource: string | null; disabilityType: string | null }[]>({
    queryKey: ["service-recipients"],
    queryFn: () => fetch("/api/service-recipients").then((r) => r.ok ? r.json() : []),
    staleTime: 60_000,
  });

  const isLoading = dogsLoading || programsLoading;

  // ── Computed stats ──────────────────────────────────────────────────────────
  const totalDogs = dogs.length;
  const byPhase = dogs.reduce((acc, d) => {
    acc[d.phase] = (acc[d.phase] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const certified = dogs.filter((d) => d.phase === "CERTIFIED");
  const inTraining = dogs.filter((d) => ["IN_TRAINING", "ADVANCED_TRAINING"].includes(d.phase));
  const placed = dogs.filter((d) => d.activePlacement?.status === "ACTIVE");

  const now = new Date();

  // Upcoming renewals (next 90 days)
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const upcomingRenewals: Array<{ dogId: string; dogName: string; label: string; expiry: Date; urgency: "overdue" | "soon" | "ok" }> = [];
  dogs.forEach((dog) => {
    const checks = [
      { label: t("renewals.licenseExpiry"), date: dog.licenseExpiry ? new Date(dog.licenseExpiry) : null },
      { label: t("renewals.certificationExpiry"), date: dog.certificationExpiry ? new Date(dog.certificationExpiry) : null },
    ];
    checks.forEach(({ label, date }) => {
      if (!date) return;
      if (date <= in90Days) {
        upcomingRenewals.push({
          dogId: dog.id,
          dogName: dog.pet.name,
          label,
          expiry: date,
          urgency: date < now ? "overdue" : date < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) ? "soon" : "ok",
        });
      }
    });
  });
  upcomingRenewals.sort((a, b) => a.expiry.getTime() - b.expiry.getTime());

  // Recipients by funding source
  const byFunding = recipients.reduce((acc, r) => {
    const key = r.fundingSource || "UNKNOWN";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Recipients pipeline counts
  const recipientsByStage = RECIPIENT_STATUSES.map((s) => ({
    ...s,
    count: recipients.filter((r) => r.status === s.id).length,
  }));

  return (
    <div className="animate-fade-in space-y-6">
      <style>{`.print-header{display:none} @media print { aside,nav,header,[data-topbar],[data-sidebar],.print\\:hidden{display:none!important} body{font-size:12px} .card{break-inside:avoid} .print-header{display:flex!important;align-items:center;gap:12px;padding-bottom:12px;border-bottom:2px solid #e2e8f0;margin-bottom:14px;} }`}</style>
      <div className="print-header">
        <img src="/petra-logo.png" alt="Petra" style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 6 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>{t("title")}</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>{t("generatedAt", { date: new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) })}</div>
        </div>
      </div>
      <ServiceDogsTabs />
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 text-sm text-petra-muted mb-1">
            <Link href="/service-dogs" className="hover:text-foreground">{t("breadcrumb.serviceDogs")}</Link>
            <ChevronLeft className="w-3.5 h-3.5 ltr:-scale-x-100" />
            <span>{t("breadcrumb.reports")}</span>
          </div>
          <h1 className="page-title flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-brand-500" />
            {t("title")}
          </h1>
          <p className="text-sm text-petra-muted mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="btn-secondary flex items-center gap-2 text-sm px-3 py-2 print:hidden"
          >
            <Printer className="w-4 h-4" />
            {t("actions.print")}
          </button>
          {canExportData && (<>
          <a
            href="/api/service-dogs/export/government"
            download
            className="btn-primary flex items-center gap-2 text-sm px-3 py-2"
            title={t("actions.govReportTitle")}
          >
            <Download className="w-4 h-4" />
            {t("actions.govReport")}
          </a>
          <a
            href="/api/service-dogs/export"
            download
            className="btn-secondary flex items-center gap-2 text-sm px-3 py-2"
          >
            <Download className="w-4 h-4" />
            {t("actions.exportDogs")}
          </a>
          <a
            href="/api/service-recipients/export"
            download
            className="btn-secondary flex items-center gap-2 text-sm px-3 py-2"
          >
            <Download className="w-4 h-4" />
            {t("actions.exportRecipients")}
          </a>
          <a
            href="/api/service-recipients/export/by-funding?source=BITUACH_LEUMI"
            download
            className="btn-secondary flex items-center gap-2 text-sm px-3 py-2"
          >
            <Download className="w-4 h-4" />
            {t("actions.exportBituachLeumi")}
          </a>
          <a
            href="/api/service-recipients/export/by-funding?source=MINISTRY_OF_DEFENSE"
            download
            className="btn-secondary flex items-center gap-2 text-sm px-3 py-2"
          >
            <Download className="w-4 h-4" />
            {t("actions.exportMinistryOfDefense")}
          </a>
          <a
            href="/api/service-dogs/export/care"
            download
            className="btn-secondary flex items-center gap-2 text-sm px-3 py-2"
            title={t("actions.careExportTitle")}
          >
            <Download className="w-4 h-4" />
            {t("actions.careExport")}
          </a>
          </>)}
          <button
            onClick={() => {
              const certRows = certified.map((dog) => `<tr><td>${escapeHtml(dog.pet.name)}</td><td>${escapeHtml(dog.pet.breed) || "—"}</td><td>${dog.certificationDate ? formatDate(dog.certificationDate) : "—"}</td><td>${dog.activePlacement ? t("print.placedTo", { name: escapeHtml(dog.activePlacement.recipientName) }) : t("noPlacement")}</td></tr>`).join("");
              const phaseRows = Object.entries(byPhase).map(([phase, count]) => `<tr><td>${phase}</td><td>${count}</td></tr>`).join("");
              const win = window.open("", "_blank");
              if (!win) return;
              win.document.write(`<html dir="${cfg.dir}"><head><title>${t("title")}</title>
                <style>body{font-family:Arial,sans-serif;padding:32px;direction:${cfg.dir}}h1{font-size:20px;margin-bottom:4px}h2{font-size:15px;margin:24px 0 10px;border-bottom:2px solid #eee;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px}th,td{border:1px solid #ddd;padding:7px 10px;text-align:start}th{background:#f5f5f5;font-weight:600}tr:nth-child(even){background:#fafafa}.stat{display:inline-block;margin:0 8px 8px 0;padding:6px 14px;border:1px solid #ddd;border-radius:8px;font-size:13px}footer{margin-top:24px;font-size:11px;color:#888;border-top:1px solid #eee;padding-top:8px}</style>
              </head><body>
                <h1>${t("title")}</h1>
                <p style="color:#888;font-size:12px">${t("generatedAt", { date: formatDate(new Date()) })}</p>
                <div>
                  <span class="stat">${t("print.statTotalDogs")} <strong>${totalDogs}</strong></span>
                  <span class="stat">${t("print.statCertified")} <strong>${certified.length}</strong></span>
                  <span class="stat">${t("print.statInTraining")} <strong>${inTraining.length}</strong></span>
                  <span class="stat">${t("print.statPlaced")} <strong>${placed.length}</strong></span>
                </div>
                <h2>${t("certified.heading", { count: certified.length })}</h2>
                <table><thead><tr><th>${t("print.colName")}</th><th>${t("print.colBreed")}</th><th>${t("print.colCertDate")}</th><th>${t("print.colPlacement")}</th></tr></thead><tbody>${certRows}</tbody></table>
                <h2>${t("print.byPhaseHeading")}</h2>
                <table><thead><tr><th>${t("print.colPhase")}</th><th>${t("print.colCount")}</th></tr></thead><tbody>${phaseRows}</tbody></table>
                <footer>${t("print.footer", { date: formatDate(new Date()) })}</footer>
              </body></html>`);
              win.document.close();
              win.print();
            }}
            className="btn-secondary flex items-center gap-2 text-sm px-3 py-2 print:hidden"
          >
            <Printer className="w-4 h-4" />
            {t("actions.printReport")}
          </button>
        </div>
      </div>

      {isLoading ? (
        <PetraLoader />
      ) : (
        <>
          {/* ── Location Distribution ────────────────────────────────────── */}
          {(() => {
            const byLocation = LOCATION_OPTIONS.map((l) => ({
              ...l,
              count: dogs.filter((d) => (d.currentLocation || "TRAINER") === l.id).length,
            }));
            const awayDogs = dogs.filter((d) => d.currentLocation && d.currentLocation !== "TRAINER");
            return (
              <div className="card p-5">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-500" />
                  {t("location.heading")}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {byLocation.map((l) => (
                    <div key={l.id} className="rounded-xl p-3 text-center border" style={{ backgroundColor: l.color.bg, borderColor: l.color.border }}>
                      <div className="text-2xl font-bold" style={{ color: l.color.text }}>{l.count}</div>
                      <div className="text-xs mt-1" style={{ color: l.color.text }}>{l.label}</div>
                    </div>
                  ))}
                </div>
                {awayDogs.length > 0 && (
                  <div className="divide-y max-h-48 overflow-y-auto">
                    {awayDogs.map((dog) => {
                      const loc = dog.currentLocation || "TRAINER";
                      const locInfo = LOCATION_MAP[loc];
                      const phaseInfo = SERVICE_DOG_PHASE_MAP[dog.phase];
                      return (
                        <Link
                          key={dog.id}
                          href={`/service-dogs/${dog.id}`}
                          className="flex items-center justify-between py-2.5 hover:bg-slate-50 px-1 rounded transition-colors"
                        >
                          <span className="text-sm font-medium">{dog.pet.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-petra-muted">{phaseInfo?.label || dog.phase}</span>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium border"
                              style={{ backgroundColor: locInfo?.color.bg, color: locInfo?.color.text, borderColor: locInfo?.color.border }}
                            >
                              {locInfo?.label || loc}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Summary Stats ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-4 text-center">
              <Dog className="w-6 h-6 mx-auto text-brand-500 mb-2" />
              <div className="text-3xl font-bold">{totalDogs}</div>
              <div className="text-xs text-petra-muted mt-1">{t("stats.totalDogs")}</div>
            </div>
            <div className="card p-4 text-center">
              <Shield className="w-6 h-6 mx-auto text-emerald-500 mb-2" />
              <div className="text-3xl font-bold text-emerald-600">{certified.length}</div>
              <div className="text-xs text-petra-muted mt-1">{t("stats.certified")}</div>
            </div>
            <div className="card p-4 text-center">
              <GraduationCap className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <div className="text-3xl font-bold text-blue-600">{inTraining.length}</div>
              <div className="text-xs text-petra-muted mt-1">{t("stats.inTraining")}</div>
            </div>
            <div className="card p-4 text-center">
              <Activity className="w-6 h-6 mx-auto text-purple-500 mb-2" />
              <div className="text-3xl font-bold text-purple-600">{placed.length}</div>
              <div className="text-xs text-petra-muted mt-1">{t("stats.activePlacements")}</div>
            </div>
          </div>

          {/* ── Recipients Summary ────────────────────────────────────── */}
          {recipients.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pipeline */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-brand-500" />
                    {t("pipeline.heading", { count: recipients.length })}
                  </h2>
                  <button
                    onClick={() => {
                      const rows = recipientsByStage.filter(s => s.count > 0)
                        .map(s => `<tr><td>${s.label}</td><td>${s.count}</td></tr>`).join("");
                      const win = window.open("", "_blank");
                      if (!win) return;
                      win.document.write(`<html dir="${cfg.dir}"><head><title>${t("pipeline.title")}</title>
                        <style>body{font-family:Arial,sans-serif;padding:32px;direction:${cfg.dir}}h2{font-size:18px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ddd;padding:8px 10px;text-align:start}th{background:#f5f5f5;font-weight:600}tr:nth-child(even){background:#fafafa}footer{margin-top:24px;font-size:11px;color:#888;border-top:1px solid #eee;padding-top:8px}</style>
                      </head><body>
                        <h2>${t("pipeline.heading", { count: recipients.length })}</h2>
                        <table><thead><tr><th>${t("print.colPhase")}</th><th>${t("print.colCount")}</th></tr></thead><tbody>${rows}</tbody></table>
                        <footer>${t("print.footer", { date: formatDate(new Date()) })}</footer>
                      </body></html>`);
                      win.document.close();
                      win.print();
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors print:hidden"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {t("actions.print")}
                  </button>
                </div>
                <div className="space-y-2">
                  {recipientsByStage.filter((s) => s.count > 0).map((stage) => {
                    const pct = recipients.length > 0 ? Math.round((stage.count / recipients.length) * 100) : 0;
                    return (
                      <div key={stage.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", stage.color)}>{stage.label}</span>
                          <span className="text-sm font-bold">{stage.count}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* By funding source */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-brand-500" />
                    {t("funding.title")}
                  </h2>
                  <button
                    onClick={() => {
                      const rows = Object.entries(byFunding)
                        .map(([source, count]) => `<tr><td>${FUNDING_SOURCE_MAP[source] || t("funding.unknown")}</td><td>${count}</td></tr>`).join("");
                      const win = window.open("", "_blank");
                      if (!win) return;
                      win.document.write(`<html dir="${cfg.dir}"><head><title>${t("funding.title")}</title>
                        <style>body{font-family:Arial,sans-serif;padding:32px;direction:${cfg.dir}}h2{font-size:18px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ddd;padding:8px 10px;text-align:start}th{background:#f5f5f5;font-weight:600}tr:nth-child(even){background:#fafafa}footer{margin-top:24px;font-size:11px;color:#888;border-top:1px solid #eee;padding-top:8px}</style>
                      </head><body>
                        <h2>${t("funding.printHeading")}</h2>
                        <table><thead><tr><th>${t("funding.colSource")}</th><th>${t("print.colCount")}</th></tr></thead><tbody>${rows}</tbody></table>
                        <footer>${t("print.footer", { date: formatDate(new Date()) })}</footer>
                      </body></html>`);
                      win.document.close();
                      win.print();
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors print:hidden"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {t("actions.print")}
                  </button>
                </div>
                <div className="space-y-3">
                  {Object.entries(byFunding).map(([source, count]) => {
                    const pct = recipients.length > 0 ? Math.round((count / recipients.length) * 100) : 0;
                    return (
                      <div key={source}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">{FUNDING_SOURCE_MAP[source] || t("funding.unknown")}</span>
                          <span className="text-sm font-bold">{count} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Phase Distribution ─────────────────────────────────────── */}
            <div className="card p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Dog className="w-4 h-4 text-brand-500" />
                {t("phases.heading")}
              </h2>
              <div className="space-y-2">
                {Object.entries(byPhase).map(([phase, count]) => {
                  const info = SERVICE_DOG_PHASE_MAP[phase];
                  const colors = SERVICE_DOG_PHASE_COLORS[phase];
                  const pct = totalDogs > 0 ? Math.round((count / totalDogs) * 100) : 0;
                  return (
                    <div key={phase}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm" style={{ color: colors?.text }}>{info?.label || phase}</span>
                        <span className="text-sm font-bold">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: colors?.text || "#94A3B8" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Certified Dogs Detail ─────────────────────────────────── */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  {t("certified.heading", { count: certified.length })}
                </h2>
                <button
                  onClick={() => {
                    const rows = certified.map((dog) => `
                      <tr>
                        <td>${escapeHtml(dog.pet.name)}</td>
                        <td>${escapeHtml(dog.pet.breed) || "—"}</td>
                        <td>${dog.certificationDate ? formatDate(dog.certificationDate) : "—"}</td>
                        <td>${dog.activePlacement ? t("print.placedTo", { name: escapeHtml(dog.activePlacement.recipientName) }) : t("noPlacement")}</td>
                      </tr>`).join("");
                    const win = window.open("", "_blank");
                    if (!win) return;
                    win.document.write(`<html dir="${cfg.dir}"><head><title>${t("certified.title")}</title>
                      <style>body{font-family:Arial,sans-serif;padding:32px;direction:${cfg.dir}}h2{font-size:18px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ddd;padding:8px 10px;text-align:start}th{background:#f5f5f5;font-weight:600}tr:nth-child(even){background:#fafafa}footer{margin-top:24px;font-size:11px;color:#888;border-top:1px solid #eee;padding-top:8px}</style>
                    </head><body>
                      <h2>${t("certified.heading", { count: certified.length })}</h2>
                      <table><thead><tr><th>${t("print.colDogName")}</th><th>${t("print.colBreed")}</th><th>${t("print.colCertDate")}</th><th>${t("print.colPlacement")}</th></tr></thead>
                      <tbody>${rows}</tbody></table>
                      <footer>${t("print.footer", { date: formatDate(new Date()) })}</footer>
                    </body></html>`);
                    win.document.close();
                    win.print();
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors print:hidden"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {t("actions.print")}
                </button>
              </div>
              {certified.length === 0 ? (
                <p className="text-sm text-petra-muted">{t("certified.empty")}</p>
              ) : (
                <div className="divide-y max-h-64 overflow-y-auto">
                  {certified.map((dog) => (
                    <Link
                      key={dog.id}
                      href={`/service-dogs/${dog.id}`}
                      className="flex items-center justify-between py-2.5 hover:bg-slate-50 px-1 rounded transition-colors group"
                    >
                      <div>
                        <p className="text-sm font-medium">{dog.pet.name}</p>
                        <p className="text-xs text-petra-muted mt-0.5">
                          {dog.certificationDate ? t("certified.certifiedOn", { date: formatDate(dog.certificationDate) }) : t("certified.noCertDate")}
                        </p>
                      </div>
                      <div className="text-end">
                        {dog.activePlacement ? (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                            {t("certified.placedTo", { name: dog.activePlacement.recipientName })}
                          </span>
                        ) : (
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{t("noPlacement")}</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Upcoming Renewals ────────────────────────────────────── */}
          {upcomingRenewals.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-amber-500" />
                  {t("renewals.heading")}
                  <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    {t("renewals.items", { count: upcomingRenewals.length })}
                  </span>
                </h2>
                <button
                  onClick={() => {
                    const rows = upcomingRenewals.map(r =>
                      `<tr><td>${escapeHtml(r.dogName)}</td><td>${escapeHtml(r.label)}</td><td>${r.urgency === "overdue" ? t("renewals.expired") : formatDate(r.expiry)}</td></tr>`
                    ).join("");
                    const win = window.open("", "_blank");
                    if (!win) return;
                    win.document.write(`<html dir="${cfg.dir}"><head><title>${t("renewals.title")}</title>
                      <style>body{font-family:Arial,sans-serif;padding:32px;direction:${cfg.dir}}h2{font-size:18px;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ddd;padding:8px 10px;text-align:start}th{background:#f5f5f5;font-weight:600}tr:nth-child(even){background:#fafafa}footer{margin-top:24px;font-size:11px;color:#888;border-top:1px solid #eee;padding-top:8px}</style>
                    </head><body>
                      <h2>${t("renewals.printHeading", { count: upcomingRenewals.length })}</h2>
                      <table><thead><tr><th>${t("print.colDogName")}</th><th>${t("renewals.colType")}</th><th>${t("renewals.colDate")}</th></tr></thead>
                      <tbody>${rows}</tbody></table>
                      <footer>${t("print.footer", { date: formatDate(new Date()) })}</footer>
                    </body></html>`);
                    win.document.close();
                    win.print();
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors print:hidden"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {t("actions.print")}
                </button>
              </div>
              <div className="divide-y max-h-64 overflow-y-auto">
                {upcomingRenewals.map((r, i) => (
                  <Link
                    key={i}
                    href={`/service-dogs/${r.dogId}`}
                    className="flex items-center justify-between py-2.5 hover:bg-slate-50 px-1 rounded transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{r.dogName}</p>
                      <p className="text-xs text-petra-muted">{r.label}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        r.urgency === "overdue" ? "bg-red-100 text-red-700"
                          : r.urgency === "soon" ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                      )}>
                        {r.urgency === "overdue" ? t("renewals.expired") : formatDate(r.expiry.toISOString())}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </>
      )}
    </div>
  );
}

export default function ServiceDogsReportsPage() {
  const t = useTranslations("serviceDogs.serviceDogsReportsPage");
  return (
    <TierGate
      feature="service_dogs"
      title={t("tierGate.title")}
      description={t("tierGate.description")}
      upgradeTier="service_dog"
    >
      <ServiceDogsReportsPageContent />
    </TierGate>
  );
}
