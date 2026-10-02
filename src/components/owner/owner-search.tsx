"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Building2, User } from "lucide-react";
import { fetchJSON, cn } from "@/lib/utils";
import { TIER_LABELS } from "@/lib/platform-labels";

interface SearchResults {
  businesses: { id: string; name: string; tier: string; status: string }[];
  users: { id: string; name: string | null; email: string; isActive: boolean }[];
}

/** Global search in the platform panel header — businesses and users. */
export function OwnerSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data, isFetching } = useQuery<SearchResults>({
    queryKey: ["owner", "search", debounced],
    queryFn: () => fetchJSON(`/api/owner/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 2,
  });

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const hasResults = !!data && (data.businesses.length > 0 || data.users.length > 0);

  return (
    <div ref={boxRef} className="relative flex-1 max-w-md">
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="חיפוש עסק, משתמש, אימייל או טלפון..."
        aria-label="חיפוש בפאנל הניהול"
        className="w-full h-9 pr-9 pl-3 rounded-xl bg-slate-100 border border-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-orange-300 focus:outline-none transition-colors"
      />

      {open && debounced.length >= 2 && (
        <div className="absolute top-full mt-1 inset-x-0 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden z-40">
          {!data && isFetching ? (
            <div className="px-4 py-3 text-sm text-slate-400">מחפש...</div>
          ) : !hasResults ? (
            <div className="px-4 py-3 text-sm text-slate-500">לא נמצאו תוצאות</div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto py-1">
              {data!.businesses.length > 0 && (
                <div className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">עסקים</div>
              )}
              {data!.businesses.map((b) => (
                <button
                  key={b.id}
                  onClick={() => go(`/owner/tenants/${b.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-right hover:bg-slate-50"
                >
                  <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-800">{b.name}</span>
                  <span className={cn("text-xs flex-shrink-0", b.status === "active" ? "text-slate-400" : "text-red-500")}>
                    {b.status === "active" ? TIER_LABELS[b.tier] ?? b.tier : "מושהה"}
                  </span>
                </button>
              ))}
              {data!.users.length > 0 && (
                <div className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">משתמשים</div>
              )}
              {data!.users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => go(`/owner/users/${u.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-right hover:bg-slate-50"
                >
                  <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800">{u.name || u.email}</span>
                    <span className="block truncate text-xs text-slate-400" dir="ltr">{u.email}</span>
                  </span>
                  {!u.isActive && <span className="text-xs text-red-500 flex-shrink-0">חסום</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
