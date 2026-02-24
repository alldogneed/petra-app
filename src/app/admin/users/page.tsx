"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";

function getScoreColor(score: number) {
  if (score >= 20) return { bg: "#06B6D420", text: "#06B6D4" };
  if (score >= 10) return { bg: "#F59E0B20", text: "#F59E0B" };
  if (score >= 1) return { bg: "#64748B20", text: "#94A3B8" };
  return { bg: "#EF444420", text: "#EF4444" };
}

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, page],
    queryFn: () =>
      fetch(`/api/admin/users?search=${encodeURIComponent(search)}&page=${page}&limit=20`).then((r) => r.json()),
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">משתמשים</h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>
            {data ? `${data.total} משתמשים רשומים` : "טוען..."}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#475569" }} />
          <input
            type="text"
            placeholder="חיפוש לפי שם או אימייל..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pr-10 pl-4 py-2 rounded-xl text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1"
            style={{ background: "#12121A", border: "1px solid #1E1E2E", color: "#E2E8F0", focusRingColor: "#06B6D4" }}
            dir="rtl"
          />
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "#12121A", border: "1px solid #1E1E2E" }}>
        {isLoading ? (
          <div className="p-12 text-center text-sm" style={{ color: "#64748B" }}>טוען...</div>
        ) : !data?.users?.length ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "#1E1E2E" }} />
            <p className="text-sm" style={{ color: "#64748B" }}>לא נמצאו משתמשים</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid #1E1E2E" }}>
                    <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: "#64748B" }}>שם</th>
                    <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: "#64748B" }}>תפקיד</th>
                    <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: "#64748B" }}>עסק</th>
                    <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: "#64748B" }}>תאריך הצטרפות</th>
                    <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: "#64748B" }}>פעילות אחרונה</th>
                    <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: "#64748B" }}>ציון פעילות</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user: any) => {
                    const sc = getScoreColor(user.activityScore);
                    return (
                      <tr key={user.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: "1px solid #1E1E2E" }}>
                        <td className="px-5 py-3">
                          <div className="text-sm text-white">{user.name}</div>
                          <div className="text-xs" style={{ color: "#64748B" }}>{user.email}</div>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{
                              background: user.role === "MASTER" ? "#06B6D420" : "#64748B20",
                              color: user.role === "MASTER" ? "#06B6D4" : "#94A3B8",
                            }}
                          >
                            {user.role === "MASTER" ? "Master" : "User"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm" style={{ color: "#94A3B8" }}>
                          {user.businessName || "—"}
                        </td>
                        <td className="px-5 py-3 text-sm" style={{ color: "#94A3B8" }}>
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-5 py-3 text-sm" style={{ color: "#94A3B8" }}>
                          {formatDate(user.lastActivityAt)}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            style={{ background: sc.bg, color: sc.text }}
                          >
                            {user.activityScore}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: "1px solid #1E1E2E" }}>
                <span className="text-xs" style={{ color: "#64748B" }}>
                  עמוד {page} מתוך {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1 rounded-lg text-xs disabled:opacity-30 transition-colors"
                    style={{ background: "#1E1E2E", color: "#94A3B8" }}
                  >
                    הקודם
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1 rounded-lg text-xs disabled:opacity-30 transition-colors"
                    style={{ background: "#1E1E2E", color: "#94A3B8" }}
                  >
                    הבא
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
