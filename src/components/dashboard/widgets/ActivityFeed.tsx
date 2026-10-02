"use client";
import Link from "next/link";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActivityItem, ACTIVITY_ICONS, relativeTime } from "@/components/dashboard/dashboard-shared";


export function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) {
    return (
      <div className="empty-state py-8">
        <div className="empty-state-icon">
          <Activity className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm text-petra-muted">אין פעילות ב-24 שעות האחרונות</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-50">
      {activities.slice(0, 10).map((item) => {
        const iconInfo = ACTIVITY_ICONS[item.action] || ACTIVITY_ICONS.LOGIN;
        const IconComp = iconInfo.icon;
        const rowClass = "flex items-start gap-3 py-3 px-1 hover:bg-slate-50/40 rounded-lg transition-colors";
        const rowBody = (
          <>
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: iconInfo.bg }}
            >
              <IconComp className="w-4 h-4" style={{ color: iconInfo.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-petra-text leading-snug">{item.description}</p>
              <p className="text-[11px] text-petra-muted mt-0.5">
                {item.userName}
                <span className="text-slate-300 mx-1.5">·</span>
                {relativeTime(item.createdAt)}
              </p>
            </div>
            {item.type === "whatsapp" && item.status && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 mt-1",
                  item.status === "SENT"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                )}
              >
                {item.status === "SENT" ? "נשלח" : "נכשל"}
              </span>
            )}
          </>
        );
        return item.href ? (
          <Link key={item.id} href={item.href} className={rowClass}>{rowBody}</Link>
        ) : (
          <div key={item.id} className={rowClass}>{rowBody}</div>
        );
      })}
    </div>
  );
}
