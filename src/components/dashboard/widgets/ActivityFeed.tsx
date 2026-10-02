"use client";
import { cn } from "@/lib/utils";
import { ActivityItem, relativeTime } from "@/components/dashboard/dashboard-shared";
import { DashEmpty, DashLinkRow } from "@/components/dashboard/dash-ui";


export function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) {
    return <DashEmpty>אין פעילות ב-24 שעות האחרונות</DashEmpty>;
  }

  return (
    <div>
      {activities.slice(0, 10).map((item) => {
        const rowBody = (
          <>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-sm leading-[1.45] text-slate-900 break-words">{item.description}</span>
              <span className="text-xs text-slate-400 truncate">
                {item.userName} · {relativeTime(item.createdAt)}
              </span>
            </div>
            {item.type === "whatsapp" && item.status && (
              <span
                className={cn(
                  "text-xs font-medium flex-shrink-0",
                  item.status === "SENT" ? "text-emerald-700" : "text-red-700"
                )}
              >
                {item.status === "SENT" ? "נשלח" : "נכשל"}
              </span>
            )}
          </>
        );
        return item.href ? (
          <DashLinkRow key={item.id} href={item.href} className="items-start justify-between">
            {rowBody}
          </DashLinkRow>
        ) : (
          <div
            key={item.id}
            className="flex items-start justify-between gap-3 py-[11px] px-2 -mx-2 border-t border-slate-100 cursor-default"
          >
            {rowBody}
          </div>
        );
      })}
    </div>
  );
}
