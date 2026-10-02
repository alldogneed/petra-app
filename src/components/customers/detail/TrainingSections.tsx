"use client";

import Link from "next/link";
import { ExternalLink, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROGRAM_STATUS_COLORS, PROGRAM_STATUS_LABELS, PROGRAM_TYPE_LABELS } from "./constants";
import type { TrainingProgramInfo } from "./types";

/** Session-package progress for active programs that have a session quota. */
export function PackageTracking({ programs }: { programs: TrainingProgramInfo[] }) {
  const tracked = programs.filter((p) => p.status === "ACTIVE" && (p.totalSessions ?? 0) > 0);
  if (tracked.length === 0) return null;
  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold text-petra-text mb-3 flex items-center gap-2">
        <GraduationCap className="w-4 h-4 text-amber-500" />
        מעקב חבילות
      </h3>
      <div className="space-y-4">
        {tracked.map((program) => {
          const completed = program.completedSessions ?? 0;
          const total = program.totalSessions || 1;
          const pct = Math.min(100, Math.round((completed / total) * 100));
          return (
            <div key={program.id}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-medium text-petra-text truncate">
                  {program.dog?.name ? `${program.dog.name} · ` : ""}
                  {PROGRAM_TYPE_LABELS[program.programType] || program.name}
                </span>
                <span className="text-[10px] text-petra-muted flex-shrink-0">{completed}/{total} מפגשים</span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: pct >= 100 ? "#10B981" : pct >= 60 ? "#F97316" : "#FBBF24" }}
                />
              </div>
              <p className="text-[10px] text-petra-muted mt-0.5 text-right">{pct}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TrainingProgramsCard({ programs }: { programs: TrainingProgramInfo[] }) {
  if (programs.length === 0) return null;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-petra-text flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-petra-muted" />
          תוכניות אימון ({programs.length})
        </h2>
        <Link href="/training" className="btn-ghost text-xs">
          <ExternalLink className="w-3.5 h-3.5" />
          הכל
        </Link>
      </div>
      <div className="space-y-3">
        {programs.map((program) => (
          <Link
            key={program.id}
            href={`/training?program=${program.id}`}
            className="block p-3 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-slate-100 hover:border-slate-200 transition-colors"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="min-w-0">
                <span className="text-sm font-medium text-petra-text">{program.name}</span>
                {program.dog && <span className="text-xs text-petra-muted mr-1">· {program.dog.name}</span>}
              </div>
              <span className={cn("badge text-[10px] flex-shrink-0", PROGRAM_STATUS_COLORS[program.status] || "badge-neutral")}>
                {PROGRAM_STATUS_LABELS[program.status] || program.status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-petra-muted mb-2">
              <span>{PROGRAM_TYPE_LABELS[program.programType] || program.programType}</span>
              <span>·</span>
              <span>
                {program.completedSessions ?? 0}
                {program.totalSessions ? `/${program.totalSessions}` : ""} מפגשים
              </span>
            </div>
            {program.goals.length > 0 && (
              <div className="space-y-1.5">
                {program.goals.slice(0, 3).map((goal) => (
                  <div key={goal.id}>
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs text-petra-text truncate">{goal.title}</span>
                      <span className="text-[10px] text-petra-muted flex-shrink-0">{goal.progressPercent}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${goal.progressPercent}%`, background: goal.progressPercent >= 100 ? "#10B981" : "#F97316" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
