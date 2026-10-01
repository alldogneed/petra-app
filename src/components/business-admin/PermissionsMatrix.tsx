"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCcw, ShieldCheck } from "lucide-react";
import { CRITICAL_CAPABILITIES } from "@/lib/permissions";
import { capabilityCell } from "@/lib/team-stats";
import { ROLE_LABELS, ROLE_COLORS } from "./shared";

export interface MatrixMember {
  id: string;
  userId: string;
  role: string;
  isActive: boolean;
  permissionOverrides?: Record<string, boolean> | null;
  user: { name: string };
}

/**
 * Non-owner members × CRITICAL_CAPABILITIES. Shows the EFFECTIVE value; a dot marks
 * cells whose value comes from a per-member override rather than the role default.
 * Writes go through PATCH /api/admin/[businessId]/members/[memberId] (owner only server-side).
 */
export function PermissionsMatrix({
  businessId,
  members,
  currentUserId,
  queryKey,
}: {
  businessId: string;
  members: MatrixMember[];
  currentUserId: string;
  queryKey: readonly unknown[];
}) {
  const queryClient = useQueryClient();
  const rows = members.filter((m) => m.role !== "owner");

  const mutation = useMutation({
    mutationFn: ({ memberId, permissionOverrides }: { memberId: string; permissionOverrides: Record<string, boolean>; reset?: boolean }) =>
      fetch(`/api/admin/${businessId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionOverrides }),
      }).then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "שגיאה בשמירת ההרשאות");
        return d;
      }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: [...queryKey] });
      toast.success(vars.reset ? "ההרשאות אופסו לברירת המחדל" : "ההרשאות נשמרו");
    },
    onError: () => toast.error("שגיאה בשמירת ההרשאות. נסה שוב."),
  });

  if (rows.length === 0) {
    return (
      <p className="text-sm text-petra-muted py-6 text-center">
        אין עובדים מלבד הבעלים — הוסף עובדים בהגדרות → צוות.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-petra-muted mb-3">
        <span>הערך המוצג הוא ההרשאה בפועל. בעלים תמיד בעלי גישה מלאה.</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          שונה ידנית (גובר על ברירת המחדל של התפקיד)
        </span>
      </div>
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="text-sm border-separate border-spacing-0 min-w-max">
          <thead>
            <tr className="text-xs text-petra-muted">
              <th className="sticky right-0 z-10 bg-white text-right font-medium px-3 py-2 border-b border-slate-100 min-w-[150px]">
                עובד
              </th>
              {CRITICAL_CAPABILITIES.map((cap) => (
                <th
                  key={cap.key}
                  className="font-medium px-2 py-2 border-b border-slate-100 text-center align-bottom w-24 max-w-[96px] leading-tight"
                >
                  {cap.label}
                </th>
              ))}
              <th className="px-2 py-2 border-b border-slate-100" />
            </tr>
          </thead>
          <tbody>
            {rows.map((member) => {
              const overrides = member.permissionOverrides ?? {};
              const hasOverrides = Object.keys(overrides).length > 0;
              const isMe = member.userId === currentUserId;
              const disabled = mutation.isPending || isMe;
              return (
                <tr key={member.id} className={member.isActive ? "" : "opacity-60"}>
                  <td className="sticky right-0 z-10 bg-white px-3 py-2 border-b border-slate-50">
                    <p className="font-medium text-slate-800 truncate max-w-[150px]">{member.user.name}</p>
                    <span
                      className={`inline-block mt-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                        ROLE_COLORS[member.role] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {ROLE_LABELS[member.role] ?? member.role}
                    </span>
                    {!member.isActive && <span className="text-[11px] text-red-500 mr-1">מושבת</span>}
                  </td>
                  {CRITICAL_CAPABILITIES.map((cap) => {
                    const cell = capabilityCell(member.role, cap.key, overrides);
                    const isOverride = cell.source === "override";
                    const title = `${cap.label}: ${cell.value ? "מותר" : "חסום"}${
                      isOverride
                        ? ` (שונה ידנית — ברירת המחדל לתפקיד: ${cell.roleDefault ? "מותר" : "חסום"})`
                        : " (ברירת מחדל של התפקיד)"
                    }`;
                    return (
                      <td key={cap.key} className="px-2 py-2 border-b border-slate-50 text-center">
                        <label className="relative inline-flex items-center justify-center cursor-pointer" title={title}>
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-brand-500"
                            checked={cell.value}
                            disabled={disabled}
                            aria-label={`${member.user.name} — ${cap.label}`}
                            onChange={(e) =>
                              mutation.mutate({
                                memberId: member.id,
                                permissionOverrides: { ...overrides, [cap.key]: e.target.checked },
                              })
                            }
                          />
                          {isOverride && (
                            <span className="absolute -top-1 -left-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
                          )}
                        </label>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 border-b border-slate-50 whitespace-nowrap">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-petra-muted hover:text-brand-600 disabled:opacity-40 disabled:hover:text-petra-muted"
                      disabled={!hasOverrides || disabled}
                      title="מחיקת כל השינויים הידניים — חזרה להרשאות התפקיד"
                      onClick={() =>
                        mutation.mutate({ memberId: member.id, permissionOverrides: {}, reset: true })
                      }
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      איפוס לברירת מחדל
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="flex items-center gap-1 text-[11px] text-petra-muted mt-3">
        <ShieldCheck className="w-3.5 h-3.5" />
        כל שינוי נשמר מיד ונרשם ביומן הביקורת.
      </p>
    </div>
  );
}
