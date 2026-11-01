"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Award,
  AlertTriangle,
  ExternalLink,
  Ban,
  RotateCcw,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { fetchJSON } from "@/lib/utils";
import {
  Modal,
  heDate,
  unwrapList,
  type MembershipItem,
  type CourseItem,
} from "./shared";
import { PetraLoader } from "@/components/ui/PetraLoader";

// ─── Types (mirror src/services/certificate-admin.ts, JSON-serialised) ───────

interface CertificateRow {
  id: string;
  serial: string;
  studentName: string;
  courseTitle: string;
  issuedAt: string;
  issuedManually: boolean;
  revokedAt: string | null;
  courseId: string;
  membershipId: string;
  student: { name: string; email: string };
}

type StatusFilter = "all" | "valid" | "revoked";

const FILTERS: { id: StatusFilter }[] = [
  { id: "all" },
  { id: "valid" },
  { id: "revoked" },
];

const VERIFY_BASE = "/verify/";

export function CertificatesTab() {
  const t = useTranslations("onlineClasses.certificatesTab");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [courseFilter, setCourseFilter] = useState("");
  const [showIssue, setShowIssue] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["oc-certificates", courseFilter],
    queryFn: () =>
      fetchJSON(
        courseFilter
          ? `/api/online-classes/certificates?includeRevoked=true&courseId=${encodeURIComponent(courseFilter)}`
          : "/api/online-classes/certificates?includeRevoked=true"
      ),
  });

  // Courses for the filter dropdown + issue modal picker.
  const { data: coursesData } = useQuery({
    queryKey: ["oc-courses"],
    queryFn: () => fetchJSON("/api/online-classes/courses"),
  });
  const courses = unwrapList<CourseItem>(coursesData, "courses", "items");

  const allCerts = unwrapList<CertificateRow>(data, "certificates", "items");
  const certificates = useMemo(() => {
    if (status === "valid") return allCerts.filter((c) => !c.revokedAt);
    if (status === "revoked") return allCerts.filter((c) => c.revokedAt);
    return allCerts;
  }, [allCerts, status]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["oc-certificates"] });

  const patchMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      fetchJSON(`/api/online-classes/certificates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (_d, vars) => {
      toast.success(
        vars.body.action === "revoke" ? t("toast.revoked") : t("toast.restored")
      );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || t("toast.updateError")),
  });

  const handleRevoke = (cert: CertificateRow) => {
    if (
      !window.confirm(
        t("revokeConfirm", {
          name: cert.student.name || cert.studentName,
          course: cert.courseTitle,
        })
      )
    )
      return;
    const reason = window.prompt(t("revokeReasonPrompt"), "") ?? "";
    patchMutation.mutate({
      id: cert.id,
      body: { action: "revoke", reason: reason.trim() || undefined },
    });
  };

  const handleRestore = (cert: CertificateRow) => {
    patchMutation.mutate({ id: cert.id, body: { action: "restore" } });
  };

  if (isError) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-400" />
        <p className="text-red-600 font-medium mb-2">{t("loadError")}</p>
        <button className="btn-secondary text-sm" onClick={() => refetch()}>
          {t("retry")}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setStatus(f.id)}
                className={
                  status === f.id
                    ? "px-3.5 py-1.5 rounded-full text-xs font-medium bg-brand-500 text-white whitespace-nowrap"
                    : "px-3.5 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-petra-muted hover:bg-slate-200 whitespace-nowrap"
                }
              >
                {t(`filters.${f.id}`)}
              </button>
            ))}
          </div>
          <select
            className="input w-auto text-sm"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="">{t("allCourses")}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary text-sm" onClick={() => setShowIssue(true)}>
          <Plus className="w-4 h-4" />
          {t("issueManually")}
        </button>
      </div>

      {isLoading ? (
        <PetraLoader />
      ) : certificates.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">
            <Award className="w-6 h-6 text-slate-400" />
          </div>
          <p className="font-medium text-petra-text mb-1">{t("empty.title")}</p>
          <p className="text-sm text-petra-muted">
            {t("empty.body")}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-petra-border">
                <tr>
                  <th className="table-header-cell">{t("table.student")}</th>
                  <th className="table-header-cell">{t("table.course")}</th>
                  <th className="table-header-cell hidden md:table-cell">
                    {t("table.serial")}
                  </th>
                  <th className="table-header-cell">{t("table.issuedAt")}</th>
                  <th className="table-header-cell">{t("table.status")}</th>
                  <th className="table-header-cell">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {certificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-slate-50/60">
                    <td className="table-cell font-medium text-petra-text">
                      {cert.student.name || cert.studentName || "—"}
                      {cert.student.email && (
                        <p
                          className="text-xs text-petra-muted font-normal"
                          dir="ltr"
                        >
                          {cert.student.email}
                        </p>
                      )}
                    </td>
                    <td className="table-cell text-petra-text">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{cert.courseTitle}</span>
                        {cert.issuedManually && (
                          <span className="badge-neutral">{t("manualBadge")}</span>
                        )}
                      </div>
                    </td>
                    <td
                      className="table-cell hidden md:table-cell font-mono text-xs text-petra-muted"
                      dir="ltr"
                    >
                      {cert.serial}
                    </td>
                    <td className="table-cell text-petra-muted">
                      {heDate(cert.issuedAt)}
                    </td>
                    <td className="table-cell">
                      {cert.revokedAt ? (
                        <span className="badge-danger">{t("status.revoked")}</span>
                      ) : (
                        <span className="badge-success">{t("status.valid")}</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`${VERIFY_BASE}${cert.serial}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs py-1.5"
                          title={t("viewHint")}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {t("view")}
                        </a>
                        {cert.revokedAt ? (
                          <button
                            className="btn-secondary text-xs py-1.5"
                            disabled={patchMutation.isPending}
                            onClick={() => handleRestore(cert)}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {t("restore")}
                          </button>
                        ) : (
                          <button
                            className="btn-danger text-xs py-1.5"
                            disabled={patchMutation.isPending}
                            onClick={() => handleRevoke(cert)}
                          >
                            <Ban className="w-3.5 h-3.5" />
                            {t("revoke")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11px] text-petra-muted mt-3">
        {t("viewFootnote")}
      </p>

      {showIssue && (
        <IssueModal
          courses={courses}
          onClose={() => setShowIssue(false)}
          onDone={() => {
            setShowIssue(false);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

// ─── Manual issue modal ──────────────────────────────────────────────────────

function IssueModal({
  courses,
  onClose,
  onDone,
}: {
  courses: CourseItem[];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("onlineClasses.certificatesTab");
  const tc = useTranslations("common");
  const [membershipId, setMembershipId] = useState("");
  const [courseId, setCourseId] = useState("");

  const { data: membershipsData, isLoading: membershipsLoading } = useQuery({
    queryKey: ["oc-memberships", ""],
    queryFn: () => fetchJSON("/api/online-classes/memberships"),
  });
  const memberships = unwrapList<MembershipItem>(
    membershipsData,
    "memberships",
    "items"
  );

  const publishedCourses = courses.filter(
    (c) => c.status?.toLowerCase() === "published"
  );

  const createMutation = useMutation({
    mutationFn: () =>
      fetchJSON("/api/online-classes/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId, courseId }),
      }),
    onSuccess: () => {
      toast.success(t("issueModal.issued"));
      onDone();
    },
    onError: (e: Error) => toast.error(e.message || t("issueModal.issueError")),
  });

  return (
    <Modal title={t("issueModal.title")} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-petra-muted">
          {t("issueModal.intro")}
        </p>

        <div>
          <label className="label">{t("issueModal.student")}</label>
          <select
            className="input"
            value={membershipId}
            onChange={(e) => setMembershipId(e.target.value)}
            disabled={membershipsLoading}
          >
            <option value="">
              {membershipsLoading ? tc("loading") : t("issueModal.selectStudent")}
            </option>
            {memberships.map((m) => (
              <option key={m.id} value={m.id}>
                {m.portalUser?.name || m.portalUser?.email || "—"}
                {m.portalUser?.email ? ` (${m.portalUser.email})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">{t("issueModal.course")}</label>
          <select
            className="input"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            <option value="">{t("issueModal.selectCourse")}</option>
            {publishedCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          {publishedCourses.length === 0 && (
            <p className="text-[11px] text-amber-600 mt-1">
              {t("issueModal.noPublishedCourses")}
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            className="btn-primary flex-1 justify-center"
            disabled={createMutation.isPending || !membershipId || !courseId}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? t("issueModal.issuing") : t("issueModal.issue")}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            {tc("actions.cancel")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
